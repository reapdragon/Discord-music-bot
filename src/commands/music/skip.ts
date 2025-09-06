import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';

export default class Skip extends Command {
  public data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    try {
      player.skip(guildId);
      // Try to show what’s now playing (if already swapped in by the Player).
      const s: any = (player as any).sessions?.get(guildId);
      const nextTitle: string | undefined = s?.current?.meta?.title;
      await interaction.editReply(
        nextTitle ? `⏭️ Skipped. Now playing **${nextTitle}**.` : '⏭️ Skipped.'
      );
    } catch (e) {
      console.error('[skip] failed:', e);
      await interaction.editReply('Failed to skip.');
    }
  }
}
