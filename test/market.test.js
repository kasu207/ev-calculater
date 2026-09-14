import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStore, resolve } from '../server/market/cache.js';
import { parseStationList, median } from '../server/market/tankerkoenig.js';
import { parseSpotPrices, dayInBerlin } from '../server/market/energycharts.js';
import { lookupPostalCode, normalisePostalCode, loadPostalTable } from '../server/market/plz.js';
import { createMarketService } from '../server/market/index.js';
import { createVehicleStore } from '../server/market/vehicles.js';
import { validateVehicleList } from '../shared/vehicle-schema.js';
import { vehicles } from '../shared/vehicles.js';

/* --------------------------------------------------------------- Kraftstoff */

test('Median ist robust gegen einzelne Ausreißer', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('Tankstellenliste wird je Sorte ausgewertet', () => {
  const parsed = parseStationList({
    ok: true,
    license: 'CC BY 4.0 - Tankerkönig',
    stations: [
      { id: 'a', e5: 1.729, e10: 1.669, diesel: 1.649 },
      { id: 'b', e5: 1.759, e10: 1.699, diesel: 1.679 },
      // Autobahnpreis: zieht den Mittelwert hoch, den Median nicht.
      { id: 'c', e5: 2.199, e10: 2.139, diesel: 2.099 },
    ],
  });
  assert.equal(parsed.prices.e5, 1.759);
  assert.equal(parsed.stations, 3);
  assert.equal(parsed.counts.diesel, 3);
  assert.equal(parsed.licence, 'CC BY 4.0 - Tankerkönig');
});

test('Nicht gemeldete Preise werden übersprungen, nicht als Null gezählt', () => {
  const parsed = parseStationList({
    ok: true,
    stations: [
      { id: 'a', e5: false, e10: 1.669, diesel: 1.649 },
      { id: 'b', e5: 1.759, e10: null, diesel: 0 },
    ],
  });
  assert.equal(parsed.prices.e5, 1.759);
  assert.equal(parsed.counts.e5, 1);
  assert.equal(parsed.prices.diesel, 1.649);
  assert.equal(parsed.counts.diesel, 1);
});

test('Abgelehnte Abfragen werfen mit der Begründung der Quelle', () => {
  assert.throws(
    () => parseStationList({ ok: false, message: 'apikey nicht gültig' }),
    /apikey nicht gültig/,
  );
  assert.throws(() => parseStationList(null), /Unerwartete Antwort/);
});

test('Ohne Tankstellen im Umkreis gibt es keine Preise, aber auch keinen Fehler', () => {
  const parsed = parseStationList({ ok: true, stations: [] });
  assert.equal(parsed.prices.e5, null);
  assert.equal(parsed.stations, 0);
});

/* -------------------------------------------------------------------- Strom */

test('Börsenpreise werden von EUR/MWh in EUR/kWh umgerechnet', () => {
  const day = '2026-09-14';
  const noon = Math.floor(new Date(`${day}T12:00:00+02:00`).getTime() / 1000);
  const parsed = parseSpotPrices(
    {
      unix_seconds: [noon, noon + 3600, noon + 7200],
      price: [80, 120, 100],
      unit: 'EUR / MWh',
    },
    { today: dayInBerlin(noon) },
  );
  assert.equal(parsed.mean, 0.1);
  assert.equal(parsed.min, 0.08);
  assert.equal(parsed.max, 0.12);
  assert.equal(parsed.hours, 3);
  assert.equal(parsed.partialDay, false);
});

test('Liegen für heute keine Werte vor, zählt der gelieferte Zeitraum', () => {
  const past = Math.floor(new Date('2026-09-13T12:00:00+02:00').getTime() / 1000);
  const parsed = parseSpotPrices(
    { unix_seconds: [past], price: [90] },
    { today: '2026-09-14' },
  );
  assert.equal(parsed.partialDay, true);
  assert.equal(parsed.mean, 0.09);
});

test('Unbrauchbare Antworten werden abgewiesen', () => {
  assert.throws(() => parseSpotPrices({ unix_seconds: [1], price: [] }), /Unerwartete Antwort/);
  assert.throws(() => parseSpotPrices({}), /Unerwartete Antwort/);
});

/* ---------------------------------------------------------- Zwischenspeicher */

test('Ein frischer Wert wird nicht erneut abgerufen', async () => {
  let calls = 0;
  const store = createStore({ ttlMs: 1000, minIntervalMs: 0 });
  const load = async () => {
    calls += 1;
    return calls;
  };
  assert.equal((await resolve(store, 'k', load)).value, 1);
  assert.equal((await resolve(store, 'k', load)).value, 1);
  assert.equal(calls, 1);
});

test('Der Mindestabstand bremst den nächsten Abruf', async () => {
  let now = 0;
  const store = createStore({ ttlMs: 10, minIntervalMs: 5000, now: () => now });
  await resolve(store, 'k', async () => 'alt');
  now = 1000; // Wert verfallen, Mindestabstand aber nicht erreicht
  const result = await resolve(store, 'k', async () => 'neu');
  assert.equal(result.value, 'alt');
  assert.equal(result.stale, true);
  assert.match(result.note, /Mindestabstand/);

  now = 7000;
  assert.equal((await resolve(store, 'k', async () => 'neu')).value, 'neu');
});

test('Fällt die Quelle aus, bleibt der letzte Erfolg gültig', async () => {
  let now = 0;
  const store = createStore({ ttlMs: 10, minIntervalMs: 0, now: () => now });
  await resolve(store, 'k', async () => 1.75);
  now = 100;
  const result = await resolve(store, 'k', async () => {
    throw new Error('HTTP 503');
  });
  assert.equal(result.value, 1.75);
  assert.equal(result.stale, true);
  assert.match(result.note, /503/);
});

test('Ohne vorherigen Erfolg liefert ein Ausfall null', async () => {
  const store = createStore({ ttlMs: 10, minIntervalMs: 0 });
  const result = await resolve(store, 'k', async () => {
    throw new Error('kaputt');
  });
  assert.equal(result, null);
});

/* --------------------------------------------------------------- Postleitzahl */

test('Postleitzahlen werden geprüft und aufgelöst', async () => {
  const table = await loadPostalTable(new URL('../data/plz-koordinaten.json', import.meta.url).pathname);
  assert.ok(table.count > 8000, `nur ${table.count} Einträge`);

  assert.equal(normalisePostalCode(' 10115 '), '10115');
  assert.equal(normalisePostalCode('1011'), null);
  assert.equal(normalisePostalCode('abcde'), null);

  const berlin = lookupPostalCode(table, '10115');
  assert.ok(berlin.lat > 52 && berlin.lat < 53, `lat ${berlin?.lat}`);
  assert.ok(berlin.lng > 13 && berlin.lng < 14, `lng ${berlin?.lng}`);
  assert.equal(lookupPostalCode(table, '00000'), null);
});

test('Ohne Tabelle bleibt die Anwendung startfähig', async () => {
  const table = await loadPostalTable('/gibt/es/nicht.json');
  assert.equal(table.count, 0);
  assert.equal(lookupPostalCode(table, '10115'), null);
});

/* ------------------------------------------------------------- Marktdienst */

const TABLE = {
  coordinates: { 10115: [52.5323, 13.3846], 80331: [48.1345, 11.571] },
};

function stubFetch(handler) {
  return async (url) => {
    const result = handler(new URL(url));
    return { ok: true, status: 200, json: async () => result };
  };
}

test('Ohne Konfiguration geht keine einzige Anfrage nach außen', async () => {
  let calls = 0;
  const service = createMarketService({
    env: {},
    postalTable: TABLE,
    fetchImpl: async () => {
      calls += 1;
      throw new Error('darf nicht passieren');
    },
  });
  const data = await service.marketData({});
  assert.equal(calls, 0);
  assert.equal(service.enabled, false);
  assert.deepEqual(data.configured, { fuel: false, power: false });
  assert.equal(data.fuel.available, false);
});

test('Mit Schlüssel und Vorgaberegion kommen Kraftstoffpreise mit Herkunft', async () => {
  const service = createMarketService({
    env: { TANKERKOENIG_API_KEY: 'x', MARKET_POSTAL_CODE: '10115', MARKET_RADIUS_KM: '8' },
    postalTable: TABLE,
    fetchImpl: stubFetch(() => ({
      ok: true,
      stations: [{ e5: 1.72, e10: 1.66, diesel: 1.64 }, { e5: 1.74, e10: 1.68, diesel: 1.66 }],
    })),
  });
  const data = await service.marketData({});
  assert.equal(data.configured.fuel, true);
  assert.equal(data.fuel.available, true);
  assert.equal(data.fuel.prices.e5, 1.73);
  assert.equal(data.fuel.stations, 2);
  assert.equal(data.region.postalCode, '10115');
  assert.equal(data.region.source, 'default');
  assert.equal(data.region.radiusKm, 8);
  assert.match(data.fuel.provider.name, /Tankerkönig/);
  assert.ok(Date.parse(data.fuel.fetchedAt) > 0);
});

test('Eine angefragte Postleitzahl übersteuert die Vorgaberegion', async () => {
  const seen = [];
  const service = createMarketService({
    env: { TANKERKOENIG_API_KEY: 'x', MARKET_POSTAL_CODE: '10115', MARKET_MIN_INTERVAL_SECONDS: '0' },
    postalTable: TABLE,
    fetchImpl: stubFetch((url) => {
      seen.push(`${url.searchParams.get('lat')},${url.searchParams.get('lng')}`);
      return { ok: true, stations: [{ e5: 1.8, e10: 1.75, diesel: 1.7 }] };
    }),
  });
  const data = await service.marketData({ postalCode: '80331' });
  assert.equal(data.region.postalCode, '80331');
  assert.equal(data.region.source, 'request');
  assert.equal(seen[0], '48.1345,11.571');
});

test('Eine unbekannte Postleitzahl wird benannt, nicht verschluckt', async () => {
  const service = createMarketService({
    env: { TANKERKOENIG_API_KEY: 'x', MARKET_POSTAL_CODE: '10115' },
    postalTable: TABLE,
    fetchImpl: stubFetch(() => ({ ok: true, stations: [{ e5: 1.7 }] })),
  });
  const data = await service.marketData({ postalCode: '99999' });
  assert.equal(data.region.postalCode, '10115');
  assert.match(data.notes.join(' '), /99999 ist nicht bekannt/);
});

test('Der Börsenstrompreis wird nur auf Wunsch abgerufen', async () => {
  const day = dayInBerlin(Date.now() / 1000);
  const noon = Math.floor(new Date(`${day}T12:00:00+02:00`).getTime() / 1000);
  const service = createMarketService({
    env: { MARKET_POWER: 'on' },
    postalTable: TABLE,
    fetchImpl: stubFetch(() => ({ unix_seconds: [noon], price: [95] })),
  });
  const data = await service.marketData({});
  assert.equal(data.power.available, true);
  assert.equal(data.power.mean, 0.095);
  assert.equal(data.power.zone, 'DE-LU');
  assert.equal(data.fuel.available, false);
});

test('Ein Ausfall der Quelle beendet nicht die Antwort', async () => {
  const service = createMarketService({
    env: { TANKERKOENIG_API_KEY: 'x', MARKET_POSTAL_CODE: '10115' },
    postalTable: TABLE,
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    },
    logger: { warn() {} },
  });
  const data = await service.marketData({});
  assert.equal(data.fuel.available, false);
  assert.match(data.notes.join(' '), /nicht abrufbar/);
});

