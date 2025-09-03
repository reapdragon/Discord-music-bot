import {
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  joinVoiceChannel,
  entersState
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';

class Queue {
  constructor() { this.tracks = []; }
  enqueue(t) { this.tracks.push(t); }
  dequeue() { return this.tracks.shift(); }
  clear() { this.tracks = []; }
}

export class Player {
  constructor() {
    /** @type {Map<string, {player:any, queue:Queue, connection:any}>} */
    this.sessions = new Map();
  }

  getOrCreateSession(guildId) {
    let s = this.sessions.get(guildId);
    if (s) return s;

    const queue = new Queue();
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

    player.on(AudioPlayerStatus.Idle, () => {
      const sess = this.sessions.get(guildId);
      if (!sess) return;
      const next = sess.queue.dequeue();
      if (next) this.play(guildId, next).catch(() => {});
    });

    s = { player, queue, connection: null };
    this.sessions.set(guildId, s);
    return s;
  }

  async connect(member, channel) {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');

    const session = this.getOrCreateSession(vc.guild.id);
    const conn = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator
    });

    await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
    session.connection = conn;
    conn.subscribe(session.player);
    return conn;
  }

  async ensureConnected(member, channel) {
    const vc = channel ?? member.voice.channel;
    if (!vc) throw new Error('Join a voice channel first.');
    const guildId = vc.guild.id;
    const s = this.sessions.get(guildId);
    if (!s || !s.connection) await this.connect(member, channel);
  }

  enqueue(guildId, track) {
    const session = this.getOrCreateSession(guildId);
    const status = session.player.state.status;
    const playing = status === AudioPlayerStatus.Playing || status === AudioPlayerStatus.Buffering;

    session.queue.enqueue(track);
    if (!playing) {
      const next = session.queue.dequeue();
      if (next) this.play(guildId, next).catch(() => {});
    }
  }

  async play(guildId, track) {
    const session = this.getOrCreateSession(guildId);
    if (!session.connection) throw new Error('Not connected to a voice channel.');

        const stream = ytdl(track.meta.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        requestOptions: {
            headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'accept-language': 'en-US,en;q=0.9'
            }
        }
        });

    const resource = createAudioResource(stream);
    session.player.play(resource);
  }

  skip(guildId) {
    const s = this.sessions.get(guildId);
    if (!s) return;
    s.player.stop(true);
  }

  stop(guildId) {
    const s = this.sessions.get(guildId);
    if (!s) return;
    s.queue.clear();
    s.player.stop(true);
  }
}

export const player = new Player();
