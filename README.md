# E-Auto-Rechner

Webanwendung, die mit den echten Kosten des eigenen Fahrzeugs beantwortet, **ab wann
sich der Umstieg auf ein Elektroauto rechnet** – und **welches Modell** dabei passt.

Kein Framework, keine Laufzeitabhängigkeiten: Node-Standardbibliothek im Backend,
ES-Module im Browser.

## Was die Anwendung leistet

1. **Fahrprofil erfassen** – Jahresfahrleistung, Betrachtungszeitraum, längste Strecke.
2. **Aktuelles Auto bewerten** – Verkaufserlös, Verbrauch, Kraftstoffpreis, Versicherung,
   Kfz-Steuer, Wartung, sonstige Fixkosten, Wertverlust.
3. **Energiepreise und Laden** – Anteil Heimladen, Strompreise, Ladeverlust, Wallbox,
   Förderung, THG-Quote, Kapitalkosten sowie die **Preisprognose** für Kraftstoff und
   Strom.
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
           + laufende_kosten_referenz(t) − laufende_kosten_eauto(t)
           + wertverlust_referenz(t) − wertverlust_eauto(t)
           − kapitalkosten(t)
```

Zum Zeitpunkt 0 bleibt `förderung − wallbox` übrig, weil sich Kaufpreise und Restwerte
auf beiden Seiten aufheben. Der **Break-even** ist der erste Monat, in dem `vorteil(t)`
das Vorzeichen wechselt; gerechnet wird monatsgenau, dargestellt in Jahresschritten.

Restwerte fallen geometrisch (gleichbleibender Prozentsatz pro Jahr auf den jeweiligen
Restwert). Kapitalkosten laufen auf das zusätzlich gebundene Geld
(`restwert_eauto − restwert_referenz`, zuzüglich der noch nicht abgeschriebenen Wallbox).

### Preisprognose für Kraftstoff und Strom

Die laufenden Kosten werden monatlich aufsummiert, weil sich Kraftstoff und Strom
unterschiedlich schnell verteuern. Nur der Energieanteil wächst, Versicherung, Steuer und
Wartung bleiben fest:

```
energiekosten(monat m) = energiekosten_heute / 12 · (1 + steigerung)^((m − 0,5) / 12)
```

Der Preisstand wird in der Monatsmitte angesetzt, damit im ersten Jahr kein Sprung
entsteht. Die gesamte Rechnung läuft in **heutigen Euro**, deshalb sind die Steigerungen
**real** einzutragen – der Anteil über der allgemeinen Inflation. So bleibt das Modell
ohne zusätzliche Abzinsung konsistent.

Drei Voreinstellungen sind mit einem Klick umschaltbar, eigene Werte (auch negative)
überschreiben sie jederzeit:

| Voreinstellung | Kraftstoff | Strom |
| --- | --- | --- |
| Preise bleiben real konstant | 0 % | 0 % |
| Moderat steigend (Vorgabe) | 2,0 % | 1,0 % |
| CO2-Preis schlägt durch | 5,0 % | 1,0 % |

Das Ergebnis weist die Ersparnis im ersten und im letzten Jahr sowie den Durchschnitt
getrennt aus, dazu den Kraftstoff- und Strompreis am Ende des Zeitraums.

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
npm test           # 35 Tests: Rechenkern und HTTP-Schicht
```

Port und Adresse sind über `PORT` und `HOST` einstellbar. Es werden keine Pakete
installiert – Node 18 oder neuer genügt.

## Deployment mit Docker Compose

Auf dem Server läuft die Anwendung auf **Port 7000**; im Container lauscht sie
intern auf 3000.

```bash
git clone https://github.com/kasu207/ev-calculater.git
cd ev-calculater
docker compose up -d --build
```

Prüfen, ob sie steht:

```bash
docker compose ps                       # Status muss "healthy" zeigen
curl http://localhost:7000/api/health   # {"status":"ok",...}
```

Danach ist der Rechner unter `http://<server>:7000` erreichbar.

### Bind-Adresse

Standardmäßig setzt die Compose-Datei keine Host-IP, Docker bindet den Port also
wie üblich auf IPv4 und IPv6. Hinter einem Reverse Proxy ist es besser, ihn
gezielt nur lokal zu öffnen:

```bash
BIND_ADDR=127.0.0.1 docker compose up -d
```

### Fehlersuche

