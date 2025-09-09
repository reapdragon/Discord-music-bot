import type { ResolvedStream } from '../../types.js';

export class YouTubeResolver {
  async resolveStream(url: string): Promise<ResolvedStream> {
    // play-dl handles the stream URL internally; we'll pipe into createAudioResource
    // Returning a dummy value for interface completeness
    return { streamUrl: url };
  }
}
