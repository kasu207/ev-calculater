/**
 * Rechenkern des E-Auto-Rechners.
 *
 * Verglichen werden zwei Szenarien über einen frei wählbaren Zeitraum.
 * Szenario B ist immer "E-Auto kaufen". Szenario A hängt vom gewählten
 * Vergleichsfall ab:
 *
 *   scenario 'keep'    - aktuellen Verbrenner weiterfahren. Referenzwert ist
 *                        der heutige Verkaufserlös, der weiter an Wert verliert.
 *   scenario 'replace' - es wird ohnehin ein Auto gekauft, Alternative ist ein
 *                        neuer Verbrenner. Referenzwert ist dessen Kaufpreis.
 *
 * In beiden Fällen gilt dieselbe Formel für den wirtschaftlichen Vorteil
 * des E-Autos zum Zeitpunkt t (in Jahren):
 *
 *   vorteil(t) = förderung - wallbox
 *              + ersparnis_laufend * t
 *              + wertverlust_referenz(t) - wertverlust_eauto(t)
 *              - kapitalkosten(t)
 *
 * Zum Zeitpunkt 0 bleibt genau `förderung - wallbox` übrig, weil sich
 * Kaufpreise und Restwerte auf beiden Seiten aufheben. Der Break-even ist der
 * erste Monat, in dem vorteil(t) das Vorzeichen wechselt.
 */

import { withDefaults } from './defaults.js';

const MONTHS = 12;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Restwert nach `years` Jahren bei jährlich gleichbleibender Verlustrate. */
export function residualValue(base, annualRate, years) {
  return base * Math.pow(1 - clamp(annualRate, 0, 0.6), years);
}

/** Mischpreis je kWh aus Heim- und Fremdladeanteil, inklusive Ladeverlust. */
export function blendedKwhPrice(ev) {
  const share = clamp(num(ev.homeChargeShare, 0.7), 0, 1);
  const raw = share * num(ev.homePrice) + (1 - share) * num(ev.publicPrice);
  return raw / (1 - clamp(num(ev.chargingLossPct, 0), 0, 0.4));
}

/**
 * Laufende Jahreskosten eines Verbrenners.
 * `override` erlaubt es, statt des aktuellen Autos einen Neuwagen zu rechnen.
 */
export function annualCostsIce(input, override = null) {
  const car = override || input.current;
  const km = num(input.profile.kmPerYear);
  const fuel = (km / 100) * num(car.consumptionL100) * num(input.current.fuelPrice);
  const parts = {
    fuel,
    insurance: num(car.insurance),
    tax: num(car.tax),
    maintenance: num(car.maintenance),
    other: num(car.otherCosts),
  };
  return { ...parts, total: parts.fuel + parts.insurance + parts.tax + parts.maintenance + parts.other };
}

/**
 * Geschätzte E-Auto-Versicherung. Basis ist die heutige Prämie, leicht
 * skaliert mit dem Fahrzeugwert - ein teureres Auto kostet in der Vollkasko
 * mehr. Der Faktor ist bewusst flach und auf 0,8 bis 1,6 begrenzt.
 */
export function estimateEvInsurance(input, vehicle) {
  const base = num(input.current.insurance) * num(input.ev.insuranceFactor, 1);
  return base * clamp(0.8 + 0.2 * (vehicle.price / 35000), 0.8, 1.6);
}

/** Laufende Jahreskosten eines konkreten E-Autos. */
export function annualCostsEv(input, vehicle) {
  const km = num(input.profile.kmPerYear);
  const kwhPrice = blendedKwhPrice(input.ev);
  const parts = {
    energy: (km / 100) * vehicle.consumptionKwh100 * kwhPrice,
    insurance: estimateEvInsurance(input, vehicle),
    tax: num(input.ev.tax),
    maintenance: num(input.current.maintenance) * num(input.ev.maintenanceFactor, 1),
    thgBonus: -num(input.ev.thgBonus),
  };
  return {
    ...parts,
    total: parts.energy + parts.insurance + parts.tax + parts.maintenance + parts.thgBonus,
  };
}

/**
 * Beschreibt Szenario A: welcher Vermögenswert steht dem E-Auto gegenüber
 * und welche laufenden Kosten fallen dort an.
 */
