import yts from 'yt-search';
import ytpl from 'ytpl';
import { BaseExtractor } from './BaseExtractor.js';
/** host helpers */
function isYouTubeHost(host) {
    return /(^|\.)youtube\.com$/i.test(host)
        || /(^|\.)youtu\.be$/i.test(host)
        || /(^|\.)music\.youtube\.com$/i.test(host);
}
function isUrl(s) {
    return /^https?:\/\//i.test(s);
}
function last(arr) {
    return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : undefined;
}
function getListId(urlStr) {
    try {
        const u = new URL(urlStr);
        const list = u.searchParams.get('list');
        return list || null;
    }
    catch {
        return null;
    }
}
export class YouTubeExtractor extends BaseExtractor {
    /** handle any YT / YT Music URL or keywords */
    match(query) {
        if (isUrl(query)) {
            try {
                return isYouTubeHost(new URL(query).hostname);
            }
            catch {
                return false;
            }
        }
        return true; // keywords → YouTube search
    }
    async resolve(query) {
        const isLink = isUrl(query);
        // ========== PLAYLIST (YouTube / YouTube Music) ==========
        if (isLink) {
            let hostOk = false;
            let listId = null;
            try {
                const u = new URL(query);
                hostOk = isYouTubeHost(u.hostname);
                listId = getListId(query);
            }
            catch { /* ignore */ }
            if (hostOk && listId && ytpl.validateID(listId)) {
                // Try ytpl first
                try {
                    const playlist = await ytpl(listId, {
                        limit: 500,
                        hl: 'en',
                        gl: 'US',
                        requestOptions: {
                            headers: {
                                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'accept-language': 'en-US,en;q=0.9',
                                referer: 'https://www.youtube.com/',
                            },
                        },
                    });
                    const out = [];
                    for (const raw of playlist.items) {
                        const id = raw?.id;
                        const title = raw?.title;
                        if (!id || !title)
                            continue;
                        const url = raw.shortUrl || `https://www.youtube.com/watch?v=${id}`;
                        const durationMs = typeof raw.durationSec === 'number' ? raw.durationSec * 1000 : undefined;
                        out.push({
                            title,
                            url,
                            durationMs,
                            author: raw.author?.name ?? playlist.author?.name,
                            thumbnail: raw.bestThumbnail?.url,
                            source: 'YOUTUBE',
                        });
                    }
                    if (out.length)
                        return out;
                }
                catch (e) {
                    console.warn('[ytx] ytpl failed, falling back to youtubei.js:', e?.message ?? e);
                }
                // Fallback: youtubei.js (Innertube) — version-agnostic
                try {
                    const mod = await import('youtubei.js');
                    const Innertube = mod.Innertube ?? mod.default;
                    const yt = typeof Innertube?.create === 'function' ? await Innertube.create() : new Innertube();
                    let pl;
                    if (typeof yt.getPlaylist === 'function') {
                        pl = await yt.getPlaylist(listId);
                    }
                    else if (typeof yt.playlist === 'function') {
                        pl = await yt.playlist(listId);
                    }
                    else if (yt.actions?.browse) {
                        pl = await yt.actions.browse({ browseId: `VL${listId}` });
                    }
                    const items = pl?.items ??
                        pl?.videos ??
                        pl?.contents ??
                        pl?.related?.contents ??
                        [];
                    const out = items
                        .map((v) => {
                        const id = v.id ?? v.video_id ?? v.videoId ?? v?.basic_info?.id;
                        const url = id ? `https://www.youtube.com/watch?v=${id}` : v.url;
                        const title = v.title?.text ?? v.title ?? v?.basic_info?.title;
                        const author = v.author?.name ??
                            v.authorText ??
                            v?.basic_info?.author ??
                            (pl?.author?.name ?? undefined);
                        const durationSec = v.duration?.seconds ??
                            v.duration_seconds ??
                            v?.basic_info?.duration_seconds ??
                            (typeof v.duration === 'number' ? v.duration : undefined);
                        const thumbs = v.thumbnails ??
                            v.thumbnail?.thumbnails ??
                            v?.basic_info?.thumbnail ??
                            [];
                        const thumbUrl = last(thumbs)?.url;
                        if (!title || !url)
                            return null;
                        return {
                            title,
                            url,
                            durationMs: typeof durationSec === 'number' ? durationSec * 1000 : undefined,
                            author,
                            thumbnail: thumbUrl,
                            source: 'YOUTUBE',
                        };
                    })
                        .filter(Boolean);
                    if (out.length)
                        return out;
                }
                catch (e) {
                    console.warn('[ytx] youtubei.js fallback failed:', e?.message ?? e);
                }
                return [];
            }
        }
        // ========== SINGLE VIDEO URL ==========
        if (isLink) {
            // For single video URLs, use yt-search to get metadata
            try {
                const res = await yts(query);
                const first = res.videos?.[0];
                if (first) {
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
            catch (e) {
                console.warn('[ytx] Failed to resolve single video URL:', e);
            }
        }
        // ========== KEYWORD SEARCH (first result) ==========
        const res = await yts(query);
        const first = res.videos?.[0];
        if (!first)
            return [];
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
