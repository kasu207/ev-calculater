/**
 * Postleitzahl zu Koordinate.
 *
 * Die Tabelle liegt als Datei bei (data/plz-koordinaten.json, erzeugt von
 * scripts/plz-koordinaten.mjs aus GeoNames-Daten, CC BY 4.0). Damit braucht
 * die Anwendung keinen externen Geocoder: die Auflösung geschieht im eigenen
 * Prozess, und es verlässt nichts den Server, was nicht ohnehin für die
 * Preisabfrage gebraucht wird.
 */

import fs from 'node:fs/promises';

const EMPTY = { count: 0, coordinates: {}, source: null, generatedAt: null };

export async function loadPostalTable(path) {
  try {
    const parsed = JSON.parse(await fs.readFile(path, 'utf8'));
    const coordinates = parsed?.koordinaten;
    if (!coordinates || typeof coordinates !== 'object') return EMPTY;
    return {
      count: Object.keys(coordinates).length,
      coordinates,
      source: parsed.quelle || null,
      licence: parsed.lizenz || null,
      generatedAt: parsed.erzeugtAm || null,
    };
  } catch {
    // Ohne Tabelle bleibt die Vorgaberegion des Betreibers - kein Grund,
    // den Dienst nicht zu starten.
    return EMPTY;
  }
}

export function normalisePostalCode(value) {
  const code = String(value ?? '').trim();
  return /^\d{5}$/.test(code) ? code : null;
}

export function lookupPostalCode(table, value) {
  const code = normalisePostalCode(value);
  if (!code) return null;
  const entry = table?.coordinates?.[code];
  if (!Array.isArray(entry) || entry.length !== 2) return null;
  return { postalCode: code, lat: entry[0], lng: entry[1] };
}
