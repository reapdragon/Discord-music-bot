import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';

export default class Ping extends Command {
  public data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Health check');

  async execute({ interaction }: CommandContext): Promise<void> {
    await interaction.reply(`🏓 Pong! WS: ${interaction.client.ws.ping}ms`);
  }
}