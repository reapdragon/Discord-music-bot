import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class StopCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop and clear the queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }

    player.stop(gid);
    await safeRespond(interaction, '⏹️ Stopped and cleared the queue.', { ephemeral: false });
  }
}
