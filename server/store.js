/**
 * Ablage für Anfragen und Trichter-Ereignisse.
 *
 * Bewusst zwei Dateien im JSON-Lines-Format statt einer Datenbank. Bei den
 * Mengen, um die es hier zunächst geht, ist eine Datenbank reiner
 * Betriebsaufwand: eine Zeile anhängen ist atomar genug, die Datei lässt sich
 * mit grep auswerten und mit cp sichern. Wenn das Volumen das überholt, ist
 * das ein gutes Problem - dann wird migriert.
 *
 * Datenschutz ist hier kein Anhang, sondern Vorbedingung:
 * - IP-Adressen werden nie gespeichert, nur ein täglich wechselnder Hash
 *   im Arbeitsspeicher, ausschließlich zur Begrenzung von Missbrauch.
 * - Ereignisse enthalten keine Kennung, die einen Menschen identifiziert.
 * - Eine E-Mail-Adresse wird nur mit ausdrücklicher Einwilligung gespeichert
 *   und bleibt bis zur Bestätigung im Status "pending".
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

/** Tagesschlüssel für die IP-Pseudonymisierung. Wechselt automatisch. */
const IP_SALT = crypto.randomBytes(32);
const hashIp = (ip) =>
  crypto
    .createHash('sha256')
    .update(IP_SALT)
    .update(new Date().toISOString().slice(0, 10))
    .update(String(ip || ''))
    .digest('hex')
    .slice(0, 16);

async function ensureDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function append(file, record) {
  await ensureDir();
  await fsp.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/* ------------------------------------------------------- Ratenbegrenzung */

const buckets = new Map();

/**
 * Einfaches Schiebefenster im Arbeitsspeicher. Überlebt keinen Neustart und
 * ersetzt keinen Schutz vor verteilten Angriffen - es hält lediglich
 * versehentliche Schleifen und plumpes Formular-Spam draußen.
 */
export function rateLimit(ip, { limit = 20, windowMs = 60_000, key = 'default' } = {}) {
  const id = `${key}:${hashIp(ip)}`;
  const now = Date.now();
  const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(id, hits);

  // Gelegentliches Aufräumen, damit die Map nicht unbegrenzt wächst.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return hits.length <= limit;
}

/* --------------------------------------------------------------- Anfragen */

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);
}

/**
 * Speichert eine Anfrage als unbestätigt. Verschickt wird nichts, bevor die
 * Adresse bestätigt ist - das ist in Deutschland nicht optional, und es hält
 * die Liste sauber.
 */
export async function saveLead({ email, consent, purpose, vehicleId, share, note, ip, userAgent }) {
  if (!isValidEmail(email)) throw Object.assign(new Error('Bitte eine gültige E-Mail-Adresse angeben.'), { status: 400 });
  if (consent !== true) throw Object.assign(new Error('Ohne Einwilligung können wir nichts senden.'), { status: 400 });

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    email: String(email).trim().toLowerCase(),
    purpose: ['result', 'dealer', 'updates'].includes(purpose) ? purpose : 'result',
    vehicleId: typeof vehicleId === 'string' ? vehicleId.slice(0, 40) : null,
    // Der kodierte Rechenzustand, damit die spätere Mail das Ergebnis enthält.
    share: typeof share === 'string' ? share.slice(0, 2000) : null,
    note: typeof note === 'string' ? note.slice(0, 500) : null,
    status: 'pending',
    confirmToken: crypto.randomBytes(24).toString('base64url'),
    confirmedAt: null,
    // Nur zur Missbrauchsabwehr, pseudonymisiert und tagesrollierend.
    ipHash: hashIp(ip),
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 200) : null,
  };

  await append(LEADS_FILE, record);
  return record;
}

/**
 * Bestätigt eine Anfrage. Die Datei wird neu geschrieben statt fortgeschrieben,
 * weil eine Bestätigung selten ist und die Datei klein bleibt.
 */
export async function confirmLead(token) {
  if (!token || typeof token !== 'string') return null;
  const leads = readLines(LEADS_FILE);
  const index = leads.findIndex((l) => l.confirmToken === token);
  if (index === -1) return null;
  if (leads[index].status === 'confirmed') return leads[index];

  leads[index] = { ...leads[index], status: 'confirmed', confirmedAt: new Date().toISOString() };
  await ensureDir();
  await fsp.writeFile(LEADS_FILE, `${leads.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  return leads[index];
}

export function listLeads() {
  return readLines(LEADS_FILE);
}

/* ------------------------------------------------------------ Ereignisse */

const ALLOWED_EVENTS = new Set([
  'view',
  'step',
  'result',
  'vehicle_select',
  'lever_view',
  'partner_click',
  'lead_open',
  'lead_submit',
  'share',
  'inquiry_copy',
]);

/**
 * Cookielose Messung. Ohne diese Zahlen ist jede Optimierung geraten: an
 * welchem Schritt bricht der Trichter ein, welcher Hinweis wird geklickt.
 * Gespeichert wird nur, was zur Beantwortung genau dieser Frage nötig ist.
 */
export async function saveEvent({ name, props, ip }) {
  if (!ALLOWED_EVENTS.has(name)) return null;
  const record = {
    ts: new Date().toISOString(),
    name,
    // Nur flache Werte, auf Länge begrenzt - hier landet nichts Freies.
    props: Object.fromEntries(
      Object.entries(props || {})
        .slice(0, 8)
        .map(([k, v]) => [String(k).slice(0, 24), String(v).slice(0, 64)]),
    ),
    day: new Date().toISOString().slice(0, 10),
    visitor: hashIp(ip),
  };
  await append(EVENTS_FILE, record);
  return record;
}

export function listEvents() {
  return readLines(EVENTS_FILE);
}

/* ----------------------------------------------------------- Auswertung */

/**
 * Verdichtet Ereignisse und Anfragen zum Trichter. Die Quoten sind das
 * eigentliche Steuerungsinstrument: wo fällt der größte Anteil weg.
 */
export function funnel(days = 30) {
  const since = Date.now() - days * 86_400_000;
  const events = listEvents().filter((e) => new Date(e.ts).getTime() >= since);
  const leads = listLeads().filter((l) => new Date(l.createdAt).getTime() >= since);

  const count = (name) => events.filter((e) => e.name === name).length;
  const unique = (name) => new Set(events.filter((e) => e.name === name).map((e) => e.visitor)).size;

  const partnerClicks = {};
  for (const e of events) {
    if (e.name !== 'partner_click') continue;
    const id = e.props?.partner || 'unbekannt';
    partnerClicks[id] = (partnerClicks[id] || 0) + 1;
  }

  const byDay = {};
  for (const e of events) {
    if (e.name !== 'view') continue;
    byDay[e.day] = (byDay[e.day] || 0) + 1;
  }

  const visitors = unique('view');
  const results = unique('result');
  const rate = (a, b) => (b > 0 ? a / b : 0);

  return {
    days,
    visitors,
    views: count('view'),
    results,
    leadOpens: unique('lead_open'),
    leads: leads.length,
    leadsConfirmed: leads.filter((l) => l.status === 'confirmed').length,
    dealerLeads: leads.filter((l) => l.purpose === 'dealer').length,
    partnerClicks,
    partnerClickTotal: count('partner_click'),
    shares: count('share'),
    inquiryCopies: count('inquiry_copy'),
    rates: {
      resultFromVisit: rate(results, visitors),
      leadFromResult: rate(leads.length, results),
      partnerClickFromResult: rate(count('partner_click'), results),
    },
    byDay,
  };
}

export const paths = { DATA_DIR, LEADS_FILE, EVENTS_FILE };
