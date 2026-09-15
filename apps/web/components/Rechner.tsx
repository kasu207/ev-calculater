'use client';

import { guenstigstesFahrzeug } from '@ampmatch/core';
import type { Eingabe } from '@ampmatch/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Annahmen } from '@/components/Annahmen';
import { EingabeFeld } from '@/components/EingabeFeld';
import { Kostenverlauf } from '@/components/Kostenverlauf';
import { Offenlegung } from '@/components/Offenlegung';
import { PartnerCta } from '@/components/PartnerCta';
import { Verdikt } from '@/components/Verdikt';
import { ergebnisFuer, fahrzeugName } from '@/lib/ergebnis';
import { alsEuro } from '@/lib/format';
import { EREIGNIS, budgetKlasse, internKennzeichnen, kmKlasse, melde } from '@/lib/messung';
import { GRENZEN, permalink } from '@/lib/eingabe';

type Props = {
  eingabe: Eingabe;
  partnerUrls: Record<string, string>;
};

const RUHE_MS = 600;

export function Rechner({ eingabe: vorbelegung, partnerUrls }: Props) {
  const [eingabe, setEingabe] = useState<Eingabe>(vorbelegung);
  const [ersteAnzeige, setErsteAnzeige] = useState(true);
  const zuletztGemeldet = useRef<string | null>(null);

  const ergebnis = useMemo(() => ergebnisFuer(eingabe), [eingabe]);

  useEffect(() => {
    const parameter = new URLSearchParams(window.location.search);
    if (parameter.get('intern') === '1') internKennzeichnen(true);
    melde(EREIGNIS.rechnerGesehen);
  }, []);

  // calc_completed feuert erst, wenn die Eingabe zur Ruhe gekommen ist und ein
  // gueltiges Ergebnis vorliegt. Sonst waere der Nenner der Gate-Metrik wertlos.
  useEffect(() => {
    if (!ergebnis) return;
    const daten = {
      modellId: ergebnis.empfehlung.modellId,
      kmBucket: kmKlasse(eingabe.kmProJahr),
      budgetBucket: budgetKlasse(eingabe.budgetEur),
    };
    const kennung = JSON.stringify(daten);
    const uhr = setTimeout(() => {
      if (zuletztGemeldet.current === kennung) return;
      zuletztGemeldet.current = kennung;
      melde(EREIGNIS.ergebnisFertig, daten);
    }, ersteAnzeige ? 0 : RUHE_MS);
    return () => clearTimeout(uhr);
  }, [ergebnis, eingabe, ersteAnzeige]);

  // Die Adresszeile bleibt am Ergebnis, damit jeder Stand teilbar ist.
  useEffect(() => {
    const uhr = setTimeout(() => {
      window.history.replaceState(null, '', permalink(eingabe, window.location.pathname));
    }, RUHE_MS);
    return () => clearTimeout(uhr);
  }, [eingabe]);

  function aendern(feld: 'km' | 'budget', wert: number) {
    setErsteAnzeige(false);
    melde(EREIGNIS.eingabeGeaendert, { feld });
    setEingabe((alt) =>
      feld === 'km'
        ? { ...alt, kmProJahr: Math.round(wert) }
        : { ...alt, budgetEur: Math.round(wert) },
    );
  }

  const fahrzeug = ergebnis?.fahrzeug;
  const guenstigstes = guenstigstesFahrzeug();

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-rule bg-sheet p-5 sm:p-6 rounded-[var(--radius-sheet)]">
        <h1 className="m-0 mb-4 text-[17px] font-semibold text-ink">
          Wie viel fährst du, und was darf das Auto kosten?
        </h1>
        <form
          action="/rechner"
          method="get"
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(ereignis) => ereignis.preventDefault()}
        >
          <EingabeFeld
            name="km"
            beschriftung="Fahrleistung in Kilometern pro Jahr"
            einheit="km pro Jahr"
            wert={eingabe.kmProJahr}
            min={GRENZEN.km.min}
            max={GRENZEN.km.max}
            schritt={GRENZEN.km.schritt}
            onWert={(wert) => aendern('km', wert)}
          />
          <EingabeFeld
            name="budget"
            beschriftung="Budget für den Kauf in Euro"
            einheit="€ Budget"
            wert={eingabe.budgetEur}
            min={GRENZEN.budget.min}
            max={GRENZEN.budget.max}
            schritt={GRENZEN.budget.schritt}
            onWert={(wert) => aendern('budget', wert)}
          />
          <noscript>
            <button
              type="submit"
              className="bg-ink px-5 py-3 text-[16px] font-semibold text-sheet rounded-[var(--radius-control)]"
            >
              Ergebnis berechnen
            </button>
          </noscript>
        </form>
      </section>

      {ergebnis && fahrzeug ? (
        <section
          aria-live="polite"
          className="border border-rule bg-sheet p-5 sm:p-6 rounded-[var(--radius-sheet)]"
        >
          <Verdikt ergebnis={ergebnis} />

          <div className="mt-6">
            <Kostenverlauf ergebnis={ergebnis} zeichnen={ersteAnzeige} />
          </div>

          <div className="mt-6">
            <Annahmen ergebnis={ergebnis} />
          </div>

          <div className="max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-10 max-sm:border-t max-sm:border-rule max-sm:bg-sheet max-sm:p-4 sm:mt-2">
            <PartnerCta
              modellId={fahrzeug.id}
              href={partnerUrls[fahrzeug.id] ?? fahrzeug.partnerUrl}
              beschriftung={`Preise für den ${fahrzeugName(fahrzeug)} bei Carwow ansehen`}
              eingabe={eingabe}
            />
            <Offenlegung klasse="mt-2" />
          </div>
        </section>
      ) : (
        <section
          aria-live="polite"
          className="border border-rule bg-sheet p-5 sm:p-6 rounded-[var(--radius-sheet)]"
        >
          <p className="fliesstext m-0 text-[19px] text-ink">
            Für {alsEuro(eingabe.budgetEur)} liegt kein Modell im Datensatz.
          </p>
          <p className="fliesstext mt-2 mb-0 text-[16px] text-muted">
            Das günstigste geführte Fahrzeug ist der {fahrzeugName(guenstigstes)} ab{' '}
            {alsEuro(guenstigstes.listenpreisEur)}. Erhöhe das Budget auf mindestens diesen
            Betrag.
          </p>
        </section>
      )}
    </div>
  );
}
