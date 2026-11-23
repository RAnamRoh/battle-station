import type { ContentPack } from '@bs/content-schema/types';
import raw from '../../../content/_build/core.pack.json';

/** The compiled content pack (built from content/core by `pnpm content`). */
export const pack = raw as unknown as ContentPack;

export function hex(colour: string): number {
  return parseInt(colour.slice(1), 16);
}
