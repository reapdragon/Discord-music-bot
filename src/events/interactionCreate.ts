import type { Client, ChatInputCommandInteraction } from 'discord.js';
import type { Bot } from '../core/Bot.js';

export default (client: Client) => {
  client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    console.log(`[interaction] /${i.commandName} by ${i.user.tag} in guild=${i.guildId}`);

    const bot = client as Bot;
    const cmd = bot.commands.get(i.commandName);
    if (!cmd) {
      console.log(`[interaction] command not found: ${i.commandName}`);
      return;
    }

    try {
      await cmd.execute({ interaction: i as ChatInputCommandInteraction });
    } catch (err) {
      console.error(`[interaction:error] /${i.commandName}`, err);
      try {
        if (i.deferred) await i.editReply('Error executing command.');
        else if (i.replied) await i.followUp({ content: 'Error executing command.', ephemeral: true });
        else await i.reply({ content: 'Error executing command.', ephemeral: true });
      } catch (e: any) {
        console.error('[interaction:error:notify-failed]', e?.code || e);
        if (e?.code === 10062 && i.inGuild() && i.channel) {
          await i.channel.send('Error executing command (interaction expired). Try again.');
        }
      }
    }
  });
};
