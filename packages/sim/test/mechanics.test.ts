import { describe, expect, it } from 'vitest';
import { Ev, Phase, Slot, St, step } from '../src/index';
import { B, close, pack, run, training, versus } from './helpers';

const count = (events: { t: number }[], t: number) => events.filter((e) => e.t === t).length;

describe('movement', () => {
  it('walks forward and stops at the stage edge', () => {
    const r = run(training(), [[600, B.LEFT, 0]]);
    const lim = (pack.rules.stageWidth * 256) / 2 - (pack.fighters[0]!.stats.width * 256) / 2;
    expect(r.state.players[0]!.x).toBe(-lim);
  });

  it('jumps and lands', () => {
    const r = run(training(), [[5, B.UP, 0]]);
    expect(r.state.players[0]!.y).toBeGreaterThan(0);
    const landed = run(r.state, [[60, 0, 0]]);
    expect(landed.state.players[0]!.y).toBe(0);
    expect(landed.state.players[0]!.st).toBe(St.IDLE);
  });

  it('dashes on a double tap, faster than walking', () => {
    const walk = run(training(), [[14, B.RIGHT, 0]]);
    const dash = run(training(), [[2, B.RIGHT, 0], [2, 0, 0], [10, B.RIGHT, 0]]);
    expect(count(dash.events, Ev.DASH)).toBe(1);
    expect(dash.state.players[0]!.x).toBeGreaterThan(walk.state.players[0]!.x);
  });

  it('keeps fighters from overlapping', () => {
    const r = run(training(), [[300, B.RIGHT, B.LEFT]]);
    const gap = r.state.players[1]!.x - r.state.players[0]!.x;
    expect(gap).toBe(pack.fighters[0]!.stats.width * 256);
  });
});

describe('attacks', () => {
  it('uses the forward variant when forward is held', () => {
    const r = run(close(training()), [[1, B.RIGHT | B.LIGHT, 0]]);
    expect(r.state.players[0]!.move).toBe(Slot.L6);
    const n = run(close(training()), [[1, B.LIGHT, 0]]);
    expect(n.state.players[0]!.move).toBe(Slot.L5);
    const d = run(close(training()), [[1, B.DOWN | B.HEAVY, 0]]);
    expect(d.state.players[0]!.move).toBe(Slot.H2);
  });

  it('hits: damage, stun and pushback', () => {
    const r = run(close(training()), [[1, B.LIGHT, 0], [7, 0, 0]]);
    const v = r.state.players[1]!;
    expect(count(r.events, Ev.HIT)).toBe(1);
    expect(v.hp).toBe(pack.fighters[0]!.stats.hp - 30);
    expect(v.st).toBe(St.HIT);
    expect(v.vx).toBeGreaterThan(0);
    expect(r.state.hitstop).toBeGreaterThan(0);
  });

  it('whiffs at range', () => {
    const r = run(training(), [[1, B.LIGHT, 0], [20, 0, 0]]);
    expect(count(r.events, Ev.HIT)).toBe(0);
    expect(r.state.players[0]!.st).toBe(St.IDLE);
  });

  it('buffers a press made just before the fighter can act', () => {
    // 5L lasts 15 frames. Press heavy 3 frames before it ends, at range so nothing connects.
    const r = run(training(), [[1, B.LIGHT, 0], [11, 0, 0], [1, B.HEAVY, 0], [5, 0, 0]]);
    expect(r.state.players[0]!.move).toBe(Slot.H5);
  });

  it('cancels light into heavy on hit, as one scaled combo', () => {
    const r = run(close(training()), [[1, B.LIGHT, 0], [12, 0, 0], [1, B.HEAVY, 0], [24, 0, 0]]);
    const hits = r.events.filter((e) => e.t === Ev.HIT);
    expect(hits.map((h) => h.n)).toEqual([1, 2]);
    expect(pack.fighters[0]!.stats.hp - r.state.players[1]!.hp).toBe(30 + 63); // 70 at 90%
  });

  it('cannot cancel heavy into light', () => {
    const r = run(close(training()), [[1, B.HEAVY, 0], [16, 0, 0], [1, B.LIGHT, 0], [3, 0, 0]]);
    expect(r.state.players[0]!.move).toBe(Slot.H5);
  });

  it('simple controls chain on repeated light presses', () => {
    let s = close(training({ simple: [true, false] }));
    const all: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = run(s, [[1, B.LIGHT, 0], [7, 0, 0]]);
      s = r.state;
      for (const e of r.events) if (e.t === Ev.SWING) all.push(e.a);
    }
    expect(all.slice(0, 4)).toEqual([Slot.L5, Slot.L6, Slot.H5, Slot.K6]);
  });

  it('launches with the anti-air heavy and knocks down', () => {
    const r = run(close(training()), [[1, B.LEFT | B.HEAVY, 0], [12, 0, 0]]);
    expect(r.state.players[1]!.st).toBe(St.LAUNCH);
    const later = run(r.state, [[70, 0, 0]]);
    expect(count(later.events, Ev.KNOCKDOWN)).toBe(1);
    const up = run(later.state, [[60, 0, 0]]);
    expect(up.state.players[1]!.st).toBe(St.IDLE);
  });
});

