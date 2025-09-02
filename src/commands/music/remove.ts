import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class Remove extends Command {
  public data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by its position (1-based)')
    .addIntegerOption(opt =>
      opt.setName('position').setDescription('Position in the queue (1 = next up)').setRequired(true)
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }
    const pos = interaction.options.getInteger('position', true);
    const session = (player as any).sessions?.get(guildId);
    if (!session || !session.queue) {
      await interaction.reply('Queue is empty.');
      return;
    }
    const idx = pos - 1;
    if (idx < 0 || idx >= session.queue.tracks.length) {
      await interaction.reply(`Invalid position. Queue has ${session.queue.tracks.length} item(s).`);
      return;
    }
    const [removed] = session.queue.tracks.splice(idx, 1);
    await interaction.reply(`🗑️ Removed **${removed.meta.title}** from the queue.`);
  }
}
