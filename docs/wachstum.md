# Wachstum: der Engpass und was ihn löst

Dieses Dokument beantwortet eine Frage: **Was begrenzt AmpMatch gerade, und was
davon ist gebaut?** Alles andere gehört nicht hierher.

---

## 1. Die Rechnung, auf die es ankommt

```
Umsatz = Sitzungen × CTA-Quote × Abschlussquote beim Partner × 10 €
```

Drei der vier Faktoren sind bereits im Griff:

- Die **CTA-Quote** wird gemessen, ist die Primärmetrik des Sprints und lässt
  sich gestalten.
- Die **Abschlussquote** gehört Carwow. Wir sehen sie nur im Reporting.
- Die **Provision** ist mit 10 € fest.

Bleibt **Sitzungen**. Und genau dort stand bis eben eine Null.

Die Sitemap führte drei Adressen: Startseite, Impressum, Datenschutz. Der
Rechner ist eine einzige Seite, deren Inhalt an zwei Parametern hängt, und der
Canonical-Tag zeigt bewusst immer auf `/`. Das ist für parametrisierte Adressen
richtig entschieden – aber es bedeutete: **Für eine Suchmaschine bestand das
gesamte Produkt aus einer Seite.** Wer den Rechner nicht schon kannte, hatte
keinen Weg zu ihm.

Bei 10 € je Anfrage braucht man für 100 € im Monat zehn Anfragen. Bei 8 Prozent
CTA-Klickrate und 10 Prozent Abschluss beim Partner sind das rund 1.250
abgeschlossene Rechnungen im Monat. Mit drei indexierbaren Adressen ist das
nicht knapp, sondern unmöglich. Jede Verbesserung an Oberfläche, Bundle-Größe
oder Rechenmodell war bis dahin Arbeit an einem Faktor, der mit null
multipliziert wird.

---

## 2. Welcher Markt sich gewinnen lässt

"Lohnt sich ein E-Auto" gehört dem ADAC und den großen Portalen. Dort
anzutreten heißt, gegen Redaktionen mit zwanzig Jahren Domainhistorie zu
konkurrieren.

Die Frage, die **niemand mit einer Zahl beantwortet**, ist die konkrete:

> *Lohnt sich der Volkswagen ID.3 bei 30.000 km im Jahr – und ab wann?*

Diese Frage hat 20 × 6 Ausprägungen, sie wird tatsächlich gestellt, und
AmpMatch kann sie als einziger in einer Sekunde beantworten, weil der Rechenkern
schon existiert. Das ist der kleine Markt, in dem man Erster sein kann, statt
Dreiundzwanzigster in einem großen.

Entscheidend ist dabei die Form, nicht die Menge. Zwei Seitenarten, deren
Achsen **senkrecht zueinander** stehen:

| Seitenart | Was fest ist | Was variiert | Anzahl |
| --- | --- | --- | --- |
| `/e-auto/[modell]` | das Modell | die Fahrleistung | 20 |
| `/fahrleistung/[n]-km` | die Fahrleistung | das Modell | 6 |

Dadurch wiederholt keine Seite den Inhalt einer anderen. Der naheliegende
dritte Schnitt – je Modell **und** Fahrleistung – ergäbe 120 weitere Adressen,
von denen jede eine Zeile aus einer bestehenden Tabelle wäre. Genau so entstehen
die Seiten, die Google als Brückenseiten aussortiert. Deshalb nicht gebaut, und
zwar bewusst.

---

## 3. Was jetzt drin ist

| Baustein | Ort | Zweck |
| --- | --- | --- |
| Datengrundlage der Seiten | `apps/web/lib/flaeche.ts` | Matrix je Modell, Rangliste je Fahrleistung, Preisnachbarn |
| Modellseiten | `apps/web/app/e-auto/[modell]/` | 20 statische Seiten, beim Bauen erzeugt |
| Fahrleistungsseiten | `apps/web/app/fahrleistung/[strecke]/` | 6 statische Seiten |
| Übersicht | `apps/web/app/e-auto/` | Verzeichnis und interne Verteilung |
| Sitemap | `apps/web/app/sitemap.ts` | 30 statt 3 Adressen |
| Seitenart in der Messung | `apps/web/lib/messung.ts` | beantwortet, welche Seitenart Anfragen erzeugt |
| Partner-CTA auf jeder Seite | `PartnerCta` mit `seitenart` | sonst wäre Zulauf ohne Ertrag |

