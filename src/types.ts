export type PlayableSource = 'YOUTUBE' | 'SPOTIFY';

export interface TrackMetadata {
  title: string;
  url: string;          // original (YT or Spotify)
  durationMs?: number;
  author?: string;
  thumbnail?: string;
  source: PlayableSource;
  requestedBy?: string; // username/id
}

export interface ResolvedStream {
  streamUrl: string;    // direct YT audio stream URL
  isLive?: boolean;
}
