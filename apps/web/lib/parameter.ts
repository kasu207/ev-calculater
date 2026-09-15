import { z } from 'zod';
import type { Eingabe } from '@ampmatch/core';
import { GRENZEN, VORBELEGUNG } from '@/lib/eingabe';

// Erlaubt sind ganze Zahlen, auch mit Tausenderpunkt: 15000 und 15.000 meinen dasselbe.
const ZahlAusParameter = z
  .string()
  .transform((wert) => wert.trim().replace(/[.\s]/g, ''))
  .refine((wert) => /^\d+$/.test(wert))
  .transform(Number);

const ParameterSchema = z.object({
  km: ZahlAusParameter.pipe(z.number().min(GRENZEN.km.min).max(GRENZEN.km.max)).optional(),
  budget: ZahlAusParameter.pipe(
    z.number().min(GRENZEN.budget.min).max(GRENZEN.budget.max),
  ).optional(),
});

type RoheParameter = Record<string, string | string[] | undefined>;

function erster(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert;
}

/**
 * Liest km und budget aus der URL. Ungueltige Werte fallen einzeln auf die
 * Vorbelegung zurueck, damit ein geteilter Link nie auf einer Fehlerseite endet.
 */
export function eingabeAusParametern(parameter: RoheParameter = {}): Eingabe {
  const km = ParameterSchema.shape.km.safeParse(erster(parameter.km));
  const budget = ParameterSchema.shape.budget.safeParse(erster(parameter.budget));

  return {
    kmProJahr: km.success && km.data !== undefined ? km.data : VORBELEGUNG.kmProJahr,
    budgetEur: budget.success && budget.data !== undefined ? budget.data : VORBELEGUNG.budgetEur,
  };
}

export { GRENZEN, VORBELEGUNG, permalink } from '@/lib/eingabe';
