import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  entersState,
  joinVoiceChannel,
  StreamType,
  type DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import type { GuildMember, VoiceBasedChannel } from 'discord.js';

import * as playdl from 'play-dl';
import ytdl from '@distube/ytdl-core';

import { Queue } from './Queue.js';
import type { Track } from './Track.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const YT_COOKIE = (process.env.YOUTUBE_COOKIE ?? '').trim();
const YT_ID_TOKEN = (process.env.YOUTUBE_IDENTITY_TOKEN ?? '').trim();

type GuildSession = {
  player: AudioPlayer;
  queue: Queue;
  connection: VoiceConnection | null;
  current: Track | null;
};

export class Player {
  private sessions = new Map<string, GuildSession>();
  private starting = new Set<string>();

  private getOrCreateSession(guildId: string): GuildSession {
    let s = this.sessions.get(guildId);
    if (s) return s;

    const queue = new Queue();
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    player.on('stateChange', (o, n) => {
      console.log(`[audio] ${guildId}: ${o.status} -> ${n.status}`);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      const sess = this.sessions.get(guildId);
      if (!sess) return;

      const next = sess.queue.dequeue();
      sess.current = next ?? null;

      if (next) {
        console.log('[player] idle -> next:', next.meta.title);
        this.play(guildId, next).catch((e) =>
          console.error('[player] auto-next failed:', e),
        );
      } else {
        console.log('[player] idle -> queue empty');
      }
    });

    player.on('error', (e) => console.error('[audio:error]', guildId, e));

    s = { player, queue, connection: null, current: null };
    this.sessions.set(guildId, s);
    return s;
  }

  async connect(member: GuildMember, channel?: VoiceBasedChannel): Promise<VoiceConnection> {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');

    const s = this.getOrCreateSession(vc.guild.id);

    const conn = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: true,
    });

    conn.on('stateChange', (oldS, newS) => {
      console.log(`[voice] ${vc.guild.id}: ${oldS.status} -> ${newS.status}`);
    });

    console.log('[player] joinVoiceChannel ->', vc.name);
    await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
    console.log('[player] voice Ready');

    s.connection = conn;
    conn.subscribe(s.player);
    return conn;
  }

  enqueue(guildId: string, track: Track): { started: boolean; position: number } {
    const s = this.getOrCreateSession(guildId);
    s.queue.enqueue(track);
    const position = Math.max(0, s.queue.length - 1);

    const started = this.maybeStart(guildId);

    console.log('[queue] +', track.meta.title, `(pos ${position}${started ? ', started' : ''})`);
    return { started, position };
  }

  private maybeStart(guildId: string): boolean {
    const s = this.getOrCreateSession(guildId);

    const status = s.player.state.status;
    const busy =
      status === AudioPlayerStatus.Playing ||
      status === AudioPlayerStatus.Buffering ||
      this.starting.has(guildId);

    if (busy) {
      console.log('[maybeStart] busy=', { status, starting: this.starting.has(guildId) });
      return false;
    }

    let next = s.current ?? undefined;
    if (!next) {
      next = s.queue.dequeue();
      s.current = next ?? null;
    }

    if (!next) {
      console.log('[maybeStart] nothing to play (queue empty)');
      return false;
    }

    this.starting.add(guildId);
    console.log('[maybeStart] starting ->', next.meta.title);

    this.play(guildId, next)
      .catch((e) => console.error('[player] start failed:', e))
      .finally(() => this.starting.delete(guildId));

    return true;
  }

  async play(guildId: string, track: Track): Promise<void> {
    const s = this.getOrCreateSession(guildId);
    if (!s.connection) throw new Error('Not connected to a voice channel.');

    try {
      const { resource, cleanup } = await this.buildResource(track.meta.url);
      s.player.play(resource);
      s.current = track;

      const onDone = () => {
        try { cleanup?.(); } catch {}
        s.player.off(AudioPlayerStatus.Idle, onDone);
        s.player.off('error', onDone as any);
      };
      s.player.once(AudioPlayerStatus.Idle, onDone);
      s.player.once('error', onDone as any);
    } catch (err: any) {
      console.warn('[player] play failed for', track.meta.url, '-', err?.message ?? err);
      s.current = null;
      const next = s.queue.dequeue();
      if (next) {
        console.log('[player] skipping blocked track -> trying next:', next.meta.title);
        this.maybeStart(guildId);
      } else {
        console.log('[player] no playable items left');
      }
    }
  }

  skip(guildId: string): void {
    const s = this.sessions.get(guildId);
    if (!s) return;
    s.player.stop(true);
  }

  stop(guildId: string): void {
    const s = this.sessions.get(guildId);
    if (!s) return;
    s.queue.clear();
    s.current = null;
    s.player.stop(true);
  }

  async ensureConnected(member: GuildMember, channel?: VoiceBasedChannel): Promise<void> {
    const gid = (channel ?? member.voice.channel)?.guild.id;
    if (!gid) throw new Error('Join a voice channel first.');
    const s = this.sessions.get(gid);
    if (!s || !s.connection) await this.connect(member, channel);
  }

  private async buildResource(url: string): Promise<{
    resource: ReturnType<typeof createAudioResource>;
    cleanup: () => void;
  }> {
    // 1) Try play-dl first (uses cookie set in initYouTubeTokens)
    try {
      const pl = await playdl.stream(url);
      const { stream: probed, type } = await demuxProbe(pl.stream);
      const resource = createAudioResource(probed, { inputType: type });
      const cleanup = () => {
        try { (pl.stream as any)?.destroy?.(); } catch {}
      };
      return { resource, cleanup };
    } catch (e) {
      console.warn('[player] play-dl failed, falling back to ytdl:', (e as Error)?.message ?? e);
    }

    // 2) Fallback: ytdl-core with cookie + UA (+ optional identity token)
    const headers: Record<string, string> = {
      'user-agent': UA,
      'accept-language': 'en-US,en;q=0.9',
    };
    if (YT_COOKIE) headers.cookie = YT_COOKIE;
    if (YT_ID_TOKEN) headers['x-youtube-identity-token'] = YT_ID_TOKEN;

    const ystream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      requestOptions: { headers },
    });

    const { stream: probed, type } = await demuxProbe(ystream);
    const resource = createAudioResource(probed, {
      inputType: type ?? StreamType.Arbitrary,
    });
    const cleanup = () => {
      try { (ystream as any)?.destroy?.(); } catch {}
    };
    return { resource, cleanup };
  }
}

export const player = new Player();
