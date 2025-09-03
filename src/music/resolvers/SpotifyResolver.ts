import type { TrackMetadata } from '../../types.js';
import { YouTubeExtractor } from '../extractors/YouTubeExtractor.js';

export class SpotifyResolver {
  private yt = new YouTubeExtractor();

  async spotifyTrackToYouTube(track: TrackMetadata): Promise<TrackMetadata | null> {
    const q = [track.author, track.title].filter(Boolean).join(' - ');
    const results = await this.yt.resolve(q);
    return results[0] ?? null;
  }
}