**`curl: (7) Failed to connect to localhost port 7000 after 0 ms`, obwohl der
Container läuft.** Die Fehlermeldung ohne messbare Laufzeit bedeutet, dass die
Verbindung sofort abgelehnt wurde – meist löst `localhost` dann zuerst nach IPv6
`::1` auf, wo nichts lauscht. Gegenprobe:

```bash
curl http://127.0.0.1:7000/api/health
```

Antwortet diese Adresse, ist es genau das. Sorgen Sie dafür, dass `BIND_ADDR`
nicht auf `0.0.0.0` gesetzt ist – dann bindet Docker wieder beide Protokolle.

**Prüfen, ob die Anwendung im Container selbst antwortet:**

```bash
docker compose exec ev-calculator \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
docker compose logs --tail=30
docker inspect --format '{{json .State.Health}}' ev-calculator
```

**`exec /sbin/docker-init: operation not permitted`, Container startet immer neu.**
Das tritt auf, wenn `init: true` gesetzt ist und der Host die Ausführung des
eingehängten `docker-init` verweigert. Die Compose-Datei kommt bewusst ohne
`init` aus – der Server behandelt SIGTERM und SIGINT selbst und startet keine
Kindprozesse. Sollte die Zeile in einer eigenen Abwandlung wieder auftauchen,
gehört sie hier wieder heraus.

### Zusatzhärtung nachrüsten

Die Compose-Datei verzichtet auf `read_only`, `cap_drop: ALL` und
`no-new-privileges`. Auf einem gehärteten Ubuntu-Host verhinderten sie den
Containerstart (Exit 255 in einer Neustartschleife), und für den Betrieb werden
sie nicht gebraucht: die Anwendung läuft als unprivilegierter Nutzer, schreibt
nichts auf die Platte und hält keine Daten.

Wer sie trotzdem möchte, prüft jede Option einzeln gegen den eigenen Host –
`exit=124` bedeutet, dass der Start geklappt hat und nur die Zeitgrenze zuschlug:

```bash
timeout 4 docker run --rm --read-only ev-calculator:latest; echo $?
timeout 4 docker run --rm --cap-drop ALL ev-calculator:latest; echo $?
timeout 4 docker run --rm --security-opt no-new-privileges:true ev-calculator:latest; echo $?
```

Was durchläuft, kann in `docker-compose.yml` ergänzt werden.

**`WARN The "BIND_ADDR" variable is not set.`** Harmlos: die Variable ist
optional. Wer die Meldung nicht sehen will, legt eine Datei `.env` mit der
Zeile `BIND_ADDR=` an.

**Port bereits belegt?** `ss -ltnp | grep 7000` zeigt, wer ihn hält. Ein anderer
Host-Port lässt sich in `docker-compose.yml` unter `ports` eintragen.

### Betrieb hinter einem Reverse Proxy

Der Server spricht reines HTTP ohne eigene TLS-Terminierung. Für eine öffentliche
Adresse gehört ein Proxy davor, der das Zertifikat hält. Mit Caddy genügt:

```caddyfile
rechner.example.com {
    reverse_proxy 127.0.0.1:7000
}
```

Mit nginx:

```nginx
location / {
    proxy_pass         http://127.0.0.1:7000;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

### Aktualisieren, Logs, Stoppen

```bash
git pull && docker compose up -d --build   # neue Version ausrollen
docker compose logs -f                     # Logs mitlesen
docker compose down                        # stoppen und entfernen
```

Der Container fährt auf SIGTERM geordnet herunter (gemessen rund 0,1 Sekunden),
`docker compose down` läuft also ohne Timeout durch.

### Was der Container mitbringt

| Eigenschaft | Umsetzung |
| --- | --- |
| Basis | `node:22-alpine`, keine Laufzeitabhängigkeiten, kein Build-Schritt |
| Nutzer | unprivilegierter Nutzer `node`, nicht root |
| Grenzen | 512 MB Speicher, 1 CPU |
| Healthcheck | `GET /api/health` alle 30 Sekunden |
| Logs | json-file, rotiert bei 10 MB, 3 Dateien |
| Neustart | `unless-stopped` |

Es gibt keinen Zustand und keine Datenbank: Eingaben bleiben im Browser des
Nutzers, der Container ist jederzeit ersetzbar.

## API

| Endpunkt | Zweck |
| --- | --- |
| `GET /api/meta` | Vorgabewerte, Karosseriebezeichnungen, Stand der Fahrzeugdaten |
| `GET /api/vehicles` | vollständige Fahrzeugdatenbank |
| `POST /api/recommend` | Ranking, beste Gesamtempfehlung, wirtschaftlicher Sieger, Gegenszenario |
| `POST /api/vehicle` | Einzelbewertung, Angebotsvarianten, Anfragetext, Hebel, freigeschaltete Partner |
| `POST /api/lead` | Anfrage eines Nutzers, wird unbestätigt gespeichert |
| `POST /api/event` | cookielose Trichtermessung |

Die POST-Endpunkte für Berechnungen erwarten `{ "input": { ... } }` in der Struktur aus
`shared/defaults.js`; fehlende Felder werden mit den Vorgabewerten ergänzt.

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H 'content-type: application/json' \
  -d '{"input":{"scenario":"replace","profile":{"kmPerYear":25000}},"limit":5}'
```

