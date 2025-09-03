// src/index.ts
import './lib/env.js';
import { Bot } from './core/Bot.js';
import { registerEvents } from './core/EventRegistry.js';
import { loadCommandClasses } from './core/CommandRegistry.js';
import { Config } from './config.js';

async function tryAutoRegisterOnBoot() {
  if (process.env.REGISTER_ON_BOOT !== 'true') return;

  console.log('[registry] REGISTER_ON_BOOT=true → registering slash commands…');
  try {
    // Try to call an exported function if available
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
      // Fallback if your registry exposes a main(argv) style API
      await mod.main('register');
      console.log('[registry] Registration completed via main(). You can now unset REGISTER_ON_BOOT.');
    } else {
      console.warn('[registry] No callable export found in core/CommandRegistry.js');
    }
  } catch (err) {
    console.error('[registry] Registration failed:', err);
  }
}

async function maybePrintVoiceDependencyReport() {
  if (process.env.VOICE_DIAGNOSTICS === '1') {
    try {
      const { generateDependencyReport } = await import('@discordjs/voice');
      console.log(generateDependencyReport());
    } catch (e) {
      console.warn('[voice] Could not generate dependency report:', e);
    }
  }
}

async function main() {
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

  // Optional diagnostics
  await maybePrintVoiceDependencyReport();

  // Register event listeners
  await registerEvents(client);

  // (Optional) auto-register slash commands on boot if env flag is set
  await tryAutoRegisterOnBoot();

  // Log in — DO NOT log the return value (it is the token)
  await client.login(Config.token);
  // Your EventRegistry should log the user/tag on clientReady.
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
