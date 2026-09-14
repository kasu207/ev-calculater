# Checkliste vor dem ersten öffentlichen Aufruf

Abzuarbeiten in dieser Reihenfolge. Der letzte Punkt ist das Abnahmekriterium
des Sprints.

## Inhalt und Recht

- [ ] Alle zwanzig Partnerlinks von Hand geöffnet und `partnerUrlGeprueft` auf
      `true` gesetzt, siehe `partnerlinks-pruefen.md`.
- [ ] `AMPMATCH_BETREIBER_NAME`, `_ANSCHRIFT` und `_EMAIL` gesetzt. Impressum und
      Datenschutz zeigen die Angaben, nicht den Hinweis auf fehlende Angaben.
- [ ] Datenschutzerklärung gegen den tatsächlichen Stand gelesen: Hosting,
      Umami, Weiterleitung zum Partner, selbst gehostete Schrift.
- [ ] Anwaltliche Prüfung der Weiterleitung ohne Einwilligungsdialog
      abgeschlossen. Fällt sie negativ aus, kommt der Dialog davor, siehe
      `entscheidungen.md`.

## Technik

- [ ] `node scripts/startpruefung.mjs` läuft ohne offene Punkte durch.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`
      grün.
- [ ] Lighthouse mobil über 90 in Performance und Barrierefreiheit.
- [ ] Vollständige Tastaturbedienung mit sichtbarem Fokus, einmal ohne Maus
      durchgespielt.
- [ ] Vorschaubild in LinkedIn und Slack gegengeprüft, einmal mit Ergebnis und
      einmal mit zu kleinem Budget.
- [ ] `https://ampmatch.de/api/health` antwortet, `robots.txt` und `sitemap.xml`
      liefern die richtige Basisadresse.
- [ ] Sicherung hat mindestens einmal geschrieben:
      `docker compose exec sicherung ls -la /sicherung`.

## Messung

- [ ] Umami-Website angelegt, Skriptadresse und ID in der `.env`.
- [ ] Funnel `calc_viewed → calc_completed → offer_cta_clicked →
      partner_redirect` angelegt.
- [ ] Eigene Geräte über `?intern=1` ausgeschlossen.
- [ ] Ein echter Klick vom Rechner bis in das FlexOffers-Reporting
      nachgewiesen. Erst damit ist bewiesen, dass Klick, Zuordnung, Anfrage und
      Anerkennung durchgängig funktionieren.