## Öffentliche Seiten

Der Rechner selbst wird im Browser zusammengesetzt und ist für Suchmaschinen
damit leer. Deshalb rendert der Server zusätzlich 36 vollständige Seiten aus
derselben Rechenlogik - sie sind der Grund, warum das Projekt gefunden werden
kann. Die Inhalte sind gerechnet, nicht getextet, und bleiben dadurch aktuell,
wenn sich Fahrzeugdaten oder Annahmen ändern.

| Pfad | Inhalt |
| --- | --- |
| `/e-auto` | Übersicht aller 28 Modelle mit Break-even |
| `/e-auto/:modell` | Modellseite mit Break-even je Fahrleistung, Kostenverlauf, Daten |
| `/fahrprofil/:n-km` | Rangliste für 5.000 bis 50.000 km im Jahr |
| `/ergebnis/:zustand` | geteiltes Ergebnis, nicht indexiert |
| `/sitemap.xml`, `/robots.txt` | für Suchmaschinen |
| `/admin?token=…` | Trichter- und Ertragskennzahlen, nur mit `ADMIN_TOKEN` |
| `/bestaetigen?token=…` | Double-Opt-in für E-Mail-Adressen |

## Betriebsvariablen

| Variable | Wirkung |
| --- | --- |
| `SITE_URL` | absolute Basis für Sitemap, geteilte Links und Bestätigungsmails |
| `ADMIN_TOKEN` | schaltet `/admin` frei; ohne Token antwortet die Seite wie eine unbekannte Adresse |
| `DATA_DIR` | Ablage für `leads.jsonl` und `events.jsonl` (Standard `./data`) |
| `MAIL_WEBHOOK_URL` | Webhook eines Maildienstes; ohne Angabe landet die Mail nur im Log |
| `MAIL_WEBHOOK_TOKEN` | optionales Bearer-Token für diesen Webhook |
| `TRUST_PROXY` | wertet `X-Forwarded-For` aus - nur hinter einem vertrauenswürdigen Proxy setzen |

## Datenschutz im Betrieb

- Keine Cookies, keine Fremdskripte, keine Einbindung Dritter.
- IP-Adressen werden nie gespeichert. Für Ratenbegrenzung und Besucherzählung
  dient ein tagesrollierender, nicht zurückrechenbarer Hash im Arbeitsspeicher.
- E-Mail-Adressen nur mit ausdrücklicher Einwilligung und erst nach
  Bestätigung des zugesandten Links verwendbar.
- Geteilte Ergebnislinks tragen die Rechenwerte in der Adresse und werden
  nirgends gespeichert.
- `public/impressum.html` und `public/datenschutz.html` sind **Vorlagen** und
  müssen vor der Veröffentlichung ausgefüllt werden.

## Ertragsquellen

`shared/partners.js` hält die vergüteten Empfehlungen. Alle Einträge stehen auf
`enabled: false` und zeigen auf Platzhalter-URLs. Ein Eintrag wird erst
eingeschaltet, wenn ein echter Partnervertrag besteht und die eigene
Partnerkennung hinterlegt ist.

Ein Partnerhinweis erscheint ausschließlich an einem Hebel aus
`shared/levers.js`, dessen Wirkung vorher durchgerechnet wurde - der Nutzen ist
also belegt, bevor ein Link steht. Werbliche Verweise sind fest im Markup als
Anzeige gekennzeichnet und tragen `rel="sponsored nofollow noopener"`.

Die Reihenfolge der Fahrzeugempfehlungen wird von Vergütungen nicht beeinflusst.
Sie ergibt sich ausschließlich aus der Berechnung in `shared/match.js`.

