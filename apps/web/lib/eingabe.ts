import type { Eingabe } from '@ampmatch/core';

/**
 * Werte, die Client und Server teilen. Bewusst frei von Zod, damit die
 * Validierungsbibliothek nicht ueber diesen Umweg im Browser-Bundle landet.
 */
export const VORBELEGUNG: Eingabe = { kmProJahr: 15000, budgetEur: 45000 };

/** Grenzen der Eingabefelder. Ausserhalb faellt der Rechner auf die Vorbelegung zurueck. */
export const GRENZEN = {
  km: { min: 0, max: 100_000, schritt: 500 },
  budget: { min: 10_000, max: 120_000, schritt: 500 },
} as const;

/** Permalink zum aktuellen Ergebnis. */
export function permalink(eingabe: Eingabe, pfad = '/rechner'): string {
  return `${pfad}?km=${eingabe.kmProJahr}&budget=${eingabe.budgetEur}`;
}
