import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError } from './compile';
import { loadPack } from './load';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
try {
  const pack = loadPack(join(root, 'content', 'core'), 'core');
  const out = join(root, 'content', '_build');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'core.pack.json'), JSON.stringify(pack));
  console.log(`content: ${pack.fighters.length} fighter(s), ${pack.stages.length} stage(s), gameplay hash ${pack.gameplayHash.slice(0, 12)}`);
} catch (e) {
  if (e instanceof ContentError) { console.error(`Content error: ${e.message}`); process.exit(1); }
  throw e;
}
