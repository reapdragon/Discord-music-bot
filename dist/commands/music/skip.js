import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/playerInstance.js';
export default class Skip extends Command {
    data = new SlashCommandBuilder().setName('skip').setDescription('Skip current track');
    async execute({ interaction }) {
        player.skip(interaction.guild.id);
        await interaction.reply('⏭️ Skipped.');
    }
}
