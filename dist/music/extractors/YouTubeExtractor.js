import ytdl from '@distube/ytdl-core';
import yts from 'yt-search';

export class YouTubeExtractor {
  static YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

  match(query) {
    return YouTubeExtractor.YT_REGEX.test(query) || !/^https?:\/\//i.test(query);
  }

  async resolve(query) {
    // Direct URL
    if (/^https?:\/\//i.test(query) && ytdl.validateURL(query)) {
      const info = await ytdl.getBasicInfo(query);
      const v = info.videoDetails;
      const thumb = Array.isArray(v.thumbnails) && v.thumbnails.length
        ? v.thumbnails[v.thumbnails.length - 1].url
        : undefined;

      return [{
        title: v.title,
        url: v.video_url,
        durationMs: Number(v.lengthSeconds) * 1000,
        author: v.author?.name,
        thumbnail: thumb,
        source: 'YOUTUBE'
      }];
    }

    // Keyword search
    const res = await yts(query);
    const first = res.videos?.[0];
    if (!first) return [];

    return [{
      title: first.title,
      url: first.url,
      durationMs: first.seconds ? first.seconds * 1000 : undefined,
      author: first.author?.name,
      thumbnail: first.thumbnail,
      source: 'YOUTUBE'
    }];
  }
}
