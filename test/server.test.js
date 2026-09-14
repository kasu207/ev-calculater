/**
 * Tests der HTTP-Schicht. Der Server wird auf einem freien Port gestartet,
 * damit Health-Endpunkt, Auslieferung und Fehlerfälle so geprüft werden,
 * wie der Container sie später bedient.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { server } from '../server/server.js';

let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('Health-Endpunkt meldet Bereitschaft', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.vehicleCount > 0);
  assert.ok(Number.isFinite(body.uptimeSeconds));
});

test('Startseite und Assets werden mit korrektem Typ ausgeliefert', async () => {
  const cases = [
    ['/', 'text/html'],
    ['/styles.css', 'text/css'],
    ['/app.js', 'text/javascript'],
  ];
  for (const [path, type] of cases) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
    assert.ok(res.headers.get('content-type').startsWith(type), `${path}: ${res.headers.get('content-type')}`);
  }
});

test('Unbekannte Pfade und Endpunkte antworten mit 404', async () => {
  assert.equal((await fetch(`${base}/gibtsnicht.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/gibtsnicht`)).status, 404);
});

test('Pfadausbruch wird abgewiesen', async () => {
  for (const path of ['/%2e%2e%2fpackage.json', '/%2e%2e/server/server.js', '/..%2f..%2fetc%2fpasswd']) {
    const res = await fetch(`${base}${path}`);
    assert.ok(res.status === 403 || res.status === 404, `${path}: ${res.status}`);
    const body = await res.text();
    assert.ok(!body.includes('root:x:'), `${path} hat /etc/passwd ausgeliefert`);
    assert.ok(!body.includes('createServer'), `${path} hat Serverquelltext ausgeliefert`);
  }
});

test('Empfehlung ist über die API abrufbar', async () => {
  const res = await fetch(`${base}/api/recommend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { scenario: 'replace' }, limit: 3 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.bestMatch);
  assert.equal(body.ranked.length, 3);
});

test('Ungültiges JSON führt zu 400, nicht zu 500', async () => {
  const res = await fetch(`${base}/api/recommend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{kaputt',
  });
  assert.equal(res.status, 400);
});

test('Unbekannte Fahrzeug-ID führt zu 404', async () => {
  const res = await fetch(`${base}/api/vehicle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vehicleId: 'gibt-es-nicht' }),
  });
  assert.equal(res.status, 404);
});

test('Schreibende Methoden auf statischen Pfaden werden abgelehnt', async () => {
  const res = await fetch(`${base}/`, { method: 'DELETE' });
  assert.equal(res.status, 405);
});

test('Ohne konfigurierte Quelle antwortet /api/market still', async () => {
  const res = await fetch(`${base}/api/market`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.configured, { fuel: false, power: false });
  assert.equal(body.fuel.available, false);
  assert.equal(body.power.available, false);
});

test('Meta nennt Herkunft der Fahrzeugdaten und Zustand der Marktquellen', async () => {
  const res = await fetch(`${base}/api/meta`);
  const body = await res.json();
  assert.equal(body.vehicleSource.source, 'snapshot');
  assert.equal(body.vehicleSource.fallback, false);
  assert.equal(body.market.fuel, false);
  // Die Postleitzahlentabelle liegt dem Abbild bei, sonst ist keine regionale
  // Abfrage möglich.
  assert.equal(body.market.postalLookup, true);
});
