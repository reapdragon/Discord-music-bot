import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';

export default class StopCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    try {
      player.stop(guildId);
      // If your Player has a disconnect/leave, call it here as well.
      await interaction.editReply('⏹️ Stopped and cleared the queue.');
    } catch (e) {
      console.error('[stop] failed:', e);
      await interaction.editReply('Failed to stop.');
    }
  }
}
