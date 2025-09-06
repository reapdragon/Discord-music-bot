# --- base runtime image ---
FROM node:20-bookworm-slim AS base
WORKDIR /app

# --- deps: install build toolchain & deps (dev deps included) ---
FROM base AS deps
# toolchain for native modules (opus/tweetnacl, etc.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ pkg-config git \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json tsconfig.json ./
RUN npm ci

# --- build: compile TS to dist ---
FROM deps AS build
# bring in sources
COPY src ./src
# build and ensure dist exists
RUN npm run build \
 && ls -la dist \
 && test -f dist/index.js

# strip dev deps from node_modules AFTER building
RUN npm prune --omit=dev

# --- prod: minimal runtime image ---
FROM node:20-bookworm-slim AS prod
ENV NODE_ENV=production \
    YTDL_NO_UPDATE=1 \
    PORT=8889
WORKDIR /app

# copy production node_modules and compiled JS
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 8889
CMD ["node", "dist/index.js"]
