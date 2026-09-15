import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { BESCHREIBUNG, SEITENNAME, basisUrl } from '@/lib/seite';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(basisUrl()),
  title: {
    default: `${SEITENNAME} – lohnt sich das Elektroauto für dich?`,
    template: `%s – ${SEITENNAME}`,
  },
  description: BESCHREIBUNG,
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: SEITENNAME,
  },
};

export const viewport: Viewport = {
  themeColor: '#14203a',
};

export default function Wurzellayout({ children }: { children: React.ReactNode }) {
  const umamiSkript = process.env.AMPMATCH_UMAMI_SKRIPT_URL?.trim();
  const umamiId = process.env.AMPMATCH_UMAMI_WEBSITE_ID?.trim();

  return (
    <html lang="de">
      <head>
        <link
          rel="preload"
          href="/schrift/archivo-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div // Unten Platz fuer die feste Leiste auf kleinen Bildschirmen.
          className="mx-auto flex min-h-dvh max-w-[840px] flex-col px-4 pt-6 pb-44 sm:px-6 sm:pt-10 sm:pb-10">
          <header className="mb-6 flex items-baseline justify-between border-b border-rule pb-4">
            <Link href="/" className="text-[17px] font-bold tracking-tight text-ink no-underline">
              {SEITENNAME}
            </Link>
            <span className="tabellenschrift text-[13px] text-muted">
              Rechner für den Umstieg
            </span>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="tabellenschrift mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-[13px] text-muted">
            <Link className="text-muted underline underline-offset-2" href="/e-auto">
              Alle Modelle
            </Link>
            <Link className="text-muted underline underline-offset-2" href="/impressum">
              Impressum
            </Link>
            <Link className="text-muted underline underline-offset-2" href="/datenschutz">
              Datenschutz
            </Link>
            <span>Preise und Verbräuche nach Herstellerangabe, Stand September 2026.</span>
          </footer>
        </div>

        {umamiSkript && umamiId ? (
          <Script src={umamiSkript} data-website-id={umamiId} strategy="afterInteractive" />
        ) : null}
      </body>
    </html>
  );
}
