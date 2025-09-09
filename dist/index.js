// src/index.ts
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Client, GatewayIntentBits, REST, Routes, Collection, } from 'discord.js';
// ---------- Crash guards ----------
process.on('unhandledRejection', (e) => {
    console.error('[boot] unhandledRejection:', e);
});
process.on('uncaughtException', (e) => {
    console.error('[boot] uncaughtException:', e);
    process.exit(1);
});
// ---------- Env check & logging ----------
function flag(v) { return v && v.trim() ? '<set>' : '<unset>'; }
console.log('[boot] env:', 'DISCORD_TOKEN=' + flag(process.env.DISCORD_TOKEN), 'DISCORD_CLIENT_ID=' + (process.env.DISCORD_CLIENT_ID ?? '<unset>'), 'SPOTIFY_CLIENT_ID=' + (process.env.SPOTIFY_CLIENT_ID ?? '<unset>'), 'SPOTIFY_CLIENT_SECRET=' + flag(process.env.SPOTIFY_CLIENT_SECRET));
if (!process.env.DISCORD_TOKEN) {
    console.error('[boot] DISCORD_TOKEN missing — refusing to start.');
    process.exit(1);
}
// ---------- Client ----------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});
const commands = new Collection();
async function findCommandsRoot() {
    // When compiled, this file lives in dist/. In dev (tsx), it’s src/.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(here, 'commands'); // dist/commands
    const srcPath = path.resolve(here, '../src/commands'); // src/commands (when running tsx)
    // Prefer dist if it exists, else src
    try {
        await fs.access(distPath);
        return { root: distPath, ext: 'js' };
    }
    catch { }
    try {
        await fs.access(srcPath);
        return { root: srcPath, ext: 'ts' };
    }
    catch { }
    // Fallback to dist
    return { root: distPath, ext: 'js' };
}
async function loadCommands() {
    const { root, ext } = await findCommandsRoot();
    async function walk(dir) {
        const out = [];
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const it of items) {
            const full = path.join(dir, it.name);
            if (it.isDirectory())
                out.push(...await walk(full));
            else if (it.isFile() && (it.name.endsWith(`.${ext}`)))
                out.push(full);
        }
        return out;
    }
    const files = await walk(root);
    for (const file of files) {
        try {
            const mod = await import(pathToImportUrl(file));
            const CmdClass = mod.default ?? mod.Cmd ?? null;
            if (!CmdClass)
                continue;
            const instance = new CmdClass();
            if (!instance?.data?.name || typeof instance.execute !== 'function')
                continue;
            commands.set(instance.data.name, instance);
        }
        catch (e) {
            console.error('[boot] failed to load command', file, e);
        }
    }
    console.log(`[boot] Loaded ${commands.size} command(s).`);
}
function pathToImportUrl(p) {
    // Ensure Windows paths import properly in ESM
    const full = path.resolve(p);
    const url = pathToFileURLSafe(full);
    return url;
}
function pathToFileURLSafe(p) {
    let u = new URL('file://');
    // Node’s URL wants forward slashes
    const normalized = p.replace(/\\/g, '/');
    u = new URL(u.pathname + normalized, u);
    // But using new URL like that can double the path; safer:
    return new URL('file://' + normalized).href;
}
// ---------- Interaction safety wrapper ----------
async function runSafely(interaction, fn) {
    let replied = interaction.deferred || interaction.replied;
    const timer = setTimeout(async () => {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply(); // fast ACK (prevents 10062)
                replied = true;
            }
        }
        catch (e) {
            // Ignore race errors here
        }
    }, 1500);
    try {
        await fn();
    }
    catch (err) {
        const code = err?.code ?? err?.rawError?.code;
        const msg = err?.message ?? String(err);
        console.error('[interaction:error]', `/${interaction.commandName}`, err);
        // If we never got to reply, try to let the user know once
        if (!replied && !interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ content: 'Something went wrong running that command.', ephemeral: true });
            }
            catch { }
        }
        // Don’t crash on “Unknown interaction”
        if (code === 10062)
            return;
        // Otherwise ok to swallow; already logged
    }
    finally {
        clearTimeout(timer);
    }
}
// ---------- Events ----------
client.once('ready', async () => {
    console.log(`[clientReady] Logged in as ${client.user?.tag} (id=${client.user?.id})`);
    // Register all commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const body = [...commands.values()].map(c => c.data.toJSON());
    try {
        if (!client.user?.id)
            throw new Error('client.user.id missing on ready');
        await rest.put(Routes.applicationCommands(client.user.id), { body });
        console.log(`[boot] Registered ${body.length} application command(s).`);
    }
    catch (e) {
        console.error('[boot] command registration failed:', e);
    }
    // Tiny HTTP (health)
    const port = Number(process.env.PORT ?? '8889');
    http.createServer((_, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok\n');
    }).listen(port, () => console.log(`[web] listening on :${port}`));
});
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const cmd = commands.get(interaction.commandName);
    console.log('[interaction]', `/${interaction.commandName}`, 'by', interaction.user.username, 'in guild=' + (interaction.guildId ?? 'DM'));
    if (!cmd) {
        try {
            await interaction.reply({ content: 'Unknown command.', ephemeral: true });
        }
        catch { }
        return;
    }
    await runSafely(interaction, async () => {
        // Most of your commands already defer/reply themselves.
        await cmd.execute({ interaction });
    });
});
// ---------- Boot ----------
(async function main() {
    console.log('[boot] starting login…');
    await loadCommands();
    // Optional hints about third-party deps:
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        console.log('[spotify] tokens set.');
    }
    else {
        console.log('[spotify] client id/secret not set — Spotify links will be converted using search only.');
    }
    await client.login(process.env.DISCORD_TOKEN);
})();