export function referenceScenario(input, vehicle) {
  if (input.scenario === 'replace') {
    const price = num(input.replacement.price) || Math.round(vehicle.price * 0.82);
    return {
      kind: 'replace',
      label: 'Neuer Verbrenner',
      description: 'Vergleich mit dem Kauf eines vergleichbaren Verbrenner-Neuwagens.',
      base: price,
      rate: num(input.replacement.depreciationRate, 0.13),
      upfront: price - num(input.current.resaleValue),
      costs: annualCostsIce(input, input.replacement),
      consumptionL100: num(input.replacement.consumptionL100),
    };
  }
  return {
    kind: 'keep',
    label: 'Aktuelles Auto behalten',
    description: 'Vergleich mit dem Weiterfahren des vorhandenen Verbrenners.',
    base: num(input.current.resaleValue),
    rate: num(input.current.depreciationRate, 0.11),
    upfront: 0,
    costs: annualCostsIce(input),
    consumptionL100: num(input.current.consumptionL100),
  };
}

/**
 * Vollständiger Vergleich für ein Fahrzeug. Rechnet monatsgenau und liefert
 * zusätzlich Jahreswerte für die Grafik.
 */
export function compareVehicle(rawInput, vehicle) {
  const input = withDefaults(rawInput);
  const years = clamp(Math.round(num(input.profile.horizonYears, 8)), 1, 20);

  const reference = referenceScenario(input, vehicle);
  const evCosts = annualCostsEv(input, vehicle);
  const annualSavings = reference.costs.total - evCosts.total;

  const resale = num(input.current.resaleValue);
  const subsidy = num(input.ev.subsidy);
  const wallbox = num(input.ev.wallboxCost);
  const evUpfront = vehicle.price - subsidy + wallbox - resale;

  const rEv = num(input.ev.depreciationRate, 0.16);
  const monthlyCapitalRate = num(input.ev.capitalCostRate, 0) / MONTHS;

  const totalMonths = years * MONTHS;
  const monthly = [];
  let capitalCostCum = 0;

  for (let m = 0; m <= totalMonths; m++) {
    const t = m / MONTHS;
    const assetRef = residualValue(reference.base, reference.rate, t);
    const assetEv = residualValue(vehicle.price, rEv, t);
    // Wallbox linear über den Betrachtungszeitraum abgeschrieben.
    const wallboxResidual = wallbox * Math.max(0, 1 - t / years);
    const tied = Math.max(0, assetEv - assetRef) + wallboxResidual;
    if (m > 0) capitalCostCum += tied * monthlyCapitalRate;

    const advantage =
      subsidy -
      wallbox +
      annualSavings * t +
      (reference.base - assetRef) -
      (vehicle.price - assetEv) -
      capitalCostCum;

    monthly.push({ month: m, years: t, assetRef, assetEv, advantage, capitalCost: capitalCostCum });
  }

  let breakEvenMonths = null;
  if (monthly[0].advantage >= 0) {
    breakEvenMonths = 0;
  } else {
    for (let m = 1; m < monthly.length; m++) {
      const prev = monthly[m - 1];
      const cur = monthly[m];
      if (prev.advantage < 0 && cur.advantage >= 0) {
        const span = cur.advantage - prev.advantage;
        breakEvenMonths = m - 1 + (span === 0 ? 0 : -prev.advantage / span);
        break;
      }
    }
  }

  const yearly = monthly
    .filter((p) => p.month % MONTHS === 0)
    .map((p) => ({
      year: p.month / MONTHS,
      km: num(input.profile.kmPerYear) * (p.month / MONTHS),
      advantage: p.advantage,
      cumulativeIce: reference.costs.total * (p.month / MONTHS) + (reference.base - p.assetRef),
      cumulativeEv:
        evCosts.total * (p.month / MONTHS) +
        (vehicle.price - p.assetEv) +
        wallbox -
        subsidy +
        p.capitalCost,
    }));

  const last = yearly[yearly.length - 1];
  const km = Math.max(1, num(input.profile.kmPerYear));

  return {
    vehicleId: vehicle.id,
    scenario: reference.kind,
    scenarioLabel: reference.label,
    years,
    annual: {
      ice: reference.costs,
      ev: evCosts,
      savings: annualSavings,
    },
    evUpfront,
    referenceUpfront: reference.upfront,
    extraUpfront: evUpfront - reference.upfront,
    kwhPrice: blendedKwhPrice(input.ev),
    costPer100Ice: (reference.costs.fuel / km) * 100,
    costPer100Ev: (evCosts.energy / km) * 100,
    breakEvenMonths,
    breakEvenYears: breakEvenMonths === null ? null : breakEvenMonths / MONTHS,
    breakEvenKm: breakEvenMonths === null ? null : (breakEvenMonths / MONTHS) * km,
    totalAdvantage: last.advantage,
    totalCostIce: last.cumulativeIce,
    totalCostEv: last.cumulativeEv,
    residualEv: residualValue(vehicle.price, rEv, years),
    residualIce: residualValue(reference.base, reference.rate, years),
    capitalCost: monthly[monthly.length - 1].capitalCost,
    yearly,
  };
}
