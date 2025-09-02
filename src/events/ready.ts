import type { Client } from 'discord.js';
export default (client: Client) => {
  client.once('ready', () => {
    console.log(`[ready] Logged in as ${client.user?.tag} (id=${client.user?.id})`);
  });
};
