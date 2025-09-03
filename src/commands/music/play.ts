import { SlashCommandBuilder } from 'discord.js';
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
    .setDescription('Play a song from YouTube or Spotify (URLs, keywords, or playlists)')
    .addStringOption((o) =>
      o
        .setName('query')
        .setDescription('YouTube/YouTube Music/Spotify URL, or keywords')
        .setRequired(true),
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    await interaction.deferReply();

    if (!interaction.inGuild()) {
      await interaction.editReply('Use this in a server.');
      return;
    }

    const query = interaction.options.getString('query', true);
    console.log('[play] query =', query);

    const guild = interaction.guild!;
    const member = await guild.members.fetch(interaction.user.id);

    if (!member.voice.channel) {
      await interaction.editReply('Join a voice channel first.');
      return;
    }

    try {
      await player.ensureConnected(member);
      console.log('[play] ensureConnected OK in channel:', member.voice.channel.name);
    } catch (e) {
      console.error('[play] ensureConnected FAILED:', e);
      await interaction.editReply('Failed to join your voice channel.');
      return;
    }

    // Resolve
    let metas;
    try {
      const useSpotify = sp.match(query);
      console.log('[play] resolver =', useSpotify ? 'Spotify' : 'YouTube');
      metas = useSpotify ? await sp.resolve(query) : await yt.resolve(query);
      console.log('[play] resolver returned', metas?.length ?? 0, 'item(s)');
    } catch (e) {
      console.error('[play] resolve FAILED:', e);
      await interaction.editReply('Failed to resolve that track or playlist.');
      return;
    }

    if (!metas?.length) {
      await interaction.editReply('No results.');
      return;
    }

    // Convert Spotify → YouTube (track-by-track) if needed
    const out: Track[] = [];
    for (const m of metas) {
      if (m.source === 'SPOTIFY') {
        const { SpotifyResolver } = await import('../../music/resolvers/SpotifyResolver.js');
        const resolver = new SpotifyResolver();
        const ytMeta = await resolver.spotifyTrackToYouTube(m);
        if (ytMeta) out.push(new Track({ ...ytMeta, requestedBy: interaction.user.username }));
      } else {
        out.push(new Track({ ...m, requestedBy: interaction.user.username }));
      }
    }
    if (!out.length) {
      await interaction.editReply('Could not find playable versions.');
      return;
    }

    // Limit the blast size for very large playlists
    const MAX_ENQUEUE = 100;
    const toAdd = out.slice(0, MAX_ENQUEUE);

    let started = 0;
    let queued = 0;
    for (const t of toAdd) {
      const res = player.enqueue(guild.id, t);
      if (res.started) started++;
      else queued++;
    }

    const more =
      out.length > MAX_ENQUEUE ? ` (first ${MAX_ENQUEUE} of ${out.length})` : '';

    await interaction.editReply(
      started
        ? `▶️ Started ${started} and queued ${queued}${more}.`
        : `➕ Queued ${queued} track(s)${more}.`,
    );
  }
}