describe('guarding', () => {
  it('blocks with the guard button: no damage, block stun', () => {
    const r = run(close(training()), [[1, B.LIGHT, B.GUARD], [7, 0, B.GUARD]]);
    expect(count(r.events, Ev.BLOCK)).toBe(1);
    expect(r.state.players[1]!.hp).toBe(pack.fighters[0]!.stats.hp);
    expect(r.state.players[1]!.st).toBe(St.BLOCK);
  });

  it('blocks by holding away', () => {
    const r = run(close(training()), [[1, B.LIGHT, B.RIGHT], [7, 0, B.RIGHT]]);
    expect(count(r.events, Ev.BLOCK)).toBe(1);
  });

  it('breaks the guard when the gauge empties', () => {
    let s = close(training());
    let broke = 0;
    for (let i = 0; i < 12 && !broke; i++) {
      s.players[0]!.x = s.players[1]!.x - 80 * 256;
      const r = run(s, [[1, B.RIGHT | B.HEAVY, B.GUARD], [40, 0, B.GUARD]]);
      s = r.state;
      broke = count(r.events, Ev.GUARD_BREAK);
    }
    expect(broke).toBe(1);
  });

  it('throws a guarding opponent', () => {
    const r = run(close(training(), 66), [[1, B.LIGHT | B.HEAVY, B.GUARD], [8, 0, B.GUARD]]);
    expect(count(r.events, Ev.THROW)).toBe(1);
    expect(r.state.players[1]!.st).toBe(St.LAUNCH);
  });
});

describe('ki', () => {
  it('charges while charge is held', () => {
    const r = run(training(), [[60, B.CHARGE, 0]]);
    expect(r.state.players[0]!.st).toBe(St.CHARGE);
    expect(r.state.players[0]!.ki).toBe(pack.rules.kiStart + 60 * pack.rules.kiCharge);
  });

  it('fires a ki blast that hits and costs ki', () => {
    const r = run(training(), [[1, B.KI, 0], [60, 0, 0]]);
    expect(count(r.events, Ev.PROJECTILE)).toBe(1);
    expect(count(r.events, Ev.HIT)).toBe(1);
    expect(r.state.projs.length).toBe(0);
  });

  it('refuses a super without a full meter', () => {
    const r = run(training(), [[1, B.SUPER, 0], [3, 0, 0]]);
    expect(count(r.events, Ev.SUPER)).toBe(0);
    expect(r.state.players[0]!.st).toBe(St.IDLE);
  });

  it('performs a super with a full meter: freeze, empty meter, big damage', () => {
    const s = training();
    s.players[0]!.ki = pack.rules.kiMax;
    const r = run(s, [[1, B.SUPER, 0]]);
    expect(count(r.events, Ev.SUPER)).toBe(1);
    expect(r.state.freeze).toBe(pack.rules.superFreeze);
    expect(r.state.players[0]!.ki).toBe(0);
    const frozen = run(r.state, [[20, 0, 0]]);
    expect(frozen.state.players[0]!.sf).toBe(0);
    const done = run(frozen.state, [[200, 0, 0]]);
    expect(done.events.filter((e) => e.t === Ev.HIT).length).toBe(5);
  });

  it('cancels two opposing ki blasts', () => {
    const r = run(training(), [[1, B.KI, B.KI], [60, 0, 0]]);
    expect(count(r.events, Ev.CLASH)).toBe(1);
    expect(count(r.events, Ev.HIT)).toBe(0);
  });
});

