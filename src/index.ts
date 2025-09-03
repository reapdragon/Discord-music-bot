// src/index.ts
import './lib/env.js';
import { Bot } from './core/Bot.js';
import { registerEvents } from './core/EventRegistry.js';
import { loadCommandClasses } from './core/CommandRegistry.js';
import { Config } from './config.js';
import * as http from 'node:http';

// --- keep Web Service alive on Render ---
function startHttpServer() {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  server.listen(port, () => {
    console.log(`[web] listening on :${port}`);
  });
}

// --- optional: one-shot command registration on boot ---
async function tryAutoRegisterOnBoot() {
  if (process.env.REGISTER_ON_BOOT !== 'true') return;

  console.log('[registry] REGISTER_ON_BOOT=true → registering slash commands…');
  try {
    const mod: any = await import('./core/CommandRegistry.js');
    const fn =
      typeof mod.registerCommands === 'function'
        ? mod.registerCommands
        : typeof mod.default === 'function'
        ? mod.default
        : null;

    if (fn) {
      await fn();
      console.log('[registry] Registration completed. You can now unset REGISTER_ON_BOOT.');
    } else if (typeof mod.main === 'function') {
      await mod.main('register');
      console.log('[registry] Registration completed via main(). You can now unset REGISTER_ON_BOOT.');
    } else {
      console.warn('[registry] No callable export found in core/CommandRegistry.js');
    }
  } catch (err) {
    console.error('[registry] Registration failed:', err);
  }
}

async function main() {
  // start HTTP first so Render detects a port
  startHttpServer();

  const client = new Bot();

  // load slash commands
  const loaded: any[] = await loadCommandClasses();
  let count = 0;
  for (const entry of loaded) {
    const file = entry?.file ?? '<unknown>';
    const cmd = entry?.instance ?? entry;
    const name = cmd?.data?.name;
    if (!name) {
      console.warn(`[boot] Skipping command with no .data.name (${file})`);
      continue;
    }
    try {
      client.commands.set(name, cmd);
      count++;
    } catch (err) {
      console.warn(`[boot] Failed to load command "${name}" from ${file}:`, err);
    }
  }
  console.log(`[boot] Loaded ${count} command(s).`);

  await registerEvents(client);
  await tryAutoRegisterOnBoot();

  // login (don’t log the returned token string)
  await client.login(Config.token);
}

process.on('unhandledRejection', (r) => console.error('[process] Unhandled Rejection:', r));
process.on('uncaughtException', (e) => console.error('[process] Uncaught Exception:', e));

main().catch((err) => console.error('[boot] fatal:', err));
