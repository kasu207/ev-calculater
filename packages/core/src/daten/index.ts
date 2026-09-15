import type { Fahrzeug, Referenz } from '../schema';
import fahrzeugeRoh from './fahrzeuge.json';
import referenzenRoh from './referenz.json';

/**
 * Die Daten werden nicht zur Laufzeit gegen das Schema geprueft, sondern in
 * `test/daten.test.ts` und damit in der CI. Ein fehlerhafter Datensatz faellt
 * so vor dem Merge auf, und der Browser laedt keine Validierungsbibliothek mit.
 */
export const fahrzeuge: readonly Fahrzeug[] = fahrzeugeRoh as Fahrzeug[];
export const referenzen: readonly Referenz[] = referenzenRoh as Referenz[];

export function fahrzeugNachId(id: string): Fahrzeug | undefined {
  return fahrzeuge.find((f) => f.id === id);
}

export function referenzNachId(id: string): Referenz | undefined {
  return referenzen.find((r) => r.id === id);
}

/** Guenstigstes ausgeliefertes Modell, fuer die Meldung bei zu kleinem Budget. */
export function guenstigstesFahrzeug(): Fahrzeug {
  return fahrzeuge.reduce((a, b) => (b.listenpreisEur < a.listenpreisEur ? b : a));
}
