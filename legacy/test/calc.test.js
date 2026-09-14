import test from 'node:test';
import assert from 'node:assert/strict';

import { withDefaults, defaults } from '../shared/defaults.js';
import { compareVehicle, blendedKwhPrice, residualValue, annualCostsIce } from '../shared/calc.js';
import { evaluateVehicle, recommend, requiredRange } from '../shared/match.js';
import { buildOffers, annuity } from '../shared/offers.js';
import { vehicles, vehicleById } from '../shared/vehicles.js';

const base = withDefaults();

test('Ladepreis mischt Heim- und Fremdladen inklusive Ladeverlust', () => {
  const price = blendedKwhPrice({
    homeChargeShare: 0.5,
    homePrice: 0.3,
    publicPrice: 0.5,
    chargingLossPct: 0,
  });
  assert.equal(price, 0.4);

  const withLoss = blendedKwhPrice({
    homeChargeShare: 1,
    homePrice: 0.3,
    publicPrice: 0.5,
    chargingLossPct: 0.1,
  });
  assert.ok(Math.abs(withLoss - 0.3 / 0.9) < 1e-9);
});

test('Restwert fällt geometrisch', () => {
  assert.equal(residualValue(10000, 0.1, 0), 10000);
  assert.ok(Math.abs(residualValue(10000, 0.1, 2) - 8100) < 1e-6);
});

test('Kraftstoffkosten folgen Fahrleistung und Verbrauch', () => {
  const input = withDefaults({
    profile: { kmPerYear: 10000 },
    current: { consumptionL100: 8, fuelPrice: 2 },
  });
  assert.equal(annualCostsIce(input).fuel, 1600);
});

test('Vorteil zum Zeitpunkt 0 entspricht Förderung minus Wallbox', () => {
  const input = withDefaults({ ev: { subsidy: 3000, wallboxCost: 1200, capitalCostRate: 0 } });
  const result = compareVehicle(input, vehicleById('vw-id3'));
  assert.ok(Math.abs(result.yearly[0].advantage - 1800) < 1e-6);
});

test('Vorteil und Kostendifferenz sind konsistent', () => {
  const result = compareVehicle(base, vehicleById('tesla-model3'));
  for (const point of result.yearly) {
    const diff = point.cumulativeIce - point.cumulativeEv;
    assert.ok(Math.abs(diff - point.advantage) < 1e-6, `Jahr ${point.year}`);
  }
});

test('Break-even liegt dort, wo der Vorteil das Vorzeichen wechselt', () => {
  const result = compareVehicle(base, vehicleById('mg4'));
  if (result.breakEvenMonths === null) return;
  const before = result.yearly.filter((p) => p.year < result.breakEvenYears);
  for (const p of before) assert.ok(p.advantage < 0.01);
});

test('Höhere Fahrleistung verkürzt den Break-even', () => {
  const opts = { scenario: 'replace' };
  const few = compareVehicle(withDefaults({ ...opts, profile: { kmPerYear: 8000 } }), vehicleById('mg4'));
  const many = compareVehicle(withDefaults({ ...opts, profile: { kmPerYear: 30000 } }), vehicleById('mg4'));
  assert.ok(many.annual.savings > few.annual.savings);
  assert.ok(many.breakEvenMonths !== null);
  assert.ok(few.breakEvenMonths === null || many.breakEvenMonths < few.breakEvenMonths);
});

test('Szenario "Neukauf" fällt günstiger aus als "Auto behalten"', () => {
  const vehicle = vehicleById('vw-id3');
  const keep = compareVehicle(withDefaults({ scenario: 'keep' }), vehicle);
  const replace = compareVehicle(withDefaults({ scenario: 'replace' }), vehicle);
  assert.equal(keep.scenario, 'keep');
  assert.equal(replace.scenario, 'replace');
  // Im Neukauf-Szenario fällt der Wertverlust auf beiden Seiten an.
  assert.ok(replace.totalAdvantage > keep.totalAdvantage);
});

test('Referenzpreis im Neukauf-Szenario ist überschreibbar', () => {
  const vehicle = vehicleById('vw-id3');
  const auto = compareVehicle(withDefaults({ scenario: 'replace' }), vehicle);
  const manual = compareVehicle(
    withDefaults({ scenario: 'replace', replacement: { price: 45000 } }),
    vehicle,
  );
  assert.ok(manual.totalAdvantage > auto.totalAdvantage);
});

