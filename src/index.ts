// src/index.ts
import 'dotenv/config';
import * as playdl from 'play-dl';
import { Bot } from './core/Bot.js';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
// ... your other imports

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,   // << REQUIRED for voice
    // (optional) GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ...rest of your boot code
  
async function boot() {
  // YouTube cookie (prevents “confirm you’re not a bot”)
  const ytCookie = process.env.YOUTUBE_COOKIE?.trim();
  if (ytCookie) {
    await playdl.setToken({ youtube: { cookie: ytCookie } });
    console.log('[yt] Using YOUTUBE_COOKIE session.');
  } else {
    console.warn('[yt] No YOUTUBE_COOKIE set — YouTube may block requests with “confirm you’re not a bot”.');
  }

  // Optional: Spotify creds (improves resolving)
  const spId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const spSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (spId && spSecret) {
    await playdl.setToken({ spotify: { client_id: spId, client_secret: spSecret, refresh_token: '', market: 'US' } });
    console.log('[spotify] tokens set.');
  }

  const bot = new Bot();
  await bot.login();
}

boot().catch((e) => {
  console.error('[boot] fatal:', e);
  process.exit(1);
});
