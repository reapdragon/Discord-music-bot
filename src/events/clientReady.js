export default (client) => {
    // Use clientReady (not ready) to avoid the deprecation warning in v14→v15
    client.once('clientReady', () => {
        console.log(`[clientReady] Logged in as ${client.user?.tag} (id=${client.user?.id})`);
    });
};
