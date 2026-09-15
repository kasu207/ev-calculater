/**
 * Oeffentliche Flaeche des Rechenkerns.
 *
 * Bewusst ohne die Zod-Schemata: dieses Modul laeuft auch im Browser, und ein
 * Re-Export der Schemata zoege die Validierungsbibliothek in das Bundle. Wer
 * Schemata braucht (Server, Tests, Datenpflege), importiert `@ampmatch/core/schema`.
 */
export { STANDARD_ANNAHMEN, NICHT_ENTHALTEN } from './annahmen';
export { EINGABE_GRENZEN, annahmenGueltig, eingabeGueltig } from './grenzen';
export {
  effektiverStrompreis,
  empfehlen,
  empfehlenAus,
  jahreskostenElektrisch,
  jahreskostenVerbrenner,
  restwert,
  vergleichen,
} from './berechnung';
export type { Empfehlung, Jahrespunkt } from './berechnung';
export {
  fahrzeuge,
  fahrzeugNachId,
  guenstigstesFahrzeug,
  referenzen,
  referenzNachId,
} from './daten';
export type { Annahmen, Eingabe, Fahrzeug, Referenz } from './schema';
