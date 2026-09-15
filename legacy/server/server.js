/**
 * Minimaler HTTP-Server ohne externe Abhängigkeiten.
 * Liefert das Frontend aus /public und stellt die Rechen-API bereit.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaults, withDefaults } from '../shared/defaults.js';
import { vehicles, vehicleById, BODY_LABELS, DATA_VINTAGE } from '../shared/vehicles.js';
import { compareVehicle } from '../shared/calc.js';
import { recommend, evaluateVehicle } from '../shared/match.js';
import { buildOffers, buildInquiryText } from '../shared/offers.js';
import { buildLevers } from '../shared/levers.js';
import { activePartnersFor } from '../shared/partners.js';
import { KM_PROFILES } from '../shared/seo.js';
import {
  renderVehiclePage,
  renderVehicleIndex,
  renderKmProfilePage,
  renderResultPage,
  renderSitemap,
  renderRobots,
} from './pages.js';
import { saveLead, confirmLead, saveEvent, rateLimit } from './store.js';
import { confirmMail, deliver } from './notify.js';
import { isAuthorized, renderAdmin } from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SHARED_DIR = path.join(ROOT, 'shared');
// Absolute Basis fuer Links in gerenderten Seiten, Sitemap und Bestaetigungsmail.
const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 256 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Anfrage zu groß'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Ungültiges JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** Verdichtet ein Bewertungsergebnis auf das, was das Frontend braucht. */
function serializeEvaluation(result) {
  return {
    vehicle: result.vehicle,
    label: result.label,
    score: result.score,
    parts: result.parts,
    eligible: result.eligible,
    blockers: result.blockers,
    warnings: result.warnings,
    highlights: result.highlights,
    realRangeKm: result.realRangeKm,
    fastChargeMinutes: result.fastChargeMinutes,
    comparison: result.comparison,
  };
}

