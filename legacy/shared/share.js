/**
 * Teilbare Ergebnis-URLs.
 *
 * Ein Ergebnis, das man verschicken kann, ist die einzige Verbreitung, die
 * nichts kostet. Deshalb wird der Eingabezustand in die URL kodiert statt in
 * eine Datenbank: kein Speicher, keine IDs, keine personenbezogenen Daten -
 * und der Server kann dieselbe URL serverseitig rendern, sodass sie in
 * Messengern eine Vorschau bekommt und von Suchmaschinen gelesen wird.
 *
 * Kodiert werden nur Werte, die von der Vorgabe abweichen. Ein Nutzer, der
 * nichts anfasst, bekommt eine kurze URL; ein Nutzer, der alles anfasst,
 * bekommt eine laengere. Die Kuerzel sind fest vergeben und duerfen nicht
 * mehr geaendert werden, sonst verfallen geteilte Links.
 */

import { defaults, withDefaults } from './defaults.js';

/** Pfad im Eingabeobjekt -> Kuerzel in der URL. Nur anhaengen, nie aendern. */
export const CODES = {
  scenario: 'sc',
  'profile.kmPerYear': 'km',
  'profile.horizonYears': 'hy',
  'profile.longestTripKm': 'lt',
  'profile.longTripsPerYear': 'lp',
  'current.fuelType': 'ft',
  'current.resaleValue': 'rv',
  'current.consumptionL100': 'cl',
  'current.fuelPrice': 'fp',
  'current.insurance': 'ci',
  'current.tax': 'ct',
  'current.maintenance': 'cm',
  'current.otherCosts': 'co',
  'current.depreciationRate': 'cd',
  'replacement.price': 'rp',
  'replacement.consumptionL100': 'rc',
  'replacement.insurance': 'ri',
  'replacement.tax': 'rt',
  'replacement.maintenance': 'rm',
  'replacement.depreciationRate': 'rd',
  'prices.fuelGrowth': 'fg',
  'prices.electricityGrowth': 'eg',
  'ev.homeChargeShare': 'hc',
  'ev.homePrice': 'hp',
  'ev.publicPrice': 'pp',
  'ev.chargingLossPct': 'cp',
  'ev.insuranceFactor': 'if',
  'ev.tax': 'et',
  'ev.maintenanceFactor': 'mf',
  'ev.wallboxCost': 'wb',
  'ev.subsidy': 'sb',
  'ev.thgBonus': 'tb',
  'ev.depreciationRate': 'ed',
  'ev.capitalCostRate': 'cc',
  'needs.budget': 'bu',
  'needs.seats': 'se',
  'needs.towing': 'tw',
  'needs.minRangeKm': 'mr',
  'needs.minBootLiters': 'mb',
  'needs.fastChargeImportant': 'fc',
};

const BY_CODE = Object.fromEntries(Object.entries(CODES).map(([path, code]) => [code, path]));

/** Karosseriewuensche als Mehrfachauswahl, deshalb eigener Kuerzel-Satz. */
const BODY_CODES = { kleinwagen: 'k', kompakt: 'o', limousine: 'l', kombi: 'w', suv: 's', van: 'v' };
const BODY_BY_CODE = Object.fromEntries(Object.entries(BODY_CODES).map(([k, v]) => [v, k]));

const get = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let cur = obj;
  for (const key of keys) cur = cur[key] ?? (cur[key] = {});
  cur[last] = value;
}

/** Zahlen ohne unnoetige Nachkommastellen, damit die URL kurz bleibt. */
function encodeValue(value) {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(Math.round(value * 10000) / 10000);
  return String(value);
}

function decodeValue(raw, reference) {
  if (typeof reference === 'boolean') return raw === '1';
  if (typeof reference === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : reference;
  }
  return raw;
}

/**
 * Erzeugt den kompakten Abfrageparameter. Rueckgabe ist ein leerer String,
 * wenn nichts von der Vorgabe abweicht - dann braucht die URL keinen Parameter.
 */
export function encodeInput(rawInput, vehicleId = null) {
  const input = withDefaults(rawInput);
  const parts = [];

  for (const [path, code] of Object.entries(CODES)) {
    const value = get(input, path);
    const fallback = get(defaults, path);
    if (value === undefined || value === null) continue;
    if (encodeValue(value) === encodeValue(fallback)) continue;
    parts.push(`${code}${encodeValue(value)}`);
  }

  const bodies = input.needs?.bodyPreference || [];
  if (bodies.length) {
    parts.push(`bp${bodies.map((b) => BODY_CODES[b] || '').join('')}`);
  }
  if (vehicleId) parts.push(`id${vehicleId}`);

  return parts.join('_');
}

/** Gegenstueck zu encodeInput. Unbekannte Kuerzel werden still ignoriert. */
export function decodeInput(encoded) {
  const input = withDefaults({});
  let vehicleId = null;
  if (!encoded || typeof encoded !== 'string') return { input, vehicleId };

  for (const part of encoded.split('_')) {
    if (!part) continue;
    const code = part.slice(0, 2);
    const raw = part.slice(2);

    if (code === 'id') {
      // Nur ein enger Zeichensatz, damit hier nichts Fremdes durchrutscht.
      if (/^[a-z0-9-]{1,40}$/.test(raw)) vehicleId = raw;
      continue;
    }
    if (code === 'bp') {
      input.needs.bodyPreference = raw
        .split('')
        .map((c) => BODY_BY_CODE[c])
        .filter(Boolean);
      continue;
    }

    const path = BY_CODE[code];
    if (!path) continue;
    set(input, path, decodeValue(raw, get(defaults, path)));
  }

  return { input: withDefaults(input), vehicleId };
}

/** Pfad der teilbaren Seite zu einem Zustand. */
export function shareUrlPath(rawInput, vehicleId = null) {
  const encoded = encodeInput(rawInput, vehicleId);
  return encoded ? `/ergebnis/${encoded}` : '/ergebnis';
}
