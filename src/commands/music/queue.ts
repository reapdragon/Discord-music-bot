import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import type { Track } from '../../music/Track.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class QueueCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }

    const session = (player as any).sessions?.get(gid);
    const tracks: Track[] = session?.queue?.tracks ?? [];
    if (!session || tracks.length === 0) {
      await safeRespond(interaction, 'Queue is empty.', { ephemeral: false });
      return;
    }

    const lines = tracks.slice(0, 15)
      .map((t, i) => `**${i + 1}.** ${t.meta.title} — ${t.meta.author ?? 'Unknown'}`);
    const more = tracks.length > 15 ? `\n…and **${tracks.length - 15}** more.` : '';

    const embed = new EmbedBuilder()
      .setTitle('📜 Queue')
      .setDescription(lines.join('\n') + more)
      .setColor(0x5865F2);

    await interaction.editReply({ embeds: [embed] });
  }
}
