# syntax=docker/dockerfile:1

# Die Anwendung hat keine Laufzeitabhängigkeiten - es gibt deshalb weder
# einen npm-install- noch einen Build-Schritt. Ein einstufiges Image genügt.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# Nur das, was der Server zur Laufzeit wirklich braucht.
# Besitzer ist der im Basisimage vorhandene unprivilegierte Nutzer "node".
COPY --chown=node:node package.json ./
COPY --chown=node:node shared/ ./shared/
COPY --chown=node:node server/ ./server/
COPY --chown=node:node public/ ./public/
# Postleitzahlen-Koordinaten für die regionale Preisabfrage (GeoNames, CC BY 4.0).
COPY --chown=node:node data/ ./data/

USER node

EXPOSE 3000

# Kein curl im Alpine-Image - Node bringt fetch seit Version 18 selbst mit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
