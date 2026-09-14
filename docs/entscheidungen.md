# Offene technische Entscheidungen, Stand der Umsetzung

Die vier Punkte aus Abschnitt 15 des Entwicklungsdokuments. Umgesetzt ist
jeweils der im Dokument vorgeschlagene Wert. Jeder steht an einer Stelle
(`packages/core/src/annahmen.ts`) und ist in der Oberfläche sichtbar.

## 1. Haltedauer im Rechenmodell

**Umgesetzt: sechs Jahre.** Das ist der Wert aus dem Dokument, keine
Entscheidung gegen die Dienstwagenperspektive.

Die Haltedauer verschiebt jedes Ergebnis erheblich: Sie bestimmt, wie oft die
jährliche Ersparnis den höheren Kaufpreis aufholen darf. Bei drei bis vier
Jahren, wie im Dienstwagen üblich, kippen mehrere Modelle vom Vorteil in den
Nachteil. Solange offen ist, ob die Zielgruppe privat oder gewerblich kauft,
bleibt es bei sechs Jahren. Umstellung: eine Zahl in `STANDARD_ANNAHMEN`.

## 2. Realaufschlag auf den WLTP-Verbrauch

**Umgesetzt: 15 Prozent, auf beiden Seiten.**

Das Dokument argumentiert nur für die Elektroseite. Der Aufschlag liegt hier
trotzdem auf beiden Seiten, weil der WLTP-Wert auch beim Verbrenner unter dem
Realverbrauch liegt. Nur elektrisch aufzuschlagen wäre nicht konservativ,
sondern falsch. Der Aufschlag deckt elektrisch zugleich die Ladeverluste ab.

Er steht nicht in den Fahrzeugdaten, sondern in den Annahmen. So bleibt in den
Daten der belegbare Herstellerwert stehen, und die Oberfläche kann den Aufschlag
offen ausweisen.

## 3. Ladeanteil zu Hause

**Umgesetzt: feste Annahme, 80 Prozent zu Hause.**

Gerechnet wird mit einem Mischpreis: 0,34 € je kWh zu Hause, 0,59 € an der
Ladesäule, gewichtet 80 zu 20. Beide Preise und der Anteil stehen im
Annahmen-Bereich.

Eine dritte Eingabe würde die Abschlussquote senken und damit genau die Zahl
verderben, die dieser Sprint messen soll.

## 4. Einwilligungsdialog vor dem Partnerklick

**Offen, hängt an der rechtlichen Prüfung.**

Umgesetzt ist der Stand ohne Dialog: Der Link trägt `rel="sponsored noopener"`,
öffnet einen neuen Tab, und die Provisionskennzeichnung steht dauerhaft sichtbar
darunter, nicht erst danach. Übermittelt werden nur die Modellkennung und die
Partnerkennung, keine Angaben über den Nutzer.

Fällt die anwaltliche Prüfung negativ aus, kommt ein Radix-Dialog mit
Einwilligung davor. Der Aufwand dafür ist mit 0,25 Personentagen veranschlagt.
Die Stelle ist `apps/web/components/PartnerCta.tsx`; der Klickpfad ist dort
bereits gekapselt.

## Abweichungen vom Entwicklungsdokument

Drei Stellen weichen bewusst ab. Alle drei sind Folgen der Technik, nicht der
Bequemlichkeit.

1. **`Annahmen` hat sechs statt drei Felder.** Die Entscheidungen 2 und 3
   brauchen einen Ort. Die drei Felder aus dem Dokument sind unverändert
   enthalten.
2. **Das Vorschaubild ist eine Route (`/api/vorschau`), keine
   `opengraph-image.tsx`.** Die Dateivariante sieht nur Pfadsegmente. Unser
   Permalink trägt seine Werte in der Abfrage, also braucht es eine Route, die
   `km` und `budget` lesen kann.
3. **Das Budget für initiales JavaScript wird nicht eingehalten.** Gemessen auf
   der Startseite, gzip, moderner Browser: 150 KB gegen ein Budget von 120 KB.
   Davon sind 11 KB unser eigener Code samt Radix-Collapsible, der Rest ist die
   Grundlast von React 19 und dem Next-App-Router. Ein zusätzlicher Chunk von
   40 KB trägt `noModule` und wird nur von alten Browsern geladen. Zod lag
   zunächst mit 101 KB im Bundle und ist entfernt: Der Rechenkern prüft seine
   Eingaben jetzt mit einfachen Vergleichen (`packages/core/src/grenzen.ts`),
   die Schemata liegen hinter einem eigenen Einstiegspunkt
   (`@ampmatch/core/schema`) und laufen nur auf dem Server und in den Tests.
   Unter 120 KB kommt man mit diesem Stack nur, wenn man den App Router
   verlässt. Das ist eine Entscheidung für Sprint 1, nicht für eine stille
   Korrektur hier.
4. **`/rechner` und `/` zeigen dieselbe Seite.** `/rechner` ist die Adresse der
   geteilten Ergebnisse, trägt aber `noindex` und einen Canonical-Tag auf `/`,
   damit nicht zwei Adressen mit demselben Inhalt indexiert werden.
