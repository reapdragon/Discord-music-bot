import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
export default class Join extends Command {
    data = new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your current voice channel');
    async execute({ interaction }) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.user.id);
            const channel = member.voice.channel;
            if (!channel) {
                await interaction.editReply('Join a voice channel first.');
                return;
            }
            // Ensure the bot can actually join/speak there
            const me = await guild.members.fetchMe();
            const perms = channel.permissionsFor(me);
            if (!perms?.has('Connect') || !perms?.has('Speak')) {
                await interaction.editReply('I need **Connect** and **Speak** permissions in that channel.');
                return;
            }
            await player.ensureConnected(member);
            await interaction.editReply(`✅ Joined **${channel.name}**`);
        }
        catch (err) {
            console.error('[join] error:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('Failed to join voice channel.');
            }
            else {
                await interaction.reply({ content: 'Failed to join voice channel.', ephemeral: true });
            }
        }
    }
}
