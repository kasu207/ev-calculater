# Server aufsetzen und betreiben

Hetzner CX22, Standort Falkenstein oder Nürnberg, rund 4,50 € im Monat.
Die Anwendung läuft intern auf Port 9000 und wird nicht nach außen
veröffentlicht. Davor steht Caddy und holt das TLS-Zertifikat selbst.

## Nur anschauen, ohne Einrichtung

Auf einem Server mit Docker reicht das hier. Es baut das Image aus dem
ausgecheckten Stand, braucht keine Registry, kein TLS und keine Domain und
läuft neben allem, was dort schon läuft:

```bash
git clone -b claude/ampmatch-sprint-0-3rk61z https://github.com/kasu207/ev-calculater.git
cd ev-calculater
docker compose -f infra/compose.vorschau.yaml up -d --build
curl -s http://localhost:9001/api/health
```

### Speicherbedarf

Der Build braucht in der Spitze rund 1,4 GB nur für die Kompilierung, dazu
kommen Docker und alles, was auf dem Server sonst läuft. Unter etwa 2 GB
freiem Speicher bricht er mit `SIGKILL` ab: Das ist der OOM-Killer, kein
Fehler im Code.

Auf einem Server ohne Auslagerungsdatei hilft eine:

```bash
free -h
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
free -h
```

Dauerhaft eintragen: `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`.
Wieder loswerden: `sudo swapoff /swapfile && sudo rm /swapfile`.

Der Build dauert mit Auslagerung spürbar länger, läuft aber durch. Wer den
Server ganz aus dem Spiel lassen will, lässt das Image in der CI bauen und
zieht es nur noch: siehe Auslieferung weiter unten.

Danach liegt der Rechner auf Port 9001. Ohne geöffneten Port in der Firewall
kommt man per SSH-Tunnel heran: `ssh -L 9001:localhost:9001 nutzer@server`,
dann im eigenen Browser `http://localhost:9001`.

In dieser Vorschau gibt es keine Statistik und kein Partner-Tracking, und
Impressum wie Datenschutz weisen offen aus, dass die Betreiberangaben fehlen.
Das ist gewollt: So kann die Vorschau nicht versehentlich als fertige Seite
durchgehen.

Wieder weg:

```bash
docker compose -f infra/compose.vorschau.yaml down --rmi local
```

## Einmalig

1. **Server anlegen.** Ubuntu 24.04, SSH-Schlüssel hinterlegen, kein Passwort.
2. **Firewall in der Hetzner Cloud Console.** Eingehend nur 22, 80 und 443.
   Port 9000 bleibt im internen Compose-Netz und wird nie veröffentlicht.
3. **SSH härten.** In `/etc/ssh/sshd_config`: `PasswordAuthentication no`,
   `PermitRootLogin prohibit-password`. Danach `systemctl restart ssh`.
4. **Automatische Sicherheitsupdates.**
   `apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades`
5. **Docker installieren.** `curl -fsSL https://get.docker.com | sh`
6. **DNS setzen.** A-Records für `ampmatch.de`, `www.ampmatch.de` und
   `stats.ampmatch.de` auf die Server-IP. Erst danach startet Caddy sauber,
   sonst schlägt die Zertifikatsausstellung fehl.
7. **Dateien ablegen.**

   ```bash
   mkdir -p /opt/ampmatch && cd /opt/ampmatch
   # aus dem Repository: infra/compose.yaml, infra/Caddyfile,
   # infra/sicherung.sh, infra/deploy.sh, infra/.env.beispiel
   cp .env.beispiel .env && chmod 600 .env
   ```

8. **`.env` ausfüllen.** Ohne `AMPMATCH_BETREIBER_*` zeigen Impressum und
   Datenschutz offen an, dass die Angaben fehlen. In diesem Zustand darf die
   Seite nicht öffentlich erreichbar sein.
9. **Starten.** `docker compose up -d`
10. **Prüfen.** `curl -s https://ampmatch.de/api/health` muss `{"status":"ok"}`
    liefern.

## Auslieferung

GitHub Actions baut bei jedem Push auf `main` das Image, schiebt es nach
ghcr.io und ruft über SSH `deploy.sh` auf. Nötige Secrets im Repository:
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.

`deploy.sh` wartet nach dem Tausch auf den Healthcheck und bricht mit den
letzten Logzeilen ab, wenn die Anwendung nicht antwortet.

Von Hand geht es genauso:

```bash
cd /opt/ampmatch && docker compose pull && docker compose up -d --remove-orphans
```

## Sicherung

Der Dienst `sicherung` schreibt jede Nacht einen `pg_dump` der
Umami-Datenbank in ein Volume und hält vierzehn Stände. Einmal pro Woche lokal
abziehen:

```bash
docker compose cp sicherung:/sicherung ./ampmatch-sicherung-$(date +%F)
```

Die Messdaten sind das einzige Ergebnis dieses Sprints. Ein Serververlust in
Woche drei ohne Sicherung wäre der Totalverlust der Arbeit.

Zurückspielen:

```bash
gunzip -c umami-2026-09-20.sql.gz | docker compose exec -T umami-db psql -U umami umami
```

## Was wo läuft

| Dienst | Aufgabe | Port |
| --- | --- | --- |
| `web` | Next.js, Standalone-Bundle, unprivilegierter Nutzer | 9000, nur intern |
| `caddy` | TLS, Host-Routing, Kompression | 80 und 443 |
| `umami` | Statistik | 3000, nur intern |
| `umami-db` | Postgres für Umami | intern |
| `sicherung` | nächtlicher Dump | – |
