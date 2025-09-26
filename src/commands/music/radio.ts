// src/commands/music/radio.ts
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../../core/Command.js';
import { player } from '../../music/Player.js';
import { YouTubeExtractor } from '../../music/extractors/YouTubeExtractor.js';
import { Track } from '../../music/Track.js';
import { safeDefer, safeRespond } from '../utils/interaction.js';
import { chatGPTService } from '../../lib/chatgpt.js';
import { logger } from '../../lib/logger.js';

const yt = new YouTubeExtractor();

export default class Radio extends Command {
  public data = new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Generate a radio playlist based on a song or current track')
    .addStringOption(option =>
      option
        .setName('seed')
        .setDescription('Song to base the radio on (leave empty to use current track)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('Number of songs to generate (5-20)')
        .setMinValue(5)
        .setMaxValue(20)
        .setRequired(false)
    );

  async execute({ interaction }: CommandContext): Promise<void> {
    const st = await safeDefer(interaction, { ephemeral: false });
    if (st === 'unknown') return;

    const gid = interaction.guildId;
    if (!gid) {
      await safeRespond(interaction, 'Use this in a server.');
      return;
    }

    const member = await interaction.guild!.members.fetch(interaction.user.id);
    if (!member.voice.channel) {
      await safeRespond(interaction, 'Join a voice channel first.');
      return;
    }

    // Check if ChatGPT is configured
    if (!chatGPTService.isConfigured()) {
      await safeRespond(interaction, '❌ Radio feature requires OpenAI API key. Please configure OPENAI_API_KEY in your environment.');
      return;
    }

    const seedQuery = interaction.options.getString('seed');
    const count = interaction.options.getInteger('count') || 10;

    let seedTrack: { title: string; artist: string; genre?: string; mood?: string };

    try {
      if (seedQuery) {
        // Use provided seed song
        await safeRespond(interaction, '🎵 Analyzing seed song...');
        
        const metas = await yt.resolve(seedQuery);
        if (!metas || metas.length === 0) {
          await safeRespond(interaction, '❌ Could not find the seed song.');
          return;
        }

        const meta = metas[0];
        seedTrack = {
          title: meta.title,
          artist: meta.author || 'Unknown Artist',
          genre: meta.source === 'SPOTIFY' ? 'Unknown' : undefined
        };

        // Analyze the track to get genre and mood
        const analysis = await chatGPTService.analyzeTrack(seedTrack);
        seedTrack.genre = analysis.genre;
        seedTrack.mood = analysis.mood;

      } else {
        // Use current playing track
        const session = (player as any).sessions?.get(gid);
        const currentTrack = session?.current;
        
        if (!session || !currentTrack) {
          await safeRespond(interaction, '❌ No song is currently playing. Provide a seed song or play something first.');
          return;
        }

        seedTrack = {
          title: currentTrack.meta.title,
          artist: currentTrack.meta.author || 'Unknown Artist'
        };

        // Analyze the current track
        const analysis = await chatGPTService.analyzeTrack(seedTrack);
        seedTrack.genre = analysis.genre;
        seedTrack.mood = analysis.mood;
      }

      // Generate radio playlist
      await safeRespond(interaction, `🤖 Generating radio playlist based on "${seedTrack.title}" by ${seedTrack.artist}...`);
      
      const radioResponse = await chatGPTService.generateRadioPlaylist(seedTrack, count);
      
      if (!radioResponse.songs || radioResponse.songs.length === 0) {
        await safeRespond(interaction, '❌ Failed to generate radio playlist.');
        return;
      }

      // Ensure we're connected to voice
      try {
        await player.ensureConnected(member);
      } catch (e) {
        logger.error('[radio] Failed to connect to voice', { error: e });
        await safeRespond(interaction, '❌ Failed to join your voice channel.');
        return;
      }

      // Convert AI suggestions to tracks and enqueue them
      let queued = 0;
      let failed = 0;
      const queuedTracks: Track[] = [];

      for (const song of radioResponse.songs) {
        try {
          // Search for the song on YouTube
          const searchQuery = `${song.title} ${song.artist}`;
          const metas = await yt.resolve(searchQuery);
          
          if (metas && metas.length > 0) {
            const track = new Track({
              ...metas[0],
              requestedBy: interaction.user.username
            });
            
            const result = player.enqueue(gid, track);
            if (result.started || result.position >= 0) {
              queued++;
              queuedTracks.push(track);
            }
          } else {
            failed++;
            logger.warn('[radio] Could not find song', { song });
          }
        } catch (error) {
          failed++;
          logger.error('[radio] Failed to queue song', { error, song });
        }
      }

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('📻 Radio Playlist Generated')
        .setDescription(`Based on **${seedTrack.title}** by ${seedTrack.artist}`)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Genre', value: radioResponse.genre || 'Unknown', inline: true },
          { name: 'Mood', value: radioResponse.mood || 'Unknown', inline: true },
          { name: 'Songs Queued', value: queued.toString(), inline: true },
          { name: 'Failed to Find', value: failed.toString(), inline: true }
        );

      if (queuedTracks.length > 0) {
        const trackList = queuedTracks.slice(0, 10).map((track, i) => 
          `${i + 1}. **${track.meta.title}** - ${track.meta.author || 'Unknown'}`
        ).join('\n');
        
        embed.addFields({
          name: 'Queued Songs',
          value: trackList + (queuedTracks.length > 10 ? `\n... and ${queuedTracks.length - 10} more` : ''),
          inline: false
        });
      }

      embed.setFooter({ text: 'Powered by AI • Use /skip to skip songs' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('[radio] Command failed', { error });
      await safeRespond(interaction, '❌ Failed to generate radio playlist. Please try again.');
    }
  }
}
