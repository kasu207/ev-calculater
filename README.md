# E-Auto-Rechner

Webanwendung, die mit den echten Kosten des eigenen Fahrzeugs beantwortet, **ab wann
sich der Umstieg auf ein Elektroauto rechnet** – und **welches Modell** dabei passt.

Kein Framework, keine Laufzeitabhängigkeiten: Node-Standardbibliothek im Backend,
ES-Module im Browser.

## Was die Anwendung leistet

1. **Fahrprofil erfassen** – Jahresfahrleistung, Betrachtungszeitraum, längste Strecke.
2. **Aktuelles Auto bewerten** – Verkaufserlös, Verbrauch, Kraftstoffpreis, Versicherung,
   Kfz-Steuer, Wartung, sonstige Fixkosten, Wertverlust.
3. **Strom und Laden** – Anteil Heimladen, Strompreise, Ladeverlust, Wallbox, Förderung,
   THG-Quote, Kapitalkosten.
4. **Anforderungen** – Budget, Sitzplätze, Anhängelast, Reichweite, Kofferraum,
   Karosserieform.
5. **Ergebnis** – Break-even in Jahren und Kilometern, Kostenverlauf als Diagramm,
   bewertete Fahrzeugempfehlungen, Angebotsvarianten und ein fertiger Anfragetext
   für den Händler.

Das Ergebnis aktualisiert sich bei jeder Eingabe; eine schwebende Leiste zeigt die
aktuelle Empfehlung schon während der Eingabe.

## Zwei Vergleichsszenarien

Die ehrliche Antwort hängt davon ab, womit verglichen wird. Beide Fälle sind umschaltbar:

| Szenario | Alternative zum E-Auto | Wirkung |
| --- | --- | --- |
| **Auto behalten** | den vorhandenen Verbrenner weiterfahren | Der Neuwagen trägt den vollen Wertverlust allein. Strenger Maßstab. |
| **Neuwagen steht an** | einen vergleichbaren Verbrenner-Neuwagen kaufen | Wertverlust fällt auf beiden Seiten an, es entscheiden die laufenden Kosten. |

## Rechenmodell

Der wirtschaftliche Vorteil des E-Autos zum Zeitpunkt `t` (in Jahren):

```
vorteil(t) = förderung − wallbox
           + ersparnis_laufend · t
           + wertverlust_referenz(t) − wertverlust_eauto(t)
           − kapitalkosten(t)
```

Zum Zeitpunkt 0 bleibt `förderung − wallbox` übrig, weil sich Kaufpreise und Restwerte
auf beiden Seiten aufheben. Der **Break-even** ist der erste Monat, in dem `vorteil(t)`
das Vorzeichen wechselt; gerechnet wird monatsgenau, dargestellt in Jahresschritten.

Restwerte fallen geometrisch (gleichbleibender Prozentsatz pro Jahr auf den jeweiligen
Restwert). Kapitalkosten laufen auf das zusätzlich gebundene Geld
(`restwert_eauto − restwert_referenz`, zuzüglich der noch nicht abgeschriebenen Wallbox).

### Fahrzeugbewertung

Fünf gewichtete Teilscores ergeben den Gesamtscore:

| Kriterium | Gewicht | Grundlage |
| --- | --- | --- |
| Wirtschaftlichkeit | 34 % | Gesamtergebnis nach Ablauf des Zeitraums und Zeitpunkt des Break-even |
| Budget | 20 % | Listenpreis abzüglich Förderung gegen das angegebene Budget |
| Reichweite | 18 % | 78 % der WLTP-Reichweite gegen den aus dem Fahrprofil abgeleiteten Bedarf |
| Praxistauglichkeit | 20 % | Karosserieform, Kofferraum, Sitzplätze |
| Ladegeschwindigkeit | 8 % | geschätzte Ladezeit für 200 km, gewichtet nach Langstreckenanteil |

Harte Kriterien (Sitzplätze, Anhängelast, deutliche Budgetüberschreitung) führen nicht
zum stillen Verschwinden eines Fahrzeugs, sondern zu einem ausgewiesenen Ausschluss
mit Begründung.

## Starten

```bash
npm start          # http://localhost:3000
npm run dev        # mit automatischem Neustart
npm test           # 21 Tests des Rechenkerns
```

Port und Adresse sind über `PORT` und `HOST` einstellbar. Es werden keine Pakete
installiert – Node 18 oder neuer genügt.

## API

| Endpunkt | Zweck |
| --- | --- |
| `GET /api/meta` | Vorgabewerte, Karosseriebezeichnungen, Stand der Fahrzeugdaten |
| `GET /api/vehicles` | vollständige Fahrzeugdatenbank |
| `POST /api/recommend` | Ranking, beste Gesamtempfehlung, wirtschaftlicher Sieger, Gegenszenario |
| `POST /api/vehicle` | Einzelbewertung, Angebotsvarianten, Anfragetext |

Beide POST-Endpunkte erwarten `{ "input": { ... } }` in der Struktur aus
`shared/defaults.js`; fehlende Felder werden mit den Vorgabewerten ergänzt.

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H 'content-type: application/json' \
  -d '{"input":{"scenario":"replace","profile":{"kmPerYear":25000}},"limit":5}'
```

## Projektstruktur

```
shared/      Rechenkern – von Server und Tests gemeinsam genutzt
  defaults.js    Vorgabewerte aller Eingaben
  vehicles.js    Fahrzeugdatenbank (28 Modelle)
  calc.js        Kostenvergleich, Restwerte, Break-even
  match.js       Bewertung und Empfehlung
  offers.js      Kauf-, Finanzierungs- und Leasingmodell, Anfragetext
server/      HTTP-Server und API, ohne Fremdbibliotheken
public/      Frontend (ES-Module, SVG-Diagramme ohne Chartbibliothek)
test/        Tests mit dem Node-Testrunner
```

## Barrierefreiheit und Darstellung

- Helles und dunkles Design, beide eigenständig gesetzt statt automatisch invertiert.
- Diagrammfarben (blau = E-Auto, orange = Verbrenner) sind in beiden Modi auf
  Farbfehlsichtigkeit und Kontrast geprüft; die Farbe folgt immer der Entität.
- Jedes Diagramm hat eine Legende, Direktbeschriftung und eine Tabellenansicht.
- Vollständig bedienbar ab 390 px Breite, ohne horizontales Scrollen der Seite.

## Datenbasis und Grenzen

Fahrzeugdaten sind **Richtwerte nach Herstellerangabe (Stand 2025/2026)** und ersetzen
kein Angebot. Die Angebotsvarianten sind **Modellrechnungen mit marktüblichen
Konditionen**, keine echten Händlerangebote und keine Zusage über Nachlässe.

Nicht im Modell enthalten: Preissteigerungen bei Kraftstoff und Strom, Reparaturrisiken
des Altfahrzeugs, steuerliche Effekte bei gewerblicher Nutzung.

Die Berechnung läuft in der Sitzung des Nutzers, Eingaben werden ausschließlich lokal
im Browser gespeichert und nicht weitergegeben.
