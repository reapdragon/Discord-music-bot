import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { YouTubeExtractor } from '../../music/extractors/YouTubeExtractor.js';
import { SpotifyExtractor } from '../../music/extractors/SpotifyExtractor.js';
import { Track } from '../../music/Track.js';

const yt = new YouTubeExtractor();
const sp = new SpotifyExtractor();

export default class Play extends Command {
  public data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube or Spotify')
    .addStringOption(o =>
      o.setName('query')
       .setDescription('YouTube/YouTube Music URL, keywords, or Spotify link')
       .setRequired(true)
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    // SAFETY: only defer if not already acknowledged by something else
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(); // public reply (not ephemeral)
    }

    if (!interaction.guild) {
      if (interaction.deferred) {
        await interaction.editReply('Use this in a server.');
      } else {
        await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    const query = interaction.options.getString('query', true);
    console.log('[play] query =', query);

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.voice.channel) {
      const msg = 'Join a voice channel first.';
      if (interaction.deferred) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await player.ensureConnected(member);
      console.log('[play] ensureConnected OK in channel:', member.voice.channel.name);
    } catch (e) {
      console.error('[play] ensureConnected FAILED:', e);
      if (interaction.deferred) await interaction.editReply('Failed to join your voice channel.');
      else await interaction.reply({ content: 'Failed to join your voice channel.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Resolve metadata
    let metas;
    try {
      const useSpotify = sp.match(query);
      console.log('[play] resolver =', useSpotify ? 'Spotify' : 'YouTube');
      metas = useSpotify ? await sp.resolve(query) : await yt.resolve(query);
      console.log('[play] resolver returned', metas?.length ?? 0, 'item(s)');
      if (metas?.[0]) {
        console.log('[play] first meta =', {
          title: metas[0].title,
          url: metas[0].url,
          source: metas[0].source
        });
      }
    } catch (e) {
      console.error('[play] resolve FAILED:', e);
      if (interaction.deferred) await interaction.editReply('Failed to resolve that track.');
      else await interaction.reply({ content: 'Failed to resolve that track.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!metas || metas.length === 0) {
      if (interaction.deferred) await interaction.editReply('No results.');
      else await interaction.reply({ content: 'No results.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Convert Spotify tracks to YouTube when needed
    const final: Track[] = [];
    for (const m of metas) {
      if (m.source === 'SPOTIFY') {
        const { SpotifyResolver } = await import('../../music/resolvers/SpotifyResolver.js');
        const resolver = new SpotifyResolver();
        const ytMeta = await resolver.spotifyTrackToYouTube(m);
        console.log('[play] spotify→youtube', m.title, '=>', ytMeta?.url ?? 'NO MATCH');
        if (ytMeta) final.push(new Track({ ...ytMeta, requestedBy: interaction.user.username }));
      } else {
        final.push(new Track({ ...m, requestedBy: interaction.user.username }));
      }
    }

    if (final.length === 0) {
      if (interaction.deferred) await interaction.editReply('Could not find playable versions.');
      else await interaction.reply({ content: 'Could not find playable versions.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Enqueue and report
    let started = 0, queued = 0;
    for (const t of final) {
      const res = player.enqueue(interaction.guild.id, t);
      console.log('[play] enqueue', { title: t.meta.title, url: t.meta.url, result: res });
      if (res.started) started++; else queued++;
    }

    const summary =
      started ? `▶️ Started ${started} and queued ${queued}.`
              : `➕ Queued ${queued} track(s).`;

    if (interaction.deferred) await interaction.editReply(summary);
    else await interaction.reply(summary);
  }
}
