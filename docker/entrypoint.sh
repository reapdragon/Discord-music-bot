#!/usr/bin/env bash
set -euo pipefail

echo "[entry] node=$(node -v) npm=$(npm -v)"
echo "[entry] cwd=$(pwd)"
echo "[entry] dist present? $(test -d dist && echo yes || echo NO)"
ls -la dist || true

# Print only whether secrets are set (not the values)
pretty() { v="$1"; if [ -n "${!v:-}" ]; then echo "<set>"; else echo "<unset>"; fi; }
echo "[entry] ENV: DISCORD_TOKEN=$(pretty DISCORD_TOKEN) DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-<unset>} SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID:-<unset>} SPOTIFY_CLIENT_SECRET=$(pretty SPOTIFY_CLIENT_SECRET)"

# Extra diagnostics: show effective headers the player will see
export NODE_OPTIONS="--trace-warnings"
node dist/index.js
