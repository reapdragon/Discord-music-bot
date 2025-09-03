import { Client, GatewayIntentBits, Collection } from 'discord.js';
export class Bot extends Client {
    commands = new Collection();
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
