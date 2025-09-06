import * as playdl from 'play-dl';

/**
 * Configure play-dl to use your real YouTube cookie.
 * Env:
 *  - YOUTUBE_COOKIE=<the full "cookie" header string from youtube.com>
 *
 * NOTE: identity token is NOT a typed option in play-dl. We'll attach it only
 * in the ytdl fallback headers inside Player.ts.
 */
export async function initYouTubeTokens(): Promise<void> {
  const cookie = process.env.YOUTUBE_COOKIE?.trim();

  if (cookie) {
    await playdl.setToken({
      youtube: { cookie }, // <- only cookie is supported/typed here
    });
    console.log('[yt] play-dl cookie configured');
  } else {
    console.warn('[yt] No YOUTUBE_COOKIE set — YouTube may block requests with “confirm you’re not a bot”.');
  }
}

