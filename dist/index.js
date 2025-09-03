import './lib/env.js';
import { Bot } from './core/Bot.js';
import { registerEvents } from './core/EventRegistry.js';
import { loadCommandClasses } from './core/CommandRegistry.js';
import { Config } from './config.js';
async function main() {
    const client = new Bot();
    const commands = await loadCommandClasses();
    for (const c of commands)
        client.commands.set(c.data.name, c); // 👈 populate
    await registerEvents(client);
    await client.login(Config.token);
}
main().catch(console.error);
