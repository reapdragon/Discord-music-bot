import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
export default class Pause extends Command {
    data = new SlashCommandBuilder()
        .setName('commands')
        .setDescription('List of commands');
    async execute({ interaction }) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
            return;
        }
        interaction.reply({ content: 'play (Query) \n join \n pause \n queue \n remove \n shuffle \n skip \n stop \n' });
    }
}