test('Teurerer Strom verschlechtert die Bilanz', () => {
  const cheap = compareVehicle(withDefaults({ ev: { homePrice: 0.2, publicPrice: 0.3 } }), vehicleById('vw-id4'));
  const dear = compareVehicle(withDefaults({ ev: { homePrice: 0.6, publicPrice: 0.9 } }), vehicleById('vw-id4'));
  assert.ok(cheap.totalAdvantage > dear.totalAdvantage);
});

test('Sitzplatzbedarf schließt zu kleine Fahrzeuge aus', () => {
  const input = withDefaults({ needs: { seats: 7, budget: 80000 } });
  const dacia = evaluateVehicle(input, vehicleById('dacia-spring'));
  const eqb = evaluateVehicle(input, vehicleById('mercedes-eqb'));
  assert.equal(dacia.eligible, false);
  assert.equal(eqb.eligible, true);
});

test('Anhängelast wird als Ausschlusskriterium berücksichtigt', () => {
  const input = withDefaults({ needs: { towing: 1500, budget: 80000 } });
  const result = evaluateVehicle(input, vehicleById('vw-id3'));
  assert.equal(result.eligible, false);
  assert.match(result.blockers.join(' '), /Anh/);
});

test('Empfehlung liefert Ranking und Wirtschaftlichkeitssieger', () => {
  const result = recommend(withDefaults({ needs: { budget: 45000 } }));
  assert.ok(result.ranked.length > 0);
  assert.ok(result.bestMatch);
  for (let i = 1; i < result.ranked.length; i++) {
    assert.ok(result.ranked[i - 1].score >= result.ranked[i].score);
  }
  assert.equal(result.ranked.length + result.rejected.length, vehicles.length);
});

test('Budget begrenzt die Empfehlungen', () => {
  const result = recommend(withDefaults({ needs: { budget: 22000 } }));
  for (const r of result.ranked) {
    assert.ok(r.vehicle.price <= 22000 * 1.3);
  }
});

test('Benötigte Reichweite steigt mit der längsten Strecke', () => {
  const short = requiredRange(withDefaults({ profile: { longestTripKm: 100 } }));
  const long = requiredRange(withDefaults({ profile: { longestTripKm: 500 } }));
  assert.ok(long > short);
});

test('Annuität ohne Zins entspricht der linearen Rate', () => {
  assert.equal(annuity(12000, 0, 24), 500);
  assert.ok(annuity(12000, 0.05, 24) > 500);
});

test('Angebote enthalten Kauf, Finanzierung und Leasing', () => {
  const vehicle = vehicleById('skoda-elroq');
  const comparison = compareVehicle(base, vehicle);
  const offers = buildOffers(base, vehicle, comparison);
  assert.equal(offers.options.length, 3);
  assert.ok(offers.negotiatedPrice < vehicle.price);
  for (const option of offers.options) {
    assert.ok(option.assumptions.length >= 2);
    assert.ok(Number.isFinite(option.headline));
  }
});

test('Fahrzeugdatenbank ist plausibel befüllt', () => {
  const ids = new Set();
  for (const v of vehicles) {
    assert.ok(!ids.has(v.id), `doppelte id ${v.id}`);
    ids.add(v.id);
    assert.ok(v.price > 10000 && v.price < 120000, v.id);
    assert.ok(v.rangeKm > 150 && v.rangeKm < 900, v.id);
    assert.ok(v.consumptionKwh100 > 10 && v.consumptionKwh100 < 30, v.id);
    assert.ok(v.seats >= 4 && v.seats <= 9, v.id);
    assert.ok(v.dcPeakKw >= 20, v.id);
    assert.ok(typeof v.note === 'string' && v.note.length > 10, v.id);
  }
});

test('Alle Fahrzeuge lassen sich fehlerfrei durchrechnen', () => {
  for (const v of vehicles) {
    const r = evaluateVehicle(defaults, v);
    assert.ok(Number.isFinite(r.score), v.id);
    assert.ok(r.score >= 0 && r.score <= 100, `${v.id}: ${r.score}`);
    assert.ok(Number.isFinite(r.comparison.totalAdvantage), v.id);
  }
});

test('Wirtschaftlichkeitsscore ist monoton im Gesamtergebnis', () => {
  // Ein Fahrzeug mit Break-even muss ökonomisch besser bewertet werden als
  // dasselbe Fahrzeug ohne - sonst kippt das Ranking.
  const vehicle = vehicleById('byd-dolphin-surf');
  const good = evaluateVehicle(withDefaults({ scenario: 'replace', profile: { kmPerYear: 30000 } }), vehicle);
  const bad = evaluateVehicle(withDefaults({ scenario: 'keep', profile: { kmPerYear: 5000 } }), vehicle);
  assert.ok(good.comparison.breakEvenYears !== null);
  assert.equal(bad.comparison.breakEvenYears, null);
  assert.ok(good.parts.economy > bad.parts.economy);
});

