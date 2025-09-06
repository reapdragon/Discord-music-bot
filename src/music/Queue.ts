// src/music/Queue.ts
import type { Track } from './Track.js';

export class Queue {
  private items: Track[] = [];

  enqueue(track: Track): void {
    this.items.push(track);
  }
  dequeue(): Track | undefined {
    return this.items.shift();
  }
  peek(): Track | undefined {
    return this.items[0];
  }
  clear(): void {
    this.items = [];
  }
  removeAt(index: number): Track | undefined {
    if (index < 0 || index >= this.items.length) return undefined;
    const [removed] = this.items.splice(index, 1);
    return removed;
  }
  shuffle(): void {
    for (let i = this.items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
  }

  // Optional: keep this getter; it’s fine
  get length(): number {
    return this.items.length;
  }

  // Use this in Player to compute size safely
  get tracks(): Track[] {
    return [...this.items];
  }
}
