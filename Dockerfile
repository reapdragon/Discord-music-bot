# -------- base image --------
FROM node:20-bookworm-slim AS base
WORKDIR /app

# -------- deps (build) --------
FROM base AS deps
# native builds for @discordjs/opus fallback etc.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 make g++ pkg-config git \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

# -------- build --------
FROM deps AS build
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# -------- runtime --------
FROM node:20-bookworm-slim AS prod
WORKDIR /app

# Keep the bot from ytdl update checks; expose health port
ENV NODE_ENV=production \
    YTDL_NO_UPDATE=1 \
    PORT=8889

# app files
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist

# data volume for cookies (and any future cache)
VOLUME ["/data"]

# (Optional) If you run a tiny health server on PORT
EXPOSE 8889

CMD ["node", "dist/index.js"]
