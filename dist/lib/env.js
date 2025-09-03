import 'dotenv/config';
['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'].forEach((k) => {
    if (!process.env[k])
        throw new Error(`Missing env var: ${k}`);
});
