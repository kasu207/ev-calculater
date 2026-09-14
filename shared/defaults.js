/**
 * Vorbelegung aller Eingaben. Die Werte sind bewusst konservative
 * Durchschnittswerte für Deutschland und können im Formular überschrieben
 * werden. Quellenlage: Kraftstoff- und Strompreise schwanken stark, deshalb
 * sind alle Preise Eingabefelder und keine fest verdrahteten Konstanten.
 */
export const defaults = {
  /**
   * 'keep'    - Altauto behalten gegen E-Auto kaufen.
   * 'replace' - Es wird ohnehin ein neues Auto gekauft: neuer Verbrenner
   *             gegen E-Auto. Der Wertverlust fällt dann in beiden
   *             Szenarien an und das Ergebnis fällt deutlich anders aus.
   */
  scenario: 'keep',
  profile: {
    kmPerYear: 15000,
    horizonYears: 8,
    longestTripKm: 400,
    longTripsPerYear: 6,
  },
  current: {
    label: '',
    fuelType: 'benzin',
    resaleValue: 9000,
    consumptionL100: 7.2,
    fuelPrice: 1.79,
    insurance: 620,
    tax: 180,
    maintenance: 750,
    otherCosts: 0,
    depreciationRate: 0.11,
  },
  replacement: {
    price: 0,
    consumptionL100: 6.4,
    insurance: 700,
    tax: 180,
    maintenance: 600,
    depreciationRate: 0.13,
  },
  /**
   * Preisprognose. Die gesamte Rechnung läuft in heutigen Euro, deshalb sind
   * hier reale Steigerungen einzutragen - also der Anteil, der über die
   * allgemeine Inflation hinausgeht.
   */
  prices: {
    fuelGrowth: 0.02,
    electricityGrowth: 0.01,
  },
  ev: {
    homeChargeShare: 0.7,
    homePrice: 0.32,
    publicPrice: 0.55,
    chargingLossPct: 0.08,
    insuranceFactor: 1.05,
    tax: 0,
    maintenanceFactor: 0.62,
    wallboxCost: 1400,
    subsidy: 0,
    thgBonus: 75,
    depreciationRate: 0.16,
    capitalCostRate: 0.025,
  },
  needs: {
    budget: 40000,
    seats: 5,
    towing: 0,
    minRangeKm: 0,
    minBootLiters: 0,
    bodyPreference: [],
    fastChargeImportant: false,
  },
};

/** Tiefe Zusammenführung von Nutzereingaben mit den Vorgabewerten. */
export function withDefaults(input = {}) {
  const out = {};
  for (const [section, value] of Object.entries(defaults)) {
    if (value && typeof value === 'object') {
      out[section] = { ...value, ...(input[section] || {}) };
    } else {
      out[section] = input[section] ?? value;
    }
  }
  return out;
}
