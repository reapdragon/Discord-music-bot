import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class StopCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear the queue, and leave the voice channel');

  async execute({ interaction }: CommandContext): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    player.leave(guildId);
    await interaction.reply('⏹️ Stopped and cleared the queue. Left the voice channel.');
  }
}
