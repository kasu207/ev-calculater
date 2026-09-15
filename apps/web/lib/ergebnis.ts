import {
  empfehlen,
  fahrzeugNachId,
  referenzNachId,
  STANDARD_ANNAHMEN,
} from '@ampmatch/core';
import type { Annahmen, Eingabe, Empfehlung, Fahrzeug, Referenz } from '@ampmatch/core';

export type Ergebnis = {
  empfehlung: Empfehlung;
  fahrzeug: Fahrzeug;
  referenz: Referenz;
};

/** Empfehlung samt der beiden Fahrzeuge, die dahinterstehen. */
export function ergebnisFuer(eingabe: Eingabe, annahmen: Annahmen = STANDARD_ANNAHMEN): Ergebnis | null {
  const empfehlung = empfehlen(eingabe, annahmen);
  if (!empfehlung) return null;

  const fahrzeug = fahrzeugNachId(empfehlung.modellId);
  const referenz = referenzNachId(empfehlung.vergleichsId);
  if (!fahrzeug || !referenz) return null;

  return { empfehlung, fahrzeug, referenz };
}

export function fahrzeugName(fahrzeug: Fahrzeug): string {
  return `${fahrzeug.marke} ${fahrzeug.modell}`;
}

export function referenzName(referenz: Referenz): string {
  return `${referenz.marke} ${referenz.modell}`;
}

/** Der Satz, der ueber dem Ergebnis steht. Eine Aussage, kein Baukasten. */
export function verdiktSatz(ergebnis: Ergebnis): string {
  const { empfehlung, fahrzeug, referenz } = ergebnis;
  const name = fahrzeugName(fahrzeug);
  const gegen = referenzName(referenz);
  const jahre = empfehlung.annahmen.haltedauerJahre;

  if (empfehlung.breakEvenJahr === null) {
    return `Der ${name} rechnet sich in ${jahre} Jahren nicht gegen den ${gegen}.`;
  }
  if (empfehlung.breakEvenJahr === 0) {
    return `Der ${name} ist vom ersten Tag an günstiger als der ${gegen}.`;
  }
  if (empfehlung.breakEvenJahr === 1) {
    return `Der ${name} rechnet sich nach einem Jahr gegen den ${gegen}.`;
  }
  return `Der ${name} rechnet sich nach ${empfehlung.breakEvenJahr} Jahren gegen den ${gegen}.`;
}
