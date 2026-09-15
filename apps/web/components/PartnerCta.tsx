'use client';

import { useEffect, useRef } from 'react';
import { EREIGNIS, budgetKlasse, kmKlasse, melde } from '@/lib/messung';
import type { Eingabe } from '@ampmatch/core';

type Props = {
  modellId: string;
  beschriftung: string;
  href: string;
  eingabe: Eingabe;
};

/**
 * Der Klick auf diese Flaeche ist die Primaermetrik des Sprints. Deshalb steht
 * hier auch die Sichtbarkeitsmessung: 50 Prozent der Flaeche, mindestens eine Sekunde.
 */
export function PartnerCta({ modellId, beschriftung, href, eingabe }: Props) {
  const flaeche = useRef<HTMLAnchorElement>(null);
  const gemeldet = useRef(false);

  useEffect(() => {
    const knoten = flaeche.current;
    if (!knoten || gemeldet.current) return;

    let uhr: ReturnType<typeof setTimeout> | undefined;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const sichtbar = eintraege.some((eintrag) => eintrag.intersectionRatio >= 0.5);
        if (sichtbar && !uhr) {
          uhr = setTimeout(() => {
            if (gemeldet.current) return;
            gemeldet.current = true;
            melde(EREIGNIS.ctaGesehen, { modellId });
            beobachter.disconnect();
          }, 1000);
        }
        if (!sichtbar && uhr) {
          clearTimeout(uhr);
          uhr = undefined;
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    beobachter.observe(knoten);
    return () => {
      if (uhr) clearTimeout(uhr);
      beobachter.disconnect();
    };
  }, [modellId]);

  return (
    <a
      ref={flaeche}
      href={href}
      target="_blank"
      rel="sponsored noopener"
      data-pruefung="partner-cta"
      className="block bg-signal px-5 py-4 text-center text-[17px] font-semibold text-ink rounded-[var(--radius-control)]"
      onClick={() => {
        const daten = {
          modellId,
          kmBucket: kmKlasse(eingabe.kmProJahr),
          budgetBucket: budgetKlasse(eingabe.budgetEur),
        };
        melde(EREIGNIS.ctaGeklickt, daten);
        // Der Browser oeffnet unmittelbar danach die Partnerseite.
        melde(EREIGNIS.weiterleitung, daten);
      }}
    >
      {beschriftung}
    </a>
  );
}