const routes = {
  /**
   * Lebenszeichen für Container-Healthchecks und Reverse Proxies.
   * Bewusst billig: keine Berechnung, nur ein Beleg, dass der Prozess
   * Anfragen beantwortet und die Fahrzeugdaten geladen sind.
   */
  'GET /api/health': async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    vehicleCount: vehicles.length,
  }),

  'GET /api/meta': async () => ({
    defaults,
    bodyLabels: BODY_LABELS,
    dataVintage: DATA_VINTAGE,
    vehicleCount: vehicles.length,
  }),

  'GET /api/vehicles': async () => ({ vehicles, bodyLabels: BODY_LABELS }),

  'POST /api/recommend': async (body) => {
    const input = withDefaults(body.input || {});
    const limit = Math.min(Math.max(Number(body.limit) || 6, 1), vehicles.length);
    const result = recommend(input);

    // Das jeweils andere Szenario wird mitgerechnet, damit das Frontend den
    // Unterschied zwischen "behalten" und "ohnehin neu kaufen" zeigen kann.
    const otherScenario = input.scenario === 'replace' ? 'keep' : 'replace';
    const counterInput = withDefaults({ ...input, scenario: otherScenario });
    const counterBest = result.bestMatch
      ? compareVehicle(counterInput, result.bestMatch.vehicle)
      : null;

    return {
      scenario: input.scenario,
      requiredRangeKm: result.requiredRangeKm,
      bestMatch: result.bestMatch ? serializeEvaluation(result.bestMatch) : null,
      bestEconomy: result.bestEconomy ? serializeEvaluation(result.bestEconomy) : null,
      cheapestRunning: result.cheapestRunning ? serializeEvaluation(result.cheapestRunning) : null,
      ranked: result.ranked.slice(0, limit).map(serializeEvaluation),
      rejected: result.rejected.slice(0, 5).map((r) => ({
        label: r.label,
        price: r.vehicle.price,
        blockers: r.blockers,
      })),
      counterScenario: counterBest
        ? {
            scenario: otherScenario,
            vehicleId: counterBest.vehicleId,
            breakEvenYears: counterBest.breakEvenYears,
            totalAdvantage: counterBest.totalAdvantage,
          }
        : null,
    };
  },

  'POST /api/vehicle': async (body) => {
    const vehicle = vehicleById(body.vehicleId);
    if (!vehicle) throw Object.assign(new Error('Fahrzeug unbekannt'), { status: 404 });
    const input = withDefaults(body.input || {});
    const evaluation = evaluateVehicle(input, vehicle);

    // Hebel und Partner kommen in derselben Antwort, damit das Frontend fuer
    // einen Fahrzeugwechsel nur eine Anfrage stellt.
    const { levers } = buildLevers(input, vehicle);
    const partners = activePartnersFor(levers.map((l) => l.id));

    return {
      evaluation: serializeEvaluation(evaluation),
      offers: buildOffers(input, vehicle, evaluation.comparison, body.offerOptions || {}),
      inquiryText: buildInquiryText(input, evaluation),
      levers,
      partners: partners.map((p) => ({
        id: p.id,
        leverId: p.leverId,
        label: p.label,
        provider: p.provider,
        description: p.description,
        url: p.url,
      })),
    };
  },

  /**
   * Anfrage eines Nutzers. Gespeichert wird als unbestaetigt, versendet wird
   * eine Bestaetigungsmail - erst deren Klick macht die Adresse nutzbar.
   */
  'POST /api/lead': async (body, ctx) => {
    if (!rateLimit(ctx.ip, { limit: 5, windowMs: 600_000, key: 'lead' })) {
      throw Object.assign(new Error('Zu viele Anfragen. Bitte spaeter erneut versuchen.'), { status: 429 });
    }
    // Honigtopf: ein fuer Menschen unsichtbares Feld, das nur Bots ausfuellen.
    if (body.website) return { ok: true };

    const lead = await saveLead({
      email: body.email,
      consent: body.consent === true,
      purpose: body.purpose,
      vehicleId: body.vehicleId,
      share: body.share,
      note: body.note,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    const delivery = await deliver(confirmMail(lead, SITE_URL));
    return {
      ok: true,
      status: lead.status,
      mailSent: delivery.delivered,
      message: 'Fast geschafft: Bitte bestaetigen Sie den Link in der E-Mail.',
    };
  },

  /** Cookielose Trichtermessung. Fehler hier duerfen nie die Seite stoeren. */
  'POST /api/event': async (body, ctx) => {
    if (!rateLimit(ctx.ip, { limit: 120, windowMs: 60_000, key: 'event' })) return { ok: false };
    await saveEvent({ name: body.name, props: body.props, ip: ctx.ip });
    return { ok: true };
  },
};

/**
 * Kontext einer Anfrage. Die IP wird ausschliesslich zur Ratenbegrenzung und
 * Pseudonymisierung durchgereicht und nirgends im Klartext gespeichert.
 * X-Forwarded-For wird nur beruecksichtigt, wenn TRUST_PROXY gesetzt ist -
 * ungeprueft koennte sich sonst jeder Client eine beliebige IP ausdenken.
 */
function requestContext(req) {
  const forwarded = process.env.TRUST_PROXY
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : '';
  return {
    ip: forwarded || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  };
}

function sendHtml(res, status, html, { cache = 'public, max-age=900' } = {}) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': body.length,
    'cache-control': cache,
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, { 'content-type': type, 'content-length': body.length });
  res.end(body);
}

/**
 * Serverseitig gerenderte Seiten. Sie sind der Grund, warum das Projekt
 * ueberhaupt gefunden werden kann: der Rechner selbst ist eine einzige URL,
 * die eine Suchmaschine leer sieht.
 *
 * Rueckgabe true bedeutet: beantwortet, kein statisches Ausliefern noetig.
 */
