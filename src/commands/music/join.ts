import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';

export default class Join extends Command {
  public data = new SlashCommandBuilder()
    .setName('join')
    .setDescription('Ask the bot to join your voice channel');

  async execute({ interaction }: CommandContext): Promise<void> {
    await interaction.deferReply();
    if (!interaction.guild) return void interaction.editReply('Use this in a server.');

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.voice.channel) return void interaction.editReply('Join a voice channel first.');

    try {
      await player.ensureConnected(member);
      return void interaction.editReply(`✅ Joined ${member.voice.channel.name}`);
    } catch (e) {
      console.error('[join] failed:', e);
      return void interaction.editReply('Failed to join your voice channel.');
    }
  }
}
