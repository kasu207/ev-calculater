/**
 * Gueltigkeitsgrenzen der Eingaben und Annahmen als einfache Pruefungen.
 *
 * Bewusst ohne Zod: der Rechenkern laeuft auch im Browser, und die
 * Validierungsbibliothek waere dort der groesste einzelne Posten im Bundle.
 * `test/grenzen.test.ts` haelt diese Pruefungen und die Zod-Schemata deckungsgleich.
 */
import type { Annahmen, Eingabe } from './schema';

export const EINGABE_GRENZEN = {
  kmProJahr: { min: 0, max: 200_000 },
  budgetEur: { min: 0, max: 500_000 },
} as const;

function ganzZahlIn(wert: unknown, min: number, max: number): boolean {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= min && wert <= max;
}

function zahlIn(wert: unknown, min: number, max: number): boolean {
  return typeof wert === 'number' && Number.isFinite(wert) && wert >= min && wert <= max;
}

export function eingabeGueltig(eingabe: Eingabe): boolean {
  return (
    ganzZahlIn(eingabe?.kmProJahr, EINGABE_GRENZEN.kmProJahr.min, EINGABE_GRENZEN.kmProJahr.max) &&
    ganzZahlIn(eingabe?.budgetEur, EINGABE_GRENZEN.budgetEur.min, EINGABE_GRENZEN.budgetEur.max)
  );
}

export function annahmenGueltig(a: Annahmen): boolean {
  if (!a || typeof a !== 'object') return false;
  const kraftstoff = a.kraftstoffpreisEurProLiter;
  return (
    zahlIn(a.strompreisEurProKwh, Number.MIN_VALUE, Number.MAX_VALUE) &&
    zahlIn(a.oeffentlichStrompreisEurProKwh, Number.MIN_VALUE, Number.MAX_VALUE) &&
    zahlIn(a.heimladeAnteil, 0, 1) &&
    Boolean(kraftstoff) &&
    zahlIn(kraftstoff?.benzin, Number.MIN_VALUE, Number.MAX_VALUE) &&
    zahlIn(kraftstoff?.diesel, Number.MIN_VALUE, Number.MAX_VALUE) &&
    zahlIn(a.realaufschlagAnteil, 0, 1) &&
    ganzZahlIn(a.haltedauerJahre, 1, 20)
  );
}
