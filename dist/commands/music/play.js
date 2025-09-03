import { Command } from '../../core/Command.js';
import { SlashCommandBuilder } from 'discord.js';
import { player } from '../../music/Player.js';
import { YouTubeExtractor } from '../../music/extractors/YouTubeExtractor.js';
import { SpotifyExtractor } from '../../music/extractors/SpotifyExtractor.js';

const yt = new YouTubeExtractor();
const sp = new SpotifyExtractor();

export default class Play extends Command {
  constructor() {
    super();
    this.data = new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play a song from YouTube or Spotify')
      .addStringOption(o =>
        o.setName('query').setDescription('YouTube URL, keywords, or Spotify link').setRequired(true)
      );
  }

  async execute({ interaction }) {
    // Defer immediately to avoid 3s timeout -> prevents Unknown interaction
    await interaction.deferReply();

    const guild = interaction.guild;
    if (!guild) return interaction.editReply('Use this in a server.');

    const query = interaction.options.getString('query', true);
    const member = await guild.members.fetch(interaction.user.id);

    try {
      // ensure in voice
      if (!member.voice.channel) {
        await interaction.editReply('Join a voice channel first.');
        return;
      }
      await player.ensureConnected(member);
    } catch (e) {
      console.error('[play] ensureConnected error', e);
      await interaction.editReply('Failed to join your voice channel.');
      return;
    }

    // Resolve track(s)
    let metas = [];
    try {
      metas = sp.match(query) ? await sp.resolve(query) : await yt.resolve(query);
    } catch (e) {
      console.error('[play] resolver error', e);
      await interaction.editReply('Failed to resolve that track.');
      return;
    }

    if (!metas || metas.length === 0) {
      await interaction.editReply('No results.');
      return;
    }

    // Convert Spotify items to YouTube before queueing
    const final = [];
    for (const m of metas) {
      if (m.source === 'SPOTIFY') {
        const { SpotifyResolver } = await import('../../music/resolvers/SpotifyResolver.js');
        const resolver = new SpotifyResolver();
        const ytMeta = await resolver.spotifyTrackToYouTube(m);
        if (ytMeta) final.push({ ...ytMeta, requestedBy: interaction.user.username });
      } else {
        final.push({ ...m, requestedBy: interaction.user.username });
      }
    }

    if (final.length === 0) {
      await interaction.editReply('Could not find playable versions.');
      return;
    }

    for (const meta of final) player.enqueue(guild.id, { meta });
    await interaction.editReply(`Queued ${final.length} track(s).`);
  }
}
