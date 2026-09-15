import type { Annahmen } from './schema';

/**
 * Standardannahmen des Rechners.
 *
 * Jeder Wert steht so auch im aufklappbaren Annahmen-Bereich der Oberflaeche.
 * Wer hier etwas aendert, aendert das Ergebnis jedes Nutzers, deshalb gehoert
 * zu jeder Aenderung eine Quelle im Pull Request.
 */
export const STANDARD_ANNAHMEN: Annahmen = {
  /** Haushaltsstrom, bundesweiter Durchschnitt Neuvertrag. */
  strompreisEurProKwh: 0.34,
  /** Ladesaeule ausserhalb, Mischpreis AC und DC ohne Ladekarte. */
  oeffentlichStrompreisEurProKwh: 0.59,
  /** Offene Entscheidung 3 aus dem Sprintdokument: feste Annahme statt dritter Eingabe. */
  heimladeAnteil: 0.8,
  kraftstoffpreisEurProLiter: {
    benzin: 1.79,
    diesel: 1.69,
  },
  /** Offene Entscheidung 2: Aufschlag auf den WLTP-Wert, beidseitig angesetzt. */
  realaufschlagAnteil: 0.15,
  /** Entscheidung 1: drei Jahre, die uebliche Haltedauer im Dienstwagen. */
  haltedauerJahre: 3,
};

/** Was das Kostenmodell bewusst nicht enthaelt. Wird in der Oberflaeche ausgewiesen. */
export const NICHT_ENTHALTEN = [
  'Wartung und Verschleiss',
  'Versicherung',
  'Restwert beim Verkauf',
  'Foerderungen und Zuschuesse',
  'Finanzierungs- und Leasingkosten',
] as const;
