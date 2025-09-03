import SpotifyWebApi from 'spotify-web-api-node';
import { BaseExtractor } from './BaseExtractor.js';
import type { TrackMetadata } from '../../types.js';
import { Config } from '../../config.js';

/**
 * Minimal, type-safe-enough Spotify extractor that works in prod builds
 * without @types/spotify-web-api-node. We avoid referencing SpotifyApi.* types.
 */

const MARKET = 'US';

function isSpotifyUrl(input: string): boolean {
  try {
    if (input.startsWith('spotify:')) return true;
    const u = new URL(input);
    return /(^|\.)spotify\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function parseSpotifyId(input: string): { kind: 'track'|'playlist'|'album'|'artist'|null; id: string|null } {
  // Handle "spotify:<type>:<id>" URIs
  if (input.startsWith('spotify:')) {
    const parts = input.split(':'); // spotify:track:<id>
    const kind = parts[1] as any;
    const id = parts[2] ?? null;
    if (id && (kind === 'track' || kind === 'playlist' || kind === 'album' || kind === 'artist')) {
      return { kind, id };
    }
    return { kind: null, id: null };
  }

  // Handle https://open.spotify.com/<type>/<id>
  try {
    const u = new URL(input);
    const [ , kind, id ] = u.pathname.split('/'); // ["", "track", "<id>"]
    if (id && (kind === 'track' || kind === 'playlist' || kind === 'album' || kind === 'artist')) {
      // Strip any extra suffix like "?si=..."
      return { kind: kind as any, id: id.split('?')[0] };
    }
  } catch { /* ignore */ }

  return { kind: null, id: null };
}

function trackToMeta(t: any): TrackMetadata | null {
  if (!t) return null;
  const title = t.name as string;
  const url = t.external_urls?.spotify as string | undefined;
  const durationMs = typeof t.duration_ms === 'number' ? t.duration_ms : undefined;
  const artists = Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : undefined;
  const thumb =
    Array.isArray(t.album?.images) && t.album.images.length > 0
      ? t.album.images[0].url
      : undefined;

  if (!title || !url) return null;
  return {
    title,
    url,
    durationMs,
    author: artists,
    thumbnail: thumb,
    source: 'SPOTIFY',
  };
}

export class SpotifyExtractor extends BaseExtractor {
  private api: any | null = null;
  private tokenExpiresAt = 0;

  match(query: string): boolean {
    return isSpotifyUrl(query);
  }

  private async ensureClient(): Promise<any> {
    if (!this.api) {
      this.api = new SpotifyWebApi({
        clientId: Config.spotify.clientId,
        clientSecret: Config.spotify.clientSecret,
      });
    }
    // Refresh client-credentials token if missing/expired
    const now = Date.now();
    if (now >= this.tokenExpiresAt) {
      if (!Config.spotify.clientId || !Config.spotify.clientSecret) {
        throw new Error('Spotify credentials missing (set SPOTIFY_CLIENT_ID/SECRET).');
      }
      const data = await this.api.clientCredentialsGrant();
      const accessToken = data?.body?.access_token ?? data?.access_token;
      const expiresIn = (data?.body?.expires_in ?? data?.expires_in ?? 3600) as number;
      if (!accessToken) throw new Error('Failed to get Spotify access token.');
      this.api.setAccessToken(accessToken);
      this.tokenExpiresAt = now + (expiresIn - 30) * 1000; // refresh a bit early
    }
    return this.api;
  }

  async resolve(query: string): Promise<TrackMetadata[]> {
    const { kind, id } = parseSpotifyId(query);
    if (!kind || !id) return [];

    const api = await this.ensureClient();

    switch (kind) {
      case 'track': {
        const res = await api.getTrack(id);
        const meta = trackToMeta(res?.body ?? res);
        return meta ? [meta] : [];
      }
      case 'playlist': {
        // Paginate playlist tracks (100 per request)
        const out: TrackMetadata[] = [];
        let offset = 0;
        const limit = 100;
        // Some SDK versions expose res.body, others just res; normalize with ??
        for (;;) {
          const res = await api.getPlaylistTracks(id, { offset, limit, market: MARKET });
          const items: any[] =
            res?.body?.items ??
            res?.items ??
            [];
          for (const it of items) {
            const t = it?.track;
            const meta = trackToMeta(t);
            if (meta) out.push(meta);
          }
          const total: number =
            res?.body?.total ?? res?.total ?? out.length;
          offset += items.length;
          if (offset >= total || items.length === 0) break;
        }
        return out;
      }
      case 'album': {
        // Get all album tracks; we also fetch album once for images
        const album = await api.getAlbum(id, { market: MARKET });
        const albumBody: any = album?.body ?? album;
        const images: any[] = albumBody?.images ?? [];
        const defaultThumb = images.length ? images[0]?.url : undefined;

        const out: TrackMetadata[] = [];
        let offset = 0;
        const limit = 50;
        for (;;) {
          const res = await api.getAlbumTracks(id, { offset, limit, market: MARKET });
          const items: any[] =
            res?.body?.items ??
            res?.items ??
            [];
          for (const t of items) {
            const meta = trackToMeta({ ...t, album: { images } });
            if (meta) out.push(meta);
          }
          const total: number =
            res?.body?.total ?? res?.total ?? out.length;
          offset += items.length;
          if (offset >= total || items.length === 0) break;
        }
        // Fill thumbnails if missing
        if (defaultThumb) {
          for (const m of out) if (!m.thumbnail) m.thumbnail = defaultThumb;
        }
        return out;
      }
      case 'artist': {
        // Use top tracks for the artist in a market
        const res = await api.getArtistTopTracks(id, MARKET);
        const tracks: any[] = res?.body?.tracks ?? res?.tracks ?? [];
        const out: TrackMetadata[] = [];
        for (const t of tracks) {
          const meta = trackToMeta(t);
          if (meta) out.push(meta);
        }
        return out;
      }
      default:
        return [];
    }
  }
}
