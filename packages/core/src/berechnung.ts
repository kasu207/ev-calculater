import { STANDARD_ANNAHMEN } from './annahmen';
import { fahrzeuge as standardFahrzeuge, referenzen as standardReferenzen } from './daten';
import { annahmenGueltig, eingabeGueltig } from './grenzen';
import type { Annahmen, Eingabe, Fahrzeug, Referenz } from './schema';

export type Jahrespunkt = {
  jahr: number;
  kumuliertElektrisch: number;
  kumuliertVerbrenner: number;
};

export type Empfehlung = {
  modellId: string;
  vergleichsId: string;
  /** Kleinstes Jahr, in dem elektrisch nicht mehr teurer ist. null = keines innerhalb der Haltedauer. */
  breakEvenJahr: number | null;
  /** Positiv = Ersparnis gegenueber dem Verbrenner ueber die gesamte Haltedauer. */
  differenzGesamtEur: number;
  jahresreihe: Jahrespunkt[];
  annahmen: Annahmen;
};

/**
 * Restwert nach `jahre` Jahren, geometrisch: ein gleichbleibender Prozentsatz
 * auf den jeweils verbliebenen Wert. Linear waere einfacher und falsch - ein
 * Auto verliert im ersten Jahr deutlich mehr als im dritten.
 */
export function restwert(listenpreisEur: number, wertverlustProJahr: number, jahre: number): number {
  return listenpreisEur * Math.pow(1 - wertverlustProJahr, jahre);
}

/** Mischpreis aus Heim- und Ladesaeulenstrom. */
export function effektiverStrompreis(a: Annahmen): number {
  return (
    a.heimladeAnteil * a.strompreisEurProKwh +
    (1 - a.heimladeAnteil) * a.oeffentlichStrompreisEurProKwh
  );
}

/** Laufende Kosten eines Jahres, elektrisch. THG-Quote zaehlt als Gutschrift. */
export function jahreskostenElektrisch(f: Fahrzeug, kmProJahr: number, a: Annahmen): number {
  const verbrauch = f.verbrauchKwhPro100km * (1 + a.realaufschlagAnteil);
  const energie = (kmProJahr / 100) * verbrauch * effektiverStrompreis(a);
  return energie + f.kfzSteuerEurProJahr - f.thgQuoteEurProJahr;
}

/** Laufende Kosten eines Jahres, Verbrenner. */
export function jahreskostenVerbrenner(r: Referenz, kmProJahr: number, a: Annahmen): number {
  const verbrauch = r.verbrauchLPro100km * (1 + a.realaufschlagAnteil);
  const preis = a.kraftstoffpreisEurProLiter[r.kraftstoff];
  const energie = (kmProJahr / 100) * verbrauch * preis;
  return energie + r.kfzSteuerEurProJahr;
}

/**
 * Kumulierte Kosten beider Seiten ueber die Haltedauer, auf ganze Euro gerundet.
 *
 * Gerechnet wird, was das Auto bis zum Jahr N wirklich gekostet hat, wenn man
 * es dann verkauft: Anschaffung minus Restwert plus die laufenden Kosten.
 * Deshalb starten beide Reihen im Jahr 0 bei null - da ist noch nichts
 * verloren. Erst der Wertverlust laesst sie auseinanderlaufen.
 *
 * Das ist der Unterschied zur frueheren Fassung, die den Listenpreis als
 * versunkenen Betrag stehen liess. Sie zeigte dadurch einen Abstand, den kein
 * Verbrauchsvorteil in drei Jahren einholen konnte - und liess die groesste
 * Position der Rechnung ganz aus.
 */
export function vergleichen(
  f: Fahrzeug,
  r: Referenz,
  e: Eingabe,
  a: Annahmen,
): Omit<Empfehlung, 'annahmen'> {
  const proJahrElektrisch = jahreskostenElektrisch(f, e.kmProJahr, a);
  const proJahrVerbrenner = jahreskostenVerbrenner(r, e.kmProJahr, a);

  const jahresreihe: Jahrespunkt[] = [];
  for (let jahr = 0; jahr <= a.haltedauerJahre; jahr += 1) {
    const wertverlustElektrisch =
      f.listenpreisEur - restwert(f.listenpreisEur, a.wertverlustElektrischProJahr, jahr);
    const wertverlustVerbrenner =
      r.listenpreisEur - restwert(r.listenpreisEur, a.wertverlustVerbrennerProJahr, jahr);

    jahresreihe.push({
      jahr,
      kumuliertElektrisch: Math.round(wertverlustElektrisch + jahr * proJahrElektrisch),
      kumuliertVerbrenner: Math.round(wertverlustVerbrenner + jahr * proJahrVerbrenner),
    });
  }

  const ende = jahresreihe[jahresreihe.length - 1]!;
  // Ab Jahr 1 gesucht: im Jahr 0 stehen beide Seiten zwangslaeufig bei null,
  // ein Treffer dort waere kein Ergebnis, sondern ein Artefakt des Anfangs.
  const treffer = jahresreihe
    .slice(1)
    .find((p) => p.kumuliertElektrisch <= p.kumuliertVerbrenner);

  return {
    modellId: f.id,
    vergleichsId: r.id,
    breakEvenJahr: treffer ? treffer.jahr : null,
    differenzGesamtEur: ende.kumuliertVerbrenner - ende.kumuliertElektrisch,
    jahresreihe,
  };
}

/**
 * Auswahlregel: unter allen Fahrzeugen im Budget gewinnt die hoechste
 * Gesamtdifferenz. Bei Gleichstand der fruehere Break-even, danach die
 * alphabetisch erste Id, damit dieselbe Eingabe immer dasselbe Ergebnis liefert.
 */
function besser(a: Omit<Empfehlung, 'annahmen'>, b: Omit<Empfehlung, 'annahmen'>): boolean {
  if (a.differenzGesamtEur !== b.differenzGesamtEur) {
    return a.differenzGesamtEur > b.differenzGesamtEur;
  }
  const aJahr = a.breakEvenJahr ?? Number.POSITIVE_INFINITY;
  const bJahr = b.breakEvenJahr ?? Number.POSITIVE_INFINITY;
  if (aJahr !== bJahr) return aJahr < bJahr;
  return a.modellId < b.modellId;
}

export function empfehlenAus(
  fahrzeuge: readonly Fahrzeug[],
  referenzen: readonly Referenz[],
  eingabe: Eingabe,
  annahmen: Annahmen,
): Empfehlung | null {
  if (!eingabeGueltig(eingabe) || !annahmenGueltig(annahmen)) return null;

  const nachId = new Map(referenzen.map((r) => [r.id, r]));
  let bestes: Omit<Empfehlung, 'annahmen'> | null = null;

  for (const f of fahrzeuge) {
    if (f.listenpreisEur > eingabe.budgetEur) continue;
    const referenz = nachId.get(f.vergleichsId);
    if (!referenz) continue;
    const kandidat = vergleichen(f, referenz, eingabe, annahmen);
    if (!bestes || besser(kandidat, bestes)) bestes = kandidat;
  }

  return bestes ? { ...bestes, annahmen } : null;
}

/** Empfehlung aus dem ausgelieferten Datensatz. Gibt null zurueck, wenn nichts passt. */
export function empfehlen(eingabe: Eingabe, annahmen: Annahmen = STANDARD_ANNAHMEN): Empfehlung | null {
  return empfehlenAus(standardFahrzeuge, standardReferenzen, eingabe, annahmen);
}
