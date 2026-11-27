# Builds the web app as a Next.js standalone server. Run from the repo root:
#   docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/map/package.json packages/map/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @tycho/web build

FROM node:24-alpine AS run
ENV NODE_ENV=production PORT=4310 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S tycho && adduser -S tycho -G tycho
COPY --from=build --chown=tycho:tycho /repo/apps/web/.next/standalone ./
COPY --from=build --chown=tycho:tycho /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=tycho:tycho /repo/apps/web/drizzle ./apps/web/drizzle
USER tycho
EXPOSE 4310
WORKDIR /app/apps/web
# Migrations run on start (src/instrumentation.ts).
CMD ["node", "server.js"]
