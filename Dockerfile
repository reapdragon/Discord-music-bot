# --- deps
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json tsconfig.json ./
RUN npm ci

# --- build
FROM deps AS build
WORKDIR /app
COPY src ./src
RUN npm run build && npm prune --omit=dev
# sanity
RUN ls -la dist && test -f dist/index.js

# --- prod
FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY docker/entrypoint.sh /entrypoint.sh
EXPOSE 8889
ENTRYPOINT ["/entrypoint.sh"]
