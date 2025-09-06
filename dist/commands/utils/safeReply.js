export async function safeDefer(interaction, ephemeral = false) {
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply({ ephemeral });
        }
        catch { }
    }
}
export async function safeReply(interaction, options) {
    if (interaction.deferred)
        return interaction.editReply(options);
    if (interaction.replied)
        return interaction.followUp(options);
    return interaction.reply(options);
}
