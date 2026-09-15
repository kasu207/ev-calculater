/**
 * Ertragsquellen.
 *
 * Jeder Eintrag hÃ¤ngt an genau einem gerechneten Hebel aus levers.js. Ein
 * Hinweis auf einen Anbieter erscheint nur, wenn der zugehÃ¶rige Hebel im
 * konkreten Fall Ã¼berhaupt etwas bringt - sonst bleibt der Platz leer.
 *
 * WICHTIG, bevor etwas live geht:
 * 1. `enabled` steht Ã¼berall auf false. Erst einschalten, wenn ein echter
 *    Partnervertrag besteht und die URL die eigene Partnerkennung trÃ¤gt.
 *    Ein aktivierter Eintrag ohne Vertrag wÃ¤re schlicht eine Falschangabe.
 * 2. Werbliche Links sind in Deutschland kennzeichnungspflichtig. Die
 *    Kennzeichnung steckt fest im Markup und lÃ¤sst sich nicht abschalten.
 * 3. Affiliate-Links brauchen rel="sponsored nofollow noopener".
 *
 * `payoutEur` ist die erwartete VergÃ¼tung pro Abschluss. Sie wird nicht
 * angezeigt, sondern dient der Auswertung im Dashboard: Klicks mal
 * Abschlussquote mal VergÃ¼tung ergibt die Prognose.
 */

export const partners = [
  {
    id: 'tariff',
    leverId: 'tariff',
    enabled: false,
    label: 'Autostromtarife vergleichen',
    provider: 'PARTNER EINTRAGEN',
    url: 'https://example.invalid/autostrom?ref=DEINE-KENNUNG',
    description:
      'Tarifvergleich für Haushalts- und Autostrom. Der Wechsel dauert wenige Minuten, der Netzbetreiber bleibt derselbe.',
    payoutEur: 40,
    // Grobe Erfahrungswerte für die Prognose, keine Zusage.
    expectedConversion: 0.04,
  },
  {
    id: 'wallbox',
    leverId: 'wallbox',
    enabled: false,
    label: 'Wallbox-Angebote einholen',
    provider: 'PARTNER EINTRAGEN',
    url: 'https://example.invalid/wallbox?ref=DEINE-KENNUNG',
    description:
      'Angebote von Elektrofachbetrieben aus der Region inklusive Anmeldung beim Netzbetreiber.',
    payoutEur: 35,
    expectedConversion: 0.05,
  },
  {
    id: 'thg',
    leverId: 'thg',
    enabled: false,
    label: 'THG-Quote verkaufen',
    provider: 'PARTNER EINTRAGEN',
    url: 'https://example.invalid/thg?ref=DEINE-KENNUNG',
    description:
      'Einmal im Jahr den Fahrzeugschein hochladen. Greift erst, sobald das E-Auto auf Sie zugelassen ist.',
    payoutEur: 8,
    expectedConversion: 0.08,
  },
  {
    id: 'leasing',
    leverId: null, // HÃ¤ngt nicht an einem Hebel, sondern am Beschaffungsweg.
    enabled: false,
    label: 'Leasing- und Kaufangebote vergleichen',
    provider: 'PARTNER EINTRAGEN',
    url: 'https://example.invalid/leasing?ref=DEINE-KENNUNG',
    description:
      'HÃ¤ndlerangebote zum ausgewÃ¤hlten Modell, ohne selbst herumtelefonieren zu mÃ¼ssen.',
    payoutEur: 70,
    expectedConversion: 0.02,
  },
];

export function partnerById(id) {
  return partners.find((p) => p.id === id) || null;
}

/** Nur eingeschaltete Partner, die zu einem der berechneten Hebel passen. */
export function activePartnersFor(leverIds) {
  const set = new Set(leverIds);
  return partners.filter((p) => p.enabled && (p.leverId === null || set.has(p.leverId)));
}

/**
 * Ertragsprognose für das Dashboard. Bewusst ohne SchÃ¶nrechnen: gezÃ¤hlt
 * werden echte Klicks, multipliziert mit der hinterlegten Erwartung.
 */
export function forecastRevenue(clicksByPartner = {}) {
  let total = 0;
  const rows = [];
  for (const p of partners) {
    const clicks = Number(clicksByPartner[p.id] || 0);
    const expected = clicks * p.expectedConversion * p.payoutEur;
    total += expected;
    rows.push({ id: p.id, label: p.label, enabled: p.enabled, clicks, expected });
  }
  return { rows, total };
}
