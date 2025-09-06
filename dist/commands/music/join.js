import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';
export default class Join extends Command {
    data = new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your current voice channel');
    async execute({ interaction }) {
        const st = await safeDefer(interaction, { ephemeral: true });
        if (st === 'unknown')
            return;
        if (!interaction.guild) {
            await safeRespond(interaction, 'Use this in a server.');
            return;
        }
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.voice.channel) {
            await safeRespond(interaction, 'Join a voice channel first.');
            return;
        }
        try {
            await player.ensureConnected(member);
            await safeRespond(interaction, `✅ Joined ${member.voice.channel.name}`, { ephemeral: false });
        }
        catch (e) {
            console.error('[join] ensureConnected FAILED:', e);
            await safeRespond(interaction, 'Failed to join your voice channel.');
        }
    }
}
