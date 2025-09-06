import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class Skip extends Command {
  public data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track');

  async execute({ interaction }: CommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      return;
    }

    // Peek at what will play next for a nicer message
    const session = (player as any).sessions?.get(interaction.guildId);
    const upcoming = session?.queue?.peek?.();

    player.skip(interaction.guildId);

    const msg = upcoming?.meta?.title
      ? `⏭️ Skipped. Now playing: **${upcoming.meta.title}**`
      : '⏭️ Skipped.';
    await interaction.reply(msg);
  }
}
