# Build context for this Dockerfile is the REPO ROOT (not bot/), so it can also
# reach webapp/ to build the Mini App and serve it from the same process/URL.

FROM node:20-bookworm-slim AS bot-build
WORKDIR /app/bot

# better-sqlite3 needs to compile a native addon — build tools for that.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY bot/package.json bot/package-lock.json ./
RUN npm ci

COPY bot/. .
RUN npm run build

FROM node:20-bookworm-slim AS webapp-build
WORKDIR /app/webapp

COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci

COPY webapp/. .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app/bot
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=bot-build /app/bot/dist ./dist
COPY --from=bot-build /app/bot/src/db/schema.sql ./dist/db/schema.sql
COPY bot/public ./public
COPY --from=webapp-build /app/webapp/dist /app/webapp/dist

# The SQLite file and uploaded product images live here — mount a persistent
# volume at this path in Northflank, or they're lost on every redeploy.
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8787
CMD ["node", "dist/server.js"]
