import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class Pause extends Command {
  public data = new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track');

  async execute({ interaction }: CommandContext): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }
    const session = (player as any).sessions?.get(guildId);
    if (!session) {
      await interaction.reply('Nothing is playing.');
      return;
    }
    const ok = session.player.pause();
    await interaction.reply(ok ? '⏸️ Paused.' : 'Already paused.');
  }
}
