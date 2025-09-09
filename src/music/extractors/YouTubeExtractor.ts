import ytdl from '@distube/ytdl-core';
import yts from 'yt-search';
import ytpl from 'ytpl';
import { BaseExtractor } from './BaseExtractor.js';
import type { TrackMetadata } from '../../types.js';

// Configure ytdl with cookie if available
const cookie = process.env.YOUTUBE_COOKIE?.trim();
if (cookie) {
  console.log('[yt] YouTube cookie configured');
  // ytdl will automatically use the cookie from environment
} else {
  console.log('[yt] No YouTube cookie set - may encounter bot detection');
}

/** host helpers */
function isYouTubeHost(host: string): boolean {
  return /(^|\.)youtube\.com$/i.test(host)
    || /(^|\.)youtu\.be$/i.test(host)
    || /(^|\.)music\.youtube\.com$/i.test(host);
}
function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}
function last<T>(arr: T[] | undefined): T | undefined {
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : undefined;
}
function getListId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const list = u.searchParams.get('list');
    return list || null;
  } catch {
    return null;
  }
}

export class YouTubeExtractor extends BaseExtractor {
  /** handle any YT / YT Music URL or keywords */
  match(query: string): boolean {
    if (isUrl(query)) {
      try { return isYouTubeHost(new URL(query).hostname); } catch { return false; }
    }
    return true; // keywords → YouTube search
  }

  async resolve(query: string): Promise<TrackMetadata[]> {
    const isLink = isUrl(query);

    // ========== PLAYLIST (YouTube / YouTube Music) ==========
    if (isLink) {
      let hostOk = false;
      let listId: string | null = null;
      try {
        const u = new URL(query);
        hostOk = isYouTubeHost(u.hostname);
        listId = getListId(query);
      } catch {/* ignore */}

      if (hostOk && listId && ytpl.validateID(listId)) {
        // Try ytpl first
        try {
          const requestOptions: any = {
            headers: {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'accept-language': 'en-US,en;q=0.9',
              referer: 'https://www.youtube.com/',
            },
          };
          
          if (cookie) {
            requestOptions.headers.cookie = cookie;
          }
          
          const playlist = await ytpl(listId, {
            limit: 500,
            hl: 'en',
            gl: 'US',
            requestOptions,
          });

          const out: TrackMetadata[] = [];
          for (const raw of playlist.items as any[]) {
            const id = raw?.id;
            const title = raw?.title;
            if (!id || !title) continue;

            const url = raw.shortUrl || `https://www.youtube.com/watch?v=${id}`;
            const durationMs =
              typeof raw.durationSec === 'number' ? raw.durationSec * 1000 : undefined;

            out.push({
              title,
              url,
              durationMs,
              author: raw.author?.name ?? (playlist as any).author?.name,
              thumbnail: raw.bestThumbnail?.url,
              source: 'YOUTUBE',
            });
          }
          if (out.length) return out;
        } catch (e: any) {
          console.warn('[ytx] ytpl failed, falling back to youtubei.js:', e?.message ?? e);
        }

        // Fallback: youtubei.js (Innertube) — version-agnostic
        try {
          const mod: any = await import('youtubei.js');
          const Innertube: any = mod.Innertube ?? mod.default;
          const yt: any =
            typeof Innertube?.create === 'function' ? await Innertube.create() : new Innertube();

          let pl: any;
          if (typeof yt.getPlaylist === 'function') {
            pl = await yt.getPlaylist(listId);
          } else if (typeof yt.playlist === 'function') {
            pl = await yt.playlist(listId);
          } else if (yt.actions?.browse) {
            pl = await yt.actions.browse({ browseId: `VL${listId}` });
          }

          const items: any[] =
            pl?.items ??
            pl?.videos ??
            pl?.contents ??
            pl?.related?.contents ??
            [];

          const out: TrackMetadata[] = items
            .map((v: any) => {
              const id = v.id ?? v.video_id ?? v.videoId ?? v?.basic_info?.id;
              const url = id ? `https://www.youtube.com/watch?v=${id}` : v.url;
              const title = v.title?.text ?? v.title ?? v?.basic_info?.title;
              const author =
                v.author?.name ??
                v.authorText ??
                v?.basic_info?.author ??
                (pl?.author?.name ?? undefined);

              const durationSec =
                v.duration?.seconds ??
                v.duration_seconds ??
                v?.basic_info?.duration_seconds ??
                (typeof v.duration === 'number' ? v.duration : undefined);

              const thumbs =
                v.thumbnails ??
                v.thumbnail?.thumbnails ??
                v?.basic_info?.thumbnail ??
                [];
              const thumbUrl = last(thumbs as any[])?.url;

              if (!title || !url) return null;
              return {
                title,
                url,
                durationMs: typeof durationSec === 'number' ? durationSec * 1000 : undefined,
                author,
                thumbnail: thumbUrl,
                source: 'YOUTUBE',
              } as TrackMetadata;
            })
            .filter(Boolean) as TrackMetadata[];

          if (out.length) return out;
        } catch (e: any) {
          console.warn('[ytx] youtubei.js fallback failed:', e?.message ?? e);
        }

        return [];
      }
    }

    // ========== SINGLE VIDEO URL ==========
    if (isLink && ytdl.validateURL(query)) {
      const options: any = {};
      if (cookie) {
        options.requestOptions = {
          headers: {
            'cookie': cookie,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        };
      }
      
      const info = await ytdl.getBasicInfo(query, options);
      const v = info.videoDetails;
      const thumb = last(v.thumbnails)?.url;

      return [
        {
          title: v.title,
          url: v.video_url,
          durationMs: Number(v.lengthSeconds) * 1000,
          author: v.author?.name,
          thumbnail: thumb,
          source: 'YOUTUBE',
        },
      ];
    }

    // ========== KEYWORD SEARCH (first result) ==========
    const searchOptions: any = {};
    if (cookie) {
      searchOptions.requestOptions = {
        headers: {
          'cookie': cookie,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      };
    }
    
    const res = await yts({ query, ...searchOptions });
    const first = (res as any).videos?.[0];
    if (!first) return [];

    return [
      {
        title: first.title,
        url: first.url,
        durationMs: first.seconds ? first.seconds * 1000 : undefined,
        author: first.author?.name,
        thumbnail: first.thumbnail,
        source: 'YOUTUBE',
      },
    ];
  }
}
