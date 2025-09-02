import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default class Shuffle extends Command {
  public data = new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue');

  async execute({ interaction }: CommandContext): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }
    const session = (player as any).sessions?.get(guildId);
    if (!session || !session.queue || session.queue.tracks.length === 0) {
      await interaction.reply('Queue is empty.');
      return;
    }
    shuffleInPlace(session.queue.tracks);
    await interaction.reply('🔀 Shuffled the queue.');
  }
}
