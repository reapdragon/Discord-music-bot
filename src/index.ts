// src/index.ts
import './lib/env.js';
import { Bot } from './core/Bot.js';
import { registerEvents } from './core/EventRegistry.js';
import { loadCommandClasses } from './core/CommandRegistry.js';
import { Config } from './config.js';
import * as http from 'node:http';

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

async function main() {
  // Start the tiny HTTP server so Render Web Service stays healthy
  startHttpServer();

  const client = new Bot();

  // Load commands (supports either shape: instances[] OR { file, instance, name }[])
  const loaded: any[] = await loadCommandClasses();

  let count = 0;
  for (const entry of loaded) {
    const file = entry?.file ?? '<unknown>';
    const cmd = entry?.instance ?? entry; // handle both shapes
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

  // Optional one-shot slash-command registration
  await tryAutoRegisterOnBoot();

  // Login (do not log the returned token)
  await client.login(Config.token);
}

// Global safety nets
process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught Exception:', err);
});

main().catch((err) => {
  console.error('[boot] fatal:', err);
});
