import { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, demuxProbe, StreamType, } from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import { Queue } from './Queue.js';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
export class Player {
    sessions = new Map();
    getOrCreateSession(guildId) {
        let s = this.sessions.get(guildId);
        if (s)
            return s;
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
            if (!sess)
                return;
            const next = sess.queue.dequeue();
            if (next) {
                sess.suppressIdleOnce = true;
                try {
                    sess.cleanupCurrent?.();
                }
                catch { }
                sess.cleanupCurrent = undefined;
                sess.current = next;
                this.playNow(guildId, next).catch((err) => console.error('[playNow:error]', err));
            }
            else {
                sess.current = null;
                try {
                    sess.player.stop(true);
                }
                catch { }
            }
        });
        player.on(AudioPlayerStatus.Idle, () => {
            const sess = this.sessions.get(guildId);
            if (!sess)
                return;
            if (sess.suppressIdleOnce) {
                sess.suppressIdleOnce = false;
                return;
            }
            const next = sess.queue.dequeue();
            if (next) {
                console.log('[player] idle -> next:', next.meta.title);
                sess.current = next;
                this.playNow(guildId, next).catch((e) => console.error('[playNow:error]', e));
            }
            else {
                console.log('[player] idle -> queue empty');
                sess.current = null;
            }
        });
        s = { player, queue, connection: null, current: null, suppressIdleOnce: false };
        this.sessions.set(guildId, s);
        return s;
    }
    attachConnDebug(conn, guildId) {
        conn.on('stateChange', (o, n) => {
            console.log(`[voice] ${guildId}: ${o.status} -> ${n.status}`);
        });
    }
    async connect(member, channel) {
        const vc = channel ?? member.voice.channel;
        if (!vc)
            throw new Error('Join a voice channel first.');
        const session = this.getOrCreateSession(vc.guild.id);
        console.log('[player] joinVoiceChannel ->', vc.name);
        const conn = joinVoiceChannel({
            channelId: vc.id,
            guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
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
    async ensureConnected(member, channel) {
        const vc = channel ?? member.voice.channel;
        if (!vc)
            throw new Error('Join a voice channel first.');
        const s = this.sessions.get(vc.guild.id);
        if (!s || !s.connection)
            await this.connect(member, channel);
    }
    enqueue(guildId, track) {
        const s = this.getOrCreateSession(guildId);
        const somethingPlaying = s.player.state.status === AudioPlayerStatus.Playing ||
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
    skip(guildId) {
        const s = this.sessions.get(guildId);
        if (!s)
            return { action: 'noop' };
        const next = s.queue.dequeue();
        if (next) {
            s.suppressIdleOnce = true;
            try {
                s.cleanupCurrent?.();
            }
            catch { }
            s.cleanupCurrent = undefined;
            s.current = next;
            try {
                s.player.stop(true);
            }
            catch { }
            this.playNow(guildId, next).catch((e) => console.error('[playNow:error]', e));
            return { action: 'skipped', nextTitle: next.meta.title };
        }
        else {
            s.suppressIdleOnce = true;
            try {
                s.cleanupCurrent?.();
            }
            catch { }
            s.cleanupCurrent = undefined;
            s.current = null;
            try {
                s.player.stop(true);
            }
            catch { }
            return { action: 'stopped' };
        }
    }
    stop(guildId, opts = {}) {
        const s = this.sessions.get(guildId);
        if (!s)
            return { action: 'noop' };
        s.queue.clear();
        s.suppressIdleOnce = true;
        try {
            s.cleanupCurrent?.();
        }
        catch { }
        s.cleanupCurrent = undefined;
        s.current = null;
        try {
            s.player.stop(true);
        }
        catch { }
        if (opts.disconnect !== false && s.connection) {
            try {
                s.connection.destroy();
            }
            catch { }
            s.connection = null;
        }
        return { action: 'stopped' };
    }
    // ---------- Stream building (no ffmpeg on Render Free) ----------
    // Prefer WebM/Opus to avoid transcoding
    async getWebmOpusStream(url) {
        const info = await ytdl.getInfo(url, {
            requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
        });
        const opus = info.formats
            .filter((f) => (f.mimeType || '').includes('audio/webm') && (f.codecs || '').includes('opus'))
            .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
        if (opus[0]) {
            console.log('[ytdl] chosen itag', opus[0].itag, opus[0].mimeType, opus[0].audioBitrate, 'kbps');
            const stream = ytdl.downloadFromInfo(info, {
                format: opus[0],
                highWaterMark: 1 << 25,
                dlChunkSize: 0,
                requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
            });
            return { type: 'webm/opus', stream };
        }
        // Fallback: generic audioonly (may be m4a). We'll demuxProbe later.
        console.log('[ytdl] no opus/webm format; falling back to audioonly');
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
            requestOptions: { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } },
        });
        return { type: 'unknown', stream };
    }
    // Retry/backoff for 429/503 around the whole build step
    async buildResource(url, attempt = 1) {
        try {
            const got = await this.getWebmOpusStream(url);
            if (got.type === 'webm/opus') {
                const resource = createAudioResource(got.stream, { inputType: StreamType.WebmOpus });
                const cleanup = () => { try {
                    got.stream.destroy?.();
                }
                catch { } };
                return { resource, cleanup };
            }
            else {
                const { stream: probed, type } = await demuxProbe(got.stream);
                const resource = createAudioResource(probed, { inputType: type });
                const cleanup = () => { try {
                    probed.destroy?.();
                }
                catch { } };
                return { resource, cleanup };
            }
        }
        catch (e) {
            const sc = e?.statusCode ?? e?.status ?? 0;
            if ((sc === 429 || sc === 503) && attempt < 3) {
                const ms = 1000 * attempt;
                console.warn(`[ytdl] ${sc} building resource — retrying in ${ms}ms (attempt ${attempt + 1}/3)`);
                await new Promise((r) => setTimeout(r, ms));
                return this.buildResource(url, attempt + 1);
            }
            throw e;
        }
    }
    async playNow(guildId, track) {
        const s = this.getOrCreateSession(guildId);
        if (!s.connection)
            throw new Error('Not connected to a voice channel.');
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
        }
        catch (e) {
            console.error('[playNow:error]', e);
            const next = s.queue.dequeue();
            if (next) {
                s.current = next;
                this.playNow(guildId, next).catch((err) => console.error('[playNow:next:error]', err));
            }
            else {
                s.current = null;
            }
        }
    }
    getSession(guildId) {
        return this.sessions.get(guildId) ?? null;
    }
}
export const player = new Player();
