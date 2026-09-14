import type { Metadata } from 'next';
import { Abschnitt, FehlendeAngaben } from '@/components/Rechtstext';
import { betreiber } from '@/lib/betreiber';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Anbieterkennzeichnung nach Paragraf 5 DDG.',
  alternates: { canonical: '/impressum' },
};

export default function Impressum() {
  const angaben = betreiber();

  return (
    <article>
      <h1 className="m-0 mb-4 text-[28px] font-bold text-ink">Impressum</h1>

      <Abschnitt titel="Anbieter nach Paragraf 5 DDG">
        {angaben.vollstaendig ? (
          <address className="not-italic">
            {angaben.name}
            <br />
            {angaben.anschrift.map((zeile) => (
              <span key={zeile}>
                {zeile}
                <br />
              </span>
            ))}
          </address>
        ) : (
          <FehlendeAngaben />
        )}
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        {angaben.vollstaendig ? (
          <p className="m-0">
            E-Mail: <a href={`mailto:${angaben.email}`}>{angaben.email}</a>
            {angaben.telefon ? (
              <>
                <br />
                Telefon: {angaben.telefon}
              </>
            ) : null}
          </p>
        ) : (
          <FehlendeAngaben />
        )}
      </Abschnitt>

      {angaben.ustId ? (
        <Abschnitt titel="Umsatzsteuer-Identifikationsnummer">
          <p className="m-0">{angaben.ustId}</p>
        </Abschnitt>
      ) : null}

      <Abschnitt titel="Verantwortlich für den Inhalt">
        {angaben.vollstaendig ? (
          <p className="m-0">{angaben.name}, Anschrift wie oben.</p>
        ) : (
          <FehlendeAngaben />
        )}
      </Abschnitt>

      <Abschnitt titel="Werbliche Links">
        <p className="m-0">
          Diese Seite verlinkt auf Angebote von Carwow. Die Vermittlung läuft über das
          Partnerprogramm FlexOffers. Kommt über einen solchen Link eine Anfrage zustande,
          erhalten wir eine Provision. Für dich ändert sich der Preis dadurch nicht. Jeder
          werbliche Link ist vor dem Klick als solcher gekennzeichnet.
        </p>
      </Abschnitt>

      <Abschnitt titel="Streitbeilegung">
        <p className="m-0">
          Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Abschnitt>

      <Abschnitt titel="Haftung für Rechenergebnisse">
        <p className="m-0">
          Der Rechner liefert eine Überschlagsrechnung auf Grundlage öffentlicher Listenpreise
          und Verbrauchsangaben. Er ersetzt kein Angebot und keine Beratung. Die verwendeten
          Annahmen stehen auf der Rechenseite im Bereich Annahmen und Quellen.
        </p>
      </Abschnitt>
    </article>
  );
}
