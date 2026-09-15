# AmpMatch

Ein serverseitig gerenderter Rechner, der aus zwei Eingaben genau eine
Fahrzeugempfehlung mit Break-even-Jahr erzeugt, zur Partnerseite weiterleitet und
den vollständigen Funnel misst.

Umgesetzt ist Sprint 0 nach dem Entwicklungsdokument 1.0. Nicht enthalten und
bewusst nicht gebaut: Datenbank für Anwendungsdaten, Anmeldung, Adminoberfläche,
CMS, Feature-Flags, Abschluss im Interface, Preis-Scraping, Widget, API.

## Aufbau

```
apps/web/            Next.js, App Router, Tailwind mit eigener Token-Schicht
  app/               Seiten, Vorschaubild, Health-Route, Rechtstexte
  components/        Eingabe, Verdikt, Kostenverlauf, Annahmen, CTA
  lib/               Parameter, Partnerlinks, Messung, Formatierung
  styles/tokens.css  Farben, Radien, Linien
  assets/            Schriftinstanzen nur für das Vorschaubild
packages/core/       Rechenkern, Zod-Schemata, Fahrzeugdaten, Tests
infra/               Dockerfile, Compose, Caddy, Sicherung, Deploy
scripts/             Startprüfung vor dem ersten öffentlichen Aufruf
docs/                Pflegeanleitungen und Checklisten
legacy/              Der frühere Rechner ohne Framework, nicht mehr im Einsatz
```

Der Rechenkern in `packages/core` ist eine reine TypeScript-Bibliothek. Er kennt
weder React noch Next noch das Dateisystem, damit er später als API und als
Widget dieselbe Rechnung liefert.

## Entwickeln

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # Rechenkern und Fahrzeugdaten, Vitest
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e     # Funnelpfad, Playwright, braucht vorher pnpm build
```

Node 22 und pnpm 10. Für den Funneltest gegen einen vorinstallierten Browser:
`CHROMIUM_PFAD=/pfad/zu/chrome pnpm test:e2e`.

## Rechenmodell

Verglichen werden die kumulierten Kosten eines Elektromodells und eines
vergleichbaren Verbrenners über die Haltedauer:

```
kumuliert(jahr) = listenpreis + jahr × (energie + kfz_steuer − thg_quote)
```

Enthalten sind Anschaffung zum Listenpreis, Energiekosten, Kfz-Steuer und die
THG-Quote als Gutschrift. Nicht enthalten sind Wartung, Versicherung, Restwert,
Förderung und Finanzierung. Diese Auslassung steht im aufklappbaren
Annahmen-Bereich der Oberfläche, weil ein Vertrauensprodukt keine Lücke
verschweigen darf, die das Ergebnis verschiebt.

**Auswahlregel:** Unter allen Fahrzeugen im Budget gewinnt das mit der höchsten
Gesamtdifferenz. Bei Gleichstand das mit dem früheren Break-even, danach die
alphabetisch erste Kennung, damit dieselbe Eingabe immer dasselbe Ergebnis
liefert.

**Break-even:** das kleinste Jahr, in dem die kumulierten Elektrokosten die des
Verbrenners nicht mehr überschreiten. Gibt es innerhalb der Haltedauer keines,
ist `breakEvenJahr` null, und die Oberfläche sagt das in einem Satz.

Die Standardannahmen stehen in `packages/core/src/annahmen.ts`. Jede Änderung
dort verschiebt jedes Ergebnis, deshalb gehört eine Quelle in den Pull Request.

## Messung

Feste Ereignisnamen, keine spontanen Varianten:

| Ereignis | Wann |
| --- | --- |
| `calc_viewed` | Rechner sichtbar |
| `calc_input_changed` | `{ feld: "km" \| "budget" }` |
| `calc_completed` | gültiges Ergebnis, erst wenn die Eingabe zur Ruhe gekommen ist |
| `offer_cta_viewed` | CTA zu 50 % sichtbar für mindestens eine Sekunde |
| `offer_cta_clicked` | Primärmetrik |
| `partner_redirect` | Weiterleitung ausgelöst |

Gate-Metrik ist `offer_cta_clicked / calc_completed`. `lead_confirmed` kommt aus
dem FlexOffers-Reporting und wird montags von Hand nachgetragen.

Details und die Einrichtung des Funnels in Umami: `docs/messung.md`.

## Betrieb

Docker Compose auf einem Hetzner CX22, Anwendung intern auf Port 9000, davor
Caddy mit automatischem TLS. Dateien in `infra/`, Einrichtung in
`docs/betrieb.md`.

```bash
# auf dem Server, in /opt/ampmatch
docker compose pull && docker compose up -d --remove-orphans
```

GitHub Actions baut das Image, schiebt es nach ghcr.io und ruft `deploy.sh` per
SSH auf.

## Vor dem ersten öffentlichen Aufruf

```bash
node scripts/startpruefung.mjs
```

Die Prüfung fällt durch, solange ein Partnerlink nicht von Hand geöffnet wurde
oder eine Pflichtangabe für Impressum und Datenschutz fehlt. Beides ist in
`docs/partnerlinks-pruefen.md` und `docs/start-checkliste.md` beschrieben.

## Bekannte Abweichung

Das initiale JavaScript liegt bei 150 KB gzip statt der geforderten 120 KB.
11 KB davon sind eigener Code, der Rest ist die Grundlast des Frameworks.
Begründung und Messung in `docs/entscheidungen.md`.

## Offene Entscheidungen

Der Stand der vier offenen Punkte aus Abschnitt 15 des Entwicklungsdokuments
steht in `docs/entscheidungen.md`. Kurz: Haltedauer drei Jahre, Realaufschlag
15 Prozent auf beiden Seiten, Heimladeanteil 80 Prozent als feste Annahme, der
Einwilligungsdialog hängt weiter an der rechtlichen Prüfung.
