import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';

export default class Resume extends Command {
  public data = new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    try {
      // Prefer your Player API if present
      if (typeof (player as any).resume === 'function') {
        await (player as any).resume(guildId);
      } else {
        const s: any = (player as any).sessions?.get(guildId);
        if (!s?.player) throw new Error('Nothing to resume.');
        s.player.unpause();
      }
      await interaction.editReply('▶️ Resumed.');
    } catch (e) {
      console.error('[resume] failed:', e);
      await interaction.editReply('Failed to resume.');
    }
  }
}
