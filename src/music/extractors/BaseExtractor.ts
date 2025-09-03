import type { TrackMetadata } from '../../types.js';

export abstract class BaseExtractor {
  abstract match(query: string): boolean;
  abstract resolve(query: string): Promise<TrackMetadata[]>;
}
