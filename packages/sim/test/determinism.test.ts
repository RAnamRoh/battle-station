import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cloneState, createMatch, hashState, step, type State } from '../src/index';
import { pack } from './helpers';

/** A small deterministic input generator for tests (not used by the sim itself). */
function makeInputs(seed: number) {
  let x = seed | 0;
  let held = 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) | 0;
    const r = x >>> 8;
    // Change the held input every few frames, like a person would.
    if (r % 5 === 0) held = (r >>> 4) & 1023;
    return held;
  };
}

function playRandom(seed: number, frames: number, training = false): { final: State; hashes: number[] } {
  let s = createMatch({ fighters: [0, 0], seed, training }, pack);
  const a = makeInputs(seed * 7 + 1);
  const b = makeInputs(seed * 13 + 5);
  const hashes: number[] = [];
  for (let i = 0; i < frames; i++) {
    s = step(s, a(), b(), pack).state;
    hashes.push(hashState(s));
  }
  return { final: s, hashes };
}

describe('determinism', () => {
  it('gives the same checksum on every frame for the same inputs', () => {
    const one = playRandom(42, 3000);
    const two = playRandom(42, 3000);
    expect(two.hashes).toEqual(one.hashes);
  });

  it('gives different results for different inputs', () => {
    expect(playRandom(1, 600).hashes[599]).not.toBe(playRandom(2, 600).hashes[599]);
  });

  it('resumes from a snapshot to the same result (what rollback relies on)', () => {
    let s = createMatch({ fighters: [0, 0], seed: 9 }, pack);
    const a = makeInputs(100);
    const b = makeInputs(200);
    const log: [number, number][] = [];
    const snaps: State[] = [];
    for (let i = 0; i < 1500; i++) {
      snaps.push(cloneState(s));
      const ia = a();
      const ib = b();
      log.push([ia, ib]);
      s = step(s, ia, ib, pack).state;
    }
    const want = hashState(s);
    for (const from of [0, 77, 400, 901, 1499]) {
      let r = snaps[from]!;
      for (let i = from; i < 1500; i++) r = step(r, log[i]![0], log[i]![1], pack).state;
      expect(hashState(r)).toBe(want);
    }
  });

  it('keeps every state value a whole number through long random fights', () => {
    const check = (v: unknown, path: string): void => {
      if (typeof v === 'number') {
        if (!Number.isInteger(v)) throw new Error(`${path} is not a whole number: ${v}`);
      } else if (Array.isArray(v)) v.forEach((x, i) => check(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) check((v as Record<string, unknown>)[k], `${path}.${k}`);
      else throw new Error(`${path} has a non-numeric value`);
    };
    for (let seed = 1; seed <= 12; seed++) {
      const r = playRandom(seed, 4000, seed % 3 === 0);
      check(r.final, 'state');
      for (const p of r.final.players) {
        expect(p.hp).toBeGreaterThanOrEqual(0);
        expect(p.ki).toBeGreaterThanOrEqual(0);
        expect(p.ki).toBeLessThanOrEqual(pack.rules.kiMax);
      }
    }
  });

  it('matches the golden replay', () => {
    // If this fails, sim behaviour changed. That must be deliberate: update the value in the same change.
    const r = playRandom(2026, 2400);
    expect(r.hashes[2399]).toBe(GOLDEN);
  });
});

const GOLDEN = 1639029698;

describe('determinism rules (ADR-0004)', () => {
  const dir = join(__dirname, '..', 'src');
  const banned: [RegExp, string][] = [
    [/Math\.(random|sin|cos|tan|atan2?|pow|exp|sqrt|log|floor|ceil|round)\b/, 'a banned Math function'],
    [/\bDate\b|\bperformance\b|setTimeout|setInterval/, 'a clock or timer'],
    [/\*\*/, 'the power operator'],
    [/\bfor\s*\([^)]*\bin\b/, 'for...in'],
    [/\d\.\d/, 'a decimal number'],
    [/\bfrom\s+['"](?!\.)/, 'an import from outside the sim'],
  ];
  for (const name of readdirSync(dir)) {
    it(`${name} uses only allowed operations`, () => {
      const code = readFileSync(join(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'[^'\n]*'|"[^"\n]*"/g, (m) => (/^['"]\./.test(m) ? m : "''"));
      for (const [re, what] of banned) {
        const m = re.exec(code);
        if (m) throw new Error(`${name} uses ${what}: "${m[0]}"`);
      }
      const noStrings = code.replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
      if (name !== 'int.ts' && /[^/*]\/[^/*]/.test(noStrings)) throw new Error(`${name} uses the division operator; use idiv()`);
    });
  }
});