Alle Seiten entstehen beim Bauen aus den vorhandenen Daten. Es gibt kein CMS,
keine Redaktion, keinen Textbaustein zu pflegen. **Ein neues Fahrzeug in
`fahrzeuge.json` bringt eine neue Seite mit und ergänzt alle sechs
Fahrleistungsseiten.** Das ist der Grund, warum diese Form skaliert und eine
Blogstrecke es nicht täte.

---

## 4. Warum der Restwert vorher dran war

Der Rechenkern ließ den Restwert weg. Bei drei Jahren Haltedauer ist er der
größte Posten der Rechnung: rund 18.000 € bei einem Fahrzeug für 36.900 €,
während die berechnete Differenz zwischen Elektro und Verbrenner bei einigen
hundert bis wenigen tausend Euro liegt.

Der Fehler hatte damit die Größenordnung der Aussage. Und er war nicht neutral,
sondern gerichtet: Er wirkte systematisch zugunsten der teureren Seite.

Für einen Rechner mit einer Adresse wäre das eine offengelegte Schwäche
gewesen. Für 26 Seiten, die genau auf diese Zahl hin gefunden werden sollen, ist
es etwas anderes: Man hätte einen Fehler vervielfältigt und Vertrauen auf ihm
aufgebaut. Deshalb zuerst der Rechenkern, dann die Fläche. Einzelheiten in
`entscheidungen.md`, Punkt 5.

---

## 5. Was als Nächstes den größten Unterschied macht

In dieser Reihenfolge, und jeweils erst, wenn der vorige Punkt Zahlen liefert:

1. **Sitemap in der Search Console einreichen.** Ohne diesen Schritt bleibt
   alles Gebaute unsichtbar. Sechs bis zwölf Wochen bis zu ersten
   Platzierungen.
2. **`offer_cta_clicked` nach `seitenart` auswerten.** Die Frage lautet nicht
   "wie viele Besucher", sondern "erzeugt eine Modellseite genauso zuverlässig
   eine Anfrage wie der Rechner". Fällt die Antwort negativ aus, gehört der
   CTA auf diesen Seiten überarbeitet, bevor mehr Seiten entstehen.
3. **Fahrzeugdaten erweitern.** Jedes zusätzliche Modell bringt eine Seite und
   verbessert sechs weitere. Das ist die billigste Wachstumsbewegung, die es
   in diesem Aufbau gibt – und der Grund, `fahrzeuge.json` gepflegt zu halten.
4. **E-Mail-Adresse erfassen.** Ein Autokauf dauert Wochen. Der Partnerklick am
   ersten Tag ist ein Zufallstreffer und bringt im Erwartungswert unter zwei
   Euro; eine Adresse mit Kaufabsicht ist über den gesamten
   Entscheidungszeitraum ansprechbar. Das ist der Punkt, an dem AmpMatch
   aufhört, ein Zulieferer am unteren Ende eines fremden Trichters zu sein.
   Bewusst noch nicht gebaut: Es braucht Einwilligung, Double-Opt-in und eine
   rechtliche Prüfung, und es lohnt erst, wenn überhaupt Zulauf da ist.

**Nicht als Nächstes:** das JavaScript-Budget. 150 KB gegen 120 KB ist bei
dieser Besucherzahl eine Optimierung an einem Faktor, der noch nicht begrenzt.

---

## 6. Woran das scheitern kann

**Der Zulauf kommt trotzdem nicht.** Das wahrscheinlichste Scheitern. 26 Seiten
sind eine Grundlage, keine Garantie. Wenn nach drei Monaten keine Seite in den
Suchergebnissen auftaucht, ist die Annahme über die Nische falsch – dann ist
bezahlter Zulauf zu prüfen oder das Projekt ein gutes Werkzeug ohne
Geschäftsmodell. Diese Möglichkeit gehört benannt, bevor Arbeit hineinfließt.

**Die Daten veralten.** 20 Modelle mit Listenpreisen vom September 2026. Nach
zwölf Monaten ohne Pflege sind die Zahlen falsch – und falsche Zahlen auf 26
Seiten sind schlimmer als gar keine Seiten. Rechnen Sie mit einem halben Tag je
Quartal.

**Die Unabhängigkeit geht verloren.** Der einzige Grund, warum jemand diesem
Rechner glaubt, ist, dass die Empfehlung aus der Rechnung kommt und nicht aus
der Provision. Die Auswahlregel in `packages/core/src/berechnung.ts` darf
niemals eine Vergütung kennen. Das ist keine Haltung, sondern Geschäftsgrundlage:
Ein Rechner, dem man nicht glaubt, wird nicht verlinkt, und ohne Verlinkung gibt
es keinen Zulauf.
