import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
export default class Ping extends Command {
    data = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Health check');
    async execute({ interaction }) {
        await interaction.reply(`🏓 Pong! WS: ${interaction.client.ws.ping}ms`);
    }
}
