/**
 * Tests der Bausteine, die aus dem Rechner ein Geschäft machen sollen:
 * Hebel, teilbare Links, Landingpages, Anfragen und Messung.
 *
 * Der Schwerpunkt liegt bewusst auf den Zusagen gegenüber dem Nutzer -
 * keine Anzeige ohne Kennzeichnung, keine Adresse ohne Einwilligung, keine
 * Auswertung ohne Token. Ein Fehler in einer Zahl kostet Genauigkeit, ein
 * Fehler an diesen Stellen kostet Vertrauen oder Geld.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Muss vor dem Laden der Module stehen, die das Verzeichnis auslesen.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-store-'));
process.env.DATA_DIR = TMP;
process.env.ADMIN_TOKEN = 'testtoken';

const { buildLevers } = await import('../shared/levers.js');
const { encodeInput, decodeInput, shareUrlPath } = await import('../shared/share.js');
const { partners, activePartnersFor, forecastRevenue } = await import('../shared/partners.js');
const { breakEvenMatrix, rankingForKm, KM_PROFILES } = await import('../shared/seo.js');
const { vehicleById } = await import('../shared/vehicles.js');
const { renderVehiclePage, renderVehicleIndex, renderKmProfilePage, renderResultPage, renderSitemap, renderRobots } =
  await import('../server/pages.js');
const { saveLead, confirmLead, saveEvent, funnel, rateLimit, isValidEmail } = await import('../server/store.js');
const { isAuthorized } = await import('../server/admin.js');
const { server } = await import('../server/server.js');

const SITE = 'https://example.test';
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  return new Promise((resolve) => server.close(resolve));
});

/* ------------------------------------------------------------- Hebel */

test('Hebel senken den Break-even und beziffern die Wirkung', () => {
  const { levers } = buildLevers({}, vehicleById('byd-dolphin-surf'));
  assert.ok(levers.length >= 2, 'mindestens zwei Hebel bei den Vorgabewerten');

  const tariff = levers.find((l) => l.id === 'tariff');
  assert.ok(tariff.breakEvenGainMonths > 0, 'günstigerer Strom muss früher rentabel machen');
  assert.ok(tariff.totalGain > 0);
  assert.match(tariff.change, /Cent je kWh/);
  assert.ok(tariff.assumption.length > 0, 'jede Zahl nennt ihre Annahme');
});

test('Hebel entfallen, wenn sie nichts mehr bringen', () => {
  // Wer bereits zu 100 Prozent zu Hause lädt, kann diesen Anteil nicht erhöhen.
  const { levers } = buildLevers({ ev: { homeChargeShare: 1, thgBonus: 200 } }, vehicleById('vw-id3'));
  assert.equal(levers.find((l) => l.id === 'wallbox'), undefined);
  assert.equal(levers.find((l) => l.id === 'thg'), undefined);
});

test('Hebel sind nach Wirkung sortiert', () => {
  const { levers } = buildLevers({}, vehicleById('tesla-model3'));
  const gains = levers.map((l) => l.totalGain);
  assert.deepEqual(gains, [...gains].sort((a, b) => b - a));
});

/* ------------------------------------------------------- Teilbare Links */

test('Kodierung und Dekodierung sind verlustfrei', () => {
  const input = {
    profile: { kmPerYear: 27500, horizonYears: 10 },
    current: { consumptionL100: 8.4, fuelPrice: 1.92 },
    ev: { homePrice: 0.24, homeChargeShare: 0.85 },
    needs: { bodyPreference: ['kombi', 'van'], fastChargeImportant: true },
  };
  const { input: back, vehicleId } = decodeInput(encodeInput(input, 'vw-id7'));

  assert.equal(back.profile.kmPerYear, 27500);
  assert.equal(back.profile.horizonYears, 10);
  assert.equal(back.current.consumptionL100, 8.4);
  assert.equal(back.ev.homePrice, 0.24);
  assert.equal(back.needs.fastChargeImportant, true);
  assert.deepEqual(back.needs.bodyPreference, ['kombi', 'van']);
  assert.equal(vehicleId, 'vw-id7');
});

test('Vorgabewerte erzeugen keinen Ballast in der Adresse', () => {
  assert.equal(encodeInput({}), '');
  assert.equal(shareUrlPath({}), '/ergebnis');
  assert.ok(encodeInput({ profile: { kmPerYear: 20000 } }, 'mg4').length < 30, 'Links bleiben kurz');
});

test('Unbrauchbare Eingaben kippen die Dekodierung nicht', () => {
  for (const junk of ['', null, undefined, 'xx', '___', 'km' + 'a'.repeat(50), 'id../../etc/passwd']) {
    const { input, vehicleId } = decodeInput(junk);
    assert.equal(typeof input.profile.kmPerYear, 'number');
    assert.ok(Number.isFinite(input.profile.kmPerYear));
    assert.ok(vehicleId === null || /^[a-z0-9-]+$/.test(vehicleId));
  }
});

/* ------------------------------------------------------------ Partner */

