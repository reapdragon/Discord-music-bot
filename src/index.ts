import './lib/env.js';
import { Bot } from './core/Bot.js';
import { registerEvents } from './core/EventRegistry.js';
import { loadCommandClasses } from './core/CommandRegistry.js';
import { Config } from './config.js';

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
  await registerEvents(client);

  const me = await client.login(Config.token);
  console.log(`[ready] login ok, user id=${me}`);
}

main().catch((err) => {
  console.error('[boot] fatal:', err);
});

