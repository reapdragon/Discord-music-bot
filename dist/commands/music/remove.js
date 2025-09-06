import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';
export default class Resume extends Command {
    data = new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume playback');
    async execute({ interaction }) {
        await safeDefer(interaction);
        const guildId = interaction.guild?.id;
        if (!guildId) {
            await interaction.editReply('Use this in a server.');
            return;
        }
        try {
            // Prefer your Player API if present
            if (typeof player.resume === 'function') {
                await player.resume(guildId);
            }
            else {
                const s = player.sessions?.get(guildId);
                if (!s?.player)
                    throw new Error('Nothing to resume.');
                s.player.unpause();
            }
            await interaction.editReply('▶️ Resumed.');
        }
        catch (e) {
            console.error('[resume] failed:', e);
            await interaction.editReply('Failed to resume.');
        }
    }
}