test('Kein Partner ist ohne ausdrückliche Freischaltung aktiv', () => {
  // Schutz gegen den teuersten Fehler: Platzhalterlinks im Publikumsbetrieb.
  for (const p of partners) {
    if (p.enabled) {
      assert.ok(!p.url.includes('example.invalid'), `${p.id} ist aktiv, zeigt aber auf einen Platzhalter`);
      assert.ok(!p.provider.includes('EINTRAGEN'), `${p.id} ist aktiv, hat aber keinen Anbieter`);
    }
  }
  assert.deepEqual(activePartnersFor(['tariff', 'wallbox', 'thg']).filter((p) => !p.enabled), []);
});

test('Ertragsprognose rechnet Klicks in erwarteten Umsatz um', () => {
  const { total, rows } = forecastRevenue({ wallbox: 100, thg: 50 });
  const wallbox = partners.find((p) => p.id === 'wallbox');
  const expected = 100 * wallbox.expectedConversion * wallbox.payoutEur;
  assert.equal(rows.find((r) => r.id === 'wallbox').expected, expected);
  assert.ok(total > expected);
});

/* -------------------------------------------------------- Landingpages */

test('Break-even-Matrix wird mit steigender Fahrleistung besser', () => {
  const matrix = breakEvenMatrix(vehicleById('byd-dolphin-surf'));
  assert.equal(matrix.length, KM_PROFILES.length);
  for (let i = 1; i < matrix.length; i++) {
    assert.ok(
      matrix[i].totalAdvantage > matrix[i - 1].totalAdvantage,
      'mehr Kilometer müssen den Vorteil vergrößern',
    );
  }
});

test('Rangliste je Fahrleistung stellt Fahrzeuge ohne Break-even hinten an', () => {
  const ranking = rankingForKm(15000, 28);
  const firstWithout = ranking.findIndex((r) => r.comparison.breakEvenYears === null);
  if (firstWithout !== -1) {
    assert.ok(
      ranking.slice(firstWithout).every((r) => r.comparison.breakEvenYears === null),
      'nach dem ersten Fahrzeug ohne Break-even darf keines mehr folgen, das einen hat',
    );
  }
});

test('Fahrzeugseite enthält Inhalt, Auszeichnung und Verweise', () => {
  const html = renderVehiclePage('vw-id3', SITE);
  assert.ok(html.length > 6000, 'Seite muss echten Inhalt tragen, keine Hülle');
  assert.match(html, /<h1>Lohnt sich der Volkswagen ID\.3/);
  assert.match(html, /rel="canonical" href="https:\/\/example\.test\/e-auto\/vw-id3"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.ok(!html.includes('noindex'), 'Modellseiten gehören in den Index');
  assert.match(html, /href="\/e-auto\/[a-z0-9-]+"/, 'interne Verlinkung auf ähnliche Modelle');
});

test('Unbekanntes Fahrzeug erzeugt keine Seite', () => {
  assert.equal(renderVehiclePage('gibt-es-nicht', SITE), null);
  assert.equal(renderKmProfilePage(12345, SITE), null);
});

test('Übersicht und Fahrprofilseite sind vollständig', () => {
  assert.match(renderVehicleIndex(SITE), /Elektroautos im Kostenvergleich/);
  const profile = renderKmProfilePage(30000, SITE);
  assert.match(profile, /<h1>Welches E-Auto lohnt sich bei 30\.000 km im Jahr\?<\/h1>/);
  assert.match(profile, /href="\/fahrprofil\/50000-km"/);
});

test('Geteiltes Ergebnis wird nicht indexiert', () => {
  const html = renderResultPage(encodeInput({ profile: { kmPerYear: 25000 } }, 'mg4'), SITE);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /25\.000 km im Jahr/);
});

test('Sitemap und robots.txt passen zusammen', () => {
  const sitemap = renderSitemap(SITE);
  assert.match(sitemap, /<loc>https:\/\/example\.test\/e-auto\/vw-id3<\/loc>/);
  const robots = renderRobots(SITE);
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin/);
  // Was nicht indexiert werden soll, darf auch nicht in der Sitemap stehen.
  assert.ok(!sitemap.includes('/ergebnis'));
});

/* ------------------------------------------------------------ Anfragen */

test('Adresse wird nur mit Einwilligung gespeichert', async () => {
  await assert.rejects(() => saveLead({ email: 'a@b.de', consent: false, ip: '1.1.1.1' }), /Einwilligung/);
  await assert.rejects(() => saveLead({ email: 'kaputt', consent: true, ip: '1.1.1.1' }), /E-Mail/);
});

test('Anfrage bleibt bis zur Bestätigung unbestätigt', async () => {
  const lead = await saveLead({ email: 'Kunde@Beispiel.DE', consent: true, purpose: 'dealer', ip: '1.1.1.1' });
  assert.equal(lead.status, 'pending');
  assert.equal(lead.email, 'kunde@beispiel.de', 'Adressen werden normalisiert');
  assert.ok(lead.confirmToken.length >= 24);
  assert.equal(lead.ipHash.length, 16, 'IP wird nur pseudonymisiert abgelegt');
  assert.ok(!JSON.stringify(lead).includes('1.1.1.1'), 'die IP darf nirgends im Klartext stehen');

  assert.equal((await confirmLead(lead.confirmToken)).status, 'confirmed');
  assert.equal(await confirmLead('unbekannt'), null);
});

