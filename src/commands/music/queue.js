import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class QueueCmd extends Command {
    data = new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current queue');
    async execute({ interaction }) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
            return;
        }
        const session = player.sessions?.get(guildId);
        if (!session) {
            await interaction.reply('Queue is empty.');
            return;
        }
        const tracks = session.queue.tracks ?? [];
        if (tracks.length === 0) {
            await interaction.reply('Queue is empty.');
            return;
        }
        const lines = tracks.slice(0, 15).map((t, i) => `**${i + 1}.** ${t.meta.title} — ${t.meta.author ?? 'Unknown'}`);
        const more = tracks.length > 15 ? `\n…and **${tracks.length - 15}** more.` : '';
        const embed = new EmbedBuilder()
            .setTitle('📜 Queue')
            .setDescription(lines.join('\n') + more)
            .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed] });
    }
}