/* ----------------------------------------------------------- Fahrzeugquelle */

test('Fahrzeugdaten aus einer Datei werden geprüft übernommen', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ev-'));
  const file = path.join(dir, 'vehicles.json');
  const liste = vehicles.slice(0, 5).map((v) => ({ ...v, price: v.price + 500 }));
  await fs.writeFile(file, JSON.stringify({ dataVintage: 'Testabzug 2026-09', vehicles: liste }));

  const store = createVehicleStore({ file, logger: { log() {}, warn() {} } });
  await store.refresh();
  assert.equal(store.meta().source, 'file');
  assert.equal(store.meta().count, 5);
  assert.equal(store.meta().vintage, 'Testabzug 2026-09');
  assert.equal(store.byId(liste[0].id).price, vehicles[0].price + 500);
  await fs.rm(dir, { recursive: true, force: true });
});

test('Eine fehlerhafte Lieferung ändert nichts am laufenden Betrieb', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ev-'));
  const file = path.join(dir, 'vehicles.json');
  // Reichweite passt nicht zu Batterie und Verbrauch - typischer Tippfehler.
  const kaputt = [{ ...vehicles[0], rangeKm: 2250 }];
  await fs.writeFile(file, JSON.stringify(kaputt));

  const store = createVehicleStore({ file, logger: { log() {}, warn() {} } });
  await store.refresh();
  assert.equal(store.meta().source, 'snapshot');
  assert.equal(store.meta().fallback, true);
  assert.equal(store.meta().count, vehicles.length);
  assert.match(store.meta().error, /Reichweite/);
  await fs.rm(dir, { recursive: true, force: true });
});

test('Ein Feed liefert denselben Vertrag wie eine Datei', async () => {
  const store = createVehicleStore({
    url: 'https://example.invalid/vehicles.json',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ vehicles: vehicles.slice(0, 3) }) }),
    logger: { log() {}, warn() {} },
  });
  await store.refresh();
  assert.equal(store.meta().source, 'feed');
  assert.equal(store.meta().count, 3);
});

test('Die mitgelieferten Fahrzeugdaten erfüllen das Schema', () => {
  const result = validateVehicleList(vehicles);
  assert.ok(result.ok, result.errors.join('\n'));
});
