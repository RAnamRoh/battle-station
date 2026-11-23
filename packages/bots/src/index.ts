import { Btn, Cls, Phase, Slot, St, SUB, type SimPack, type State } from '@bs/sim';

/**
 * The computer opponent. It only ever produces the same input bits a person can press.
 * It keeps its own seeded random state, so the same seed and the same fight give the same choices.
 */

export const Level = { EASY: 0, NORMAL: 1, HARD: 2 } as const;
export const LEVEL_NAMES = ['Easy', 'Normal', 'Hard'] as const;

interface Tuning {
  /** Frames between decisions: a slower mind reacts later. */
  think: number;
  /** Chance out of 100 to guard an attack it sees coming. */
  guard: number;
  /** Chance out of 100 to do nothing useful this decision. */
  idle: number;
  /** Chance out of 100 to continue a combo after the first hits. */
  combo: number;
}

const TUNING: Tuning[] = [
  { think: 26, guard: 18, idle: 45, combo: 25 },
  { think: 14, guard: 50, idle: 18, combo: 65 },
  { think: 7, guard: 82, idle: 4, combo: 92 },
];

/** Pseudo-bits used inside plans; they become LEFT or RIGHT when the plan is played. */
const FWD = 1 << 12;
const BACK = 1 << 13;

export interface Bot {
  level: number;
  rng: number;
  wait: number;
  /** Queued inputs, one per frame. */
  plan: number[];
}

export function createBot(level: number, seed: number): Bot {
  return { level, rng: (seed | 0) || 1, wait: 20, plan: [] };
}

function roll(b: Bot, outOf: number): number {
  // xorshift32
  let x = b.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  b.rng = x | 0;
  return (x >>> 0) % outOf;
}
const chance = (b: Bot, percent: number) => roll(b, 100) < percent;

function push(b: Bot, frames: number, bits: number): void {
  for (let i = 0; i < frames; i++) b.plan.push(bits);
}
/** A press followed by a short release, so the sim sees a fresh button press. */
function tap(b: Bot, bits: number, gap = 5): void {
  push(b, 2, bits);
  push(b, gap, bits & (FWD | BACK | Btn.DOWN));
}

/** Returns the input for player `me` this frame. */
export function botInput(b: Bot, s: State, me: number, pack: SimPack): number {
  const p = s.players[me]!;
  const o = s.players[1 - me]!;
  if (s.phase !== Phase.FIGHT) { b.plan.length = 0; b.wait = 8 + roll(b, 10); return 0; }

  const t = TUNING[b.level] ?? TUNING[1]!;
  const f = pack.fighters[p.fighter]!;
  const dist = (o.x > p.x ? o.x - p.x : p.x - o.x) / SUB;
  const toward = o.x >= p.x ? 1 : -1;

  // Threats are checked every frame, but only acted on at the bot's reaction speed.
  let threat = false;
  let incoming = false;
  if (o.st === St.ATTACK && o.move >= 0) {
    const om = pack.fighters[o.fighter]!.moves[o.move];
    if (om) {
      const reach = om.hits.reduce((r, h) => Math.max(r, h.box.x + h.box.w), 0) + 60;
      if (dist < reach && om.cls !== Cls.THROW) threat = true;
    }
  }
  for (const pr of s.projs) {
    if (pr.owner === me) continue;
    const gap = (pr.x - p.x) / SUB;
    if ((pr.vx > 0 ? gap < 0 : gap > 0) && Math.abs(gap) < 260) { threat = true; incoming = true; }
  }

  if (b.plan.length === 0) {
    if (b.wait > 0) b.wait--;
    if (b.wait <= 0) {
      b.wait = t.think + roll(b, t.think);
      decide(b, s, me, pack, t, dist, threat, incoming);
    }
  }

  let bits = b.plan.length ? b.plan.shift()! : 0;
  if (bits & FWD) bits = (bits & ~FWD) | (toward > 0 ? Btn.RIGHT : Btn.LEFT);
  if (bits & BACK) bits = (bits & ~BACK) | (toward > 0 ? Btn.LEFT : Btn.RIGHT);
  void f;
  return bits & 1023;
}

