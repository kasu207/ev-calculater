import type { Metadata } from 'next';
import { ergebnisFuer, fahrzeugName, verdiktSatz } from '@/lib/ergebnis';
import { BESCHREIBUNG, SEITENNAME } from '@/lib/seite';
import { permalink } from '@/lib/eingabe';
import type { Eingabe } from '@ampmatch/core';

/**
 * Titel, Beschreibung und Vorschaubild haengen am Ergebnis, der Canonical-Tag
 * dagegen immer an der Adresse ohne Parameter.
 */
export function metadatenFuer(eingabe: Eingabe, pfad: string): Metadata {
  const ergebnis = ergebnisFuer(eingabe);
  const titel = ergebnis
    ? `${fahrzeugName(ergebnis.fahrzeug)} bei ${eingabe.kmProJahr.toLocaleString('de-DE')} km im Jahr`
    : `${SEITENNAME} – lohnt sich das Elektroauto für dich?`;
  const beschreibung = ergebnis ? verdiktSatz(ergebnis) : BESCHREIBUNG;
  const bild = `/api/vorschau?${new URLSearchParams({
    km: String(eingabe.kmProJahr),
    budget: String(eingabe.budgetEur),
  })}`;

  return {
    title: titel,
    description: beschreibung,
    alternates: { canonical: pfad },
    openGraph: {
      title: titel,
      description: beschreibung,
      url: permalink(eingabe, pfad),
      images: [{ url: bild, width: 1200, height: 630, alt: beschreibung }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titel,
      description: beschreibung,
      images: [bild],
    },
  };
}
