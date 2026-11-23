import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { compilePack, ContentError } from '../src/index';
import { loadPack } from '../src/load';

const core = join(__dirname, '..', '..', '..', 'content', 'core');
const file = (rel: string) => ({ path: rel, data: parse(readFileSync(join(core, rel), 'utf8')) as Record<string, any> });

describe('content build', () => {
  it('compiles the core pack', () => {
    const pack = loadPack(core, 'core');
    expect(pack.fighters.length).toBeGreaterThan(0);
    expect(pack.gameplayHash).toMatch(/^[0-9a-f]{64}$/);
    for (const f of pack.sim.fighters) expect(f.moves.length).toBe(16);
  });

  it('gives the same hash for the same data, and a new hash when gameplay changes', () => {
    const rules = file('rules.yaml');
    const rookie = file('fighters/rookie.yaml');
    const a = compilePack('t', rules, [rookie], []);
    const b = compilePack('t', rules, [rookie], []);
    expect(b.gameplayHash).toBe(a.gameplayHash);
    const tuned = structuredClone(rookie);
    tuned.data.gameplay.moves['5L'].hits[0].damage += 1;
    expect(compilePack('t', rules, [tuned], []).gameplayHash).not.toBe(a.gameplayHash);
  });

  it('keeps the hash when only presentation changes', () => {
    const rules = file('rules.yaml');
    const rookie = file('fighters/rookie.yaml');
    const a = compilePack('t', rules, [rookie], []);
    const renamed = structuredClone(rookie);
    renamed.data.presentation.name = 'Someone Else';
    expect(compilePack('t', rules, [renamed], []).gameplayHash).toBe(a.gameplayHash);
  });

  it('names the file and field when a value is missing or not a whole number', () => {
    const rules = file('rules.yaml');
    const bad = file('fighters/rookie.yaml');
    bad.data.gameplay.stats.walkF = 3.5;
    delete bad.data.gameplay.stats.hp;
    try {
      compilePack('t', rules, [bad], []);
      throw new Error('should have failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      const msg = (e as Error).message;
      expect(msg).toContain('fighters/rookie.yaml');
      expect(msg).toContain('gameplay.stats.walkF');
      expect(msg).toContain('gameplay.stats.hp');
    }
  });

  it('rejects a hit outside the move', () => {
    const bad = file('fighters/rookie.yaml');
    bad.data.gameplay.moves['5L'].hits[0].to = 99;
    expect(() => compilePack('t', file('rules.yaml'), [bad], [])).toThrow(/5L/);
  });
});
