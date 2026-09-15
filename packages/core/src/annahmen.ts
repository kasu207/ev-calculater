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

  /**
   * Wertverlust je Jahr, geometrisch auf den jeweiligen Restwert.
   *
   * Bei drei Jahren Haltedauer ist das der groesste Posten der ganzen
   * Rechnung - groesser als Energie, Steuer und THG-Quote zusammen. Ihn
   * wegzulassen hiesse, den Vergleich am wichtigsten Punkt offen zu lassen.
   *
   * Elektrisch faellt er derzeit hoeher aus: hohe Neuwagenrabatte, schnelle
   * Modellwechsel und die Unsicherheit ueber die Batterie druecken die
   * Gebrauchtpreise staerker als beim Verbrenner. 20 Prozent je Jahr
   * entsprechen rund 51 Prozent Restwert nach drei Jahren, 16 Prozent
   * rund 59 Prozent.
   *
   * Die Werte stehen hier und nicht in den Fahrzeugdaten - aus demselben
   * Grund wie der Realaufschlag: modellgenaue Restwertprognosen gibt es
   * nicht belegbar frei, und eine erfundene Genauigkeit je Fahrzeug waere
   * schlechter als ein offen ausgewiesener Durchschnitt.
   */
  wertverlustElektrischProJahr: 0.2,
  wertverlustVerbrennerProJahr: 0.16,

  /** Entscheidung 1: drei Jahre, die uebliche Haltedauer im Dienstwagen. */
  haltedauerJahre: 3,
};

/** Was das Kostenmodell bewusst nicht enthaelt. Wird in der Oberflaeche ausgewiesen. */
export const NICHT_ENTHALTEN = [
  'Wartung und Verschleiss',
  'Versicherung',
  'Foerderungen und Zuschuesse',
  'Finanzierungs- und Leasingkosten',
] as const;
