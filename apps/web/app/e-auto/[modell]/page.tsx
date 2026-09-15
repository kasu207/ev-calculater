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
import {
  alleModellIds,
  fahrleistungPfad,
  modellPfad,
  modellSeite,
  preisNachbarn,
} from '@/lib/flaeche';
import { alsEuro, alsProzent, alsZahl } from '@/lib/format';
import { partnerUrlFuer } from '@/lib/partner';
import { permalink, VORBELEGUNG } from '@/lib/eingabe';

type Props = { params: Promise<{ modell: string }> };

/**
 * Alle Modellseiten werden beim Bauen erzeugt. Sie haengen nur an den
 * Fahrzeugdaten, nicht an einer Nutzereingabe - also gibt es keinen Grund,
 * sie bei jedem Aufruf neu zu rechnen.
 */
export function generateStaticParams() {
  return alleModellIds().map((modell) => ({ modell }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seite = modellSeite((await params).modell);
  if (!seite) return {};

  const { fahrzeug, referenz, standard } = seite;
  const name = `${fahrzeug.marke} ${fahrzeug.modell}`;
  const urteil =
    standard.breakEvenJahr === null
      ? `rechnet sich in ${STANDARD_ANNAHMEN.haltedauerJahre} Jahren nicht gegen den ${referenz.marke} ${referenz.modell}`
      : `rechnet sich nach ${standard.breakEvenJahr} ${standard.breakEvenJahr === 1 ? 'Jahr' : 'Jahren'} gegen den ${referenz.marke} ${referenz.modell}`;

  return {
    title: `${name}: lohnt sich der Umstieg?`,
    description: `Bei 15.000 km im Jahr ${urteil}. Vollständige Rechnung mit Wertverlust, Strom, Kfz-Steuer und THG-Quote – für sechs Fahrleistungen durchgerechnet.`,
    alternates: { canonical: modellPfad(fahrzeug.id) },
  };
}

export default async function Modellseite({ params }: Props) {
  const seite = modellSeite((await params).modell);
  if (!seite) notFound();

  const { fahrzeug, referenz, matrix, standard, wertverlustEur, wertverlustReferenzEur } = seite;
  const name = `${fahrzeug.marke} ${fahrzeug.modell}`;
  const gegen = `${referenz.marke} ${referenz.modell}`;
  const jahre = STANDARD_ANNAHMEN.haltedauerJahre;

  // Die kleinste Fahrleistung, bei der die Rechnung aufgeht. Das ist die
  // Antwort, wegen der jemand diese Seite ueberhaupt aufruft.
  const kipppunkt = matrix.find((p) => p.empfehlung.differenzGesamtEur >= 0);

  return (
    <article>
      <Brotkrumen
        pfade={[
          { name: 'Rechner', href: '/' },
          { name: 'Modelle', href: '/e-auto' },
          { name: name },
        ]}
      />

      <Titel
        unterzeile={`Gerechnet gegen den ${gegen} über ${jahre} Jahre – mit Wertverlust, Strom, Kfz-Steuer und THG-Quote. Der Wertverlust ist dabei der größte Posten, nicht der Strompreis.`}
      >
        Lohnt sich der {name}?
      </Titel>

      <Kennzahlen>
        <Kennzahl
          was={`Ersparnis über ${jahre} Jahre`}
          wert={`${standard.differenzGesamtEur >= 0 ? '' : '−'}${alsEuro(Math.abs(standard.differenzGesamtEur))}`}
          notiz="bei 15.000 km im Jahr"
        />
        <Kennzahl
          was="Break-even"
          wert={standard.breakEvenJahr === null ? `über ${jahre} Jahre` : `nach ${standard.breakEvenJahr} ${standard.breakEvenJahr === 1 ? 'Jahr' : 'Jahren'}`}
          notiz={`gegen den ${gegen}`}
        />
        <Kennzahl
          was={`Wertverlust in ${jahre} Jahren`}
          wert={alsEuro(wertverlustEur)}
          notiz={`${alsProzent(STANDARD_ANNAHMEN.wertverlustElektrischProJahr)} je Jahr angenommen`}
        />
      </Kennzahlen>

      <Abschnitt titel={`Ab welcher Fahrleistung rechnet sich der ${name}?`}>
        <p className="fliesstext mt-0 text-[16px]">
          Der Mehrpreis eines Elektroautos fällt einmal an, die Ersparnis entsteht je Kilometer.
          Deshalb hängt die Antwort fast vollständig an der Fahrleistung – und nicht am Modell.
        </p>
        <Tabelle kopf={['Fahrleistung', 'Break-even', `Ersparnis über ${jahre} Jahre`]}>
          {matrix.map((punkt) => (
            <Zeile
              key={punkt.kmProJahr}
              zellen={[
                <Link
                  key="km"
                  href={fahrleistungPfad(punkt.kmProJahr)}
                  className="text-ink underline underline-offset-2"
                >
                  {fahrleistungText(punkt.kmProJahr)}
                </Link>,
                <BreakEven key="be" jahr={punkt.empfehlung.breakEvenJahr} haltedauer={jahre} />,
                <Betrag key="diff" eur={punkt.empfehlung.differenzGesamtEur} />,
              ]}
            />
          ))}
        </Tabelle>
        <p className="fliesstext mt-3 text-[15px] text-muted">
          {kipppunkt
            ? `Ab rund ${fahrleistungText(kipppunkt.kmProJahr)} im Jahr geht die Rechnung auf. Darunter ist der ${gegen} über ${jahre} Jahre günstiger.`
            : `Bei keiner der üblichen Fahrleistungen geht die Rechnung in ${jahre} Jahren auf. Bei einer längeren Haltedauer sieht das anders aus – der Wertverlust verteilt sich dann auf mehr Jahre.`}
        </p>
      </Abschnitt>

      <Abschnitt titel="Die Zahlen dahinter">
        <Tabelle kopf={['', name, gegen]}>
          <Zeile zellen={['Listenpreis', alsEuro(fahrzeug.listenpreisEur), alsEuro(referenz.listenpreisEur)]} />
          <Zeile
            zellen={[
              'Verbrauch nach WLTP',
              `${fahrzeug.verbrauchKwhPro100km} kWh/100 km`,
              `${referenz.verbrauchLPro100km} l/100 km`,
            ]}
          />
          <Zeile
            zellen={[
              'Kfz-Steuer je Jahr',
              alsEuro(fahrzeug.kfzSteuerEurProJahr),
              alsEuro(referenz.kfzSteuerEurProJahr),
            ]}
          />
          <Zeile zellen={['THG-Quote je Jahr', `+ ${alsEuro(fahrzeug.thgQuoteEurProJahr)}`, '—']} />
          <Zeile
            zellen={[
              `Angenommener Wertverlust in ${jahre} Jahren`,
              alsEuro(wertverlustEur),
              alsEuro(wertverlustReferenzEur),
            ]}
          />
        </Tabelle>
        <p className="fliesstext mt-3 text-[15px] text-muted">
          Wertverlust angesetzt mit {alsProzent(STANDARD_ANNAHMEN.wertverlustElektrischProJahr)} je
          Jahr elektrisch und {alsProzent(STANDARD_ANNAHMEN.wertverlustVerbrennerProJahr)} beim
          Verbrenner. {fahrzeug.quelle}, Stand {fahrzeug.standDatum}. Angesetzt sind{' '}
          {alsProzent(STANDARD_ANNAHMEN.heimladeAnteil)} Laden zu Hause und ein Aufschlag von{' '}
          {alsProzent(STANDARD_ANNAHMEN.realaufschlagAnteil)} auf beide WLTP-Werte. Nicht
          enthalten sind Wartung, Versicherung, Förderung und Finanzierung.
        </p>
      </Abschnitt>

      <Abschnitt titel="Mit deinen eigenen Zahlen">
        <p className="fliesstext mt-0 text-[16px]">
          Diese Seite rechnet mit 15.000 km und einem Budget von{' '}
          {alsZahl(VORBELEGUNG.budgetEur)} €. Beides verschiebt das Ergebnis stärker als die
          Wahl des Modells.
        </p>
        <div className="mt-4">
          <Link
            href={permalink({ ...VORBELEGUNG }, '/')}
            className="inline-block border border-rule-stark px-5 py-3 text-[16px] font-semibold text-ink no-underline"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            Eigene Werte eintragen
          </Link>
        </div>
      </Abschnitt>

      <Abschnitt titel={`Angebote zum ${name}`}>
        <div className="mt-2">
          <PartnerCta
            modellId={fahrzeug.id}
            beschriftung={`Preise für den ${name} anfragen`}
            href={partnerUrlFuer(fahrzeug)}
            eingabe={VORBELEGUNG}
            seitenart="modell"
          />
          <Offenlegung />
        </div>
      </Abschnitt>

      <Abschnitt titel="Modelle im ähnlichen Preisbereich">
        <Verweise
          eintraege={preisNachbarn(fahrzeug).map((f) => ({
            href: modellPfad(f.id),
            text: `Lohnt sich der ${f.marke} ${f.modell}?`,
            notiz: alsEuro(f.listenpreisEur),
          }))}
        />
      </Abschnitt>
    </article>
  );
}
