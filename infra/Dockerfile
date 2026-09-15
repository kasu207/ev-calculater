# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY . .
RUN pnpm --filter @ampmatch/web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=9000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S next
# Das Standalone-Bundle bringt den Server und nur die wirklich benutzten Pakete mit.
COPY --from=build --chown=next:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=next:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=next:nodejs /app/apps/web/public ./apps/web/public
USER next
WORKDIR /app/apps/web
EXPOSE 9000
CMD ["node", "server.js"]
