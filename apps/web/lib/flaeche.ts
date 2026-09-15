import {
  STANDARD_ANNAHMEN,
  fahrzeuge,
  referenzNachId,
  restwert,
  vergleichen,
} from '@ampmatch/core';
import type { Empfehlung, Fahrzeug, Referenz } from '@ampmatch/core';

/**
 * Datengrundlage der oeffentlichen Seiten.
 *
 * Der Rechner ist eine einzige Adresse, deren Inhalt von zwei Parametern
 * abhaengt. Fuer eine Suchmaschine ist das genau eine Seite - der Canonical-Tag
 * zeigt bewusst immer auf `/`, damit nicht Tausende Parametervarianten
 * konkurrieren. Richtig entschieden, aber es bedeutet: es gibt keine zweite
 * Tuer. Wer den Rechner nicht schon kennt, findet ihn nicht.
 *
 * Diese Datei erzeugt die zweite Tuer. Aus denselben Daten und derselben
 * Rechnung entstehen Seiten zu zwei Fragen, die Menschen tatsaechlich
 * eintippen und die sonst niemand mit einer Zahl beantwortet:
 *
 *   "lohnt sich der [Modell]"          -> je Modell eine Seite
 *   "welches E-Auto bei [X] km"        -> je Fahrleistung eine Seite
 *
 * Die beiden Achsen stehen bewusst senkrecht zueinander: Die eine haelt das
 * Modell fest und variiert die Fahrleistung, die andere umgekehrt. Dadurch
 * wiederholt keine Seite den Inhalt einer anderen. Ein dritter Schnitt nach
 * Budget waere leicht zu ergaenzen und wuerde genau dieses Verhaeltnis
 * zerstoeren - deshalb erst, wenn Zahlen dafuer sprechen.
 */

/** Fahrleistungen mit eigener Seite. Deckt die gaengigen Suchanfragen ab. */
export const FAHRLEISTUNGEN = [5000, 10000, 15000, 20000, 30000, 50000] as const;

/** Budget fuer die Modellseiten: hoch genug, dass kein Modell herausfaellt. */
const OHNE_BUDGETGRENZE = 500_000;

export type ModellPunkt = {
  kmProJahr: number;
  empfehlung: Omit<Empfehlung, 'annahmen'>;
};

export type ModellSeite = {
  fahrzeug: Fahrzeug;
  referenz: Referenz;
  /** Dieselbe Rechnung ueber alle Fahrleistungen - der Kern dieser Seite. */
  matrix: ModellPunkt[];
  /** Ergebnis bei der Standardfahrleistung, fuer Titel und Kennzahlen. */
  standard: Omit<Empfehlung, 'annahmen'>;
  /** Wertverlust ueber die Haltedauer, beide Seiten - der groesste Posten. */
  wertverlustEur: number;
  wertverlustReferenzEur: number;
};

export function modellSeite(modellId: string): ModellSeite | null {
  const fahrzeug = fahrzeuge.find((f) => f.id === modellId);
  if (!fahrzeug) return null;
  const referenz = referenzNachId(fahrzeug.vergleichsId);
  if (!referenz) return null;

  const matrix = FAHRLEISTUNGEN.map((kmProJahr) => ({
    kmProJahr,
    empfehlung: vergleichen(
      fahrzeug,
      referenz,
      { kmProJahr, budgetEur: OHNE_BUDGETGRENZE },
      STANDARD_ANNAHMEN,
    ),
  }));

  const standard = matrix.find((p) => p.kmProJahr === 15000)!.empfehlung;
  const wertverlustEur = Math.round(
    fahrzeug.listenpreisEur -
      restwert(
        fahrzeug.listenpreisEur,
        STANDARD_ANNAHMEN.wertverlustElektrischProJahr,
        STANDARD_ANNAHMEN.haltedauerJahre,
      ),
  );

  const wertverlustReferenzEur = Math.round(
    referenz.listenpreisEur -
      restwert(
        referenz.listenpreisEur,
        STANDARD_ANNAHMEN.wertverlustVerbrennerProJahr,
        STANDARD_ANNAHMEN.haltedauerJahre,
      ),
  );

  return { fahrzeug, referenz, matrix, standard, wertverlustEur, wertverlustReferenzEur };
}

export type Platzierung = {
  fahrzeug: Fahrzeug;
  referenz: Referenz;
  empfehlung: Omit<Empfehlung, 'annahmen'>;
};

/**
 * Rangliste aller Modelle bei einer Fahrleistung, nach Gesamtdifferenz.
 * Dieselbe Ordnung, die auch der Rechner verwendet - eine zweite Sortierung
 * waere eine zweite Wahrheit.
 */
export function rangliste(kmProJahr: number): Platzierung[] {
  const eingabe = { kmProJahr, budgetEur: OHNE_BUDGETGRENZE };

  return fahrzeuge
    .flatMap((fahrzeug) => {
      const referenz = referenzNachId(fahrzeug.vergleichsId);
      if (!referenz) return [];
      return [{ fahrzeug, referenz, empfehlung: vergleichen(fahrzeug, referenz, eingabe, STANDARD_ANNAHMEN) }];
    })
    .sort((a, b) => b.empfehlung.differenzGesamtEur - a.empfehlung.differenzGesamtEur);
}

/** Vier Modelle im aehnlichen Preisbereich - fuer die interne Verlinkung. */
export function preisNachbarn(fahrzeug: Fahrzeug, anzahl = 4): Fahrzeug[] {
  return fahrzeuge
    .filter((f) => f.id !== fahrzeug.id)
    .map((f) => ({ f, abstand: Math.abs(f.listenpreisEur - fahrzeug.listenpreisEur) }))
    .sort((a, b) => a.abstand - b.abstand)
    .slice(0, anzahl)
    .map((eintrag) => eintrag.f);
}

export const modellPfad = (id: string) => `/e-auto/${id}`;
export const fahrleistungPfad = (km: number) => `/fahrleistung/${km}-km`;

/** Alle Modellkennungen - fuer generateStaticParams und die Sitemap. */
export function alleModellIds(): string[] {
  return fahrzeuge.map((f) => f.id);
}
