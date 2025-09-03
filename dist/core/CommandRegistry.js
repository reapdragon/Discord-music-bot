// src/core/CommandRegistry.ts
import '../lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { Config } from '../config.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsDir = path.resolve(__dirname, '..', 'commands');
function walk(dir) {
    return fs.readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        return fs.statSync(p).isDirectory() ? walk(p) : [p];
    });
}
export async function loadCommandClasses() {
    if (!fs.existsSync(commandsDir)) {
        throw new Error(`Commands directory not found: ${commandsDir}`);
    }
    const files = walk(commandsDir).filter((f) => {
        const base = path.basename(f);
        if (base.endsWith('.d.ts'))
            return false;
        const ext = path.extname(f).toLowerCase();
        return ext === '.ts' || ext === '.js' || ext === '.mjs' || ext === '.cjs';
    });
    const out = [];
    for (const file of files) {
        const url = pathToFileURL(file).href;
        const mod = await import(url);
        if (!mod?.default)
            continue;
        const Cmd = mod.default;
        const inst = new Cmd();
        const name = String(inst?.data?.name ?? '').trim();
        if (!name) {
            console.warn(`[registry] Skipping file with no .data.name: ${file}`);
            continue;
        }
        out.push({ name, file, instance: inst });
    }
    return out;
}
function printDuplicates(dupes) {
    console.error('✖ Duplicate command names detected:');
    for (const [name, files] of dupes.entries()) {
        console.error(`  /${name}`);
        for (const f of files)
            console.error(`     - ${f}`);
    }
    console.error('→ Rename or remove duplicates so each slash command name is unique.');
}
export async function registerCommands() {
    const loaded = await loadCommandClasses();
    // Detect duplicates by name
    const byName = new Map();
    for (const { name, file } of loaded) {
        const arr = byName.get(name) ?? [];
        arr.push(file);
        byName.set(name, arr);
    }
    const dupes = new Map([...byName.entries()].filter(([, files]) => files.length > 1));
    if (dupes.size) {
        printDuplicates(dupes);
        throw new Error('Duplicate slash command names — fix and rerun.');
    }
    // Prepare body
    const body = loaded.map(({ instance }) => instance.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(Config.token);
    const guildId = process.env.DEV_GUILD_ID;
    const route = guildId
        ? Routes.applicationGuildCommands(Config.clientId, guildId)
        : Routes.applicationCommands(Config.clientId);
    console.log(`[registry] Registering ${body.length} command(s) ${guildId ? `to guild ${guildId}` : 'globally'}…`);
    await rest.put(route, { body });
    console.log('[registry] Done.');
}
// Extra helper to CLEAR commands if you want a clean slate
export async function clearCommands(scope = 'guild') {
    const rest = new REST({ version: '10' }).setToken(Config.token);
    if (scope === 'guild') {
        const gid = process.env.DEV_GUILD_ID;
        if (!gid)
            throw new Error('DEV_GUILD_ID not set.');
        await rest.put(Routes.applicationGuildCommands(Config.clientId, gid), { body: [] });
        console.log(`[registry] Cleared guild commands for ${gid}.`);
    }
    else {
        await rest.put(Routes.applicationCommands(Config.clientId), { body: [] });
        console.log(`[registry] Cleared GLOBAL commands.`);
    }
}
// CLI usage:
//   npm run register:commands
//   tsx src/core/CommandRegistry.ts clear guild
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const sub = process.argv[2] ?? 'register';
    (async () => {
        if (sub === 'register')
            await registerCommands();
        else if (sub === 'clear')
            await clearCommands(process.argv[3] ?? 'guild');
        else
            console.log('Usage: register | clear [guild|global]');
    })().catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
}
