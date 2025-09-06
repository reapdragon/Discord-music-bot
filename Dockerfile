# ---------- Base ----------
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ---------- Dependencies (dev) ----------
# Install build chain so @discordjs/opus can compile if no prebuild is available
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 make g++ pkg-config git \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json tsconfig.json ./
RUN npm ci

# ---------- Build (TypeScript -> dist) ----------
FROM deps AS build
COPY src ./src
RUN npm run build
# prune dev deps so the runtime layer is small and prod-only
RUN npm prune --omit=dev

# ---------- Production runtime ----------
FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production \
    YTDL_NO_UPDATE=1 \
    PORT=8889
# Reuse already-built/pruned node_modules (contains compiled opus)
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist
EXPOSE 8889
CMD ["node", "dist/index.js"]
