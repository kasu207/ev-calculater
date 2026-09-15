/**
 * Stellschrauben mit gerechneter Wirkung.
 *
 * Der Ansatz: statt neben das Ergebnis einen Werbeblock zu stellen, wird
 * ausgerechnet, was eine konkrete Änderung am Ergebnis bewegt - wie viele
 * Monate früher der Break-even liegt, wenn der Ladestrom sechs Cent
 * günstiger wird. Erst diese Zahl macht einen Hinweis auf einen Anbieter
 * vertretbar: der Nutzen ist belegt, bevor irgendwo ein Link steht.
 *
 * Jeder Hebel wird durch eine vollständige Neuberechnung ermittelt, nicht
 * durch eine Näherung. Das kostet ein paar Millisekunden und ist dafür
 * immer konsistent mit dem Hauptergebnis.
 */

import { compareVehicle } from './calc.js';
import { withDefaults } from './defaults.js';

/** Monate Differenz im Break-even. Positiv = früher am Ziel. */
function breakEvenGainMonths(base, variant) {
  if (base.breakEvenMonths === null && variant.breakEvenMonths === null) return 0;
  // Vorher nie rentabel, jetzt schon: die gewonnene Zeit ist mindestens der
  // Rest des Betrachtungszeitraums. Mehr lässt sich seriös nicht sagen.
  if (base.breakEvenMonths === null) return base.years * 12 - variant.breakEvenMonths;
  if (variant.breakEvenMonths === null) return -(variant.years * 12 - base.breakEvenMonths);
  return base.breakEvenMonths - variant.breakEvenMonths;
}

function delta(base, variant) {
  return {
    breakEvenGainMonths: breakEvenGainMonths(base, variant),
    totalGain: variant.totalAdvantage - base.totalAdvantage,
    annualGain: variant.annual.savingsFirstYear - base.annual.savingsFirstYear,
    reachesBreakEven: base.breakEvenMonths === null && variant.breakEvenMonths !== null,
  };
}

/**
 * Die drei Hebel, die ein Nutzer nach der Kaufentscheidung tatsächlich noch
 * in der Hand hat. Alle Annahmen sind konservativ gewählt und werden im
 * Ergebnis mitgeliefert, damit sie nachprüfbar bleiben.
 */
export function buildLevers(rawInput, vehicle, options = {}) {
  const input = withDefaults(rawInput);
  const base = compareVehicle(input, vehicle);

  const tariffSaving = Number(options.tariffSavingPerKwh ?? 0.06);
  const thgTarget = Number(options.thgBonus ?? 90);
  const homeShareTarget = Number(options.homeChargeShare ?? 0.9);

  const levers = [];

  // Hebel 1: günstigerer Haushalts- oder Autostromtarif.
  // Nur sinnvoll, solange überhaupt zu Hause geladen wird.
  const newHomePrice = Math.max(0.05, input.ev.homePrice - tariffSaving);
  if (input.ev.homeChargeShare > 0.05 && newHomePrice < input.ev.homePrice) {
    const variant = compareVehicle(
      { ...input, ev: { ...input.ev, homePrice: newHomePrice } },
      vehicle,
    );
    levers.push({
      id: 'tariff',
      title: 'Günstiger Strom laden',
      change: `${(input.ev.homePrice * 100).toFixed(0)} statt ${(newHomePrice * 100).toFixed(0)} Cent je kWh zu Hause`,
      explanation:
        'Autostrom- und Wärmepumpentarife liegen regelmäßig unter dem Haushaltstarif, weil das Laden netzdienlich gesteuert werden kann.',
      assumption: `Angesetzt sind ${(tariffSaving * 100).toFixed(0)} Cent Ersparnis je kWh.`,
      ...delta(base, variant),
    });
  }

  // Hebel 2: höherer Heimladeanteil. Setzt eine Lademöglichkeit voraus,
  // deshalb fällt der Hebel weg, wenn ohnehin fast alles zu Hause lädt.
  if (input.ev.homeChargeShare < homeShareTarget - 0.05) {
    const variant = compareVehicle(
      { ...input, ev: { ...input.ev, homeChargeShare: homeShareTarget } },
      vehicle,
    );
    levers.push({
      id: 'wallbox',
      title: 'Mehr zu Hause laden statt unterwegs',
      change: `${Math.round(homeShareTarget * 100)} statt ${Math.round(input.ev.homeChargeShare * 100)} Prozent Heimladeanteil`,
      explanation:
        'Öffentliches Schnellladen kostet in der Regel das Doppelte. Der Ladeanteil zu Hause ist deshalb der zweitgrößte Hebel nach dem Wertverlust.',
      assumption: `Die angesetzten Wallbox-Kosten von ${Math.round(input.ev.wallboxCost).toLocaleString('de-DE')} EUR stecken bereits in beiden Rechnungen.`,
      ...delta(base, variant),
    });
  }

  // Hebel 3: THG-Quote. Kleiner Betrag, aber jährlich wiederkehrend und
  // ohne Gegenleistung - deshalb gehört er in die Liste.
  if (input.ev.thgBonus < thgTarget) {
    const variant = compareVehicle(
      { ...input, ev: { ...input.ev, thgBonus: thgTarget } },
      vehicle,
    );
    levers.push({
      id: 'thg',
      title: 'THG-Quote jedes Jahr vermarkten',
      change: `${thgTarget} statt ${Math.round(input.ev.thgBonus)} EUR pro Jahr`,
      explanation:
        'Die Treibhausgasminderungsquote steht jedem Halter eines reinen E-Autos zu und wird einmal jährlich neu verkauft.',
      assumption: 'Die Vergütung schwankt mit dem Quotenpreis und ist nicht garantiert.',
      ...delta(base, variant),
    });
  }

  return {
    baseBreakEvenMonths: base.breakEvenMonths,
    years: base.years,
    // Sortiert nach Wirkung, damit oben steht, was am meisten bringt.
    levers: levers.sort((a, b) => b.totalGain - a.totalGain),
  };
}
