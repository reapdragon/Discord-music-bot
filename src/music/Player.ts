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
    const existing = this.sessions.get(guildId);
    if (existing) return existing;

    const queue = new Queue();
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    player.on(AudioPlayerStatus.Idle, () => {
      const s = this.sessions.get(guildId);
      if (!s) return;
      const next = s.queue.dequeue();
      s.current = next ?? null;
      if (next) {
        this.play(guildId, next).catch((e) =>
          console.error('[player] auto-next failed:', e)
        );
      }
    });

    player.on('error', (e) => console.error('[audio:error]', guildId, e));

    const session: GuildSession = { player, queue, connection: null, current: null };
    this.sessions.set(guildId, session);
    return session;
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

    await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
    s.connection = conn;
    conn.subscribe(s.player);
    return conn;
  }

  /**
   * Enqueue a track. If idle, start immediately.
   * Returns whether playback started and the 0-based queue position (if queued).
   */
  enqueue(guildId: string, track: Track): { started: boolean; position: number } {
    const s = this.getOrCreateSession(guildId);

    const isBusy =
      s.player.state.status === AudioPlayerStatus.Playing ||
      s.player.state.status === AudioPlayerStatus.Buffering ||
      !!s.current ||
      this.starting.has(guildId);

    s.queue.enqueue(track);
    const queuedPos = Math.max(0, s.queue.length - 1);

    if (!isBusy) {
      const first = s.queue.dequeue()!;
      s.current = first;
      this.starting.add(guildId);
      this.play(guildId, first)
        .catch((e) => console.error('[player] auto-start failed:', e))
        .finally(() => this.starting.delete(guildId));
      return { started: true, position: 0 };
    }

    return { started: false, position: queuedPos };
  }

  /** Play a specific track now (connection must already exist). */
  async play(guildId: string, track: Track): Promise<void> {
    const s = this.getOrCreateSession(guildId);
    if (!s.connection) throw new Error('Not connected to a voice channel.');

    const { resource, cleanup } = await this.buildResource(track.meta.url);
    s.player.play(resource);
    s.current = track;

    const once = () => {
      try { cleanup?.(); } catch {}
      s.player.off(AudioPlayerStatus.Idle, once);
      s.player.off('error', once as any);
    };
    s.player.once(AudioPlayerStatus.Idle, once);
    s.player.once('error', once as any);
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
    // try play-dl first
    try {
      const pl = await playdl.stream(url);
      const { stream: probed, type } = await demuxProbe(pl.stream);
      const resource = createAudioResource(probed, { inputType: type });
      const cleanup = () => { try { (pl.stream as any)?.destroy?.(); } catch {} };
      return { resource, cleanup };
    } catch (e) {
      console.warn('[player] play-dl failed, falling back to ytdl:', (e as Error)?.message ?? e);
    }

    // fallback ytdl
    const ystream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
    });
    const { stream: probed, type } = await demuxProbe(ystream);
    const resource = createAudioResource(probed, { inputType: type ?? StreamType.Arbitrary });
    const cleanup = () => { try { (ystream as any)?.destroy?.(); } catch {} };
    return { resource, cleanup };
  }
}

export const player = new Player();
