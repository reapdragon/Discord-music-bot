// src/core/CommandRegistry.ts
import { REST, Routes } from 'discord.js';
import { Config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
function isCodeFile(file) {
    // accept .ts and .js, but ignore .d.ts
    return (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts');
}
function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...walk(full));
        else if (entry.isFile() && isCodeFile(full))
            out.push(full);
    }
    return out;
}
/**
 * Loads command classes from the compiled commands directory.
 * Works in dev (tsx) and prod (dist) because we resolve relative to this file.
 */
export async function loadCommandClasses() {
    const here = fileURLToPath(new URL('.', import.meta.url)); // e.g. .../src/core/ or .../dist/core/
    const commandsDir = path.resolve(here, '..', 'commands'); // .../src/commands or .../dist/commands
    if (!fs.existsSync(commandsDir)) {
        console.warn(`[CommandRegistry] No commands dir at ${commandsDir}`);
        return [];
    }
    const files = walk(commandsDir);
    const instances = [];
    for (const file of files) {
        const mod = await import(pathToFileURL(file).href);
        const Ctor = mod.default;
        if (!Ctor)
            continue;
        const instance = new Ctor();
        // Basic sanity: must have a slash command builder with toJSON
        const data = instance.data;
        if (!data || typeof data.toJSON !== 'function')
            continue;
        instances.push(instance);
    }
    return instances;
}
/**
 * Registers slash commands globally or to a single guild if DEV_GUILD_ID is set.
 * Run via: `npm run register:commands`
 */
export async function registerCommands() {
    const commands = await loadCommandClasses();
    const rest = new REST({ version: '10' }).setToken(Config.token);
    const payload = commands.map((c) => c.data.toJSON());
    const guildId = process.env.DEV_GUILD_ID?.trim();
    const route = guildId
        ? Routes.applicationGuildCommands(Config.clientId, guildId)
        : Routes.applicationCommands(Config.clientId);
    await rest.put(route, { body: payload });
    console.log(`[CommandRegistry] Registered ${payload.length} command(s) ${guildId ? `to guild ${guildId}` : 'globally'}.`);
    return { count: payload.length, scope: guildId ? 'guild' : 'global', guildId: guildId || null };
}
// CLI usage: `tsx src/core/CommandRegistry.ts register` or `node dist/core/CommandRegistry.js register`
if (process.argv[1] && path.basename(process.argv[1]).toLowerCase().includes('commandregistry')) {
    const action = process.argv[2] ?? 'register';
    if (action === 'register') {
        registerCommands().catch((err) => {
            console.error(err);
            process.exit(1);
        });
    }
}
