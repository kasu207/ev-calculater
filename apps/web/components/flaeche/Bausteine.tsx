import Link from 'next/link';
import { alsEuro, alsZahl } from '@/lib/format';

/**
 * Bausteine der oeffentlichen Seiten. Reine Serverkomponenten: Diese Seiten
 * sollen ohne JavaScript vollstaendig lesbar sein, weil genau so ein
 * Suchmaschinen-Crawler und ein Vorschaubot sie sehen.
 */

export function Brotkrumen({ pfade }: { pfade: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Brotkrumen" className="tabellenschrift mb-4 flex flex-wrap gap-x-2 text-[13px] text-muted">
      {pfade.map((eintrag, i) => (
        <span key={eintrag.name} className="flex gap-x-2">
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {eintrag.href ? (
            <Link href={eintrag.href} className="text-muted underline underline-offset-2">
              {eintrag.name}
            </Link>
          ) : (
            <span>{eintrag.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Titel({ children, unterzeile }: { children: React.ReactNode; unterzeile: string }) {
  return (
    <header className="mb-6">
      <h1 className="ergebniszahl m-0 text-[30px] leading-tight sm:text-[38px]">{children}</h1>
      <p className="fliesstext mt-3 mb-0 text-[17px] leading-snug text-ink">{unterzeile}</p>
    </header>
  );
}

/** Eine Zahl mit Beschriftung. Drei davon nebeneinander, mehr wird unleserlich. */
export function Kennzahl({ was, wert, notiz }: { was: string; wert: string; notiz?: string }) {
  return (
    <div className="border-t border-rule pt-3">
      <p className="tabellenschrift m-0 text-[13px] text-muted">{was}</p>
      <p className="ergebniszahl mt-1 mb-0 text-[26px]">{wert}</p>
      {notiz ? <p className="tabellenschrift mt-1 mb-0 text-[13px] text-muted">{notiz}</p> : null}
    </div>
  );
}

export function Kennzahlen({ children }: { children: React.ReactNode }) {
  return <div className="my-6 grid gap-x-6 gap-y-4 sm:grid-cols-3">{children}</div>;
}

/**
 * Der Betrag in der Farbe seiner Aussage. Gruen spart, rot kostet - dieselbe
 * Zuordnung wie im Rechner, damit niemand zweimal lernen muss.
 */
export function Betrag({ eur }: { eur: number }) {
  return (
    <span
      className="zahl"
      style={{ color: eur >= 0 ? 'var(--saving)' : 'var(--cost)' }}
    >
      {eur >= 0 ? '' : '−'}
      {alsEuro(Math.abs(eur))}
    </span>
  );
}

export function BreakEven({ jahr, haltedauer }: { jahr: number | null; haltedauer: number }) {
  if (jahr === null) {
    return <span className="zahl text-muted">über {haltedauer} Jahre</span>;
  }
  return (
    <span className="zahl" style={{ color: 'var(--saving)' }}>
      nach {jahr} {jahr === 1 ? 'Jahr' : 'Jahren'}
    </span>
  );
}

export function Tabelle({ kopf, children }: { kopf: string[]; children: React.ReactNode }) {
  return (
    // Schmale Bildschirme scrollen die Tabelle, nicht die ganze Seite.
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            {kopf.map((zelle, i) => (
              <th
                key={zelle}
                scope="col"
                className={`tabellenschrift border-b border-rule-stark py-2 text-[13px] font-medium text-muted ${
                  i === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {zelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Zeile({ zellen }: { zellen: React.ReactNode[] }) {
  return (
    <tr>
      {zellen.map((zelle, i) => (
        <td
          key={i}
          className={`border-b border-rule py-2 ${i === 0 ? 'text-left' : 'zahl text-right whitespace-nowrap'}`}
        >
          {zelle}
        </td>
      ))}
    </tr>
  );
}

export function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="m-0 mb-3 text-[20px] font-bold tracking-tight">{titel}</h2>
      {children}
    </section>
  );
}

/** Verweisliste fuer die interne Verlinkung zwischen den Seiten. */
export function Verweise({ eintraege }: { eintraege: { href: string; text: string; notiz?: string }[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {eintraege.map((e) => (
        <li key={e.href} className="border-b border-rule py-2">
          <Link href={e.href} className="text-ink underline underline-offset-2">
            {e.text}
          </Link>
          {e.notiz ? <span className="tabellenschrift ml-2 text-[13px] text-muted">{e.notiz}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function fahrleistungText(km: number): string {
  return `${alsZahl(km)} km`;
}

export { alsEuro };
