import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class Shuffle extends Command {
  public data = new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }

    const session = (player as any).sessions?.get(gid);
    if (!session || !session.queue || session.queue.tracks.length === 0) {
      await safeRespond(interaction, 'Queue is empty.', { ephemeral: false });
      return;
    }

    session.queue.shuffle();
    await safeRespond(interaction, '🔀 Shuffled the queue.', { ephemeral: false });
  }
}
