#!/bin/sh
# Naechtlicher Dump der Umami-Datenbank in ein Volume. Vierzehn Staende bleiben
# liegen, aeltere werden geloescht. Woechentlich zieht man den Ordner lokal ab:
#   docker compose cp sicherung:/sicherung ./sicherung-$(date +%F)
set -eu

while true; do
  datei="/sicherung/umami-$(date +%Y-%m-%d).sql.gz"
  if pg_dump -h umami-db -U umami umami | gzip > "$datei.teil"; then
    mv "$datei.teil" "$datei"
    echo "$(date -Iseconds) Sicherung geschrieben: $datei"
  else
    rm -f "$datei.teil"
    echo "$(date -Iseconds) Sicherung fehlgeschlagen" >&2
  fi

  ls -1t /sicherung/umami-*.sql.gz 2>/dev/null | tail -n +15 | while read -r alt; do
    rm -f "$alt"
  done

  sleep 86400
done
