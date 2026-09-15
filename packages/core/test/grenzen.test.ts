import { describe, expect, it } from 'vitest';
import { STANDARD_ANNAHMEN } from '../src/annahmen';
import { annahmenGueltig, eingabeGueltig } from '../src/grenzen';
import { AnnahmenSchema, EingabeSchema } from '../src/schema';
import type { Annahmen, Eingabe } from '../src/schema';

/**
 * Die schnellen Pruefungen im Rechenkern und die Zod-Schemata muessen dasselbe
 * sagen. Sonst wandert eine Eingabe durch den Browser, die der Server abweist.
 */
const eingaben: unknown[] = [
  { kmProJahr: 15000, budgetEur: 45000 },
  { kmProJahr: 0, budgetEur: 0 },
  { kmProJahr: 200_000, budgetEur: 500_000 },
  { kmProJahr: 200_001, budgetEur: 45000 },
  { kmProJahr: -1, budgetEur: 45000 },
  { kmProJahr: 15000.5, budgetEur: 45000 },
  { kmProJahr: Number.NaN, budgetEur: 45000 },
  { kmProJahr: Number.POSITIVE_INFINITY, budgetEur: 45000 },
  { kmProJahr: '15000', budgetEur: 45000 },
  { kmProJahr: 15000, budgetEur: null },
];

const annahmen: unknown[] = [
  STANDARD_ANNAHMEN,
  { ...STANDARD_ANNAHMEN, haltedauerJahre: 0 },
  { ...STANDARD_ANNAHMEN, haltedauerJahre: 21 },
  { ...STANDARD_ANNAHMEN, haltedauerJahre: 3.5 },
  { ...STANDARD_ANNAHMEN, heimladeAnteil: -0.1 },
  { ...STANDARD_ANNAHMEN, heimladeAnteil: 1.5 },
  { ...STANDARD_ANNAHMEN, realaufschlagAnteil: 2 },
  { ...STANDARD_ANNAHMEN, strompreisEurProKwh: 0 },
  { ...STANDARD_ANNAHMEN, kraftstoffpreisEurProLiter: { benzin: 1.79 } },
];

describe('Grenzen', () => {
  it('urteilt bei Eingaben wie das Zod-Schema', () => {
    for (const eingabe of eingaben) {
      expect(eingabeGueltig(eingabe as Eingabe), JSON.stringify(eingabe)).toBe(
        EingabeSchema.safeParse(eingabe).success,
      );
    }
  });

  it('urteilt bei Annahmen wie das Zod-Schema', () => {
    for (const wert of annahmen) {
      expect(annahmenGueltig(wert as Annahmen), JSON.stringify(wert)).toBe(
        AnnahmenSchema.safeParse(wert).success,
      );
    }
  });
});
