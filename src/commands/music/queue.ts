import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import type { Track } from '../../music/Track.js';
import { safeDefer } from '../utils/safeReply.js';

export default class QueueCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    const session: any = (player as any).sessions?.get(guildId);
    if (!session) {
      await interaction.editReply('Queue is empty.');
      return;
    }

    const tracks: Track[] = session.queue?.tracks ?? [];
    if (!Array.isArray(tracks) || tracks.length === 0) {
      await interaction.editReply('Queue is empty.');
      return;
    }

    const lines = tracks.slice(0, 15).map((t, i) =>
      `**${i + 1}.** ${t.meta.title} — ${t.meta.author ?? 'Unknown'}`
    );
    const more = tracks.length > 15 ? `\n…and **${tracks.length - 15}** more.` : '';

    const embed = new EmbedBuilder()
      .setTitle('📜 Queue')
      .setDescription(lines.join('\n') + more)
      .setColor(0x5865f2);

    await interaction.editReply({ embeds: [embed] });
  }
}
