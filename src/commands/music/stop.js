import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class Stop extends Command {
    data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback, clear the queue, and (optionally) leave the voice channel')
        .addBooleanOption(o => o.setName('leave')
        .setDescription('Also disconnect the bot from voice (default: true)')
        .setRequired(false));
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
        const leave = interaction.options.getBoolean('leave') ?? true;
        const res = player.stop(interaction.guild.id, { disconnect: leave });
        if (res.action === 'stopped') {
            if (leave)
                await interaction.editReply('⏹️ Stopped playback, cleared the queue, and left the voice channel.');
            else
                await interaction.editReply('⏹️ Stopped playback and cleared the queue.');
        }
        else {
            await interaction.editReply('Nothing to stop.');
        }
    }
}
