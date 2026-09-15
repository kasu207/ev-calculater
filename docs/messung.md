# Messung einrichten

Umami läuft auf demselben Server unter `stats.ampmatch.de`, cookielos und ohne
Weitergabe an Dritte. Deshalb braucht die Seite kein Einwilligungsbanner.

## Einrichtung

1. `https://stats.ampmatch.de` öffnen, mit dem Erstkonto anmelden, Passwort
   sofort ändern.
2. Website `ampmatch.de` anlegen. Umami zeigt die Website-ID und die Adresse des
   Skripts.
3. Beides in `/opt/ampmatch/.env` eintragen:
   `AMPMATCH_UMAMI_SKRIPT_URL` und `AMPMATCH_UMAMI_WEBSITE_ID`.
4. `docker compose up -d web`. Ohne diese beiden Werte bindet die Anwendung gar
   kein Skript ein; es gibt keinen halben Zustand.

## Ereignisse

| Ereignis | Wann | Daten |
| --- | --- | --- |
| `calc_viewed` | Rechner ist sichtbar, einmal je Aufruf | – |
| `calc_input_changed` | jede Änderung an einem Feld | `feld` |
| `calc_completed` | gültiges Ergebnis, 600 ms nach der letzten Eingabe | `modellId`, `kmBucket`, `budgetBucket` |
| `offer_cta_viewed` | CTA zu 50 % sichtbar für mindestens eine Sekunde | `modellId` |
| `offer_cta_clicked` | Klick auf den Partnerlink | `modellId`, `kmBucket`, `budgetBucket` |
| `partner_redirect` | direkt danach, die Weiterleitung läuft | dieselben |

`calc_completed` feuert bewusst erst, wenn die Eingabe zur Ruhe gekommen ist,
und nicht erneut, wenn sich am Ergebnis nichts geändert hat. Sonst wäre der
Nenner der Gate-Metrik wertlos.

Fahrleistung und Budget gehen nur in Klassen ein (`15k-20k`, `45k-55k`), nie als
genauer Wert. Damit bleibt die Messung anonym.

## Funnel in Umami

Unter Berichte, Funnel anlegen mit genau dieser Reihenfolge:

```
calc_viewed → calc_completed → offer_cta_clicked → partner_redirect
```

Gate-Metrik ist `offer_cta_clicked / calc_completed`. `offer_cta_viewed` steht
daneben und beantwortet, ob ein niedriger Wert am Angebot liegt oder daran, dass
der Knopf nie gesehen wurde.

`lead_confirmed` wird nicht getrackt. Die Zahl kommt montags aus dem
FlexOffers-Reporting und wird von Hand nachgetragen.

## Eigene Zugriffe ausschließen

Einmal je Gerät und Browser `https://ampmatch.de/?intern=1` aufrufen. Das setzt
zwei Kennungen im lokalen Speicher: eine für unsere Ereignisse, eine für Umami
selbst. Danach zählt weder ein Seitenaufruf noch ein Ereignis von diesem Gerät.

Rückgängig: im Entwicklerwerkzeug `ampmatch.intern` und `umami.disabled` aus dem
lokalen Speicher löschen.

Vor jeder Auswertung prüfen, ob die eigenen Geräte wirklich ausgeschlossen sind.
Bei 150 erwarteten Sitzungen verschieben zwanzig eigene Aufrufe das Ergebnis
spürbar.
