import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { safeDefer } from '../utils/safeReply.js';

export default class Join extends Command {
  public data = new SlashCommandBuilder()
    .setName('join')
    .setDescription('Have the bot join your current voice channel');

  async execute({ interaction }: CommandContext): Promise<void> {
    await safeDefer(interaction);

    if (!interaction.guild) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id) as GuildMember;
    if (!member.voice.channel) {
      await interaction.editReply('Join a voice channel first.');
      return;
    }

    try {
      await player.ensureConnected(member);
      await interaction.editReply(`✅ Joined **${member.voice.channel.name}**`);
    } catch (e) {
      console.error('[join] failed:', e);
      await interaction.editReply('Failed to join your voice channel.');
    }
  }
}
