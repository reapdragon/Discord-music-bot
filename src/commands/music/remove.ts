import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

export default class Remove extends Command {
  public data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('Position of the track to remove (1-based)')
        .setRequired(true)
        .setMinValue(1)
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) { await safeRespond(interaction, 'Use this in a server.'); return; }

    const position = interaction.options.getInteger('position', true) - 1; // Convert to 0-based
    const session = (player as any).sessions?.get(gid);
    
    if (!session || !session.queue) {
      await safeRespond(interaction, 'No queue found.', { ephemeral: false });
      return;
    }

    const removed = session.queue.removeAt(position);
    if (!removed) {
      await safeRespond(interaction, 'Invalid position. Check the queue with `/queue`.', { ephemeral: false });
      return;
    }

    await safeRespond(interaction, `🗑️ Removed **${removed.meta.title}** from the queue.`, { ephemeral: false });
  }
}
