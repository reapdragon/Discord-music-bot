# ---------- base image ----------
FROM node:20-bookworm-slim AS base
WORKDIR /app
# Keep images small and HTTPS happy
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---------- deps+build stage ----------
FROM base AS build
# Tools some native modules may need during npm ci
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ pkg-config git \
 && rm -rf /var/lib/apt/lists/*

# Copy lockfiles and tsconfig first to leverage Docker layer cache
COPY package*.json tsconfig.json ./

# IMPORTANT: include dev deps so tsc exists
RUN npm ci --include=dev

# Now bring in sources and build
COPY src ./src
RUN npm run build

# Strip dev deps; leave only production deps for the final image
RUN npm prune --omit=dev

# ---------- runtime image ----------
FROM base AS runtime
# Only runtime dependency we actually need
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Copy compiled app + production node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8889
CMD ["node", "dist/index.js"]
