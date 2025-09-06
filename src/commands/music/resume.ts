import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class Resume extends Command {
  public data = new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback');

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }
    const s = (player as any).sessions?.get(gid);
    if (!s) { await safeRespond(interaction, 'Nothing to resume.'); return; }

    s.player.unpause();
    await safeRespond(interaction, '▶️ Resumed.', { ephemeral: false });
  }
}
