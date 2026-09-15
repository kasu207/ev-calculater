# Partnerlinks prüfen (AMP-006a)

Ein Modell ohne verifizierte Partnerseite wird nicht ausgeliefert. Jede der
zwanzig Adressen wird vor dem Start einmal von Hand geöffnet. Kein Skript ersetzt
das: Eine Adresse kann 200 zurückgeben und trotzdem auf einer Modellübersicht
oder einer Weiterleitung zur Startseite landen.

## Wie geprüft wird

Für jede Zeile:

1. Adresse im Browser öffnen, ohne Werbeblocker.
2. Prüfen, ob dort genau dieses Modell steht, nicht die Marke allgemein und nicht
   eine Startseite.
3. Prüfen, ob die Seite eine Anfrage erlaubt. Ohne Anfragemöglichkeit entsteht
   kein Lead, und der Link ist wertlos.
4. Stimmt alles: in `packages/core/src/daten/fahrzeuge.json` bei diesem Modell
   `partnerUrlGeprueft` auf `true` setzen und die Zeile unten auf geprüft
   ändern.
5. Stimmt es nicht: richtige Adresse suchen, `partnerUrl` ändern, erneut prüfen.
   Gibt es keine passende Seite, fliegt das Modell aus dem Datensatz.

Danach:

```bash
node scripts/startpruefung.mjs
```

Die Prüfung meldet jede Zeile, die noch offen ist.

## Der Trackingparameter

Der Deep-Link wird serverseitig zusammengesetzt
(`apps/web/lib/partner.ts`). Die Adresse in den Fahrzeugdaten ist immer die
nackte Carwow-Adresse, ohne Parameter. Die Verpackung übernimmt
`AMPMATCH_FLEXOFFERS_DEEPLINK_BASIS`; die Modellkennung geht als `fobs` mit,
damit im FlexOffers-Reporting sichtbar ist, welches Modell den Lead gebracht hat.

Vor dem Start einmal einen echten Klick durchlaufen und prüfen, ob er im
FlexOffers-Reporting auftaucht. Das ist das Abnahmekriterium des Sprints.

## Liste

| Nr | Modell | Adresse | Stand |
| --- | --- | --- | --- |
| 1 | Dacia Spring Electric 65 | <https://www.carwow.de/dacia/spring> | offen |
| 2 | BYD Dolphin Surf Boost 43 kWh | <https://www.carwow.de/byd/dolphin-surf> | offen |
| 3 | Citroen e-C3 44 kWh | <https://www.carwow.de/citroen/e-c3> | offen |
| 4 | Fiat Grande Panda Elettrica 44 kWh | <https://www.carwow.de/fiat/grande-panda> | offen |
| 5 | Renault 5 E-Tech 52 kWh | <https://www.carwow.de/renault/5-e-tech> | offen |
| 6 | Opel Corsa Electric 51 kWh | <https://www.carwow.de/opel/corsa-electric> | offen |
| 7 | Peugeot e-208 51 kWh | <https://www.carwow.de/peugeot/e-208> | offen |
| 8 | MG MG4 Electric Comfort 64 kWh | <https://www.carwow.de/mg/mg4> | offen |
| 9 | Volkswagen ID.3 Pro 59 kWh | <https://www.carwow.de/volkswagen/id3> | offen |
| 10 | Renault Megane E-Tech 60 kWh | <https://www.carwow.de/renault/megane-e-tech> | offen |
| 11 | Cupra Born 59 kWh | <https://www.carwow.de/cupra/born> | offen |
| 12 | Volvo EX30 Single Motor Extended Range | <https://www.carwow.de/volvo/ex30> | offen |
| 13 | Hyundai Kona Elektro 65 kWh | <https://www.carwow.de/hyundai/kona-elektro> | offen |
| 14 | Kia EV3 Long Range 81 kWh | <https://www.carwow.de/kia/ev3> | offen |
| 15 | Tesla Model 3 RWD | <https://www.carwow.de/tesla/model-3> | offen |
| 16 | Opel Astra Sports Tourer Electric 54 kWh | <https://www.carwow.de/opel/astra-sports-tourer> | offen |
| 17 | Skoda Elroq 85 | <https://www.carwow.de/skoda/elroq> | offen |
| 18 | Tesla Model Y RWD | <https://www.carwow.de/tesla/model-y> | offen |
| 19 | Volkswagen ID.4 Pro 77 kWh | <https://www.carwow.de/volkswagen/id4> | offen |
| 20 | Peugeot e-5008 73 kWh, 7 Sitze | <https://www.carwow.de/peugeot/e-5008> | offen |
