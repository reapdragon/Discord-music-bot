# syntax=docker/dockerfile:1

# ---- Base image with Node ----
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ---- Deps (build tools + npm ci) ----
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config git \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json tsconfig.json ./
RUN npm ci

# ---- Build TS -> JS and prune dev deps ----
FROM deps AS build
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# ---- Runtime (small) ----
FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production \
    YTDL_NO_UPDATE=1 \
    PORT=8889
# Bring only what we need at runtime
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist
EXPOSE 8889
CMD ["node", "dist/index.js"]
