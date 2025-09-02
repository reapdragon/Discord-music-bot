// src/lib/logger.ts
import os from 'node:os';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
const LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

const DEFAULT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isTTY = process.stdout.isTTY;
const serviceName = 'discord-music-bot';

// Secrets we’ll redact if they appear as values or under sensitive keys
const SECRET_KEYS = new Set(['token', 'authorization', 'auth', 'password', 'clientSecret', 'client_secret']);
const KNOWN_SECRETS = [
  process.env.DISCORD_TOKEN,
  process.env.SPOTIFY_CLIENT_SECRET,
  process.env.SPOTIFY_CLIENT_ID
].filter(Boolean) as string[];

function isoNow() {
  return new Date().toISOString();
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }
  return err;
}

function redact(key: string, value: unknown) {
  if (value == null) return value;

  // redact by sensitive key name
  if (SECRET_KEYS.has(key)) return '[REDACTED]';

  // redact if equals any known secret
  if (typeof value === 'string') {
    for (const s of KNOWN_SECRETS) {
      if (value === s) return '[REDACTED]';
      if (s && value.includes(s)) return value.split(s).join('[REDACTED]');
    }
    // basic bearer token / long token pattern
    if (/^(?:[A-Za-z0-9_\-]{20,})$/.test(value)) return '[REDACTED]';
  }

  // normalize Error objects
  if (value instanceof Error) return serializeError(value);

  return value;
}

function jsonLine(obj: Record<string, unknown>) {
  return JSON.stringify(obj, redact);
}

function prettyLine(level: LogLevel, msg: string, record: Record<string, unknown>) {
  const parts = [
    `${isoNow()}`,
    level.toUpperCase().padEnd(5, ' '),
    msg
  ];
  const meta = { ...record };
  delete (meta as any).level;
  delete (meta as any).time;
  delete (meta as any).msg;
  if (Object.keys(meta).length) parts.push('|', jsonLine(meta));
  return parts.join(' ');
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private context: Record<string, unknown>;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? DEFAULT_LEVEL;
    this.context = {
      service: serviceName,
      pid: process.pid,
      host: os.hostname(),
      ...opts.context
    };
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(l: LogLevel) {
    return LEVELS[l] >= LEVELS[this.level];
  }

  private write(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const record: Record<string, unknown> = {
      time: isoNow(),
      level,
      msg,
      ...this.context,
      ...(meta ? safeMeta(meta) : {})
    };

    if (isTTY && process.env.LOG_FORMAT !== 'json') {
      // human-friendly single line
      process.stdout.write(prettyLine(level, msg, record) + '\n');
    } else {
      // newline-delimited JSON
      process.stdout.write(jsonLine(record) + '\n');
    }
  }

  child(ctx: Record<string, unknown>) {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...ctx }
    });
  }

  // Timers
  time(meta?: Record<string, unknown>) {
    const start = process.hrtime.bigint();
    return {
      end: (label = 'duration', extra?: Record<string, unknown>) => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;
        this.debug('timer', { [label]: ms, ...meta, ...(extra ?? {}) });
        return ms;
      }
    };
  }

  // Level helpers
  trace(msg: string, meta?: Record<string, unknown>) { this.write('trace', msg, meta); }
  debug(msg: string, meta?: Record<string, unknown>) { this.write('debug', msg, meta); }
  info(msg: string, meta?: Record<string, unknown>)  { this.write('info', msg, meta); }
  warn(msg: string, meta?: Record<string, unknown>)  { this.write('warn', msg, meta); }
  error(msg: string, meta?: Record<string, unknown>) { this.write('error', msg, meta); }
  fatal(msg: string, meta?: Record<string, unknown>) { this.write('fatal', msg, meta); }
}

function safeMeta(meta: Record<string, unknown>) {
  // shallow copy with error normalization & redaction via JSON replacer on output
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = v instanceof Error ? serializeError(v) : v;
  }
  return out;
}

// Default logger instance
export const logger = new Logger();

// Convenience factories
export const createLogger = (opts?: LoggerOptions) => new Logger(opts);
export const childLogger = (ctx: Record<string, unknown>) => logger.child(ctx);

// Example usage elsewhere:
// import { logger, childLogger } from './lib/logger.js';
// const log = childLogger({ module: 'Player' });
// log.info('Starting stream', { guildId, track: track.meta.title });
