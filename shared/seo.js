/**
 * Inhalte der öffentlichen Landingpages.
 *
 * Hintergrund: der Rechner selbst ist eine einzige URL, die im Browser
 * zusammengebaut wird. Eine Suchmaschine sieht dort eine leere Seite. Ohne
 * indexierbare Seiten gibt es keinen Zulauf, ohne Zulauf keine Anfragen.
 * Deshalb wird aus derselben Rechenlogik für jedes Modell und für typische
 * Fahrleistungen eine eigene, serverseitig gerenderte Seite erzeugt.
 *
 * Die Inhalte sind gerechnet, nicht getextet. Das unterscheidet die Seiten
 * von den üblichen Platzhalterseiten und ist der Grund, warum sie überhaupt
 * eine Chance auf eine Platzierung haben.
 */

import { vehicles, vehicleById, vehicleLabel } from './vehicles.js';
import { compareVehicle } from './calc.js';
import { withDefaults } from './defaults.js';

/** Fahrleistungen mit eigener Seite. Deckt die üblichen Suchanfragen ab. */
export const KM_PROFILES = [5000, 10000, 15000, 20000, 30000, 50000];

export const vehicleSlug = (vehicle) => vehicle.id;

export function vehicleBySlug(slug) {
  return vehicleById(slug);
}

/**
 * Break-even je Fahrleistung. Das ist der eigentliche Wert dieser Seiten:
 * die Frage "ab wie vielen Kilometern lohnt sich das?" beantwortet sonst
 * niemand mit einer Zahl.
 */
export function breakEvenMatrix(vehicle, baseInput = {}) {
  return KM_PROFILES.map((kmPerYear) => {
    const input = withDefaults({
      ...baseInput,
      profile: { ...(baseInput.profile || {}), kmPerYear },
    });
    const c = compareVehicle(input, vehicle);
    return {
      kmPerYear,
      breakEvenYears: c.breakEvenYears,
      totalAdvantage: c.totalAdvantage,
      annualSavings: c.annual.savingsFirstYear,
      years: c.years,
    };
  });
}

/** Die vier preislich nächsten Modelle - für die interne Verlinkung. */
export function relatedVehicles(vehicle, count = 4) {
  return vehicles
    .filter((v) => v.id !== vehicle.id)
    .map((v) => ({ v, distance: Math.abs(v.price - vehicle.price) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((entry) => entry.v);
}

/**
 * Rangliste für eine Fahrleistung: welches Modell erreicht den Break-even
 * am schnellsten? Fahrzeuge ohne Break-even landen hinten.
 */
export function rankingForKm(kmPerYear, limit = 10) {
  const input = withDefaults({ profile: { kmPerYear } });
  return vehicles
    .map((vehicle) => ({ vehicle, comparison: compareVehicle(input, vehicle) }))
    .sort((a, b) => {
      const av = a.comparison.breakEvenYears;
      const bv = b.comparison.breakEvenYears;
      if (av === null && bv === null) return b.comparison.totalAdvantage - a.comparison.totalAdvantage;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    })
    .slice(0, limit);
}

export function vehicleMeta(vehicle, comparison) {
  const label = vehicleLabel(vehicle);
  const verdict =
    comparison.breakEvenYears === null
      ? `rechnet sich bei 15.000 km im Jahr nicht innerhalb von ${comparison.years} Jahren`
      : `rechnet sich nach rund ${Math.round(comparison.breakEvenYears * 10) / 10} Jahren`;
  return {
    title: `${label}: Lohnt sich der Umstieg? Break-even und Kosten`,
    description: `Was kostet ein ${label} wirklich? Vollständige Kostenrechnung gegen den Verbrenner: Der Wagen ${verdict}. Mit Break-even je Fahrleistung und eigenen Werten nachrechenbar.`,
  };
}

export function kmProfileMeta(kmPerYear) {
  return {
    title: `E-Auto bei ${kmPerYear.toLocaleString('de-DE')} km im Jahr: Rechnet sich das?`,
    description: `Bei ${kmPerYear.toLocaleString('de-DE')} Kilometern pro Jahr erreichen diese Elektroautos den Break-even am schnellsten. Gerechnet mit Wertverlust, Ladekosten, Versicherung und Steuer.`,
  };
}
