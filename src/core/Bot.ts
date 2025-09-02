import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { Command } from './Command.js';

export class Bot extends Client {
  public commands: Collection<string, Command> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
    });
  }
}
