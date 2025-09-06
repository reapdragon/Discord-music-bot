// src/utils/safeReply.ts
import type { InteractionReplyOptions, MessagePayload } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export async function safeDefer(interaction: ChatInputCommandInteraction, ephemeral = false) {
  if (!interaction.deferred && !interaction.replied) {
    try { await interaction.deferReply({ ephemeral }); } catch {}
  }
}

export async function safeReply(
  interaction: ChatInputCommandInteraction,
  options: string | MessagePayload | InteractionReplyOptions
) {
  if (interaction.deferred) return interaction.editReply(options as any);
  if (interaction.replied) return interaction.followUp(options as any);
  return interaction.reply(options as any);
}
