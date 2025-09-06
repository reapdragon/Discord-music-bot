import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';

export default class Pause extends Command {
  public data = new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause playback');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    try {
      // Prefer your Player API if present
      if (typeof (player as any).pause === 'function') {
        await (player as any).pause(guildId);
      } else {
        const s: any = (player as any).sessions?.get(guildId);
        if (!s?.player) throw new Error('Nothing playing.');
        s.player.pause(true);
      }
      await interaction.editReply('⏸️ Paused.');
    } catch (e) {
      console.error('[pause] failed:', e);
      await interaction.editReply('Failed to pause.');
    }
  }
}
