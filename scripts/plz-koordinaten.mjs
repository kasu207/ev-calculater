/**
 * Erzeugt data/plz-koordinaten.json - die Zuordnung von Postleitzahl zu
 * geografischem Mittelpunkt. Gebraucht wird sie, um für eine Postleitzahl den
 * Umkreis bei Tankerkönig abzufragen, ohne dafür einen externen Geocoder
 * aufzurufen.
 *
 * Quelle: GeoNames (geonames.org), Lizenz CC BY 4.0, bezogen über die
 * aufbereitete Fassung im Repository zauberware/postal-codes-json-xml-csv.
 * Mehrere Einträge zur selben Postleitzahl werden zu ihrem Mittelwert
 * zusammengefasst und auf vier Nachkommastellen gerundet (rund 11 Meter).
 *
 * Aufruf: npm run data:plz
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = 'https://raw.githubusercontent.com/zauberware/postal-codes-json-xml-csv/master/data/DE.zip';
const ZIEL = path.join(ROOT, 'data', 'plz-koordinaten.json');

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'plz-'));
const zip = path.join(tmp, 'DE.zip');

console.log(`Lade ${QUELLE}`);
await run('curl', ['-sSL', '--max-time', '120', '-o', zip, QUELLE]);
await run('unzip', ['-o', '-q', zip, '-d', tmp]);

const roh = JSON.parse(await fs.readFile(path.join(tmp, 'zipcodes.de.json'), 'utf8'));

const summen = new Map();
for (const eintrag of roh) {
  const plz = String(eintrag.zipcode || '').trim();
  const lat = Number(eintrag.latitude);
  const lng = Number(eintrag.longitude);
  if (!/^\d{5}$/.test(plz) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const bisher = summen.get(plz) || { lat: 0, lng: 0, n: 0 };
  summen.set(plz, { lat: bisher.lat + lat, lng: bisher.lng + lng, n: bisher.n + 1 });
}

const koordinaten = {};
for (const plz of [...summen.keys()].sort()) {
  const { lat, lng, n } = summen.get(plz);
  koordinaten[plz] = [Number((lat / n).toFixed(4)), Number((lng / n).toFixed(4))];
}

const inhalt = {
  quelle: 'GeoNames (geonames.org)',
  lizenz: 'CC BY 4.0',
  bezogenUeber: QUELLE,
  erzeugtAm: new Date().toISOString().slice(0, 10),
  anzahl: Object.keys(koordinaten).length,
  koordinaten,
};

await fs.writeFile(ZIEL, `${JSON.stringify(inhalt)}\n`, 'utf8');
await fs.rm(tmp, { recursive: true, force: true });
console.log(`${inhalt.anzahl} Postleitzahlen nach ${path.relative(ROOT, ZIEL)} geschrieben`);
