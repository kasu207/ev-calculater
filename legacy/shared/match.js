/**
 * Fahrzeug-Matching: bewertet, wie gut ein E-Auto zum Bedarfsprofil passt.
 *
 * Der Gesamtscore setzt sich aus fünf gewichteten Teilscores zusammen.
 * Harte Ausschlusskriterien (Sitzplätze, Anhängelast) führen nicht zum
 * Verschwinden des Fahrzeugs, sondern zu `eligible: false` plus Begründung -
 * der Nutzer soll sehen, warum ein Auto nicht in Frage kommt.
 */

import { compareVehicle } from './calc.js';
import { withDefaults } from './defaults.js';
import { vehicles as allVehicles, vehicleLabel } from './vehicles.js';

/** Anteil der WLTP-Reichweite, der im Alltag (Winter, Autobahn) übrig bleibt. */
export const REAL_RANGE_FACTOR = 0.78;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export const WEIGHTS = {
  economy: 0.34,
  budget: 0.2,
  range: 0.18,
  practicality: 0.2,
  charging: 0.08,
};

/** Praxisnahe Reichweite in km. */
export function realRange(vehicle) {
  return vehicle.rangeKm * REAL_RANGE_FACTOR;
}

/**
 * Benötigte Alltagsreichweite. Auf der Langstrecke wird ein Ladestopp
 * unterstellt, deshalb reichen rund 60 Prozent der längsten Tour.
 */
export function requiredRange(input) {
  const { profile, needs } = input;
  const dailyKm = num(profile.kmPerYear) / 220;
  return Math.max(
    num(needs.minRangeKm),
    Math.min(num(profile.longestTripKm), 500) * 0.6,
    dailyKm * 1.5,
    150,
  );
}

/** Minuten für rund 200 km Nachladen am Schnelllader. */
export function fastChargeMinutes(vehicle) {
  const kwhFor200 = (200 / 100) * vehicle.consumptionKwh100;
  const averagePower = Math.max(20, vehicle.dcPeakKw * 0.55);
  return (kwhFor200 / averagePower) * 60;
}

/**
 * Wirtschaftlichkeit in zwei Teilen, damit die Bewertung streng monoton bleibt:
 * das Endergebnis nach Ablauf des Zeitraums und - falls vorhanden - wie früh
 * der Break-even erreicht wird. Ohne diese Kombination würde ein Fahrzeug mit
 * spätem Break-even schlechter bewertet als eines, das sich nie rechnet.
 */
function scoreEconomy(comparison, years, vehicle) {
  const reference = Math.max(8000, vehicle.price * 0.25);
  const advantageScore = 50 * (1 + Math.tanh(comparison.totalAdvantage / reference));
  const breakEvenScore =
    comparison.breakEvenYears === null
      ? 0
      : clamp(100 * (1 - comparison.breakEvenYears / years), 0, 100);
  return clamp(0.65 * advantageScore + 0.35 * breakEvenScore, 0, 100);
}

function scoreBudget(vehicle, needs, subsidy) {
  const netPrice = vehicle.price - num(subsidy);
  const budget = Math.max(1, num(needs.budget));
  if (netPrice <= budget) return 100;
  return clamp(100 - (100 * (netPrice - budget)) / (0.3 * budget), 0, 100);
}

function scoreRange(vehicle, needed) {
  const ratio = realRange(vehicle) / Math.max(1, needed);
  if (ratio >= 1) return clamp(90 + (ratio - 1) * 40, 0, 100);
  return clamp(ratio * 90, 0, 90);
}

function scoreCharging(vehicle, input) {
  const minutes = fastChargeMinutes(vehicle);
  const longTrips = num(input.profile.longTripsPerYear);
  const base = clamp(100 - (minutes - 15) * 2.2, 0, 100);
  if (!input.needs.fastChargeImportant && longTrips <= 4) {
    // Wer kaum Langstrecke fährt, wird von langsamem Laden weniger getroffen.
    return clamp(base * 0.5 + 50, 0, 100);
  }
  return base;
}

function scorePracticality(vehicle, needs) {
  let score = 100;
  const prefs = Array.isArray(needs.bodyPreference) ? needs.bodyPreference : [];
  if (prefs.length && !prefs.includes(vehicle.body)) score -= 30;
  if (num(needs.minBootLiters) > 0) {
    const ratio = vehicle.bootLiters / num(needs.minBootLiters);
    if (ratio < 1) score -= clamp((1 - ratio) * 80, 0, 45);
  }
  if (vehicle.seats > num(needs.seats, 5)) score += 4;
  return clamp(score, 0, 100);
}

