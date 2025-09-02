export default (client) => {
  client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;

    try {
      await cmd.execute({ interaction: i });
    } catch (err) {
      console.error(`[interaction:error] /${i.commandName}`, err);

      // Try to notify the user without crashing even if token expired or already replied
      try {
        if (i.deferred) {
          await i.editReply('Error executing command.');
        } else if (i.replied) {
          await i.followUp({ content: 'Error executing command.', ephemeral: true });
        } else {
          await i.reply({ content: 'Error executing command.', ephemeral: true });
        }
      } catch (e) {
        // 10062 = Unknown interaction (expired/acknowledged); 40060 = already acknowledged
        if ((e?.code === 10062 || e?.code === 40060) && i.inGuild() && i.channel) {
          await i.channel.send('Error executing command (interaction expired). Try again.');
        } else {
          console.error('[interaction:error:notify-failed]', e);
        }
      }
    }
  });
};
