import type { MetadataRoute } from 'next';
import { basisUrl } from '@/lib/seite';
import { FAHRLEISTUNGEN, alleModellIds, fahrleistungPfad, modellPfad } from '@/lib/flaeche';

/**
 * Die Sitemap fuehrte lange genau drei Adressen: Start, Impressum,
 * Datenschutz. Der Rechner selbst ist eine einzige Seite, deren Inhalt an zwei
 * Parametern haengt, und der Canonical-Tag zeigt bewusst immer auf `/`. Fuer
 * eine Suchmaschine gab es damit nichts zu indexieren ausser der Startseite -
 * und damit keinen Weg auf die Seite ausser dem, den man schon kennt.
 *
 * Die Modell- und Fahrleistungsseiten sind die Antwort darauf. Sie entstehen
 * aus denselben Daten und wachsen automatisch mit: Ein neues Fahrzeug bringt
 * eine neue Seite mit und ergaenzt alle Fahrleistungsseiten.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const basis = basisUrl();
  const stand = new Date();

  return [
    { url: `${basis}/`, lastModified: stand, priority: 1 },
    { url: `${basis}/e-auto`, lastModified: stand, changeFrequency: 'weekly', priority: 0.9 },
    ...FAHRLEISTUNGEN.map((km) => ({
      url: `${basis}${fahrleistungPfad(km)}`,
      lastModified: stand,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...alleModellIds().map((id) => ({
      url: `${basis}${modellPfad(id)}`,
      lastModified: stand,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${basis}/impressum`, lastModified: stand, priority: 0.2 },
    { url: `${basis}/datenschutz`, lastModified: stand, priority: 0.2 },
  ];
}
