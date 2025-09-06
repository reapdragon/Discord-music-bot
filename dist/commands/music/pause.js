import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';
export default class Pause extends Command {
    data = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause playback');
    async execute({ interaction }) {
        const st = await safeDefer(interaction, { ephemeral: false });
        if (st === 'unknown')
            return;
        const gid = interaction.guildId;
        if (!gid) {
            await safeRespond(interaction, 'Use this in a server.');
            return;
        }
        const s = player.sessions?.get(gid);
        if (!s) {
            await safeRespond(interaction, 'Nothing playing.');
            return;
        }
        s.player.pause();
        await safeRespond(interaction, '⏸️ Paused.', { ephemeral: false });
    }
}
