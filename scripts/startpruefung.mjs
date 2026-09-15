#!/usr/bin/env node
/**
 * Prueft, was vor dem ersten oeffentlichen Aufruf stehen muss:
 * alle Partnerlinks von Hand geoeffnet, alle Pflichtangaben gesetzt.
 *
 *   node scripts/startpruefung.mjs               streng, faellt bei Luecken durch
 *   node scripts/startpruefung.mjs --nur-bericht  meldet nur, faellt nie durch
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const fahrzeuge = JSON.parse(
  readFileSync(join(wurzel, 'packages/core/src/daten/fahrzeuge.json'), 'utf8'),
);

const nurBericht = process.argv.includes('--nur-bericht');
const luecken = [];

const ungeprueft = fahrzeuge.filter((f) => !f.partnerUrlGeprueft);
console.log(`Partnerlinks: ${fahrzeuge.length - ungeprueft.length} von ${fahrzeuge.length} geprüft.`);
for (const f of ungeprueft) {
  console.log(`  offen: ${f.id} -> ${f.partnerUrl}`);
}
if (ungeprueft.length > 0) {
  luecken.push(`${ungeprueft.length} Partnerlinks sind nicht als geprüft markiert.`);
}

const pflicht = [
  'AMPMATCH_BASIS_URL',
  'AMPMATCH_UMAMI_SKRIPT_URL',
  'AMPMATCH_UMAMI_WEBSITE_ID',
  'AMPMATCH_FLEXOFFERS_DEEPLINK_BASIS',
  'AMPMATCH_BETREIBER_NAME',
  'AMPMATCH_BETREIBER_ANSCHRIFT',
  'AMPMATCH_BETREIBER_EMAIL',
];
const fehlend = pflicht.filter((name) => !process.env[name]?.trim());
if (fehlend.length > 0) {
  console.log(`Nicht gesetzte Variablen: ${fehlend.join(', ')}`);
  luecken.push(`${fehlend.length} Pflichtvariablen fehlen.`);
}

if (luecken.length === 0) {
  console.log('Alles gesetzt. Die Seite darf öffentlich gehen.');
  process.exit(0);
}

console.log('');
for (const luecke of luecken) console.log(`offen: ${luecke}`);
process.exit(nurBericht ? 0 : 1);
