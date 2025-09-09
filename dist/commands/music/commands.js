import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { safeDefer } from '../utils/interaction.js';
export default class Commands extends Command {
    data = new SlashCommandBuilder()
        .setName('commands')
        .setDescription('List all available commands');
    async execute({ interaction }) {
        const st = await safeDefer(interaction, { ephemeral: false });
        if (st === 'unknown')
            return;
        const embed = new EmbedBuilder()
            .setTitle('🎵 Music Bot Commands')
            .setDescription('Here are all the available commands:')
            .addFields({ name: '🎵 Music Commands', value: '`/play` - Play a song from YouTube or Spotify\n`/join` - Join your voice channel\n`/pause` - Pause playback\n`/resume` - Resume playback\n`/skip` - Skip current song\n`/stop` - Stop playback, clear queue, and leave voice channel\n`/queue` - Show current queue\n`/nowplaying` - Show currently playing song\n`/shuffle` - Shuffle the queue\n`/remove` - Remove a track from queue', inline: false }, { name: '🔧 Utility Commands', value: '`/ping` - Health check\n`/commands` - Show this help', inline: false })
            .setColor(0x5865F2)
            .setFooter({ text: 'Use / before each command name' });
        await interaction.editReply({ embeds: [embed] });
    }
}
