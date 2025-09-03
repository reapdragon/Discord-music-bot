import type { Client } from 'discord.js';

export default (client: Client) => {
  // Use clientReady (not ready) to avoid the deprecation warning in v14→v15
  client.once('clientReady', () => {
    console.log(`[clientReady] Logged in as ${client.user?.tag} (id=${client.user?.id})`);
  });
};
