import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class StopCmd extends Command {
  public data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear queue, and leave voice channel');

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }

    player.disconnect(gid);
    await safeRespond(interaction, '⏹️ Stopped playback, cleared queue, and left voice channel.', { ephemeral: false });
  }
}
