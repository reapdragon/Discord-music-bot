import '../lib/env.js'; // <-- make sure this is the first import
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type SlashCommand =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
}

export abstract class Command {
  // Allow any of the valid slash command builder variants
  public abstract data: SlashCommand;
  public abstract execute(ctx: CommandContext): Promise<void>;
}