Das Zahlenmodell dahinter steht in [GROWTH.md](GROWTH.md).

## Projektstruktur

```
shared/      Rechenkern – von Server, Browser und Tests gemeinsam genutzt
  defaults.js    Vorgabewerte aller Eingaben
  vehicles.js    Fahrzeugdatenbank (28 Modelle)
  calc.js        Kostenvergleich, Restwerte, Preisprognose, Break-even
  match.js       Bewertung und Empfehlung
  offers.js      Kauf-, Finanzierungs- und Leasingmodell, Anfragetext
  levers.js      gerechnete Wirkung von Tarif, Ladeanteil und THG-Quote
  partners.js    Ertragsquellen, standardmäßig alle abgeschaltet
  share.js       Kodierung des Eingabezustands für teilbare Links
  seo.js         Inhalte der öffentlichen Seiten
  format.js      Zahlen- und Datumsformate
server/      HTTP-Server, API und serverseitiges Rendern
  server.js      Routen, statische Auslieferung
  pages.js       gerenderte Landing- und Ergebnisseiten
  store.js       Anfragen, Ereignisse, Ratenbegrenzung
  notify.js      Versandnaht für Bestätigungsmails
  admin.js       Kennzahlen-Übersicht
public/      Frontend (ES-Module, SVG-Diagramme ohne Chartbibliothek)
  conversion.js  Hebel-, Anfrage- und Teilen-Bausteine
test/        Tests mit dem Node-Testrunner
GROWTH.md    Zahlenmodell und Reihenfolge der nächsten Schritte
Dockerfile
docker-compose.yml
```

## Barrierefreiheit und Darstellung

- Helles und dunkles Design, beide eigenständig gesetzt statt automatisch invertiert.
- Diagrammfarben (blau = E-Auto, orange = Verbrenner) sind in beiden Modi auf
  Farbfehlsichtigkeit und Kontrast geprüft; die Farbe folgt immer der Entität.
- Jedes Diagramm hat eine Legende, Direktbeschriftung und eine Tabellenansicht.
- Vollständig bedienbar ab 390 px Breite, ohne horizontales Scrollen der Seite.

## Entwicklung mit Claude Code

Das Repository aktiviert in `.claude/settings.json` das Plugin
[Superpowers](https://github.com/obra/superpowers) (v6.3.0, MIT, Autor Jesse Vincent) aus
dem offiziellen Anthropic-Marketplace `claude-plugins-official`:

```json
{ "enabledPlugins": { "superpowers@claude-plugins-official": true } }
```

Wer das Repository auscheckt und darin eine Claude-Code-Sitzung startet, bekommt das
Plugin automatisch installiert – der offizielle Marketplace registriert sich beim Start
von selbst, eine zusätzliche Quelle ist nicht einzutragen.

Das Plugin liefert 14 Skills für die Arbeitsweise des Agenten, unter anderem
`brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`,
`requesting-code-review` und `verification-before-completion`. Dazu kommt ein
SessionStart-Hook, der die Einstiegs-Skill `using-superpowers` als Sitzungskontext
einspielt.

Zwei Hinweise dazu:

- Das Plugin ist Fremdcode. Der Marketplace-Eintrag ist auf einen festen Commit gepinnt
  (`b36e082`, entspricht Release v6.3.0), sodass sich der Inhalt nicht unbemerkt ändert.
- Wer es für sich abschalten will, setzt in `.claude/settings.local.json`
  (gitignoriert) `{"enabledPlugins": {"superpowers@claude-plugins-official": false}}` –
  lokale Einstellungen haben Vorrang vor den Projekteinstellungen.

## Datenbasis und Grenzen

Fahrzeugdaten sind **Richtwerte nach Herstellerangabe (Stand 2025/2026)** und ersetzen
kein Angebot. Die Angebotsvarianten sind **Modellrechnungen mit marktüblichen
Konditionen**, keine echten Händlerangebote und keine Zusage über Nachlässe.

Die Voreinstellungen der Preisprognose sind Annahmen, keine Prognose – sie machen die
Bandbreite durchspielbar und sind frei änderbar.

Nicht im Modell enthalten: Reparaturrisiken des Altfahrzeugs, künftige Änderungen bei
Kfz-Steuer und Förderung, steuerliche Effekte bei gewerblicher Nutzung.

Die Berechnung läuft in der Sitzung des Nutzers, Eingaben werden ausschließlich lokal
im Browser gespeichert und nicht weitergegeben.
