# Vom Rechner zum Geschäft

Dieses Dokument beantwortet eine einzige Frage: **Was muss passieren, damit
dieses Projekt 100 Euro im Monat trägt?** Alles, was nicht auf diese Frage
einzahlt, ist vorerst Beschäftigung.

---

## 1. Bestandsaufnahme: was vorher fehlte

Der Rechner war technisch sauber gebaut und wirtschaftlich wirkungslos. Fünf
Befunde, nach Schwere sortiert:

**Keine auffindbare Fläche.** Die Anwendung bestand aus einer einzigen URL,
deren Inhalt im Browser zusammengesetzt wurde. Eine Suchmaschine sah eine leere
Seite. Ohne Zulauf ist jede Verbesserung am Rechner wertlos - das war der
teuerste Mangel.

**Kein Ausgang.** Die Nutzerreise endete in einem Textfeld, das der Nutzer
kopierte und in seine eigene E-Mail an einen Händler einfügte. Genau dort, am
Punkt höchster Kaufabsicht, verließ er die Seite spurlos. Der wertvollste
Moment des gesamten Ablaufs wurde verschenkt.

**Keine Wiederkehr.** Kein Link, kein Lesezeichen mit Inhalt, keine Adresse,
nichts zum Weitergeben. Ein Autokauf zieht sich über Wochen; wer nach dem
ersten Besuch keine Spur hinterlässt, ist weg.

**Keine Messung.** Nicht feststellbar, an welchem der vier Assistentenschritte
die Leute abbrachen. Jede Änderung wäre geraten gewesen.

**Der Assistent war Kulisse.** Das vollständige Ergebnis stand bereits in
Schritt 1 unterhalb des Formulars. Vier Schritte, rund dreißig Felder - und
kein Moment, in dem etwas aufgedeckt wird. Der Aufbau versprach eine Dramaturgie,
die das Ergebnis vorwegnahm.

---

## 2. Was jetzt drin ist

| Baustein | Datei | Zweck |
|---|---|---|
| Hebel mit gerechneter Wirkung | `shared/levers.js` | Nutzen belegen, bevor irgendwo ein Partnerlink steht |
| Partner-Konfiguration | `shared/partners.js` | Ertragsquellen an- und abschaltbar, alle standardmäßig aus |
| Teilbare Ergebnis-Links | `shared/share.js` | Weiterempfehlung und Wiederkehr, ohne Datenhaltung |
| 36 gerenderte Seiten | `shared/seo.js`, `server/pages.js` | Auffindbarkeit: 28 Modell-, 6 Fahrprofilseiten, Übersicht, Sitemap |
| Anfrage- und Ereignisspeicher | `server/store.js` | Adressen mit Einwilligung, Trichtermessung ohne Cookies |
| Kennzahlen-Übersicht | `server/admin.js` | Optimieren statt raten |
| Versandnaht | `server/notify.js` | Double-Opt-in, Maildienst später anschließbar |

---

## 3. Das Zahlenmodell

Die Zielgröße ist absichtlich klein gewählt. 100 Euro im Monat sind kein
Geschäftsmodell, sondern ein **Beweis**: dass Fremde die Seite finden, ihr
genug vertrauen, um zu handeln, und dass jemand für diese Handlung zahlt. Wer
diesen Beweis hat, kann skalieren. Wer ihn nicht hat, skaliert ein Nullergebnis.

### Die Kette

```
Besucher → Ergebnis gesehen → Handlung → Vergütung
```

Realistische Quoten für eine Nischenseite mit echtem Rechenwert:

| Stufe | Quote | Begründung |
|---|---|---|
| Besucher erreicht das Ergebnis | 55 % | Das Ergebnis steht direkt auf jeder Landingpage |
| Ergebnis → Partnerklick | 4 % | Der Hebel ist gerechnet, nicht beworben |
| Partnerklick → Abschluss | 2-8 % | Je nach Quelle, siehe `shared/partners.js` |

### Was 100 Euro kostet - in Besuchern

| Quelle | Vergütung | Abschlussquote | Nötige Klicks | Nötige Besucher/Monat |
|---|---|---|---|---|
| Wallbox-Anfrage | 35 € | 5 % | 57 | rund 2.600 |
| Autostromtarif | 40 € | 4 % | 63 | rund 2.900 |
| Leasinganfrage | 70 € | 2 % | 71 | rund 3.300 |
| THG-Quote | 8 € | 8 % | 156 | rund 7.100 |

**Gemischt und realistisch: rund 1.500 bis 2.500 Besucher im Monat.** Das sind
50 bis 80 am Tag. Für 36 Seiten zu einer Frage, die zehntausendfach im Monat
gesucht wird, ist das erreichbar - aber nicht in zwei Wochen.

### Warum diese Reihenfolge

**Wallbox zuerst.** Die Empfehlung ist inhaltlich zwingend: Wer gerade gelesen
hat, dass ein höherer Heimladeanteil den Break-even um acht Monate verkürzt,
braucht eine Wallbox. Die Vergütung ist hoch, die Absicht echt.

**Autostrom als Zweites.** Der Rechner fragt den Strompreis ohnehin ab. Wenn
jemand 32 Cent einträgt und ein Tarif 26 Cent kostet, ist der Hinweis
schlicht eine bessere Antwort auf die Frage, die er gestellt hat. Die
Empfehlung verbessert das Produkt, statt es zu belasten - das ist der einzige
Aufbau, der langfristig trägt.

