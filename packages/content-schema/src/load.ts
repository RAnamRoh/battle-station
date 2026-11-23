import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { compilePack, type SourceFile } from './compile';
import type { ContentPack } from './pack';

function readYaml(path: string): SourceFile {
  return { path, data: parseYaml(readFileSync(path, 'utf8')) };
}

function readDir(dir: string): SourceFile[] {
  let names: string[] = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.filter((n) => n.endsWith('.yaml')).sort().map((n) => readYaml(join(dir, n)));
}

/** Reads a pack folder (rules.yaml, fighters/*.yaml, stages/*.yaml) and compiles it. */
export function loadPack(dir: string, id: string): ContentPack {
  return compilePack(id, readYaml(join(dir, 'rules.yaml')), readDir(join(dir, 'fighters')), readDir(join(dir, 'stages')));
}