test('E-Mail-Prüfung weist offensichtlichen Unsinn ab', () => {
  for (const good of ['a@b.de', 'vor.nach+tag@mail.example.com']) assert.ok(isValidEmail(good), good);
  for (const bad of ['', 'a@b', 'a b@c.de', '@b.de', 'a@.de', 'x'.repeat(300) + '@b.de']) {
    assert.ok(!isValidEmail(bad), bad);
  }
});

test('Ratenbegrenzung greift und trennt nach Schlüssel', () => {
  const ip = '203.0.113.7';
  assert.ok(rateLimit(ip, { limit: 2, key: 'test' }));
  assert.ok(rateLimit(ip, { limit: 2, key: 'test' }));
  assert.ok(!rateLimit(ip, { limit: 2, key: 'test' }), 'drittes Mal muss blockieren');
  assert.ok(rateLimit(ip, { limit: 2, key: 'anderer' }), 'anderer Zweck hat ein eigenes Kontingent');
});

/* ------------------------------------------------------------- Messung */

test('Nur bekannte Ereignisse werden gespeichert', async () => {
  assert.equal(await saveEvent({ name: 'frei-erfunden', props: {}, ip: '1.1.1.1' }), null);
  const event = await saveEvent({ name: 'result', props: { v: 'mg4' }, ip: '1.1.1.1' });
  assert.equal(event.name, 'result');
  assert.ok(!JSON.stringify(event).includes('1.1.1.1'));
});

test('Ereignisdaten werden auf Länge und Anzahl begrenzt', async () => {
  const props = Object.fromEntries([...Array(30)].map((_, i) => [`k${i}`, 'x'.repeat(200)]));
  const event = await saveEvent({ name: 'view', props, ip: '1.1.1.1' });
  assert.ok(Object.keys(event.props).length <= 8);
  assert.ok(Object.values(event.props).every((v) => v.length <= 64));
});

test('Trichter verdichtet Ereignisse zu Quoten', async () => {
  await saveEvent({ name: 'partner_click', props: { partner: 'wallbox' }, ip: '198.51.100.3' });
  const f = funnel(30);
  assert.ok(f.results >= 1);
  assert.equal(f.partnerClicks.wallbox >= 1, true);
  assert.ok(f.rates.leadFromResult >= 0 && f.rates.leadFromResult <= 100);
});

/* ------------------------------------------------------------- Zugriff */

test('Auswertung ist ohne gültiges Token nicht erreichbar', async () => {
  assert.ok(isAuthorized('testtoken'));
  for (const bad of ['', 'falsch', 'testtoke', 'testtokenX', null, undefined]) assert.ok(!isAuthorized(bad));

  assert.equal((await fetch(`${base}/admin`)).status, 404);
  assert.equal((await fetch(`${base}/admin?token=falsch`)).status, 404);
  assert.equal((await fetch(`${base}/admin?token=testtoken`)).status, 200);
});

/* ---------------------------------------------------------- HTTP-Ebene */

test('Gerenderte Seiten werden ausgeliefert', async () => {
  for (const [pathname, needle] of [
    ['/e-auto', 'Kostenvergleich'],
    ['/e-auto/mg4', '<h1>Lohnt sich der'],
    ['/fahrprofil/20000-km', '20.000 km im Jahr'],
    ['/ergebnis/km25000', 'Ergebnis:'],
    ['/sitemap.xml', '<urlset'],
    ['/robots.txt', 'Sitemap:'],
  ]) {
    const res = await fetch(`${base}${pathname}`);
    assert.equal(res.status, 200, pathname);
    assert.match(await res.text(), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), pathname);
  }
});

test('Module aus /shared sind für den Browser erreichbar', async () => {
  const res = await fetch(`${base}/shared/format.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  // Der Pfad darf nicht als Schlupfloch aus dem Projekt heraus dienen.
  assert.equal((await fetch(`${base}/shared/../package.json`)).status, 404);
});

test('Anfrage über HTTP legt einen unbestätigten Datensatz an', async () => {
  const res = await fetch(`${base}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'http@beispiel.de', consent: true, purpose: 'updates' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'pending');

  const denied = await fetch(`${base}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'http@beispiel.de', consent: false }),
  });
  assert.equal(denied.status, 400);
});

test('Honigtopf schluckt Bots, ohne etwas zu speichern', async () => {
  const before = funnel(30).leads;
  const res = await fetch(`${base}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bot@spam.de', consent: true, website: 'https://spam' }),
  });
  assert.equal(res.status, 200);
  assert.equal(funnel(30).leads, before, 'ein ausgefülltes Honigtopffeld darf nichts anlegen');
});

test('Fahrzeugantwort liefert Hebel und nur freigeschaltete Partner mit', async () => {
  const res = await fetch(`${base}/api/vehicle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vehicleId: 'vw-id3', input: {} }),
  });
  const body = await res.json();
  assert.ok(body.levers.length >= 1);
  assert.deepEqual(body.partners, [], 'ohne Partnervertrag wird nichts beworben');
});
