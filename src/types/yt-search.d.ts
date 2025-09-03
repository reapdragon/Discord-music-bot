// Minimal-but-useful typings for yt-search.
// Place this file at: src/types/yt-search.d.ts

declare module 'yt-search' {
  // Common pieces
  export interface YTAuthor {
    name?: string;
    url?: string;
  }

  export interface YTBaseItem {
    type?: 'video' | 'channel' | 'list' | 'live';
    title: string;
    url: string;
    timestamp?: string;   // e.g. "3:32"
    duration?: string;    // alias of timestamp
    seconds?: number;     // duration in seconds
    views?: number;
    author?: YTAuthor;
    thumbnail?: string;   // aka image
    image?: string;       // some versions use image
  }

  export interface YTVideo extends YTBaseItem {
    type?: 'video';
  }

  export interface YTLive extends YTBaseItem {
    type?: 'live';
  }

  export interface YTChannel extends YTBaseItem {
    type?: 'channel';
  }

  export interface YTPlaylist extends YTBaseItem {
    type?: 'list';
    videoCount?: number;
  }

  export interface YTSearchResult {
    videos: YTVideo[];
    live: YTLive[];
    channels: YTChannel[];
    playlists: YTPlaylist[];
    all: (YTVideo | YTLive | YTChannel | YTPlaylist)[];
  }

  export interface YTSearchOptions {
    query: string;
    // you can add more fields if you use them, e.g.:
    // gl?: string; // region
    // hl?: string; // language
  }

  // Default export function: accepts a string or an options object
  function yts(query: string | YTSearchOptions): Promise<YTSearchResult>;
  export default yts;
}
