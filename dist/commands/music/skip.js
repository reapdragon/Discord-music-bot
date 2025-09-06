import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';
export default class Skip extends Command {
    data = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song');
    async execute({ interaction }) {
        const st = await safeDefer(interaction, { ephemeral: false });
        if (st === 'unknown')
            return;
        const gid = interaction.guildId;
        if (!gid) {
            await safeRespond(interaction, 'Use this in a server.');
            return;
        }
        player.skip(gid);
        await safeRespond(interaction, '⏭️ Skipped.', { ephemeral: false });
    }
}
