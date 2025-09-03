import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  demuxProbe,
  StreamType,
  type AudioResource,
  type DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import type { GuildMember, VoiceBasedChannel } from 'discord.js';
import { Readable } from 'node:stream';
import ytdl from '@distube/ytdl-core';
import { Track } from './Track.js';
import { Queue } from './Queue.js';

type GuildSession = {
  player: AudioPlayer;
  queue: Queue;
  connection: VoiceConnection | null;
  current: Track | null;
  suppressIdleOnce: boolean;
  cleanupCurrent?: () => void;
};

type BuiltResource = { resource: AudioResource; cleanup: () => void };
type WebmPick = { type: 'webm/opus' | 'unknown'; stream: Readable };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export class Player {
  private sessions = new Map<string, GuildSession>();

  private getOrCreateSession(guildId: string): GuildSession {
    let s = this.sessions.get(guildId);
    if (s) return s;

    const queue = new Queue();
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    player.on('stateChange', (oldS, newS) => {
      console.log(`[audio] ${guildId}: ${oldS.status} -> ${newS.status}`);
    });

    player.on('error', (e) => {
      console.error(`[audio:error] ${guildId}`, e);
      const sess = this.sessions.get(guildId);
      if (!sess) return;
      const next = sess.queue.dequeue();
      if (next) {
        sess.suppressIdleOnce = true;
        try { sess.cleanupCurrent?.(); } catch {}
        sess.cleanupCurrent = undefined;
        sess.current = next;
        this.playNow(guildId, next).catch((err) => console.error('[playNow:error]', err));
      } else {
        sess.current = null;
        try { sess.player.stop(true); } catch {}
      }
    });

    player.on(AudioPlayerStatus.Idle, () => {
      const sess = this.sessions.get(guildId);
      if (!sess) return;
      if (sess.suppressIdleOnce) { sess.suppressIdleOnce = false; return; }
      const next = sess.queue.dequeue();
      if (next) {
        console.log('[player] idle -> next:', next.meta.title);
        sess.current = next;
        this.playNow(guildId, next).catch((e) => console.error('[playNow:error]', e));
      } else {
        console.log('[player] idle -> queue empty');
        sess.current = null;
      }
    });

    s = { player, queue, connection: null, current: null, suppressIdleOnce: false };
    this.sessions.set(guildId, s);
    return s;
  }

  private attachConnDebug(conn: VoiceConnection, guildId: string): void {
    conn.on('stateChange', (o, n) => {
      console.log(`[voice] ${guildId}: ${o.status} -> ${n.status}`);
    });
  }

  async connect(member: GuildMember, channel?: VoiceBasedChannel): Promise<VoiceConnection> {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');

    const session = this.getOrCreateSession(vc.guild.id);
    console.log('[player] joinVoiceChannel ->', vc.name);

    const conn = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
    });

    this.attachConnDebug(conn, vc.guild.id);

    console.log('[player] waiting for Voice Ready…');
    await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
    console.log('[player] voice Ready');

    session.connection = conn;
    conn.subscribe(session.player);
    console.log('[player] subscribed player to connection');
    return conn;
  }

  async ensureConnected(member: GuildMember, channel?: VoiceBasedChannel): Promise<void> {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');
    const s = this.sessions.get(vc.guild.id);
    if (!s || !s.connection) await this.connect(member, channel);
  }

  enqueue(guildId: string, track: Track): { started: boolean; position: number } {
    const s = this.getOrCreateSession(guildId);
    const somethingPlaying =
      s.player.state.status === AudioPlayerStatus.Playing ||
      s.player.state.status === AudioPlayerStatus.Buffering ||
      !!s.current;

    if (somethingPlaying) {
      s.queue.enqueue(track);
      console.log('[queue] +', track.meta.title, '(pos', s.queue.tracks.length, ')');
      return { started: false, position: s.queue.tracks.length };
    }

    s.current = track;
    this.playNow(guildId, track).catch((e) => console.error('[playNow:error]', e));
    return { started: true, position: 0 };
  }

  skip(guildId: string): { action: 'skipped' | 'stopped' | 'noop'; nextTitle?: string } {
    const s = this.sessions.get(guildId);
    if (!s) return { action: 'noop' };

    const next = s.queue.dequeue();
    if (next) {
      s.suppressIdleOnce = true;
      try { s.cleanupCurrent?.(); } catch {}
      s.cleanupCurrent = undefined;
      s.current = next;
      try { s.player.stop(true); } catch {}
      this.playNow(guildId, next).catch((e) => console.error('[playNow:error]', e));
      return { action: 'skipped', nextTitle: next.meta.title };
    } else {
      s.suppressIdleOnce = true;
      try { s.cleanupCurrent?.(); } catch {}
      s.cleanupCurrent = undefined;
      s.current = null;
      try { s.player.stop(true); } catch {}
      return { action: 'stopped' };
    }
  }

  stop(guildId: string, opts: { disconnect?: boolean } = {}): { action: 'stopped' | 'noop' } {
    const s = this.sessions.get(guildId);
    if (!s) return { action: 'noop' };

    s.queue.clear();
    s.suppressIdleOnce = true;
    try { s.cleanupCurrent?.(); } catch {}
    s.cleanupCurrent = undefined;
    s.current = null;
    try { s.player.stop(true); } catch {}

    if (opts.disconnect !== false && s.connection) {
      try { s.connection.destroy(); } catch {}
      s.connection = null;
    }
    return { action: 'stopped' };
  }

  // ---------- Stream building (no ffmpeg on Render Free) ----------

  // Prefer WebM/Opus to avoid transcoding
  private async getWebmOpusStream(url: string): Promise<WebmPick> {
    const info: any = await ytdl.getInfo(url, {
      requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
    });

    const opus = info.formats
      .filter((f: any) => (f.mimeType || '').includes('audio/webm') && (f.codecs || '').includes('opus'))
      .sort((a: any, b: any) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    if (opus[0]) {
      console.log('[ytdl] chosen itag', opus[0].itag, opus[0].mimeType, opus[0].audioBitrate, 'kbps');
      const stream = ytdl.downloadFromInfo(info, {
        format: opus[0],
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
        requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
      }) as unknown as Readable;
      return { type: 'webm/opus', stream };
    }

    // Fallback: generic audioonly (may be m4a). We'll demuxProbe later.
    console.log('[ytdl] no opus/webm format; falling back to audioonly');
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
    }) as unknown as Readable;
    return { type: 'unknown', stream };
  }

  // Retry/backoff for 429/503 around the whole build step
  private async buildResource(url: string, attempt = 1): Promise<BuiltResource> {
    try {
      const got = await this.getWebmOpusStream(url);
      if (got.type === 'webm/opus') {
        const resource = createAudioResource(got.stream, { inputType: StreamType.WebmOpus });
        const cleanup = () => { try { (got.stream as any).destroy?.(); } catch {} };
        return { resource, cleanup };
      } else {
        const { stream: probed, type } = await demuxProbe(got.stream);
        const resource = createAudioResource(probed, { inputType: type });
        const cleanup = () => { try { (probed as any).destroy?.(); } catch {} };
        return { resource, cleanup };
      }
    } catch (e: any) {
      const sc: number = e?.statusCode ?? e?.status ?? 0;
      if ((sc === 429 || sc === 503) && attempt < 3) {
        const ms = 1000 * attempt;
        console.warn(`[ytdl] ${sc} building resource — retrying in ${ms}ms (attempt ${attempt + 1}/3)`);
        await new Promise((r) => setTimeout(r, ms));
        return this.buildResource(url, attempt + 1);
      }
      throw e;
    }
  }

  private async playNow(guildId: string, track: Track): Promise<void> {
    const s = this.getOrCreateSession(guildId);
    if (!s.connection) throw new Error('Not connected to a voice channel.');

    console.log('[playNow] starting:', track.meta.title, track.meta.url);

    try {
      const { resource, cleanup } = await this.buildResource(track.meta.url);
      s.cleanupCurrent = cleanup;
      s.player.play(resource);

      // If we never transition to Playing in 6s, assume stream failed silently
      setTimeout(() => {
        if (s.player.state.status !== AudioPlayerStatus.Playing) {
          console.warn('[playNow] not playing after 6s — attempting next track');
          const next = s.queue.dequeue();
          if (next) {
            s.current = next;
            this.playNow(guildId, next).catch((err) => console.error('[playNow:next:error]', err));
          }
        }
      }, 6000);
    } catch (e) {
      console.error('[playNow:error]', e);
      const next = s.queue.dequeue();
      if (next) {
        s.current = next;
        this.playNow(guildId, next).catch((err) => console.error('[playNow:next:error]', err));
      } else {
        s.current = null;
      }
    }
  }

  getSession(guildId: string): GuildSession | null {
    return this.sessions.get(guildId) ?? null;
  }
}

export const player = new Player();
