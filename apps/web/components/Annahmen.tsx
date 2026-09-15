'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { NICHT_ENTHALTEN } from '@ampmatch/core';
import { useState } from 'react';
import { alsPreis, alsProzent } from '@/lib/format';
import type { Ergebnis } from '@/lib/ergebnis';

/** Anteil des Listenpreises, der nach der Haltedauer noch im Auto steckt. */
function restwertAnteil(wertverlustProJahr: number, jahre: number): number {
  return Math.pow(1 - wertverlustProJahr, jahre);
}

function Zeile({ was, wert }: { was: string; wert: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-rule py-2">
      <dt className="text-[14px] text-ink">{was}</dt>
      <dd className="tabellenschrift m-0 text-right text-[14px] text-ink">{wert}</dd>
    </div>
  );
}

export function Annahmen({ ergebnis }: { ergebnis: Ergebnis }) {
  const [offen, setOffen] = useState(false);
  const { annahmen } = ergebnis.empfehlung;
  const { fahrzeug, referenz } = ergebnis;

  return (
    <Collapsible.Root open={offen} onOpenChange={setOffen}>
      <Collapsible.Trigger className="tabellenschrift flex w-full items-center justify-between border-t border-rule py-3 text-left text-[14px] text-ink">
        <span>Annahmen und Quellen</span>
        <span aria-hidden="true" className="text-muted">
          {offen ? 'schließen' : 'öffnen'}
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <dl className="m-0 pb-4">
          <Zeile was="Haltedauer" wert={`${annahmen.haltedauerJahre} Jahre`} />
          <Zeile
            was="Strompreis zu Hause"
            wert={`${alsPreis(annahmen.strompreisEurProKwh)} je kWh`}
          />
          <Zeile
            was="Strompreis an der Ladesäule"
            wert={`${alsPreis(annahmen.oeffentlichStrompreisEurProKwh)} je kWh`}
          />
          <Zeile was="Anteil Laden zu Hause" wert={alsProzent(annahmen.heimladeAnteil)} />
          <Zeile
            was="Benzin"
            wert={`${alsPreis(annahmen.kraftstoffpreisEurProLiter.benzin)} je Liter`}
          />
          <Zeile
            was="Diesel"
            wert={`${alsPreis(annahmen.kraftstoffpreisEurProLiter.diesel)} je Liter`}
          />
          <Zeile
            was="Aufschlag auf den WLTP-Verbrauch"
            wert={`${alsProzent(annahmen.realaufschlagAnteil)} auf beiden Seiten`}
          />
          <Zeile
            was="Wertverlust elektrisch"
            wert={`${alsProzent(annahmen.wertverlustElektrischProJahr)} je Jahr, nach ${annahmen.haltedauerJahre} Jahren ${alsProzent(restwertAnteil(annahmen.wertverlustElektrischProJahr, annahmen.haltedauerJahre))} Restwert`}
          />
          <Zeile
            was="Wertverlust Verbrenner"
            wert={`${alsProzent(annahmen.wertverlustVerbrennerProJahr)} je Jahr, nach ${annahmen.haltedauerJahre} Jahren ${alsProzent(restwertAnteil(annahmen.wertverlustVerbrennerProJahr, annahmen.haltedauerJahre))} Restwert`}
          />
          <Zeile
            was={`Verbrauch ${fahrzeug.marke} ${fahrzeug.modell}`}
            wert={`${fahrzeug.verbrauchKwhPro100km} kWh je 100 km nach WLTP`}
          />
          <Zeile
            was={`Verbrauch ${referenz.marke} ${referenz.modell}`}
            wert={`${referenz.verbrauchLPro100km} Liter je 100 km nach WLTP`}
          />
          <Zeile
            was="THG-Quote, als Gutschrift gerechnet"
            wert={`${fahrzeug.thgQuoteEurProJahr} € je Jahr`}
          />
          <Zeile
            was="Kfz-Steuer"
            wert={`elektrisch ${fahrzeug.kfzSteuerEurProJahr} €, Verbrenner ${referenz.kfzSteuerEurProJahr} € je Jahr`}
          />
        </dl>

        <div className="border-t border-rule pt-3 pb-4">
          <p className="fliesstext m-0 text-[14px] text-ink">
            Nicht enthalten, weil belastbare Werte fehlen:{' '}
            {NICHT_ENTHALTEN.join(', ')}. Diese Positionen können das Ergebnis in beide
            Richtungen verschieben.
          </p>
          <p className="fliesstext mt-2 mb-0 text-[14px] text-ink">
            Der Wertverlust ist bei dieser Haltedauer der größte Posten der Rechnung, größer
            als Energie und Steuer zusammen. Er ist ein Durchschnittswert je Antriebsart, kein
            modellgenauer Prognosewert – bei einem einzelnen Fahrzeug kann er deutlich
            abweichen.
          </p>
          <p className="fliesstext mt-2 mb-0 text-[14px] text-muted">
            {fahrzeug.quelle}, Stand {fahrzeug.standDatum}. {referenz.quelle}, Stand{' '}
            {referenz.standDatum}.
          </p>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