test('Ein Fahrzeug mit Break-even schlägt eines ohne', () => {
  const input = withDefaults({ needs: { budget: 60000 } });
  const results = recommend(input).ranked;
  const withBe = results.filter((r) => r.comparison.breakEvenMonths !== null);
  const withoutBe = results.filter((r) => r.comparison.breakEvenMonths === null);
  if (withBe.length && withoutBe.length) {
    const bestWith = Math.max(...withBe.map((r) => r.parts.economy));
    const bestWithout = Math.max(...withoutBe.map((r) => r.parts.economy));
    assert.ok(bestWith > bestWithout);
  }
});

test('Ohne Preissteigerung bleibt die Ersparnis über alle Jahre gleich', () => {
  const input = withDefaults({ prices: { fuelGrowth: 0, electricityGrowth: 0 } });
  const result = compareVehicle(input, vehicleById('vw-id3'));
  assert.ok(Math.abs(result.annual.savingsFirstYear - result.annual.savingsStatic) < 1e-6);
  assert.ok(Math.abs(result.annual.savingsLastYear - result.annual.savingsFirstYear) < 1e-6);
  assert.ok(Math.abs(result.annual.savingsAverage - result.annual.savingsFirstYear) < 1e-6);
  assert.equal(result.prices.escalating, false);
});

test('Steigende Kraftstoffpreise verkürzen den Break-even', () => {
  const vehicle = vehicleById('vw-id3');
  const flat = compareVehicle(withDefaults({ scenario: 'replace', prices: { fuelGrowth: 0, electricityGrowth: 0 } }), vehicle);
  const rising = compareVehicle(withDefaults({ scenario: 'replace', prices: { fuelGrowth: 0.06, electricityGrowth: 0.01 } }), vehicle);
  assert.ok(rising.annual.savingsLastYear > rising.annual.savingsFirstYear);
  assert.ok(rising.totalAdvantage > flat.totalAdvantage);
  assert.ok(rising.breakEvenMonths < flat.breakEvenMonths);
});

test('Steigende Strompreise verschlechtern die Bilanz', () => {
  const vehicle = vehicleById('vw-id3');
  const flat = compareVehicle(withDefaults({ scenario: 'replace', prices: { fuelGrowth: 0, electricityGrowth: 0 } }), vehicle);
  const power = compareVehicle(withDefaults({ scenario: 'replace', prices: { fuelGrowth: 0, electricityGrowth: 0.06 } }), vehicle);
  assert.ok(power.totalAdvantage < flat.totalAdvantage);
  assert.ok(power.annual.savingsLastYear < power.annual.savingsFirstYear);
});

test('Preisprognose bleibt mit der Kostendifferenz konsistent', () => {
  const input = withDefaults({ prices: { fuelGrowth: 0.045, electricityGrowth: 0.02 } });
  const result = compareVehicle(input, vehicleById('kia-ev3'));
  for (const point of result.yearly) {
    assert.ok(Math.abs(point.cumulativeIce - point.cumulativeEv - point.advantage) < 1e-6, `Jahr ${point.year}`);
  }
  // Die Summe der Jahresersparnisse muss den laufenden Anteil exakt ergeben.
  const summed = result.yearly.reduce((acc, p) => acc + p.savings, 0);
  assert.ok(Math.abs(summed - result.annual.savingsAverage * result.years) < 1e-6);
});

test('Endpreise folgen der angesetzten Steigerung', () => {
  const input = withDefaults({ profile: { horizonYears: 10 }, prices: { fuelGrowth: 0.03, electricityGrowth: 0 } });
  const result = compareVehicle(input, vehicleById('mg4'));
  assert.ok(Math.abs(result.prices.fuelAtEnd - result.prices.fuelToday * Math.pow(1.03, 10)) < 1e-9);
  assert.ok(Math.abs(result.prices.kwhAtEnd - result.prices.kwhToday) < 1e-9);
});

test('Negative Steigerung senkt die Energiekosten', () => {
  const vehicle = vehicleById('mg4');
  const flat = compareVehicle(withDefaults({ prices: { fuelGrowth: 0, electricityGrowth: 0 } }), vehicle);
  const falling = compareVehicle(withDefaults({ prices: { fuelGrowth: -0.02, electricityGrowth: 0 } }), vehicle);
  assert.ok(falling.annual.savingsLastYear < flat.annual.savingsLastYear);
  assert.ok(falling.totalAdvantage < flat.totalAdvantage);
});
