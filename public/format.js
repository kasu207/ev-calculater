const eur0 = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dec = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export const money = (v) => eur0.format(Math.round(Number(v) || 0));
export const moneyExact = (v) => eur2.format(Number(v) || 0);
export const number = (v) => int.format(Math.round(Number(v) || 0));
export const decimal = (v) => dec.format(Number(v) || 0);
export const percent = (v) => `${dec.format((Number(v) || 0) * 100)} %`;

/** Signierter Betrag: führendes Plus macht Vorteile sofort erkennbar. */
export function signedMoney(v) {
  const n = Math.round(Number(v) || 0);
  return `${n > 0 ? '+' : ''}${money(n)}`;
}

/** Jahreswert als "3 Jahre 4 Monate". Null Monate heisst: von Beginn an. */
export function duration(years) {
  if (years === null || years === undefined) return 'nicht erreicht';
  const totalMonths = Math.round(years * 12);
  if (totalMonths <= 0) return 'sofort';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} Monate`;
  if (m === 0) return `${y} ${y === 1 ? 'Jahr' : 'Jahre'}`;
  return `${y} ${y === 1 ? 'Jahr' : 'Jahre'} ${m} Mon.`;
}

/**
 * Dieselbe Dauer im Dativ, für Sätze mit "nach" oder "ab".
 * Ohne das steht dort "nach 7 Jahre" statt "nach 7 Jahren".
 */
export function durationAfter(years) {
  if (years === null || years === undefined) return 'nicht erreicht';
  const totalMonths = Math.round(years * 12);
  if (totalMonths <= 0) return 'sofort';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} Monaten`;
  if (m === 0) return `${y} ${y === 1 ? 'Jahr' : 'Jahren'}`;
  return `${y} ${y === 1 ? 'Jahr' : 'Jahren'} ${m} Mon.`;
}

export function km(v) {
  const n = Number(v) || 0;
  if (n >= 100000) return `${int.format(Math.round(n / 1000))} Tsd. km`;
  return `${int.format(Math.round(n))} km`;
}
