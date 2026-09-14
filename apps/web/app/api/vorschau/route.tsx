import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { ergebnisFuer, fahrzeugName, verdiktSatz } from '@/lib/ergebnis';
import { alsEuro, alsZahl } from '@/lib/format';
import { eingabeAusParametern } from '@/lib/parameter';
import { BESCHREIBUNG, SEITENNAME } from '@/lib/seite';

export const runtime = 'nodejs';

const GROESSE = { width: 1200, height: 630 };

/**
 * Vorschaubild je Ergebnis. Als Route und nicht als opengraph-image.tsx, weil
 * die Datei-Variante nur Pfadsegmente sieht und der Permalink seine Werte in
 * der Abfrage traegt.
 */
export async function GET(anfrage: Request) {
  const parameter = Object.fromEntries(new URL(anfrage.url).searchParams.entries());
  const eingabe = eingabeAusParametern(parameter);
  const ergebnis = ergebnisFuer(eingabe);

  const [regulaer, fett] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'archivo-400.woff')),
    readFile(join(process.cwd(), 'assets', 'archivo-700.woff')),
  ]);

  const spart = (ergebnis?.empfehlung.differenzGesamtEur ?? 0) >= 0;
  const satz = ergebnis ? verdiktSatz(ergebnis) : BESCHREIBUNG;
  const zahl = ergebnis
    ? `${spart ? '' : '−'}${alsEuro(Math.abs(ergebnis.empfehlung.differenzGesamtEur))}`
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#EDEFF2',
          color: '#14203A',
          fontFamily: 'Archivo',
          padding: '64px 72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 8, backgroundColor: '#F5B301' }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {SEITENNAME}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, lineHeight: 1.25, maxWidth: 940 }}>{satz}</div>
          {ergebnis ? (
            <div
              style={{
                display: 'flex',
                fontSize: 112,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginTop: 16,
                color: spart ? '#1F7A5C' : '#B3382B',
              }}
            >
              {zahl}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: '100%', height: 1, backgroundColor: '#C9CDD5' }} />
          <div style={{ display: 'flex', fontSize: 26, color: '#6B7488' }}>
            {ergebnis
              ? `${spart ? 'Ersparnis' : 'Mehrkosten'} über ${ergebnis.empfehlung.annahmen.haltedauerJahre} Jahre · ${fahrzeugName(ergebnis.fahrzeug)} · ${alsZahl(eingabe.kmProJahr)} km im Jahr · Budget ${alsEuro(eingabe.budgetEur)}`
              : `${alsZahl(eingabe.kmProJahr)} km im Jahr · Budget ${alsEuro(eingabe.budgetEur)}`}
          </div>
        </div>
      </div>
    ),
    {
      ...GROESSE,
      fonts: [
        { name: 'Archivo', data: regulaer, weight: 400, style: 'normal' },
        { name: 'Archivo', data: fett, weight: 700, style: 'normal' },
      ],
      headers: {
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    },
  );
}
