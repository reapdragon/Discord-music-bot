// src/music/Player.ts
import { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, createAudioResource, demuxProbe, entersState, joinVoiceChannel, StreamType, } from '@discordjs/voice';
import * as playdl from 'play-dl';
import ytdl from '@distube/ytdl-core';
import { Queue } from './Queue.js';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
export class Player {
    sessions = new Map();
    starting = new Set();
    getOrCreateSession(guildId) {
        const existing = this.sessions.get(guildId);
        if (existing)
            return existing;
        const queue = new Queue();
        const player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
        });
        player.on(AudioPlayerStatus.Idle, () => {
            const s = this.sessions.get(guildId);
            if (!s)
                return;
            const next = s.queue.dequeue();
            s.current = next ?? null;
            if (next) {
                this.play(guildId, next).catch((e) => console.error('[player] auto-next failed:', e));
            }
        });
        player.on('error', (e) => console.error('[audio:error]', guildId, e));
        const session = { player, queue, connection: null, current: null };
        this.sessions.set(guildId, session);
        return session;
    }
    async connect(member, channel) {
        const vc = channel ?? member.voice.channel;
        if (!vc)
            throw new Error('Join a voice channel first.');
        const s = this.getOrCreateSession(vc.guild.id);
        const conn = joinVoiceChannel({
            channelId: vc.id,
            guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
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
    enqueue(guildId, track) {
        const s = this.getOrCreateSession(guildId);
        const isBusy = s.player.state.status === AudioPlayerStatus.Playing ||
            s.player.state.status === AudioPlayerStatus.Buffering ||
            !!s.current ||
            this.starting.has(guildId);
        s.queue.enqueue(track);
        const queuedPos = Math.max(0, s.queue.length - 1);
        if (!isBusy) {
            const first = s.queue.dequeue();
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
    async play(guildId, track) {
        const s = this.getOrCreateSession(guildId);
        if (!s.connection)
            throw new Error('Not connected to a voice channel.');
        const { resource, cleanup } = await this.buildResource(track.meta.url);
        s.player.play(resource);
        s.current = track;
        const once = () => {
            try {
                cleanup?.();
            }
            catch { }
            s.player.off(AudioPlayerStatus.Idle, once);
            s.player.off('error', once);
        };
        s.player.once(AudioPlayerStatus.Idle, once);
        s.player.once('error', once);
    }
    skip(guildId) {
        const s = this.sessions.get(guildId);
        if (!s)
            return;
        s.player.stop(true);
    }
    stop(guildId) {
        const s = this.sessions.get(guildId);
        if (!s)
            return;
        s.queue.clear();
        s.current = null;
        s.player.stop(true);
    }
    disconnect(guildId) {
        const s = this.sessions.get(guildId);
        if (!s)
            return;
        // Stop playback and clear queue
        s.queue.clear();
        s.current = null;
        s.player.stop(true);
        // Disconnect from voice channel
        if (s.connection) {
            s.connection.destroy();
            s.connection = null;
        }
        // Remove the session
        this.sessions.delete(guildId);
    }
    /**
     * Ensure we have a ready voice connection.
     * Joins (or re-joins) if missing/disconnected or in the wrong channel.
     * Narrowing is done via a local `conn` variable to satisfy TS.
     */
    async ensureConnected(member, channel) {
        const vc = channel ?? member.voice.channel;
        if (!vc)
            throw new Error('Join a voice channel first.');
        const s = this.getOrCreateSession(vc.guild.id);
        const needJoin = !s.connection ||
            s.connection.state.status === VoiceConnectionStatus.Destroyed ||
            s.connection.state.status === VoiceConnectionStatus.Disconnected ||
            s.connection.joinConfig.channelId !== vc.id;
        if (needJoin) {
            await this.connect(member, vc);
            return;
        }
        // Work with a non-null local for TS
        const conn = s.connection;
        if (conn.state.status !== VoiceConnectionStatus.Ready) {
            await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
        }
        conn.subscribe(s.player);
    }
    async buildResource(url) {
        // Try ytdl first (more reliable)
        try {
            const ystream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions: {
                    headers: {
                        'user-agent': UA,
                        'accept-language': 'en-US,en;q=0.9',
                    },
                },
            });
            const { stream: probed, type } = await demuxProbe(ystream);
            const resource = createAudioResource(probed, {
                inputType: type ?? StreamType.Arbitrary,
            });
            const cleanup = () => {
                try {
                    ystream?.destroy?.();
                }
                catch { }
            };
            return { resource, cleanup };
        }
        catch (e) {
            console.warn('[player] ytdl failed, falling back to play-dl:', e?.message ?? e);
        }
        // Fallback to play-dl
        try {
            const pl = await playdl.stream(url);
            const { stream: probed, type } = await demuxProbe(pl.stream);
            const resource = createAudioResource(probed, { inputType: type });
            const cleanup = () => {
                try {
                    pl.stream?.destroy?.();
                }
                catch { }
            };
            return { resource, cleanup };
        }
        catch (e) {
            console.error('[player] Both ytdl and play-dl failed:', e?.message ?? e);
            throw new Error(`Failed to stream audio: ${e?.message ?? 'Unknown error'}`);
        }
    }
}
export const player = new Player();
