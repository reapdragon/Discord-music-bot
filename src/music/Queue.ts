import { Track } from './Track.js';
import { VoiceConnection } from '@discordjs/voice';

export class Queue {
  public connection: VoiceConnection | null = null;
  public tracks: Track[] = [];
  public loop = false;
  public volume = 0.5;

  enqueue(t: Track) { this.tracks.push(t); }
  dequeue(): Track | undefined { return this.tracks.shift(); }
  peek(): Track | undefined { return this.tracks[0]; }
  isEmpty() { return this.tracks.length === 0; }
  clear() { this.tracks = []; }
}
