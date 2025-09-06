// src/utils/interaction.ts
import { MessageFlags, RESTJSONErrorCodes, } from 'discord.js';
/** Safely defer the interaction. Returns the status so callers can bail early. */
export async function safeDefer(interaction, { ephemeral = true } = {}) {
    // If someone else already acked it, don't try again.
    if (interaction.deferred || interaction.replied)
        return 'already';
    try {
        const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
        await interaction.deferReply({ flags }); // NOTE: use flags here; NOT on editReply
        return 'ok';
    }
    catch (e) {
        const code = e?.code;
        if (code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged)
            return 'already';
        if (code === RESTJSONErrorCodes.UnknownInteraction)
            return 'unknown';
        throw e;
    }
}
/** Reply/edit/followUp with the right call; only the *initial* response may set ephemeral. */
export async function safeRespond(interaction, content, { ephemeral = true } = {}) {
    const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
    if (interaction.deferred) {
        // After defer, just edit the deferred reply. (No flags allowed here.)
        await interaction.editReply({ content });
    }
    else if (interaction.replied) {
        // After an initial reply, send a follow-up (flags OK here).
        await interaction.followUp({ content, flags });
    }
    else {
        // First response path.
        await interaction.reply({ content, flags });
    }
}
