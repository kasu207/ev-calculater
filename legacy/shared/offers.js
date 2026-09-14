/**
 * Modellrechnungen für Kauf, Finanzierung und Leasing.
 *
 * WICHTIG: Das sind berechnete Richtwerte auf Basis marktüblicher
 * Konditionen, keine echten Händlerangebote. Es werden keine realen
 * Angebote abgerufen, erfunden oder als verbindlich dargestellt.
 */

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Marktüblicher Nachlass auf den Listenpreis je Marktsegment. */
function typicalDiscountRate(vehicle) {
  if (vehicle.price < 25000) return 0.04;
  if (vehicle.price < 40000) return 0.09;
  if (vehicle.price < 55000) return 0.11;
  return 0.12;
}

/** Annuität: monatliche Rate eines Ratenkredits. */
export function annuity(amount, annualRate, months) {
  if (months <= 0) return 0;
  const i = annualRate / 12;
  if (i === 0) return amount / months;
  return (amount * i) / (1 - Math.pow(1 + i, -months));
}

/**
 * Drei Beschaffungswege für ein Fahrzeug, jeweils mit den Annahmen,
 * aus denen sich die Zahl ergibt.
 */
export function buildOffers(input, vehicle, comparison, options = {}) {
  const months = num(options.termMonths, 36);
  const discountRate = typicalDiscountRate(vehicle);
  const negotiatedPrice = Math.round(vehicle.price * (1 - discountRate));
  const subsidy = num(input.ev?.subsidy);
  const tradeIn = num(input.current?.resaleValue);
  const creditRate = num(options.creditRate, 0.049);
  const leasingRate = num(options.leasingInterest, 0.055);

  const cashNeeded = Math.max(0, negotiatedPrice - subsidy - tradeIn);
  const financedAmount = Math.max(0, negotiatedPrice - subsidy - tradeIn);
  const financeMonthly = annuity(financedAmount, creditRate, months);

  // Leasing: Restwert nach Laufzeit, Differenz plus Verzinsung auf das
  // durchschnittlich gebundene Kapital, zuzüglich Händlermarge.
  const residual = vehicle.price * Math.pow(1 - num(input.ev?.depreciationRate, 0.16), months / 12);
  const leasingDown = Math.round(negotiatedPrice * 0.1);
  const leasingBase = negotiatedPrice - leasingDown - residual;
  const leasingInterest = ((negotiatedPrice + residual) / 2) * leasingRate * (months / 12);
  const leasingMonthly = ((leasingBase + leasingInterest) / months) * 1.06;

  return {
    disclaimer:
      'Modellrechnung auf Basis marktüblicher Konditionen - kein verbindliches Angebot.',
    listPrice: vehicle.price,
    discountRate,
    negotiatedPrice,
    options: [
      {
        id: 'cash',
        title: 'Barkauf mit Inzahlungnahme',
        headline: cashNeeded,
        headlineLabel: 'Einmalig zu zahlen',
        monthly: null,
        assumptions: [
          `Listenpreis ${vehicle.price.toLocaleString('de-DE')} EUR abzüglich ${Math.round(discountRate * 100)} Prozent branchenüblichem Nachlass`,
          subsidy > 0 ? `Förderung ${subsidy.toLocaleString('de-DE')} EUR` : 'Keine Förderung angesetzt',
          `Inzahlungnahme Altfahrzeug ${tradeIn.toLocaleString('de-DE')} EUR`,
        ],
        pro: 'Günstigste Gesamtkosten, keine Zinsen, freie Verfügung über das Fahrzeug.',
        contra: 'Hoher Kapitalabfluss auf einen Schlag.',
      },
      {
        id: 'finance',
        title: `Ratenkredit über ${months} Monate`,
        headline: financeMonthly,
        headlineLabel: 'Monatliche Rate',
        monthly: financeMonthly,
        assumptions: [
          `Finanzierungsbetrag ${Math.round(financedAmount).toLocaleString('de-DE')} EUR`,
          `Effektivzins ${(creditRate * 100).toFixed(1)} Prozent p. a.`,
          `Zinskosten gesamt rund ${Math.round(financeMonthly * months - financedAmount).toLocaleString('de-DE')} EUR`,
        ],
        pro: 'Fahrzeug gehört Ihnen, Restwertrisiko und Chance bleiben bei Ihnen.',
        contra: 'Zinsen erhöhen die Gesamtkosten gegenüber dem Barkauf.',
      },
      {
        id: 'leasing',
        title: `Leasing über ${months} Monate`,
        headline: leasingMonthly,
        headlineLabel: 'Monatliche Rate',
        monthly: leasingMonthly,
        assumptions: [
          `Anzahlung ${leasingDown.toLocaleString('de-DE')} EUR`,
          `Kalkulierter Restwert ${Math.round(residual).toLocaleString('de-DE')} EUR`,
          'Laufleistung 15.000 km pro Jahr, Mehrkilometer werden nachberechnet',
        ],
        pro: 'Kein Restwertrisiko, planbare Rate, regelmäßig neue Technik.',
        contra: 'Kein Eigentumsaufbau, Kilometerbindung, Rückgabeschäden werden berechnet.',
      },
    ],
    monthlyRunningCost: comparison ? comparison.annual.ev.total / 12 : null,
  };
}

/** Textbaustein, den der Nutzer für eine Händleranfrage kopieren kann. */
export function buildInquiryText(input, evaluation) {
  const v = evaluation.vehicle;
  const p = input.profile || {};
  const lines = [
    'Guten Tag,',
    '',
    `ich interessiere mich für einen ${v.brand} ${v.model} und bitte um ein Angebot.`,
    '',
    'Mein Profil:',
    `- Jahresfahrleistung: ca. ${Number(p.kmPerYear || 0).toLocaleString('de-DE')} km`,
    `- Längste regelmäßige Strecke: ca. ${Number(p.longestTripKm || 0).toLocaleString('de-DE')} km`,
    `- Laden überwiegend ${Math.round((input.ev?.homeChargeShare ?? 0.7) * 100)} Prozent zu Hause`,
    `- Inzahlungnahme: vorhandenes Fahrzeug${input.current?.label ? ` (${input.current.label})` : ''}, Zeitwert ca. ${Number(input.current?.resaleValue || 0).toLocaleString('de-DE')} EUR`,
    '',
    'Bitte senden Sie mir:',
    '1. Angebot Barkauf inkl. Überführung und Zulassung',
    '2. Finanzierungsangebot (36 und 48 Monate) mit Effektivzins',
    '3. Leasingangebot (36 Monate, 15.000 km/Jahr) mit Anzahlung und ohne',
    '4. Lieferzeit sowie mögliche Vorführ- oder Lagerfahrzeuge',
    '',
    'Vielen Dank und freundliche Grüße',
  ];
  return lines.join('\n');
}
