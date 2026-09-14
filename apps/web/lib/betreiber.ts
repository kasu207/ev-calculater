/**
 * Angaben fuer Impressum und Datenschutzerklaerung. Sie stehen in der Umgebung
 * und nicht im Quelltext, damit im Repository keine Privatanschrift liegt.
 * Fehlen sie, sagt die Seite das offen, statt einen Platzhalter zu zeigen.
 */
export type Betreiber = {
  name: string;
  anschrift: string[];
  email: string;
  telefon?: string;
  ustId?: string;
  vollstaendig: boolean;
};

function wert(name: string): string | undefined {
  const inhalt = process.env[name]?.trim();
  return inhalt ? inhalt : undefined;
}

export function betreiber(): Betreiber {
  const name = wert('AMPMATCH_BETREIBER_NAME');
  const anschrift = wert('AMPMATCH_BETREIBER_ANSCHRIFT');
  const email = wert('AMPMATCH_BETREIBER_EMAIL');

  return {
    name: name ?? '',
    anschrift: anschrift ? anschrift.split('|').map((zeile) => zeile.trim()) : [],
    email: email ?? '',
    telefon: wert('AMPMATCH_BETREIBER_TELEFON'),
    ustId: wert('AMPMATCH_BETREIBER_USTID'),
    vollstaendig: Boolean(name && anschrift && email),
  };
}