describe('rounds', () => {
  it('starts after the intro and counts the timer down', () => {
    const r = run(versus(), [[pack.rules.introFrames + 10, B.LIGHT, 0]]);
    expect(r.state.phase).toBe(Phase.FIGHT);
    expect(count(r.events, Ev.ROUND_START)).toBe(1);
    expect(r.state.timer).toBeLessThan(pack.rules.roundFrames);
  });

  it('ends a round by knockout and starts the next', () => {
    const s = versus();
    s.players[1]!.hp = 10;
    close(s);
    const r = run(s, [[pack.rules.introFrames, 0, 0], [1, B.LIGHT, 0], [10, 0, 0]]);
    expect(count(r.events, Ev.KO)).toBe(1);
    expect(r.state.players[0]!.wins).toBe(1);
    const next = run(r.state, [[pack.rules.koSlowFrames + pack.rules.roundEndFrames + 5, 0, 0]]);
    expect(next.state.round).toBe(2);
    expect(next.state.phase).toBe(Phase.INTRO);
    expect(next.state.players[1]!.hp).toBe(pack.fighters[0]!.stats.hp);
  });

  it('decides the match after the required round wins', () => {
    let s = versus();
    for (let round = 0; round < 2; round++) {
      s.players[1]!.hp = 10;
      close(s);
      s = run(s, [[pack.rules.introFrames, 0, 0], [1, B.LIGHT, 0], [300, 0, 0]]).state;
    }
    expect(s.phase).toBe(Phase.MATCH_END);
    expect(s.winner).toBe(0);
  });

  it('gives a timed-out round to the fighter with more health', () => {
    const s = versus();
    s.players[0]!.hp = 500;
    s.timer = 5;
    const r = run(s, [[pack.rules.introFrames + 10, 0, 0]]);
    expect(count(r.events, Ev.TIME_UP)).toBe(1);
    expect(r.state.players[1]!.wins).toBe(1);
    expect(r.state.players[0]!.wins).toBe(0);
  });

  it('grants a last stand once at low health', () => {
    const s = versus();
    close(s);
    s.players[1]!.hp = 270;
    s.players[1]!.ki = 0;
    const r = run(s, [[pack.rules.introFrames, 0, 0], [1, B.LIGHT, 0], [10, 0, 0]]);
    expect(count(r.events, Ev.LAST_STAND)).toBe(1);
    expect(r.state.players[1]!.ki).toBeGreaterThanOrEqual(pack.rules.lastStandKi);
  });
});

describe('training', () => {
  it('restores the dummy after a combo ends', () => {
    const r = run(close(training()), [[1, B.LIGHT, 0], [10, 0, 0]]);
    expect(r.state.players[1]!.hp).toBeLessThan(pack.fighters[0]!.stats.hp);
    const later = run(r.state, [[pack.rules.trainingRegenDelay + 40, 0, 0]]);
    expect(later.state.players[1]!.hp).toBe(pack.fighters[0]!.stats.hp);
  });

  it('never changes the previous state', () => {
    const s = training();
    const before = JSON.stringify(s);
    step(s, B.LIGHT, B.RIGHT, pack);
    expect(JSON.stringify(s)).toBe(before);
  });
});
