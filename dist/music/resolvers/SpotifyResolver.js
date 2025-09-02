import { YouTubeExtractor } from '../extractors/YouTubeExtractor.js';
export class SpotifyResolver {
    yt = new YouTubeExtractor();
    async spotifyTrackToYouTube(track) {
        const q = [track.author, track.title].filter(Boolean).join(' - ');
        const results = await this.yt.resolve(q);
        return results[0] ?? null;
    }
}
