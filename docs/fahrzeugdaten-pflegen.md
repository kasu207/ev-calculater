# Fahrzeugdaten pflegen

Die Daten liegen als versioniertes JSON im Repository. Es gibt keine Oberfläche
dafür, jede Änderung läuft über einen Pull Request. Das ist Absicht: So ist
nachvollziehbar, wer welchen Preis wann geändert hat.

Dateien:

- `packages/core/src/daten/fahrzeuge.json` – die ausgelieferten Elektromodelle
- `packages/core/src/daten/referenz.json` – die Verbrenner, gegen die gerechnet wird

## Ein Modell ändern

1. Wert im Konfigurator des Herstellers nachschlagen, nicht in einer
   Presseübersicht.
2. Feld ändern und `standDatum` auf das heutige Datum setzen.
3. `quelle` anpassen, wenn sich die Herkunft geändert hat.
4. `pnpm test` – die Prüfungen laufen gegen das Schema und die Verweise.
5. Im Pull Request die Quelle nennen. Ein Preis ohne Quelle wird nicht gemerged.

## Ein Modell aufnehmen

```json
{
  "id": "marke-modell-variante",
  "marke": "Cupra",
  "modell": "Born",
  "variante": "59 kWh",
  "listenpreisEur": 38300,
  "verbrauchKwhPro100km": 15.7,
  "kfzSteuerEurProJahr": 0,
  "thgQuoteEurProJahr": 70,
  "vergleichsId": "vw-golf-benzin",
  "partnerUrl": "https://www.carwow.de/cupra/born",
  "partnerUrlGeprueft": false,
  "quelle": "Listenpreis und WLTP kombiniert laut Herstellerkonfigurator",
  "standDatum": "2026-09-01"
}
```

Regeln:

- `verbrauchKwhPro100km` ist der WLTP-Wert **ohne** Aufschlag. Der Realaufschlag
  liegt in den Annahmen und wird für alle Fahrzeuge gleich angesetzt.
- `kfzSteuerEurProJahr` ist für batterieelektrische Fahrzeuge bis Ende 2030 null.
- `thgQuoteEurProJahr` ist der Erlös aus der THG-Quote, derzeit einheitlich
  70 € und nicht modellabhängig.
- `vergleichsId` muss auf einen Eintrag in `referenz.json` zeigen. Mehrere
  Modelle dürfen sich eine Referenz teilen.
- `partnerUrlGeprueft` bleibt `false`, bis jemand die Seite geöffnet und
  gesehen hat, dass dort genau dieses Modell steht. Siehe
  `partnerlinks-pruefen.md`.

## Eine Referenz wählen

Die Referenz entscheidet das Ergebnis stärker als jeder andere Wert. Sie soll
das Fahrzeug sein, das derselbe Käufer sonst nehmen würde: gleiche Klasse,
gleiche Größenordnung bei der Ausstattung, übliche Motorisierung. Ein premium
ausgestatteter Verbrenner als Vergleich lässt jedes Elektroauto gut aussehen und
macht das Ergebnis angreifbar.

Jede Referenz muss von mindestens einem Fahrzeug benutzt werden, sonst schlägt
die Prüfung fehl.

## Was die Prüfung abdeckt

`pnpm test` prüft: Schema beider Dateien, keine doppelten Kennungen, jede
`vergleichsId` existiert, keine verwaiste Referenz, jede `partnerUrl` ist eine
HTTPS-Adresse auf `www.carwow.de` mit Pfad, jeder Eintrag hat Quelle und Stand.

Ob eine Partnerseite wirklich existiert, prüft kein Test. Das macht ein Mensch,
einmal, vor dem Start.
