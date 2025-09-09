import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';
export default class NowPlayingCmd extends Command {
    data = new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song');
    async execute({ interaction }) {
        const st = await safeDefer(interaction, { ephemeral: false });
        if (st === 'unknown')
            return;
        const gid = interaction.guildId;
        if (!gid) {
            await safeRespond(interaction, 'Use this in a server.');
            return;
        }
        const session = player.sessions?.get(gid);
        const track = session?.current;
        if (!session || !track) {
            await safeRespond(interaction, 'Not playing anything.', { ephemeral: false });
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('🎵 Now Playing')
            .setDescription(`**${track.meta.title}**`)
            .setColor(0x5865F2)
            .setURL(track.meta.url);
        if (track.meta.author) {
            embed.addFields({ name: 'Artist', value: track.meta.author, inline: true });
        }
        if (track.meta.durationMs) {
            const duration = Math.floor(track.meta.durationMs / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            embed.addFields({ name: 'Duration', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true });
        }
        if (track.meta.requestedBy) {
            embed.addFields({ name: 'Requested by', value: track.meta.requestedBy, inline: true });
        }
        if (track.meta.thumbnail) {
            embed.setThumbnail(track.meta.thumbnail);
        }
        embed.setFooter({ text: `Source: ${track.meta.source}` });
        await interaction.editReply({ embeds: [embed] });
    }
}
