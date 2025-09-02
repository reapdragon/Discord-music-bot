import SpotifyWebApi from 'spotify-web-api-node';
import { BaseExtractor } from './BaseExtractor.js';
import type { TrackMetadata } from '../../types.js';
import { Config } from '../../config.js';

const spotify = new SpotifyWebApi({
  clientId: Config.spotify.clientId,
  clientSecret: Config.spotify.clientSecret,
});

async function ensureToken(): Promise<void> {
  const token = spotify.getAccessToken();
  if (!token) {
    const { body } = await spotify.clientCredentialsGrant();
    spotify.setAccessToken(body.access_token);
  }
}

function parseSpotifyId(query: string): { type: 'track' | 'playlist' | 'album' | null, id: string | null } {
  try {
    if (/^spotify:/i.test(query)) {
      // spotify:track:ID or spotify:playlist:ID or spotify:album:ID
      const [, type, id] = query.split(':');
      if (type && id) return { type: type as any, id };
      return { type: null, id: null };
    }
    const url = new URL(query);
    if (!/open\.spotify\.com$/i.test(url.host)) return { type: null, id: null };
    const parts = url.pathname.split('/').filter(Boolean); // ['track','id']
    const type = (parts[0] ?? '') as 'track' | 'playlist' | 'album';
    const id = parts[1] ?? null;
    return { type: ['track','playlist','album'].includes(type) ? type : null, id };
  } catch {
    return { type: null, id: null };
  }
}

export class SpotifyExtractor extends BaseExtractor {
  match(query: string): boolean {
    return /open\.spotify\.com/i.test(query) || /^spotify:(track|playlist|album):/i.test(query);
  }

  async resolve(query: string): Promise<TrackMetadata[]> {
    await ensureToken();
    const { type, id } = parseSpotifyId(query);
    if (!type || !id) return [];

    if (type === 'track') {
      const { body: t } = await spotify.getTrack(id);
      return [{
        title: t.name,
        url: `https://open.spotify.com/track/${t.id}`,
        durationMs: t.duration_ms,
        author: t.artists.map(a => a.name).join(', '),
        thumbnail: t.album.images?.[0]?.url,
        source: 'SPOTIFY'
      }];
    }

    if (type === 'playlist') {
      // Page through playlist tracks
      const out: TrackMetadata[] = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const { body: p } = await spotify.getPlaylistTracks(id, { offset, limit });
        for (const item of p.items) {
          const t = (item.track as SpotifyApi.TrackObjectFull | null);
          if (!t) continue;
          out.push({
            title: t.name,
            url: `https://open.spotify.com/track/${t.id}`,
            durationMs: t.duration_ms,
            author: t.artists.map(a => a.name).join(', '),
            thumbnail: t.album.images?.[0]?.url,
            source: 'SPOTIFY'
          });
        }
        if (p.items.length < limit) break;
        offset += limit;
      }
      return out;
    }

    if (type === 'album') {
      // Fetch album tracks (paged)
      const out: TrackMetadata[] = [];
      let offset = 0;
      const limit = 50;
      const { body: album } = await spotify.getAlbum(id);
      while (true) {
        const { body: tr } = await spotify.getAlbumTracks(id, { limit, offset });
        for (const t of tr.items) {
          out.push({
            title: t.name,
            url: `https://open.spotify.com/track/${t.id}`,
            durationMs: t.duration_ms,
            author: t.artists.map(a => a.name).join(', '),
            thumbnail: album.images?.[0]?.url,
            source: 'SPOTIFY'
          });
        }
        if (tr.items.length < limit) break;
        offset += limit;
      }
      return out;
    }

    return [];
  }
}
