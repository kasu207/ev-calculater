/** Basisadresse der Seite. Wird fuer Canonical, Sitemap und Vorschaubild gebraucht. */
export function basisUrl(): string {
  const gesetzt = process.env.AMPMATCH_BASIS_URL?.trim();
  return (gesetzt && gesetzt.replace(/\/$/, '')) || 'https://ampmatch.de';
}

export const SEITENNAME = 'AmpMatch';

export const BESCHREIBUNG =
  'Zwei Angaben, ein Ergebnis: welches Elektroauto sich für deine Fahrleistung rechnet und ab wann.';
