const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

const zweiStellen = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function alsEuro(betrag: number): string {
  return euro.format(Math.round(betrag));
}

export function alsZahl(wert: number): string {
  return zahl.format(wert);
}

export function alsPreis(betrag: number): string {
  return `${zweiStellen.format(betrag)} €`;
}

export function alsProzent(anteil: number): string {
  return `${zahl.format(anteil * 100)} %`;
}
