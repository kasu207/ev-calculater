#!/usr/bin/env bash
# Wird auf dem Server ausgefuehrt. Holt das neue Image und tauscht die Container.
set -euo pipefail

verzeichnis="${AMPMATCH_VERZEICHNIS:-/opt/ampmatch}"
cd "$verzeichnis"

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f

# Warten, bis der Healthcheck greift, sonst merkt niemand einen kaputten Start.
for versuch in $(seq 1 30); do
  if docker compose exec -T web wget -qO- http://127.0.0.1:9000/api/health > /dev/null 2>&1; then
    echo "Anwendung antwortet nach $versuch Versuchen."
    exit 0
  fi
  sleep 2
done

echo "Anwendung antwortet nach dem Deploy nicht." >&2
docker compose logs --tail 50 web >&2
exit 1
