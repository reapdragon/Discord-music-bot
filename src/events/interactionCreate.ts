import type { Client, Interaction } from 'discord.js';
import { MessageFlags } from 'discord.js';

export default (client: Client) => {
  client.on('interactionCreate', async (i: Interaction) => {
    if (!i.isChatInputCommand()) return;

    console.log(
      `[interaction] /${i.commandName} by ${i.user.tag} in guild=${i.guildId}`
    );
    const cmd = (client as any).commands?.get(i.commandName);
    if (!cmd || typeof cmd.execute !== 'function') {
      try {
        await i.reply({ content: 'Command not found.', flags: MessageFlags.Ephemeral });
      } catch { /* ignore */ }
      return;
    }

    try {
      // Do NOT defer here. Let the command decide and check i.deferred.
      await cmd.execute({ interaction: i, client });
    } catch (err) {
      console.error(`[interaction:error] /${i.commandName}`, err);
      try {
        if (i.deferred && !i.replied) {
          await i.editReply('Error executing command.');
        } else if (!i.deferred && !i.replied) {
          await i.reply({ content: 'Error executing command.', flags: MessageFlags.Ephemeral });
        }
      } catch (notifyErr: any) {
        console.error('[interaction:error:notify-failed]', notifyErr?.code ?? notifyErr);
      }
    }
  });
};