function decide(b: Bot, s: State, me: number, pack: SimPack, t: Tuning, dist: number, threat: boolean, incoming: boolean): void {
  const p = s.players[me]!;
  const o = s.players[1 - me]!;
  const f = pack.fighters[p.fighter]!;
  const r = pack.rules;
  const cost = (slot: number) => f.moves[slot]?.kiCost ?? 99999;
  const has = (slot: number) => f.moves[slot] != null && p.ki >= cost(slot);
  const free = p.st === St.IDLE || p.st === St.CROUCH || p.st === St.GUARD || p.st === St.CHARGE;
  if (!free && p.st !== St.JUMP) { b.wait = 2; return; }

  // Jumping over a ki blast is how close-range fighters get in.
  if (incoming && free && dist > 200 && chance(b, t.guard >> 1)) { push(b, 3, Btn.UP | FWD); push(b, 12, FWD); return; }
  if (threat && chance(b, t.guard)) {
    // A reversal now and then at the higher levels.
    if (b.level === Level.HARD && dist < 110 && has(Slot.K2) && chance(b, 25)) { tap(b, Btn.DOWN | Btn.KI, 12); return; }
    push(b, 16 + roll(b, 14), Btn.GUARD);
    return;
  }
  if (chance(b, t.idle)) {
    // Beginners' habits: stand there, back off, or jump for no reason.
    const pick = roll(b, 3);
    if (pick === 0) push(b, 12 + roll(b, 20), 0);
    else if (pick === 1) push(b, 14, BACK);
    else push(b, 3, Btn.UP);
    return;
  }

  const opponentDown = o.st === St.DOWN || o.st === St.GETUP || o.st === St.LAUNCH;
  const superMove = f.moves[Slot.SUPER];
  if (superMove && p.ki >= r.kiMax && p.st !== St.JUMP) {
    const reach = superMove.hits.reduce((m, h) => Math.max(m, h.box.x + h.box.w), 0) + (superMove.moveX.length ? 260 : 0);
    if (dist < reach - 30 && !opponentDown && o.y === 0) { tap(b, Btn.SUPER, 20); return; }
  }

  if (p.st === St.JUMP) {
    if (dist < 150) tap(b, chance(b, 60) ? Btn.HEAVY : Btn.LIGHT, 8);
    else push(b, 4, 0);
    return;
  }

  const blast = f.moves[Slot.K5];
  const signature = f.moves[Slot.K4];
  const sigIsBlast = signature?.projectile != null;
  const sigReach = signature ? signature.hits.reduce((m, h) => Math.max(m, h.box.x + h.box.w), 0) + signature.moveX.reduce((m, sg) => m + (sg.speed > 0 ? ((sg.to - sg.from + 1) * sg.speed) / SUB : 0), 0) : 0;

  if (dist > 380) {
    const pick = roll(b, 100);
    if (blast?.projectile && has(Slot.K5) && pick < 34) { tap(b, Btn.KI, 18); return; }
    if (sigIsBlast && has(Slot.K4) && pick < 50) { tap(b, BACK | Btn.KI, 24); return; }
    if (p.ki < r.kiMax && pick < 62) { push(b, 30 + roll(b, 40), Btn.CHARGE); return; }
    if (pick < 80) { push(b, 2, FWD); push(b, 2, 0); push(b, 10, FWD); return; } // dash in
    push(b, 18 + roll(b, 14), FWD);
    return;
  }

  if (dist > 150) {
    const pick = roll(b, 100);
    if (signature && !sigIsBlast && has(Slot.K4) && dist < sigReach && pick < 22) { tap(b, BACK | Btn.KI, 24); return; }
    if (has(Slot.K6) && dist < 300 && pick < 40) { tap(b, FWD | Btn.KI, 26); return; }
    if (sigIsBlast && has(Slot.K4) && pick < 52) { tap(b, BACK | Btn.KI, 24); return; }
    if (blast?.projectile && has(Slot.K5) && pick < 60) { tap(b, Btn.KI, 16); return; }
    if (pick < 72) { push(b, 3, Btn.UP | FWD); push(b, 14, FWD); return; } // jump in
    if (pick < 86) { push(b, 2, FWD); push(b, 2, 0); push(b, 8, FWD); return; }
    push(b, 10 + roll(b, 10), FWD);
    return;
  }

  // Close range.
  if (opponentDown) {
    if (chance(b, 50)) push(b, 12, BACK); else push(b, 10, Btn.GUARD);
    return;
  }
  const pick = roll(b, 100);
  const oppGuarding = o.st === St.GUARD || o.st === St.BLOCK;
  const grab = signature?.hits[0]?.throw === 1 && has(Slot.K4);
  if (dist < 80 && (oppGuarding ? pick < 55 : pick < 12)) {
    if (grab && chance(b, 50)) tap(b, BACK | Btn.KI, 20); else tap(b, Btn.LIGHT | Btn.HEAVY, 16);
    return;
  }
  if (pick < 14) { tap(b, Btn.DOWN | Btn.HEAVY, 18); return; }
  if (pick < 24) { tap(b, BACK | Btn.HEAVY, 18); return; }
  if (pick < 34 && dist > 90) { tap(b, FWD | Btn.HEAVY, 20); return; }
  if (pick < 40) { push(b, 12, BACK); return; }
  // The bread-and-butter string: light, light, heavy, then a power move if the level allows.
  tap(b, Btn.LIGHT, 6);
  if (chance(b, t.combo)) {
    tap(b, FWD | Btn.LIGHT, 7);
    tap(b, Btn.HEAVY, 10);
    if (chance(b, t.combo) && has(Slot.K6)) tap(b, FWD | Btn.KI, 20);
  }
}
