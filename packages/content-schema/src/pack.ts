import type { SimPack } from '@bs/sim';
import type { Presentation, StageDef } from './schema';

export interface ContentPack {
  id: string;
  /** SHA-256 of the canonical JSON of `sim`. Replays and online matches pin this value. */
  gameplayHash: string;
  sim: SimPack;
  fighters: { id: string; presentation: Presentation }[];
  stages: StageDef[];
}

