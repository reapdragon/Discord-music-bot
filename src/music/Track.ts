import type { TrackMetadata } from '../types.js';

export class Track {
  constructor(public readonly meta: TrackMetadata) {}
  toString() { return `${this.meta.title} (${this.meta.source})`; }
}