**Leasing zuletzt.** Höchste Vergütung, niedrigste Quote, und der Verdacht der
Befangenheit ist am größten. Erst anschließen, wenn die Reihenfolge der
Fahrzeugempfehlungen nachweislich unbeeinflusst bleibt - sie wird ausschließlich
aus der Berechnung abgeleitet, und das muss so bleiben.

**THG als Dauerläufer.** Kleiner Betrag, aber jährlich wiederkehrend. Greift
erst, wenn jemand das E-Auto tatsächlich gekauft hat - deshalb nichts für den
Anfang, aber der Grund, warum die E-Mail-Liste den eigentlichen Wert hat.

---

## 4. Warum die E-Mail-Liste mehr wert ist als jeder Klick

Ein Autokauf dauert Wochen bis Monate. Der Klick am ersten Tag ist ein
Zufallstreffer; die Adresse ist ein Kanal über den gesamten Entscheidungszeitraum.
Rechnerisch:

- Ein Partnerklick ist einmalig und bringt im Erwartungswert 1,50 bis 2 Euro.
- Eine bestätigte Adresse mit Kaufabsicht ist über 12 Monate mehrfach ansprechbar:
  vor dem Kauf (Wallbox, Tarif, Angebot), nach dem Kauf (THG, jährlich).

Deshalb steht das Formular **nach** dem Ergebnis und nicht davor. Eine
Mautschranke vor dem Ergebnis hebt die Eintragsquote kurzfristig und zerstört
die Weiterempfehlung, von der der Zulauf abhängt.

---

## 5. Reihenfolge der nächsten Schritte

**Zuerst, ohne das geht nichts:**

1. Domain registrieren, `SITE_URL` setzen. Ohne echte Domain zeigen Sitemap,
   geteilte Links und Bestätigungsmails ins Leere.
2. Impressum und Datenschutzerklärung ausfüllen. Beide liegen als Vorlage in
   `public/`. Ein fehlendes Impressum ist abmahnfähig, bevor der erste Euro
   fließt.
3. `ADMIN_TOKEN` setzen. Ohne Zahlen ist alles Weitere geraten.

**Dann, für den Zulauf:**

4. Sitemap in der Google Search Console einreichen. Erste Platzierungen
   brauchen erfahrungsgemäß sechs bis zwölf Wochen.
5. Maildienst am `MAIL_WEBHOOK_URL` anschließen, sonst bleibt jede Adresse
   unbestätigt und damit unbrauchbar.
6. Drei bis fünf ehrliche Beiträge dort, wo die Frage ohnehin gestellt wird
   (Fachforen, einschlägige Subreddits). Kein Werbetext, sondern die
   Modellseite als Antwort auf eine konkrete Frage. Das bringt die ersten
   Besucher, während die Suchmaschine noch braucht.

**Erst danach, wenn Zahlen vorliegen:**

7. Einen Partner anschließen - Wallbox. `enabled: true` setzen und die echte
   Partnerkennung eintragen. Nicht vier auf einmal: sonst ist nicht
   zuzuordnen, was wirkt.
8. Nach vier Wochen `/admin?token=...` auswerten. Die schwächste Quote in der
   Kette ist der nächste Arbeitspunkt, nicht die, die am leichtesten zu
   verbessern wäre.

---

## 6. Was dieses Modell scheitern lässt

Ehrlichkeit über die Risiken gehört zur Planung:

**Der Zulauf kommt nicht.** Das wahrscheinlichste Scheitern. Der Suchbegriff
"lohnt sich ein e-auto" ist umkämpft; ADAC und die großen Portale stehen
oben. Die Chance liegt in der langen Nische: "lohnt sich ein [Modell] bei
[Fahrleistung]" - genau dafür sind die 34 Detailseiten gebaut. Wenn nach drei
Monaten keine Seite in den Suchergebnissen auftaucht, ist die Annahme falsch,
und dann ist bezahlter Zulauf zu prüfen oder das Projekt ein gutes Werkzeug
ohne Geschäftsmodell.

**Die Datenbasis veraltet.** 28 Modelle mit Listenpreisen aus 2025/2026. Nach
zwölf Monaten ohne Pflege sind die Zahlen falsch, und falsche Zahlen sind
schlimmer als keine. Rechnen Sie mit einem halben Tag Pflege pro Quartal.

**Die Vergütung deckt den Aufwand nicht.** Bei 100 Euro im Monat und einem
halben Tag Pflege im Quartal geht die Rechnung knapp auf. Sie geht nicht auf,
wenn laufend Funktionen hinzukommen. Der Rechner ist fertig; die Arbeit liegt
jetzt beim Zulauf.

**Die Unabhängigkeit geht verloren.** Der einzige Grund, warum jemand diesem
Rechner glaubt, ist die Unabhängigkeit der Empfehlung. Die Fahrzeugreihenfolge
darf niemals von einer Vergütung abhängen. Das ist keine Haltung, sondern
Geschäftsgrundlage: Ein Rechner, dem man nicht glaubt, wird nicht
weiterempfohlen, und ohne Weiterempfehlung gibt es keinen Zulauf.
