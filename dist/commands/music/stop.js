import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class Stop extends Command {
    data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue');
    async execute({ interaction }) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
            return;
        }
        // Clear queue & stop audio
        player.stop(interaction.guildId);
        // Optional: disconnect the voice connection (safe no-op if none)
        const session = player.sessions?.get(interaction.guildId);
        try {
            session?.connection?.destroy?.();
        }
        catch { }
        await interaction.reply('⏹️ Stopped and cleared the queue.');
    }
}
