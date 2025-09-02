import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class Resume extends Command {
    data = new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume playback');
    async execute({ interaction }) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
            return;
        }
        const session = player.sessions?.get(guildId);
        if (!session) {
            await interaction.reply('Nothing to resume.');
            return;
        }
        const ok = session.player.unpause();
        await interaction.reply(ok ? '▶️ Resumed.' : 'Already playing.');
    }
}
