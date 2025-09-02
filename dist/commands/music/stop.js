import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/playerInstance.js';
export default class Stop extends Command {
    data = new SlashCommandBuilder().setName('stop').setDescription('Stop and clear the queue');
    async execute({ interaction }) {
        player.stop(interaction.guild.id);
        await interaction.reply('⏹️ Stopped and cleared the queue.');
    }
}
