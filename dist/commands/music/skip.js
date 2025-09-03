import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class Skip extends Command {
    data = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track');
    async execute({ interaction }) {
        await interaction.deferReply();
        if (!interaction.inGuild()) {
            await interaction.editReply('Use this in a server.');
            return;
        }
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.voice.channel) {
            await interaction.editReply('Join a voice channel first.');
            return;
        }
        const res = player.skip(interaction.guild.id);
        if (res.action === 'skipped') {
            await interaction.editReply(`⏭️ Skipped. Now playing: **${res.nextTitle}**`);
        }
        else if (res.action === 'stopped') {
            await interaction.editReply('⏹️ Stopped. No more tracks in the queue.');
        }
        else {
            await interaction.editReply('Nothing to skip.');
        }
    }
}