async function servePage(req, res, url) {
  const p = url.pathname;

  if (p === '/robots.txt') {
    sendText(res, 200, renderRobots(SITE_URL));
    return true;
  }
  if (p === '/sitemap.xml') {
    sendText(res, 200, renderSitemap(SITE_URL), 'application/xml; charset=utf-8');
    return true;
  }
  if (p === '/e-auto' || p === '/e-auto/') {
    sendHtml(res, 200, renderVehicleIndex(SITE_URL));
    return true;
  }

  const vehicleMatch = /^\/e-auto\/([a-z0-9-]{1,40})\/?$/.exec(p);
  if (vehicleMatch) {
    const html = renderVehiclePage(vehicleMatch[1], SITE_URL);
    if (!html) return false;
    sendHtml(res, 200, html);
    return true;
  }

  const kmMatch = /^\/fahrprofil\/(\d{1,6})-km\/?$/.exec(p);
  if (kmMatch) {
    const html = renderKmProfilePage(Number(kmMatch[1]), SITE_URL);
    if (!html) return false;
    sendHtml(res, 200, html);
    return true;
  }

  const resultMatch = /^\/ergebnis(?:\/([A-Za-z0-9._~-]{0,600}))?\/?$/.exec(p);
  if (resultMatch) {
    // Geteilte Ergebnisse sind personenbezogen genug, um sie nicht in
    // Zwischenspeichern von Proxys liegen zu lassen.
    sendHtml(res, 200, renderResultPage(resultMatch[1] || '', SITE_URL), { cache: 'no-store' });
    return true;
  }

  if (p === '/bestaetigen') {
    const lead = await confirmLead(url.searchParams.get('token'));
    sendHtml(
      res,
      lead ? 200 : 404,
      confirmationPage(lead),
      { cache: 'no-store' },
    );
    return true;
  }

  if (p === '/admin') {
    if (!isAuthorized(url.searchParams.get('token'))) {
      // Bewusst dieselbe Antwort wie fuer eine unbekannte Seite: ohne gueltiges
      // Token soll gar nicht erkennbar sein, dass es hier etwas gibt.
      sendText(res, 404, 'Nicht gefunden');
      return true;
    }
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
    sendHtml(res, 200, renderAdmin(days), { cache: 'no-store' });
    return true;
  }

  return false;
}

function confirmationPage(lead) {
  const ok = Boolean(lead);
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${ok ? 'Adresse bestätigt' : 'Link nicht gültig'}</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body class="page"><main class="page__main"><article class="article">
<h1>${ok ? 'Danke, das hat geklappt' : 'Dieser Link ist nicht mehr gültig'}</h1>
<p class="lead">${
    ok
      ? 'Ihre E-Mail-Adresse ist bestätigt. Sie können den Widerruf jederzeit per formloser Nachricht erklären.'
      : 'Der Bestätigungslink ist unbekannt oder wurde bereits verwendet. Fordern Sie ihn im Rechner einfach erneut an.'
  }</p>
<p><a class="btn btn--primary" href="/">Zurück zum Rechner</a></p>
</article></main></body></html>`;
}

async function serveStatic(req, res, urlPath) {
  // Module aus /shared laufen sowohl im Server als auch im Browser. Damit der
  // Browser sie laden kann, wird dieses eine Verzeichnis mit ausgeliefert.
  const isShared = urlPath.startsWith('/shared/');
  const baseDir = isShared ? SHARED_DIR : PUBLIC_DIR;
  const rel = urlPath === '/'
    ? 'index.html'
    : decodeURIComponent(isShared ? urlPath.slice('/shared/'.length) : urlPath).replace(/^\/+/, '');
  const target = path.resolve(baseDir, rel);
  if (target !== baseDir && !target.startsWith(baseDir + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const key = `${req.method} ${url.pathname}`;

  if (url.pathname.startsWith('/api/')) {
    const handler = routes[key];
    if (!handler) return sendJson(res, 404, { error: 'Unbekannter Endpunkt' });
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      sendJson(res, 200, await handler(body, requestContext(req)));
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      sendJson(res, status, { error: err.message || 'Serverfehler' });
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  try {
    if (await servePage(req, res, url)) return;
  } catch (err) {
    console.error(err);
    sendText(res, 500, 'Serverfehler');
    return;
  }

  await serveStatic(req, res, url.pathname);
});

/**
 * Geordnetes Herunterfahren. Ohne das würde der Prozess im Container das
 * SIGTERM von `docker compose down` ignorieren und erst nach dem Timeout
 * hart abgeräumt - das kostet bei jedem Neustart unnötig Sekunden.
 */
export function shutdown(signal) {
  console.log(`${signal} empfangen, Server wird beendet.`);
  server.close(() => process.exit(0));
  // Notbremse, falls eine Verbindung nicht freigibt.
  setTimeout(() => process.exit(0), 10000).unref();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(PORT, HOST, () => {
    console.log(`E-Auto-Rechner läuft auf http://${HOST}:${PORT}`);
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => shutdown(signal));
  }
}