/** Einzelbewertung inkl. Wirtschaftlichkeitsrechnung. */
export function evaluateVehicle(rawInput, vehicle) {
  const input = withDefaults(rawInput);
  const comparison = compareVehicle(input, vehicle);
  const needed = requiredRange(input);

  const parts = {
    economy: scoreEconomy(comparison, comparison.years, vehicle),
    budget: scoreBudget(vehicle, input.needs, input.ev.subsidy),
    range: scoreRange(vehicle, needed),
    practicality: scorePracticality(vehicle, input.needs),
    charging: scoreCharging(vehicle, input),
  };

  const score = Object.entries(WEIGHTS).reduce((sum, [key, w]) => sum + parts[key] * w, 0);

  const blockers = [];
  const warnings = [];
  const highlights = [];

  if (vehicle.seats < num(input.needs.seats, 5)) {
    blockers.push(`Nur ${vehicle.seats} Sitzplätze, benötigt werden ${input.needs.seats}.`);
  }
  if (num(input.needs.towing) > 0 && vehicle.towing < num(input.needs.towing)) {
    blockers.push(
      vehicle.towing === 0
        ? 'Keine Anhängerkupplung verfügbar.'
        : `Anhängelast nur ${vehicle.towing} kg statt ${input.needs.towing} kg.`,
    );
  }
  if (vehicle.price - num(input.ev.subsidy) > num(input.needs.budget) * 1.3) {
    blockers.push('Liegt deutlich über dem angegebenen Budget.');
  }

  if (realRange(vehicle) < needed) {
    warnings.push(
      `Alltagsreichweite rund ${Math.round(realRange(vehicle))} km, rechnerisch nötig sind ${Math.round(needed)} km.`,
    );
  }
  if (fastChargeMinutes(vehicle) > 35 && num(input.profile.longTripsPerYear) > 6) {
    warnings.push(
      `Laden dauert vergleichsweise lang (ca. ${Math.round(fastChargeMinutes(vehicle))} min für 200 km).`,
    );
  }
  if (comparison.breakEvenYears === null) {
    warnings.push(`Rechnet sich innerhalb von ${comparison.years} Jahren nicht.`);
  }

  if (comparison.breakEvenYears !== null && comparison.breakEvenYears <= comparison.years * 0.5) {
    highlights.push(
      `Break-even nach ${comparison.breakEvenYears.toFixed(1)} Jahren bzw. ${Math.round(comparison.breakEvenKm / 1000)} Tsd. km.`,
    );
  }
  if (parts.range >= 95) highlights.push('Reichweite mit klarem Puffer für das Fahrprofil.');
  if (fastChargeMinutes(vehicle) <= 22) highlights.push('Sehr schnelles Nachladen auf der Langstrecke.');
  if (vehicle.price - num(input.ev.subsidy) <= num(input.needs.budget) * 0.85) {
    highlights.push('Deutlich unter Budget - Spielraum für Ausstattung.');
  }

  return {
    vehicle,
    label: vehicleLabel(vehicle),
    score: Math.round(score * 10) / 10,
    parts,
    eligible: blockers.length === 0,
    blockers,
    warnings,
    highlights,
    realRangeKm: Math.round(realRange(vehicle)),
    fastChargeMinutes: Math.round(fastChargeMinutes(vehicle)),
    comparison,
  };
}

/**
 * Bewertet die gesamte Datenbank und liefert eine sortierte Empfehlung.
 * `bestMatch` ist die Gesamtempfehlung, `bestEconomy` das wirtschaftlich
 * schnellste Fahrzeug - das ist nicht zwingend dasselbe Auto.
 */
export function recommend(rawInput, list = allVehicles) {
  const input = withDefaults(rawInput);
  const results = list.map((v) => evaluateVehicle(input, v));

  const eligible = results.filter((r) => r.eligible).sort((a, b) => b.score - a.score);
  const rejected = results.filter((r) => !r.eligible).sort((a, b) => b.score - a.score);

  const withBreakEven = eligible.filter((r) => r.comparison.breakEvenMonths !== null);
  const bestEconomy =
    withBreakEven.sort(
      (a, b) => a.comparison.breakEvenMonths - b.comparison.breakEvenMonths,
    )[0] || null;

  return {
    requiredRangeKm: Math.round(requiredRange(input)),
    ranked: eligible,
    rejected,
    bestMatch: eligible[0] || null,
    bestEconomy,
    cheapestRunning:
      [...eligible].sort(
        (a, b) => a.comparison.annual.ev.total - b.comparison.annual.ev.total,
      )[0] || null,
  };
}
