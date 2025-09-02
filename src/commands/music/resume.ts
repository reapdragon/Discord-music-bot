import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class Resume extends Command {
  public data = new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback');

  async execute({ interaction }: CommandContext): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }
    const session = (player as any).sessions?.get(guildId);
    if (!session) {
      await interaction.reply('Nothing to resume.');
      return;
    }
    const ok = session.player.unpause();
    await interaction.reply(ok ? '▶️ Resumed.' : 'Already playing.');
  }
}
