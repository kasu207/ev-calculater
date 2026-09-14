import { z } from 'zod';

/**
 * Fahrzeugdatensatz: ein ausgeliefertes Elektromodell.
 *
 * `verbrauchKwhPro100km` ist der WLTP-Wert kombiniert ohne Ladeverluste.
 * Der Realaufschlag liegt nicht in den Daten, sondern in den Annahmen,
 * damit er in der Oberflaeche sichtbar und an einer Stelle aenderbar ist.
 */
export const FahrzeugSchema = z.object({
  id: z.string().min(1),
  marke: z.string().min(1),
  modell: z.string().min(1),
  variante: z.string().min(1),
  listenpreisEur: z.number().positive(),
  verbrauchKwhPro100km: z.number().positive(),
  kfzSteuerEurProJahr: z.number().min(0),
  thgQuoteEurProJahr: z.number().min(0),
  vergleichsId: z.string().min(1),
  partnerUrl: z.url(),
  partnerUrlGeprueft: z.boolean(),
  quelle: z.string().min(1),
  standDatum: z.iso.date(),
});

export const ReferenzSchema = z.object({
  id: z.string().min(1),
  marke: z.string().min(1),
  modell: z.string().min(1),
  listenpreisEur: z.number().positive(),
  verbrauchLPro100km: z.number().positive(),
  kraftstoff: z.enum(['benzin', 'diesel']),
  kfzSteuerEurProJahr: z.number().min(0),
  quelle: z.string().min(1),
  standDatum: z.iso.date(),
});

export const FahrzeugListeSchema = z.array(FahrzeugSchema).min(1);
export const ReferenzListeSchema = z.array(ReferenzSchema).min(1);

/** Eingaben des Nutzers. Zwei Felder, mehr fragt der Rechner nicht. */
export const EingabeSchema = z.object({
  kmProJahr: z.number().int().min(0).max(200_000),
  budgetEur: z.number().int().min(0).max(500_000),
});

export const AnnahmenSchema = z.object({
  strompreisEurProKwh: z.number().positive(),
  oeffentlichStrompreisEurProKwh: z.number().positive(),
  heimladeAnteil: z.number().min(0).max(1),
  kraftstoffpreisEurProLiter: z.object({
    benzin: z.number().positive(),
    diesel: z.number().positive(),
  }),
  realaufschlagAnteil: z.number().min(0).max(1),
  haltedauerJahre: z.number().int().positive().max(20),
});

export type Fahrzeug = z.infer<typeof FahrzeugSchema>;
export type Referenz = z.infer<typeof ReferenzSchema>;
export type Eingabe = z.infer<typeof EingabeSchema>;
export type Annahmen = z.infer<typeof AnnahmenSchema>;
