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
  type DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import type { GuildMember, VoiceBasedChannel } from 'discord.js';
import ytdl from '@distube/ytdl-core';
import { Track } from './Track.js';
import { Queue } from './Queue.js';

type GuildSession = {
  player: AudioPlayer;
  queue: Queue;
  connection: VoiceConnection | null;
  current: Track | null;            // track currently playing (or being prepared)
  suppressIdleOnce: boolean;        // ignore next Idle emitted by manual stop/skip
  cleanupCurrent?: () => void;      // destroys the current ytdl stream
};

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
    player.on('error', (e) => console.error(`[audio:error] ${guildId}`, e));

    player.on(AudioPlayerStatus.Idle, () => {
      const sess = this.sessions.get(guildId);
      if (!sess) return;

      // If we intentionally stopped or skipped, ignore this Idle bounce.
      if (sess.suppressIdleOnce) {
        sess.suppressIdleOnce = false;
        return;
      }

      const next = sess.queue.dequeue();
      if (next) {
        console.log('[player] idle -> next:', next.meta.title);
        sess.current = next; // mark immediately to avoid race
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

  private attachConnDebug(conn: VoiceConnection, guildId: string) {
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

  async ensureConnected(member: GuildMember, channel?: VoiceBasedChannel) {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');
    const s = this.sessions.get(vc.guild.id);
    if (!s || !s.connection) await this.connect(member, channel);
  }

  /** Queue a track. If nothing is playing, start immediately. */
  enqueue(guildId: string, track: Track): { started: boolean; position: number } {
    const s = this.getOrCreateSession(guildId);
    const somethingPlaying =
      s.player.state.status === AudioPlayerStatus.Playing ||
      s.player.state.status === AudioPlayerStatus.Buffering ||
      !!s.current;

    console.log('[player] enqueue BEFORE', {
      title: track.meta.title,
      somethingPlaying,
      qlen: s.queue.tracks.length,
    });

    if (somethingPlaying) {
      s.queue.enqueue(track);
      console.log('[player] enqueue AFTER', { qlen: s.queue.tracks.length });
      return { started: false, position: s.queue.tracks.length }; // 1-based
    }

    // Mark current BEFORE async preparation to prevent a stampede of "started".
    s.current = track;
    console.log('[player] nothing playing, starting now:', track.meta.title);
    this.playNow(guildId, track).catch((e) => console.error('[playNow:error]', e));
    return { started: true, position: 0 };
  }

  /** Skip current track; if queue has next, start it immediately. */
  skip(guildId: string): { action: 'skipped' | 'stopped' | 'noop'; nextTitle?: string } {
    const s = this.sessions.get(guildId);
    if (!s) return { action: 'noop' };

    const next = s.queue.dequeue();
    if (next) {
      s.suppressIdleOnce = true;        // ignore Idle emitted by stop(true)
      // Kill current stream cleanly
      try { s.cleanupCurrent?.(); } catch {}
      s.cleanupCurrent = undefined;

      s.current = next;
      console.log('[player] skip -> next:', next.meta.title);
      try { s.player.stop(true); } catch {}
      this.playNow(guildId, next).catch((e) => console.error('[playNow:error]', e));
      return { action: 'skipped', nextTitle: next.meta.title };
    } else {
      console.log('[player] skip -> no next, stopping');
      s.suppressIdleOnce = true;
      try { s.cleanupCurrent?.(); } catch {}
      s.cleanupCurrent = undefined;
      s.current = null;
      try { s.player.stop(true); } catch {}
      return { action: 'stopped' };
    }
  }

  /** Stop playback, clear queue, and optionally disconnect from voice. */
  stop(guildId: string, opts: { disconnect?: boolean } = {}): { action: 'stopped' | 'noop' } {
    const s = this.sessions.get(guildId);
    if (!s) return { action: 'noop' };

    console.log('[player] stop -> clearing queue and stopping player');
    s.queue.clear();
    s.suppressIdleOnce = true;      // ignore the Idle from stop(true)
    try { s.cleanupCurrent?.(); } catch {}
    s.cleanupCurrent = undefined;
    s.current = null;

    try { s.player.stop(true); } catch {}

    if (opts.disconnect !== false && s.connection) {
      console.log('[player] stop -> destroying voice connection');
      try { s.connection.destroy(); } catch {}
      s.connection = null;
    }

    return { action: 'stopped' };
  }

  /** Build an audio resource with proper demux (Opus/WebM/etc.) and return a cleanup. */
  private async buildResource(url: string) {
    console.log('[player] buildResource', url);
    const src = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      requestOptions: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'accept-language': 'en-US,en;q=0.9',
        },
      },
    });

    const { stream: probed, type } = await demuxProbe(src);
    console.log('[player] demuxProbe type =', type);

    const resource = createAudioResource(probed, { inputType: type });
    const cleanup = () => {
      try { probed.destroy(); } catch {}
      try { (src as any).destroy?.(); } catch {}
    };

    return { resource, cleanup };
  }

  private async playNow(guildId: string, track: Track) {
    const s = this.getOrCreateSession(guildId);
    if (!s.connection) throw new Error('Not connected to a voice channel.');

    console.log('[player] playNow', { guildId, title: track.meta.title });
    const { resource, cleanup } = await this.buildResource(track.meta.url);
    s.cleanupCurrent = cleanup;
    s.player.play(resource);
    console.log('[player] player.play(resource) -> called');
  }

  /** For /queue UI */
  getSession(guildId: string) {
    return this.sessions.get(guildId) ?? null;
  }
}

export const player = new Player();
