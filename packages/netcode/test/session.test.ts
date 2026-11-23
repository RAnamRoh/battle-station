import { describe, expect, it } from 'vitest';
import { createMatch, hashState, step, type SimPack, type State } from '@bs/sim';
import fixture from '../../sim/test/fixture.pack.json';
import { RollbackSession, type Transport } from '../src/index';

const pack = fixture as unknown as SimPack;

/** A pretend network between two players, with delay, jitter and loss, driven by a test clock. */
class FakeNet {
  time = 0;
  private queue: { at: number; to: number; data: Uint8Array }[] = [];
  private seed: number;
  readonly ends: [Transport, Transport];
  blocked = false;
  constructor(seed: number, private latency: number, private jitter: number, private loss: number) {
    this.seed = seed;
    const make = (from: number): Transport => ({
      onMessage: null,
      send: (data) => {
        if (this.blocked || this.rand() < this.loss) return;
        const at = this.time + this.latency + this.rand() * this.jitter;
        this.queue.push({ at, to: 1 - from, data: data.slice() });
        // Now and then the same message arrives twice.
        if (this.rand() < 0.03) this.queue.push({ at: at + this.rand() * 30, to: 1 - from, data: data.slice() });
      },
    });
    this.ends = [make(0), make(1)];
  }
  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0;
    return (this.seed >>> 0) / 4294967296;
  }
  deliver(): void {
    const due = this.queue.filter((m) => m.at <= this.time).sort((a, b) => a.at - b.at);
    this.queue = this.queue.filter((m) => m.at > this.time);
    for (const m of due) this.ends[m.to]!.onMessage?.(m.data);
  }
}

function inputs(seed: number) {
  let x = seed | 0;
  let held = 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) | 0;
    if ((x >>> 8) % 5 === 0) held = (x >>> 12) & 1023;
    return held;
  };
}

function setup(seed: number, latency: number, jitter: number, loss: number) {
  const net = new FakeNet(seed, latency, jitter, loss);
  const initial = createMatch({ fighters: [0, 0], seed }, pack);
  const now = () => net.time;
  const a = new RollbackSession({ pack, initial, local: 0, transport: net.ends[0], now });
  const b = new RollbackSession({ pack, initial, local: 1, transport: net.ends[1], now });
  return { net, initial, a, b };
}

function run(seed: number, latency: number, jitter: number, loss: number, ticks: number) {
  const t = setup(seed, latency, jitter, loss);
  const ia = inputs(seed * 3 + 1);
  const ib = inputs(seed * 5 + 2);
  for (let i = 0; i < ticks; i++) {
    t.net.time += 1000 / 60;
    t.net.deliver();
    t.a.tick(ia());
    // Player B's clock runs a little slow, as real devices' clocks differ.
    if (i % 97 !== 0) t.b.tick(ib());
  }
  // Let the last messages arrive.
  for (let i = 0; i < 120; i++) { t.net.time += 1000 / 60; t.net.deliver(); t.a.tick(0); t.b.tick(0); }
  return t;
}

function reference(initial: State, a: readonly number[], b: readonly number[], frames: number): number {
  let s = initial;
  for (let f = 0; f < frames; f++) s = step(s, a[f] ?? 0, b[f] ?? 0, pack).state;
  return hashState(s);
}

describe('rollback session', () => {
  const cases: [string, number, number, number][] = [
    ['a perfect link', 0, 0, 0],
    ['office Wi-Fi (30 ms, some jitter)', 30, 12, 0.01],
    ['mobile data (90 ms, heavy jitter, 8% loss)', 90, 60, 0.08],
    ['a bad link (160 ms, 20% loss)', 160, 80, 0.2],
  ];
  for (const [name, latency, jitter, loss] of cases) {
    it(`keeps both players in agreement over ${name}`, () => {
      const t = run(11, latency, jitter, loss, 2400);
      expect(t.a.desync).toBe(false);
      expect(t.b.desync).toBe(false);
      const common = [...t.a.checks.keys()].filter((f) => t.b.checks.has(f));
      expect(common.length).toBeGreaterThan(20);
      for (const f of common) expect(t.a.checks.get(f), `frame ${f}`).toBe(t.b.checks.get(f));
      // Both must also match a plain run of the fight with the same inputs.
      const last = Math.max(...common);
      expect(t.a.checks.get(last)).toBe(reference(t.initial, t.a.localInputLog(), t.b.localInputLog(), last));
      if (latency > 0) expect(t.a.rollbackFrames).toBeGreaterThan(0);
    });
  }

  it('keeps the players within a few frames of each other', () => {
    const t = run(4, 60, 20, 0.02, 3000);
    expect(Math.abs(t.a.frame - t.b.frame)).toBeLessThan(8);
    expect(t.a.ping).toBeGreaterThan(80);
    expect(t.a.ping).toBeLessThan(260);
  });

  it('holds still when the other player goes silent, then carries on', () => {
    const t = setup(7, 20, 0, 0);
    const tickBoth = (n: number) => { for (let i = 0; i < n; i++) { t.net.time += 1000 / 60; t.net.deliver(); t.a.tick(0); t.b.tick(0); } };
    tickBoth(120);
    expect(t.a.stalled).toBe(false);
    t.net.blocked = true;
    for (let i = 0; i < 90; i++) { t.net.time += 1000 / 60; t.net.deliver(); t.a.tick(0); }
    const held = t.a.frame;
    expect(t.a.stalled).toBe(true);
    expect(t.a.frame - t.a.confirmedFrame).toBeLessThanOrEqual(8);
    expect(t.a.silentMs).toBeGreaterThan(1000);
    t.net.blocked = false;
    tickBoth(240);
    expect(t.a.stalled).toBe(false);
    expect(t.a.frame).toBeGreaterThan(held + 100);
    expect(t.a.desync).toBe(false);
  });

  it('reports a desync when the two devices compute different fights', () => {
    const net = new FakeNet(3, 20, 0, 0);
    const initial = createMatch({ fighters: [0, 0], seed: 3 }, pack);
    const other = createMatch({ fighters: [0, 0], seed: 3 }, pack);
    other.players[0]!.hp -= 1; // one device starts from different data
    const now = () => net.time;
    const a = new RollbackSession({ pack, initial, local: 0, transport: net.ends[0], now });
    const b = new RollbackSession({ pack, initial: other, local: 1, transport: net.ends[1], now });
    for (let i = 0; i < 200; i++) { net.time += 1000 / 60; net.deliver(); a.tick(0); b.tick(0); }
    expect(a.desync || b.desync).toBe(true);
  });

  it('shows each event once despite rollbacks', () => {
    const t = setup(21, 80, 40, 0.05);
    const ia = inputs(1);
    const ib = inputs(2);
    const seen = new Set<string>();
    let repeats = 0;
    for (let i = 0; i < 2000; i++) {
      t.net.time += 1000 / 60; t.net.deliver();
      for (const e of t.a.tick(ia())) {
        const k = `${e.f}:${e.t}:${e.p}:${e.a}:${e.b}`;
        if (seen.has(k)) repeats++;
        seen.add(k);
      }
      t.b.tick(ib());
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(repeats).toBe(0);
  });
});
