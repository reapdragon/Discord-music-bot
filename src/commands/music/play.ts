import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { YouTubeExtractor } from '../../music/extractors/YouTubeExtractor.js';
import { SpotifyExtractor } from '../../music/extractors/SpotifyExtractor.js';
import { Track } from '../../music/Track.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';

const yt = new YouTubeExtractor();
const sp = new SpotifyExtractor();

export default class Play extends Command {
  public data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube or Spotify')
    .addStringOption(o =>
      o.setName('query')
        .setDescription('YouTube URL, keywords, or Spotify link')
        .setRequired(true),
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    // Visible in channel by default
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    if (!interaction.guild) {
      await safeRespond(interaction, 'Use this in a server.');
      return;
    }

    const query = interaction.options.getString('query', true);
    console.log('[play] query =', query);

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.voice.channel) {
      await safeRespond(interaction, 'Join a voice channel first.');
      return;
    }

    // Ensure we’re connected (and subscribed) before resolving/queuing
    try {
      await player.ensureConnected(member);
      console.log('[play] ensureConnected OK in channel:', member.voice.channel.name);
    } catch (e) {
      console.error('[play] ensureConnected FAILED:', e);
      await safeRespond(interaction, 'Failed to join your voice channel.');
      return;
    }

    // Resolve search / links
    let metas: Array<{ title: string; url: string; source: 'YOUTUBE' | 'SPOTIFY' }> | undefined;
    try {
      const useSpotify = sp.match(query);
      console.log('[play] resolver =', useSpotify ? 'Spotify' : 'YouTube');
      metas = useSpotify ? await sp.resolve(query) : await yt.resolve(query);
      console.log('[play] resolver returned', metas?.length ?? 0, 'item(s)');
      if (metas?.[0]) console.log('[play] first meta =', metas[0]);
    } catch (e) {
      console.error('[play] resolve FAILED:', e);
      await safeRespond(interaction, 'Failed to resolve that track.');
      return;
    }

    if (!metas || metas.length === 0) {
      await safeRespond(interaction, 'No results.');
      return;
    }

    // Convert items to Track(s) (Spotify -> YouTube lookup)
    const final: Track[] = [];
    for (const m of metas) {
      if (m.source === 'SPOTIFY') {
        const { SpotifyResolver } = await import('../../music/resolvers/SpotifyResolver.js');
        const resolver = new SpotifyResolver();
        const ytMeta = await resolver.spotifyTrackToYouTube(m);
        if (ytMeta) {
          final.push(new Track({ ...ytMeta, requestedBy: interaction.user.username }));
        }
      } else {
        final.push(new Track({ ...m, requestedBy: interaction.user.username }));
      }
    }
    if (final.length === 0) {
      await safeRespond(interaction, 'Could not find playable versions.');
      return;
    }

    // Enqueue
    let started = 0;
    let queued = 0;
    for (const t of final) {
      const res = player.enqueue(interaction.guild.id, t);
      console.log('[play] enqueue', { title: t.meta.title, url: t.meta.url, result: res });
      if (res.started) started++;
      else queued++;
    }

    await safeRespond(
      interaction,
      started ? `▶️ Started ${started} and queued ${queued}.` : `➕ Queued ${queued} track(s).`,
      { ephemeral: false },
    );
  }
}
