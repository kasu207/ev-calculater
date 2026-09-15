import type { Metadata } from 'next';
import { Abschnitt, FehlendeAngaben } from '@/components/Rechtstext';
import { betreiber } from '@/lib/betreiber';

export const metadata: Metadata = {
  title: 'Datenschutz',
  description: 'Welche Daten diese Seite verarbeitet und welche nicht.',
  alternates: { canonical: '/datenschutz' },
};

export default function Datenschutz() {
  const angaben = betreiber();

  return (
    <article>
      <h1 className="m-0 mb-4 text-[28px] font-bold text-ink">Datenschutzerklärung</h1>

      <p className="fliesstext m-0 text-[16px] text-ink">
        Diese Seite setzt keine Cookies, bindet keine fremden Skripte ein und verlangt keine
        Anmeldung. Deine Eingaben im Rechner werden im Browser verarbeitet und nicht
        gespeichert.
      </p>

      <Abschnitt titel="Verantwortlich">
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
            E-Mail: <a href={`mailto:${angaben.email}`}>{angaben.email}</a>
          </address>
        ) : (
          <FehlendeAngaben />
        )}
      </Abschnitt>

      <Abschnitt titel="Aufruf der Seite">
        <p className="m-0">
          Beim Aufruf verarbeitet der Server technisch notwendige Zugriffsdaten: gekürzte
          IP-Adresse, Zeitpunkt, angeforderte Adresse, Statuscode, übertragene Datenmenge und
          Browserkennung. Sie dienen dem Betrieb und der Abwehr von Angriffen. Rechtsgrundlage
          ist Artikel 6 Absatz 1 Buchstabe f DSGVO, unser berechtigtes Interesse an einem
          stabilen Betrieb. Die Protokolle werden nach spätestens sieben Tagen gelöscht.
        </p>
      </Abschnitt>

      <Abschnitt titel="Hosting">
        <p className="m-0">
          Die Seite läuft auf einem Server der Hetzner Online GmbH, Industriestraße 25, 91710
          Gunzenhausen, Standort Deutschland. Hetzner verarbeitet die Daten als
          Auftragsverarbeiter nach Artikel 28 DSGVO.
        </p>
      </Abschnitt>

      <Abschnitt titel="Reichweitenmessung">
        <p className="m-0">
          Für die Statistik nutzen wir Umami. Die Software läuft auf demselben Server und gibt
          keine Daten an Dritte weiter. Sie arbeitet ohne Cookies und ohne Kennung, die dich
          wiedererkennt. Erfasst werden aufgerufene Seiten, Verweisquelle, grobe Herkunftsregion
          und Gerätetyp sowie die Ereignisse des Rechners: Aufruf, Eingabeänderung, fertiges
          Ergebnis, Sichtbarkeit und Klick des Partnerlinks. Zum Ergebnis speichern wir das
          empfohlene Modell sowie Fahrleistung und Budget in groben Klassen, nicht die genauen
          Werte. Ein Personenbezug entsteht dabei nicht. Rechtsgrundlage ist Artikel 6 Absatz 1
          Buchstabe f DSGVO.
        </p>
      </Abschnitt>

      <Abschnitt titel="Weiterleitung zum Partner">
        <p className="m-0">
          Der Knopf unter dem Ergebnis führt auf eine Modellseite bei Carwow. Die Vermittlung
          läuft über das Partnerprogramm FlexOffers. Wir übermitteln dabei keine Angaben über
          dich, sondern nur die Kennung des empfohlenen Modells und unsere Partnerkennung. Mit
          dem Klick verlässt du diese Seite; ab dann gelten die Datenschutzhinweise von
          FlexOffers und Carwow. Beide setzen in der Regel eigene Cookies, um eine Anfrage
          unserer Empfehlung zuzuordnen. Darauf haben wir keinen Einfluss.
        </p>
      </Abschnitt>

      <Abschnitt titel="Schriften">
        <p className="m-0">
          Die verwendete Schrift Archivo liegt auf unserem Server. Es wird keine Verbindung zu
          Google Fonts oder einem anderen fremden Dienst aufgebaut.
        </p>
      </Abschnitt>

      <Abschnitt titel="Deine Rechte">
        <p className="m-0">
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen, die auf
          unserem berechtigten Interesse beruhen. Außerdem kannst du dich bei einer
          Datenschutzaufsichtsbehörde beschweren. Da wir keine Nutzerkonten führen und keine
          personenbezogenen Daten speichern, können wir zu einer Auskunftsanfrage in der Regel
          nur mitteilen, dass zu dir keine Daten vorliegen.
        </p>
      </Abschnitt>

      <Abschnitt titel="Stand">
        <p className="m-0">September 2026.</p>
      </Abschnitt>
    </article>
  );
}
