// Robust .env loader that works no matter your current working directory.
// Place as: src/lib/env.ts  (and make sure files import '../lib/env.js' or './lib/env.js' accordingly)

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findEnv(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = findEnv(here) ?? path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// (Optional) quick sanity log — set to true to debug
if (process.env.DEBUG_ENV === '1') {
  console.log('[env] loaded from:', envPath);
  console.log('[env] DISCORD_CLIENT_ID?', !!process.env.DISCORD_CLIENT_ID);
  console.log('[env] DISCORD_TOKEN?', !!process.env.DISCORD_TOKEN);
}

// Don’t hard-fail here; the register script will throw a friendly error if missing.
