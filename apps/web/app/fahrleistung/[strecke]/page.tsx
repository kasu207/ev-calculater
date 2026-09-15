import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STANDARD_ANNAHMEN } from '@ampmatch/core';
import {
  Abschnitt,
  Betrag,
  BreakEven,
  Brotkrumen,
  Kennzahl,
  Kennzahlen,
  Tabelle,
  Titel,
  Verweise,
  Zeile,
  fahrleistungText,
} from '@/components/flaeche/Bausteine';
import { PartnerCta } from '@/components/PartnerCta';
import { Offenlegung } from '@/components/Offenlegung';
import { FAHRLEISTUNGEN, fahrleistungPfad, modellPfad, rangliste } from '@/lib/flaeche';
import { alsEuro, alsZahl } from '@/lib/format';
import { partnerUrlFuer } from '@/lib/partner';
import { VORBELEGUNG } from '@/lib/eingabe';

type Props = { params: Promise<{ strecke: string }> };

/** `/fahrleistung/15000-km` - die Einheit steht in der Adresse, nicht nur die Zahl. */
function kmAusPfad(strecke: string): number | null {
  const treffer = /^(\d{1,6})-km$/.exec(strecke);
  if (!treffer) return null;
  const km = Number(treffer[1]);
  return (FAHRLEISTUNGEN as readonly number[]).includes(km) ? km : null;
}

export function generateStaticParams() {
  return FAHRLEISTUNGEN.map((km) => ({ strecke: `${km}-km` }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const km = kmAusPfad((await params).strecke);
  if (km === null) return {};

  const liste = rangliste(km);
  const bester = liste[0];
  const lohnend = liste.filter((p) => p.empfehlung.differenzGesamtEur >= 0).length;

  return {
    title: `Welches E-Auto lohnt sich bei ${alsZahl(km)} km im Jahr?`,
    description: `Bei ${alsZahl(km)} km rechnen sich ${lohnend} von ${liste.length} Modellen innerhalb von ${STANDARD_ANNAHMEN.haltedauerJahre} Jahren. Vorn liegt der ${bester?.fahrzeug.marke} ${bester?.fahrzeug.modell}. Gerechnet mit Wertverlust, Strom, Steuer und THG-Quote.`,
    alternates: { canonical: fahrleistungPfad(km) },
  };
}

export default async function Fahrleistungsseite({ params }: Props) {
  const km = kmAusPfad((await params).strecke);
  if (km === null) notFound();

  const liste = rangliste(km);
  const bester = liste[0];
  if (!bester) notFound();

  const lohnend = liste.filter((p) => p.empfehlung.differenzGesamtEur >= 0);
  const jahre = STANDARD_ANNAHMEN.haltedauerJahre;
  const besterName = `${bester.fahrzeug.marke} ${bester.fahrzeug.modell}`;

  return (
    <article>
      <Brotkrumen
        pfade={[
          { name: 'Rechner', href: '/' },
          { name: 'Modelle', href: '/e-auto' },
          { name: fahrleistungText(km) },
        ]}
      />

      <Titel
        unterzeile={`Alle ${liste.length} Modelle über ${jahre} Jahre durchgerechnet – mit Wertverlust, Strom, Kfz-Steuer und THG-Quote. Sortiert nach dem, was am Ende übrig bleibt.`}
      >
        Welches E-Auto lohnt sich bei {fahrleistungText(km)} im Jahr?
      </Titel>

      <Kennzahlen>
        <Kennzahl was="Vorn liegt" wert={besterName} notiz={alsEuro(bester.fahrzeug.listenpreisEur) + ' Listenpreis'} />
        <Kennzahl
          was={`Ersparnis über ${jahre} Jahre`}
          wert={`${bester.empfehlung.differenzGesamtEur >= 0 ? '' : '−'}${alsEuro(Math.abs(bester.empfehlung.differenzGesamtEur))}`}
          notiz={`gegen den ${bester.referenz.marke} ${bester.referenz.modell}`}
        />
        <Kennzahl
          was="Rechnen sich"
          wert={`${lohnend.length} von ${liste.length}`}
          notiz={`innerhalb von ${jahre} Jahren`}
        />
      </Kennzahlen>

      <Abschnitt titel={`Rangliste bei ${fahrleistungText(km)} im Jahr`}>
        <Tabelle kopf={['Modell', 'Listenpreis', 'Break-even', `Ersparnis über ${jahre} Jahre`]}>
          {liste.map((platz) => (
            <Zeile
              key={platz.fahrzeug.id}
              zellen={[
                <Link
                  key="name"
                  href={modellPfad(platz.fahrzeug.id)}
                  className="text-ink underline underline-offset-2"
                >
                  {platz.fahrzeug.marke} {platz.fahrzeug.modell}
                </Link>,
                alsEuro(platz.fahrzeug.listenpreisEur),
                <BreakEven key="be" jahr={platz.empfehlung.breakEvenJahr} haltedauer={jahre} />,
                <Betrag key="diff" eur={platz.empfehlung.differenzGesamtEur} />,
              ]}
            />
          ))}
        </Tabelle>
      </Abschnitt>

      <Abschnitt titel="Warum die Fahrleistung so stark durchschlägt">
        <p className="fliesstext mt-0 text-[16px]">
          Der Mehrpreis eines Elektroautos fällt einmal an. Die Ersparnis entsteht je gefahrenem
          Kilometer, aus der Differenz zwischen Strom- und Kraftstoffkosten. Wer doppelt so viel
          fährt, holt den Mehrpreis in ungefähr der halben Zeit herein.
        </p>
        <p className="fliesstext text-[16px]">
          Der zweite große Posten hängt dagegen nicht an der Fahrleistung, sondern am Kaufpreis:
          der Wertverlust. Bei {jahre} Jahren Haltedauer ist er größer als Strom und Steuer
          zusammen – und er ist der Grund, warum ein teures Elektroauto sich auch bei hoher
          Fahrleistung nicht zwangsläufig rechnet.
        </p>
      </Abschnitt>

      <Abschnitt titel={`Angebote zum ${besterName}`}>
        <div className="mt-2">
          <PartnerCta
            modellId={bester.fahrzeug.id}
            beschriftung={`Preise für den ${besterName} anfragen`}
            href={partnerUrlFuer(bester.fahrzeug)}
            eingabe={{ kmProJahr: km, budgetEur: VORBELEGUNG.budgetEur }}
            seitenart="fahrleistung"
          />
          <Offenlegung />
        </div>
      </Abschnitt>

      <Abschnitt titel="Andere Fahrleistungen">
        <Verweise
          eintraege={FAHRLEISTUNGEN.filter((andere) => andere !== km).map((andere) => ({
            href: fahrleistungPfad(andere),
            text: `Welches E-Auto lohnt sich bei ${fahrleistungText(andere)} im Jahr?`,
          }))}
        />
      </Abschnitt>
    </article>
  );
}
