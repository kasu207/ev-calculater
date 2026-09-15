import type { Metadata } from 'next';
import Link from 'next/link';
import { STANDARD_ANNAHMEN, fahrzeuge } from '@ampmatch/core';
import {
  Abschnitt,
  Betrag,
  BreakEven,
  Brotkrumen,
  Tabelle,
  Titel,
  Verweise,
  Zeile,
  fahrleistungText,
} from '@/components/flaeche/Bausteine';
import { FAHRLEISTUNGEN, fahrleistungPfad, modellPfad, rangliste } from '@/lib/flaeche';
import { alsEuro } from '@/lib/format';

export const metadata: Metadata = {
  title: `${fahrzeuge.length} Elektroautos im Kostenvergleich`,
  description: `Für ${fahrzeuge.length} Elektroautos durchgerechnet: was sie gegenüber einem vergleichbaren Verbrenner über drei Jahre kosten – mit Wertverlust, Strom, Kfz-Steuer und THG-Quote.`,
  alternates: { canonical: '/e-auto' },
};

export default function Modelluebersicht() {
  const jahre = STANDARD_ANNAHMEN.haltedauerJahre;
  // Nach Preis sortiert, nicht nach Ergebnis: Diese Seite ist ein Verzeichnis,
  // die Wertung steht auf den Fahrleistungsseiten.
  const liste = [...rangliste(15000)].sort(
    (a, b) => a.fahrzeug.listenpreisEur - b.fahrzeug.listenpreisEur,
  );

  return (
    <article>
      <Brotkrumen pfade={[{ name: 'Rechner', href: '/' }, { name: 'Modelle' }]} />

      <Titel
        unterzeile={`Für jedes Modell ist durchgerechnet, was es gegenüber einem vergleichbaren Verbrenner über ${jahre} Jahre kostet – bei 15.000 km im Jahr, mit Wertverlust, Strom, Kfz-Steuer und THG-Quote.`}
      >
        {fahrzeuge.length} Elektroautos im Kostenvergleich
      </Titel>

      <Abschnitt titel="Alle Modelle">
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
        <p className="fliesstext mt-3 text-[15px] text-muted">
          15.000 km im Jahr sind ein Durchschnitt, kein Fahrprofil. Die Fahrleistung verschiebt
          das Ergebnis stärker als die Wahl des Modells – deshalb steht dieselbe Rechnung unten
          noch einmal nach Fahrleistung sortiert.
        </p>
      </Abschnitt>

      <Abschnitt titel="Nach Fahrleistung">
        <Verweise
          eintraege={FAHRLEISTUNGEN.map((km) => ({
            href: fahrleistungPfad(km),
            text: `Welches E-Auto lohnt sich bei ${fahrleistungText(km)} im Jahr?`,
          }))}
        />
      </Abschnitt>
    </article>
  );
}
