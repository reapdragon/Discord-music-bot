# syntax=docker/dockerfile:1

# ---------- Base ----------
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- Deps (build toolchain + full deps) ----------
FROM base AS deps
# Toolchain for native modules + ffmpeg for probing/stream muxing
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 make g++ pkg-config git ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

# ---------- Build (compile TS -> dist and remove dev deps) ----------
FROM deps AS build
COPY src ./src
# Fail early if build doesn't output dist/index.js (prevents COPY errors later)
RUN npm run build \
 && test -f dist/index.js \
 && npm prune --omit=dev

# ---------- Runtime (small, only what we need) ----------
FROM base AS final
# ffmpeg at runtime helps with demux/probe without transcoding
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PORT=8889
EXPOSE 8889

# Copy runtime bits
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist        ./dist
COPY package*.json                  ./

# Optional healthcheck (expects your index to start the tiny HTTP server)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||8889)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
