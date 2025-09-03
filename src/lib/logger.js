// src/lib/logger.ts
import os from 'node:os';
const LEVELS = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};
const DEFAULT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const isTTY = process.stdout.isTTY;
const serviceName = 'discord-music-bot';
// Secrets we’ll redact if they appear as values or under sensitive keys
const SECRET_KEYS = new Set(['token', 'authorization', 'auth', 'password', 'clientSecret', 'client_secret']);
const KNOWN_SECRETS = [
    process.env.DISCORD_TOKEN,
    process.env.SPOTIFY_CLIENT_SECRET,
    process.env.SPOTIFY_CLIENT_ID
].filter(Boolean);
function isoNow() {
    return new Date().toISOString();
}
function serializeError(err) {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
    }
    return err;
}
function redact(key, value) {
    if (value == null)
        return value;
    // redact by sensitive key name
    if (SECRET_KEYS.has(key))
        return '[REDACTED]';
    // redact if equals any known secret
    if (typeof value === 'string') {
        for (const s of KNOWN_SECRETS) {
            if (value === s)
                return '[REDACTED]';
            if (s && value.includes(s))
                return value.split(s).join('[REDACTED]');
        }
        // basic bearer token / long token pattern
        if (/^(?:[A-Za-z0-9_\-]{20,})$/.test(value))
            return '[REDACTED]';
    }
    // normalize Error objects
    if (value instanceof Error)
        return serializeError(value);
    return value;
}
function jsonLine(obj) {
    return JSON.stringify(obj, redact);
}
function prettyLine(level, msg, record) {
    const parts = [
        `${isoNow()}`,
        level.toUpperCase().padEnd(5, ' '),
        msg
    ];
    const meta = { ...record };
    delete meta.level;
    delete meta.time;
    delete meta.msg;
    if (Object.keys(meta).length)
        parts.push('|', jsonLine(meta));
    return parts.join(' ');
}
export class Logger {
    level;
    context;
    constructor(opts = {}) {
        this.level = opts.level ?? DEFAULT_LEVEL;
        this.context = {
            service: serviceName,
            pid: process.pid,
            host: os.hostname(),
            ...opts.context
        };
    }
    setLevel(level) {
        this.level = level;
    }
    shouldLog(l) {
        return LEVELS[l] >= LEVELS[this.level];
    }
    write(level, msg, meta) {
        if (!this.shouldLog(level))
            return;
        const record = {
            time: isoNow(),
            level,
            msg,
            ...this.context,
            ...(meta ? safeMeta(meta) : {})
        };
        if (isTTY && process.env.LOG_FORMAT !== 'json') {
            // human-friendly single line
            process.stdout.write(prettyLine(level, msg, record) + '\n');
        }
        else {
            // newline-delimited JSON
            process.stdout.write(jsonLine(record) + '\n');
        }
    }
    child(ctx) {
        return new Logger({
            level: this.level,
            context: { ...this.context, ...ctx }
        });
    }
    // Timers
    time(meta) {
        const start = process.hrtime.bigint();
        return {
            end: (label = 'duration', extra) => {
                const end = process.hrtime.bigint();
                const ms = Number(end - start) / 1_000_000;
                this.debug('timer', { [label]: ms, ...meta, ...(extra ?? {}) });
                return ms;
            }
        };
    }
    // Level helpers
    trace(msg, meta) { this.write('trace', msg, meta); }
    debug(msg, meta) { this.write('debug', msg, meta); }
    info(msg, meta) { this.write('info', msg, meta); }
    warn(msg, meta) { this.write('warn', msg, meta); }
    error(msg, meta) { this.write('error', msg, meta); }
    fatal(msg, meta) { this.write('fatal', msg, meta); }
}
function safeMeta(meta) {
    // shallow copy with error normalization & redaction via JSON replacer on output
    const out = {};
    for (const [k, v] of Object.entries(meta)) {
        out[k] = v instanceof Error ? serializeError(v) : v;
    }
    return out;
}
// Default logger instance
export const logger = new Logger();
// Convenience factories
export const createLogger = (opts) => new Logger(opts);
export const childLogger = (ctx) => logger.child(ctx);
// Example usage elsewhere:
// import { logger, childLogger } from './lib/logger.js';
// const log = childLogger({ module: 'Player' });
// log.info('Starting stream', { guildId, track: track.meta.title });
