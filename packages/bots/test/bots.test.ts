import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMatch, Ev, hashState, Phase, step, type SimPack } from '@bs/sim';
import { loadPack } from '../../content-schema/src/load';
import { botInput, createBot, Level } from '../src/index';

const content = loadPack(join(__dirname, '..', '..', '..', 'content', 'core'), 'core');
const pack: SimPack = content.sim;
const ids = content.fighters.map((f) => f.id);

interface Result { winner: number; frames: number; supers: number; hash: number }

function play(a: number, b: number, levelA: number, levelB: number, seed: number): Result {
  let s = createMatch({ fighters: [a, b], seed }, pack);
  const botA = createBot(levelA, seed * 31 + 7);
  const botB = createBot(levelB, seed * 17 + 3);
  let supers = 0;
  let frames = 0;
  while (s.phase !== Phase.MATCH_END && frames < 60 * 60 * 8) {
    const r = step(s, botInput(botA, s, 0, pack), botInput(botB, s, 1, pack), pack);
    s = r.state;
    for (const e of r.events) if (e.t === Ev.SUPER) supers++;
    frames++;
  }
  return { winner: s.winner, frames, supers, hash: hashState(s) };
}

describe('cpu opponent', () => {
  it('finishes matches and is repeatable for the same seeds', () => {
    const one = play(0, 1, Level.NORMAL, Level.NORMAL, 5);
    const two = play(0, 1, Level.NORMAL, Level.NORMAL, 5);
    expect(one.winner).toBeGreaterThanOrEqual(0);
    expect(two).toEqual(one);
  });

  it('uses supers', () => {
    let supers = 0;
    for (let seed = 1; seed <= 6; seed++) supers += play(seed % ids.length, (seed + 2) % ids.length, Level.HARD, Level.HARD, seed).supers;
    expect(supers).toBeGreaterThan(0);
  });

  it('wins clearly more often on Hard than on Easy with the same fighter', () => {
    let hard = 0;
    let games = 0;
    for (let f = 0; f < ids.length; f++) {
      for (let seed = 1; seed <= 6; seed++) {
        const hardFirst = seed % 2 === 0;
        const r = play(f, f, hardFirst ? Level.HARD : Level.EASY, hardFirst ? Level.EASY : Level.HARD, seed + f * 10);
        if (r.winner === (hardFirst ? 0 : 1)) hard++;
        games++;
      }
    }
    expect(hard / games).toBeGreaterThan(0.75);
  });
});

describe('roster', () => {
  it('has five fighters with distinct stats and the shared move layout', () => {
    expect(ids.length).toBe(5);
    const keys = new Set(pack.fighters.map((f) => `${f.stats.hp}/${f.stats.walkF}/${f.stats.damageMul}`));
    expect(keys.size).toBe(5);
    for (const f of pack.fighters) {
      for (let slot = 0; slot < 16; slot++) expect(f.moves[slot], `${f.id} slot ${slot}`).not.toBeNull();
    }
  });

  it('has no runaway matchups (CPU versus CPU, every pairing)', () => {
    const report: string[] = [];
    const bad: string[] = [];
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        let winsA = 0;
        let decided = 0;
        for (let seed = 1; seed <= 24; seed++) {
          // Swap sides every other game so the starting side does not matter.
          const swap = seed % 2 === 0;
          const r = swap ? play(b, a, Level.HARD, Level.HARD, seed) : play(a, b, Level.HARD, Level.HARD, seed);
          if (r.winner === 2 || r.winner < 0) continue;
          decided++;
          if ((r.winner === 0) !== swap) winsA++;
        }
        const rate = decided ? winsA / decided : 0.5;
        report.push(`${ids[a]} vs ${ids[b]}: ${(rate * 100).toFixed(0)}%`);
        if (rate < 0.2 || rate > 0.8) bad.push(`${ids[a]} vs ${ids[b]}: ${(rate * 100).toFixed(0)}%`);
      }
    }
    console.log(report.join('\n'));
    expect(bad).toEqual([]);
  }, 120000);
});
