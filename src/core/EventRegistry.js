import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function registerEvents(client) {
    const eventsDir = path.resolve(__dirname, '../events');
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
        const mod = await import(pathToFileURL(path.join(eventsDir, file)).href);
        if (typeof mod.default === 'function')
            mod.default(client);
    }
}
