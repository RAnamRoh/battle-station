import { approachZero, clamp, idiv } from './int';
import {
  Btn, BUTTON_BITS, Cls, Ev, INPUT_MASK, Phase, Slot, St, SUB,
  type FighterDef, type HitProps, type MatchConfig, type MoveDef, type PlayerState, type Rules,
  type SimEvent, type SimPack, type State, type StepResult,
} from './types';

// ---------- generic copy and checksum (state holds only integers in plain objects and arrays) ----------

export function cloneState<T>(v: T): T {
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(cloneState(v[i]));
    return out as T;
  }
  if (typeof v === 'object' && v !== null) {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      out[k] = cloneState(src[k]);
    }
    return out as T;
  }
  return v;
}

function mix(h: number, n: number): number {
  return Math.imul(h ^ (n | 0), 16777619);
}

function hashValue(h: number, v: unknown): number {
  if (typeof v === 'number') return mix(h, v);
  if (Array.isArray(v)) {
    h = mix(h, v.length);
    for (let i = 0; i < v.length; i++) h = hashValue(h, v[i]);
    return h;
  }
  if (typeof v === 'object' && v !== null) {
    const src = v as Record<string, unknown>;
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) h = hashValue(h, src[keys[i]!]);
    return h;
  }
  return h;
}

/** A 32-bit checksum of the whole state. Equal states give equal checksums on every machine. */
export function hashState(s: State): number {
  return hashValue(-2128831035, s) >>> 0;
}

// ---------- setup ----------

function newPlayer(fighter: number, simple: number): PlayerState {
  return {
    fighter, simple,
    x: 0, y: 0, vx: 0, vy: 0, facing: 1,
    hp: 0, ki: 0, guard: 0, guardWait: 0,
    st: St.IDLE, sf: 0,
    move: -1, hitMask: 0, connected: 0, chain: 0,
    stun: 0,
    comboHits: 0, comboDmg: 0, juggle: 0,
    prevIn: 0,
    bufBtn: 0, bufDir: 0, bufTtl: 0,
    dirPrev1: 0, dirPrev2: 0,
    tapDir: 0, tapT: 0, dashReq: 0, dashReqT: 0,
    invul: 0,
    wins: 0,
    lastStand: 0,
    regenWait: 0,
  };
}

function resetRound(s: State, pack: SimPack): void {
  const r = pack.rules;
  for (let i = 0; i < 2; i++) {
    const p = s.players[i]!;
    const f = pack.fighters[p.fighter]!;
    const side = i === 0 ? -1 : 1;
    p.x = side * idiv(r.startGap * SUB, 2);
    p.y = 0; p.vx = 0; p.vy = 0;
    p.facing = -side;
    p.hp = f.stats.hp;
    p.guard = f.stats.guardMax; p.guardWait = 0;
    p.st = St.IDLE; p.sf = 0;
    p.move = -1; p.hitMask = 0; p.connected = 0; p.chain = 0;
    p.stun = 0; p.comboHits = 0; p.comboDmg = 0; p.juggle = 0;
    p.bufTtl = 0; p.dashReqT = 0; p.tapT = 0;
    p.invul = 0; p.lastStand = 0; p.regenWait = 0;
  }
  s.projs = [];
  s.timer = r.roundFrames;
  s.hitstop = 0; s.freeze = 0;
  s.phase = Phase.INTRO;
  s.phaseT = r.introFrames;
}

export function createMatch(cfg: MatchConfig, pack: SimPack): State {
  const seed = cfg.seed | 0;
  const s: State = {
    frame: 0,
    phase: Phase.INTRO, phaseT: 0,
    round: 1, timer: 0,
    hitstop: 0, freeze: 0,
    winner: -1,
    training: cfg.training ? 1 : 0,
    kiRefill: cfg.kiRefill ? 1 : 0,
    rngA: seed, rngB: seed ^ 0x5bd1e995, rngC: 0x9e3779b9 | 0, rngD: 1,
    players: [
      newPlayer(cfg.fighters[0], cfg.simple && cfg.simple[0] ? 1 : 0),
      newPlayer(cfg.fighters[1], cfg.simple && cfg.simple[1] ? 1 : 0),
    ],
    projs: [],
  };
  for (let i = 0; i < 2; i++) s.players[i]!.ki = pack.rules.kiStart;
  resetRound(s, pack);
  if (s.training) { s.phase = Phase.FIGHT; s.phaseT = 0; }
  return s;
}

/** Seeded random number (sfc32). Its state lives in the sim state, so it survives snapshots. */
export function rngNext(s: State): number {
  const t = (((s.rngA + s.rngB) | 0) + s.rngD) | 0;
  s.rngD = (s.rngD + 1) | 0;
  s.rngA = s.rngB ^ (s.rngB >>> 9);
  s.rngB = (s.rngC + (s.rngC << 3)) | 0;
  s.rngC = ((s.rngC << 21) | (s.rngC >>> 11)) + t | 0;
  return t >>> 0;
}

// ---------- queries shared with the renderer ----------

export interface Rect { x0: number; y0: number; x1: number; y1: number }

export function isAirborne(p: PlayerState): boolean {
  return p.st === St.JUMP || p.st === St.LAUNCH || p.y > 0;
}

/** Body rectangle in subpixels. */
export function hurtRect(p: PlayerState, f: FighterDef): Rect {
  const half = idiv(f.stats.width * SUB, 2);
  const h = (p.st === St.CROUCH ? f.stats.crouchHeight : f.stats.height) * SUB;
  return { x0: p.x - half, y0: p.y, x1: p.x + half, y1: p.y + h };
}

/** Attack rectangles active this frame, in subpixels. */
export function activeHitRects(p: PlayerState, f: FighterDef): Rect[] {
  const out: Rect[] = [];
  if (p.st !== St.ATTACK || p.move < 0) return out;
  const m = f.moves[p.move];
  if (!m) return out;
  for (let k = 0; k < m.hits.length; k++) {
    const h = m.hits[k]!;
    if (p.sf >= h.from && p.sf <= h.to) out.push(boxRect(p, h.box.x, h.box.y, h.box.w, h.box.h));
  }
  return out;
}

function boxRect(p: PlayerState, bx: number, by: number, bw: number, bh: number): Rect {
  const near = p.x + p.facing * bx * SUB;
  const far = near + p.facing * bw * SUB;
  return {
    x0: near < far ? near : far,
    x1: near < far ? far : near,
    y0: p.y + by * SUB,
    y1: p.y + (by + bh) * SUB,
  };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// ---------- input ----------

function bufferInput(p: PlayerState, input: number, r: Rules): void {
  const pressed = input & ~p.prevIn;
  const btn = pressed & BUTTON_BITS;
  const dirNow = input & (Btn.DOWN | Btn.LEFT | Btn.RIGHT);
  if (p.bufTtl > 0) p.bufTtl--;
  if (btn !== 0) {
    // Buttons pressed within two frames of each other count as pressed together (for throws).
    p.bufBtn = p.bufTtl >= r.bufferFrames - 2 ? p.bufBtn | btn : btn;
    p.bufDir = dirNow !== 0 ? dirNow : p.dirPrev1 !== 0 ? p.dirPrev1 : p.dirPrev2;
    p.bufTtl = r.bufferFrames;
  }
  p.dirPrev2 = p.dirPrev1;
  p.dirPrev1 = dirNow;

  if (p.tapT > 0) p.tapT--;
  if (p.dashReqT > 0) p.dashReqT--;
  const side = pressed & (Btn.LEFT | Btn.RIGHT);
  if (side === Btn.LEFT || side === Btn.RIGHT) {
    const d = side === Btn.RIGHT ? 1 : -1;
    if (p.tapDir === d && p.tapT > 0) {
      p.dashReq = d; p.dashReqT = 6; p.tapT = 0;
    } else {
      p.tapDir = d; p.tapT = r.dashTapWindow;
    }
  }
  p.prevIn = input;
}

function pickDirSlot(base5: number, base6: number, base4: number, base2: number, p: PlayerState): number {
  const fwdBit = p.facing > 0 ? Btn.RIGHT : Btn.LEFT;
  const backBit = p.facing > 0 ? Btn.LEFT : Btn.RIGHT;
  if (p.bufDir & Btn.DOWN) return base2;
  if (p.bufDir & fwdBit) return base6;
  if (p.bufDir & backBit) return base4;
  return base5;
}

function pickSlot(p: PlayerState, f: FighterDef, r: Rules, air: boolean): number {
  const btn = p.bufBtn;
  if (air) {
    if (btn & Btn.HEAVY) return f.moves[Slot.JH] ? Slot.JH : -1;
    if (btn & Btn.LIGHT) return f.moves[Slot.JL] ? Slot.JL : -1;
    return -1;
  }
  const wantsSuper = (btn & Btn.SUPER) !== 0 || (p.simple === 1 && (btn & Btn.KI) !== 0);
  if (wantsSuper && p.ki >= r.kiMax && f.moves[Slot.SUPER]) return Slot.SUPER;
  if ((btn & Btn.LIGHT) && (btn & Btn.HEAVY) && f.moves[Slot.THROW]) return Slot.THROW;
  if (btn & Btn.KI) {
    let c = pickDirSlot(Slot.K5, Slot.K6, Slot.K4, Slot.K2, p);
    let m = f.moves[c];
    if (!m || p.ki < m.kiCost) { c = Slot.K5; m = f.moves[c]; }
    if (!m || p.ki < m.kiCost) return -1;
    return c;
  }
  if (btn & Btn.HEAVY) {
    const c = pickDirSlot(Slot.H5, Slot.H6, Slot.H4, Slot.H2, p);
    return f.moves[c] ? c : f.moves[Slot.H5] ? Slot.H5 : -1;
  }
  if (btn & Btn.LIGHT) {
    const c = pickDirSlot(Slot.L5, Slot.L6, Slot.L4, Slot.L2, p);
    return f.moves[c] ? c : f.moves[Slot.L5] ? Slot.L5 : -1;
  }
  return -1;
}

function pushEvent(ev: SimEvent[], t: number, f: number, p: number, a: number, b: number, x: number, y: number, n: number): void {
  ev.push({ t, f, p, a, b, x: idiv(x, SUB), y: idiv(y, SUB), n });
}

function setState(p: PlayerState, st: number): void {
  if (p.st !== st) { p.st = st; p.sf = 0; }
}

function startMove(s: State, i: number, slot: number, m: MoveDef, fresh: boolean, r: Rules, ev: SimEvent[]): void {
  const p = s.players[i]!;
  p.st = St.ATTACK; p.sf = 0;
  p.move = slot; p.hitMask = 0; p.connected = 0;
  p.chain = fresh ? 1 << slot : p.chain | (1 << slot);
  p.ki -= m.kiCost;
  p.bufTtl = 0;
  if (!m.air) p.vx = 0;
  if (m.cls === Cls.SUPER) {
    s.freeze = r.superFreeze;
    pushEvent(ev, Ev.SUPER, s.frame, i, slot, 3, p.x, p.y, 0);
  } else {
    pushEvent(ev, Ev.SWING, s.frame, i, slot, m.cls, p.x, p.y, 0);
  }
}

function tryStartMove(s: State, i: number, pack: SimPack, air: boolean, ev: SimEvent[]): boolean {
  const p = s.players[i]!;
  if (p.bufTtl <= 0) return false;
  const f = pack.fighters[p.fighter]!;
  const slot = pickSlot(p, f, pack.rules, air);
  if (slot < 0) { p.bufTtl = 0; return false; }
  startMove(s, i, slot, f.moves[slot]!, true, pack.rules, ev);
  return true;
}

// ---------- per-player update ----------

function groundFree(s: State, i: number, input: number, pack: SimPack, ev: SimEvent[]): void {
  const p = s.players[i]!;
  const f = pack.fighters[p.fighter]!;
  const r = pack.rules;
  if (tryStartMove(s, i, pack, false, ev)) return;
  if (p.dashReqT > 0) {
    p.dashReqT = 0;
    if (p.dashReq === p.facing) {
      setState(p, St.DASH);
    } else {
      setState(p, St.BACKDASH);
      p.invul = r.backdashInvul;
    }
    pushEvent(ev, Ev.DASH, s.frame, i, p.st, 0, p.x, p.y, 0);
    return;
  }
  if (input & Btn.CHARGE) {
    setState(p, St.CHARGE);
    p.vx = 0;
    p.ki = clamp(p.ki + r.kiCharge, 0, r.kiMax);
    return;
  }
  if (input & Btn.GUARD) { setState(p, St.GUARD); p.vx = 0; return; }
  const dx = (input & Btn.RIGHT ? 1 : 0) - (input & Btn.LEFT ? 1 : 0);
  if (input & Btn.UP) {
    setState(p, St.JUMP);
    p.vy = f.stats.jumpVy;
    p.vx = dx * f.stats.jumpVx;
    pushEvent(ev, Ev.JUMP, s.frame, i, 0, 0, p.x, p.y, 0);
    return;
  }
  if (input & Btn.DOWN) { setState(p, St.CROUCH); p.vx = 0; return; }
  setState(p, St.IDLE);
  p.vx = dx === 0 ? 0 : dx === p.facing ? dx * f.stats.walkF : dx * f.stats.walkB;
}

function runMove(s: State, i: number, input: number, pack: SimPack, ev: SimEvent[]): void {
  const p = s.players[i]!;
  const f = pack.fighters[p.fighter]!;
  const r = pack.rules;
  const m = f.moves[p.move]!;
  const fr = p.sf;

  // Light or heavy started a moment before the other button: turn it into a throw.
  if (!m.air && fr <= 3 && m.cls <= Cls.HEAVY && f.moves[Slot.THROW] &&
      (input & Btn.LIGHT) && (input & Btn.HEAVY) && p.bufTtl > 0) {
    startMove(s, i, Slot.THROW, f.moves[Slot.THROW]!, true, r, ev);
    return;
  }

  if (!m.air) {
    p.vx = 0;
    for (let k = 0; k < m.moveX.length; k++) {
      const seg = m.moveX[k]!;
      if (fr >= seg.from && fr <= seg.to) p.vx = p.facing * seg.speed;
    }
  }
  if (m.invFrom > 0 && fr >= m.invFrom && fr <= m.invTo && p.invul < 1) p.invul = 1;

  const pr = m.projectile;
  if (pr && fr === pr.frame) {
    s.projs.push({
      owner: i, slot: p.move,
      x: p.x + p.facing * pr.x * SUB, y: p.y + pr.y * SUB,
      vx: p.facing * pr.speed, life: pr.life,
    });
    pushEvent(ev, Ev.PROJECTILE, s.frame, i, p.move, pr.tier, p.x + p.facing * pr.x * SUB, p.y + pr.y * SUB, 0);
  }

  if (p.connected === 1 && p.bufTtl > 0 && m.cls !== Cls.THROW) {
    let slot = pickSlot(p, f, r, m.air === 1);
    if (p.simple === 1 && p.bufBtn === Btn.LIGHT) {
      const at = f.autoChain.indexOf(p.move);
      if (at >= 0 && at + 1 < f.autoChain.length) {
        const nextSlot = f.autoChain[at + 1]!;
        const nm = f.moves[nextSlot];
        slot = nm && p.ki >= nm.kiCost ? nextSlot : -1;
      }
    }
    if (slot >= 0) {
      const n = f.moves[slot]!;
      const ok = n.cls !== Cls.THROW &&
        (n.cls > m.cls || (n.cls === Cls.LIGHT && m.cls === Cls.LIGHT && (p.chain & (1 << slot)) === 0));
      if (ok) { startMove(s, i, slot, n, false, r, ev); return; }
    }
  }

  if (fr >= m.total) {
    p.move = -1;
    p.st = isAirborne(p) ? St.JUMP : St.IDLE;
    p.sf = 0;
  }
}

function updatePlayer(s: State, i: number, input: number, pack: SimPack, ev: SimEvent[]): void {
  const p = s.players[i]!;
  const f = pack.fighters[p.fighter]!;
  const r = pack.rules;
  p.sf++;
  if (p.invul > 0) p.invul--;
  switch (p.st) {
    case St.IDLE: case St.CROUCH: case St.GUARD: case St.CHARGE:
      groundFree(s, i, input, pack, ev);
      break;
    case St.DASH:
      p.vx = p.facing * f.stats.dashSpeed;
      if (p.sf >= 4 && tryStartMove(s, i, pack, false, ev)) break;
      if (p.sf >= f.stats.dashFrames) { p.vx = 0; setState(p, St.IDLE); }
      break;
    case St.BACKDASH:
      p.vx = -p.facing * f.stats.backdashSpeed;
      if (p.sf >= f.stats.backdashFrames) { p.vx = 0; setState(p, St.IDLE); }
      break;
    case St.JUMP:
      tryStartMove(s, i, pack, true, ev);
      break;
    case St.ATTACK:
      runMove(s, i, input, pack, ev);
      break;
    case St.HIT: case St.BLOCK: case St.BREAK:
      p.stun--;
      if (p.stun <= 0) setState(p, St.IDLE);
      break;
    case St.LAUNCH:
      break;
    case St.DOWN:
      p.vx = 0;
      if ((p.hp > 0 || s.training === 1) && p.sf >= r.downFrames) {
        setState(p, St.GETUP);
        p.invul = r.getupFrames + 2;
      }
      break;
    case St.GETUP:
      if (p.sf >= r.getupFrames) setState(p, St.IDLE);
      break;
  }
}

function physics(s: State, i: number, pack: SimPack, ev: SimEvent[]): void {
  const p = s.players[i]!;
  const f = pack.fighters[p.fighter]!;
  const air = isAirborne(p);
  if (air) p.vy -= f.stats.gravity;
  p.x += p.vx;
  p.y += p.vy;
  if (air && p.y <= 0 && p.vy <= 0) {
    p.y = 0; p.vy = 0;
    if (p.st === St.LAUNCH) {
      p.st = St.DOWN; p.sf = 0; p.vx = 0;
      pushEvent(ev, Ev.KNOCKDOWN, s.frame, i, 0, 0, p.x, 0, 0);
    } else {
      if (p.st === St.JUMP || p.st === St.ATTACK) { p.st = St.IDLE; p.sf = 0; p.move = -1; p.vx = 0; }
      pushEvent(ev, Ev.LAND, s.frame, i, 0, 0, p.x, 0, 0);
    }
  }
  if (!air && (p.st === St.HIT || p.st === St.BLOCK || p.st === St.BREAK)) {
    p.vx = approachZero(p.vx, pack.rules.friction);
  }
}

function clampToStage(p: PlayerState, f: FighterDef, r: Rules): void {
  const lim = idiv(r.stageWidth * SUB, 2) - idiv(f.stats.width * SUB, 2);
  p.x = clamp(p.x, -lim, lim);
}

function separate(s: State, pack: SimPack): void {
  const a = s.players[0]!;
  const b = s.players[1]!;
  const fa = pack.fighters[a.fighter]!;
  const fb = pack.fighters[b.fighter]!;
  const r = pack.rules;
  clampToStage(a, fa, r);
  clampToStage(b, fb, r);
  const solid = (p: PlayerState) => p.st !== St.LAUNCH && p.st !== St.DOWN;
  if (!solid(a) || !solid(b)) return;
  if (a.y >= fb.stats.height * SUB || b.y >= fa.stats.height * SUB) return;
  const minDist = idiv((fa.stats.width + fb.stats.width) * SUB, 2);
  let dx = b.x - a.x;
  const dir = dx > 0 ? 1 : dx < 0 ? -1 : a.facing;
  let gap = minDist - (dx < 0 ? -dx : dx);
  if (gap <= 0) return;
  const halfGap = idiv(gap, 2);
  a.x -= dir * halfGap;
  b.x += dir * (gap - halfGap);
  clampToStage(a, fa, r);
  clampToStage(b, fb, r);
  dx = b.x - a.x;
  gap = minDist - (dx < 0 ? -dx : dx);
  if (gap > 0) {
    b.x += dir * gap;
    clampToStage(b, fb, r);
    dx = b.x - a.x;
    gap = minDist - (dx < 0 ? -dx : dx);
    if (gap > 0) { a.x -= dir * gap; clampToStage(a, fa, r); }
  }
}

function updateFacing(s: State): void {
  for (let i = 0; i < 2; i++) {
    const p = s.players[i]!;
    const o = s.players[1 - i]!;
    if (p.y === 0 && (p.st === St.IDLE || p.st === St.CROUCH || p.st === St.GUARD || p.st === St.CHARGE)) {
      if (o.x > p.x) p.facing = 1;
      else if (o.x < p.x) p.facing = -1;
    }
  }
}

// ---------- hits ----------

function canBeHit(s: State, v: PlayerState, r: Rules, isThrow: boolean): boolean {
  if (v.invul > 0) return false;
  if (v.hp <= 0 && s.training === 0) return false;
  if (v.st === St.DOWN || v.st === St.GETUP) return false;
  if (v.st === St.LAUNCH && v.juggle >= r.juggleLimit) return false;
  if (isThrow) {
    if (v.y > 0) return false;
    return v.st === St.IDLE || v.st === St.CROUCH || v.st === St.GUARD || v.st === St.CHARGE;
  }
  return true;
}

function isGuarding(v: PlayerState, dir: number): boolean {
  if (v.y > 0) return false;
  if (!(v.st === St.IDLE || v.st === St.CROUCH || v.st === St.GUARD || v.st === St.BLOCK)) return false;
  if (v.prevIn & Btn.GUARD) return true;
  // Holding away from the attack.
  return (v.prevIn & (dir > 0 ? Btn.RIGHT : Btn.LEFT)) !== 0;
}

function addKi(p: PlayerState, amount: number, f: FighterDef, r: Rules): void {
  p.ki = clamp(p.ki + idiv(amount * f.stats.kiGainMul, 100), 0, r.kiMax);
}

/** Applies one hit from attacker ai to the other player. dir is the direction the hit travels. */
function applyHit(
  s: State, ai: number, h: HitProps, isThrow: boolean, isMelee: boolean, dir: number,
  cx: number, cy: number, slot: number, pack: SimPack, ev: SimEvent[],
): void {
  const r = pack.rules;
  const a = s.players[ai]!;
  const v = s.players[1 - ai]!;
  const fa = pack.fighters[a.fighter]!;
  const fv = pack.fighters[v.fighter]!;
  const atWall = (dir > 0 ? v.x : -v.x) >= idiv(r.stageWidth * SUB, 2) - idiv(fv.stats.width * SUB, 2) - SUB;

  if (!isThrow && isGuarding(v, dir)) {
    v.st = St.BLOCK; v.sf = 0; v.move = -1;
    v.stun = h.blockstun;
    v.vx = dir * h.pushX;
    v.guard -= h.guardDamage; v.guardWait = 0;
    if (h.chip > 0) v.hp = v.hp - h.chip < 1 ? 1 : v.hp - h.chip;
    addKi(a, r.kiBlock, fa, r);
    if (v.guard <= 0) {
      v.guard = fv.stats.guardMax;
      v.st = St.BREAK; v.stun = r.guardBreakStun;
      pushEvent(ev, Ev.GUARD_BREAK, s.frame, 1 - ai, slot, h.tier, cx, cy, 0);
    } else {
      pushEvent(ev, Ev.BLOCK, s.frame, ai, slot, h.tier, cx, cy, 0);
    }
  } else {
    const steps = r.comboScale.length;
    const scale = r.comboScale[v.comboHits < steps ? v.comboHits : steps - 1]!;
    let dmg = idiv(h.damage * fa.stats.damageMul * scale, 10000);
    if (a.simple === 1) dmg = idiv(dmg * r.simpleDamagePercent, 100);
    if (dmg < 1) dmg = 1;
    v.hp -= dmg;
    if (s.training === 1 && v.hp < 1) v.hp = 1;
    v.comboHits++; v.comboDmg += dmg; v.regenWait = 0;
    v.move = -1;
    const wasAir = isAirborne(v);
    if (wasAir || h.launchY > 0 || isThrow) {
      v.st = St.LAUNCH; v.sf = 0;
      v.vy = h.launchY > 0 ? h.launchY : 3 * SUB;
      v.vx = dir * h.pushX;
      v.juggle++;
    } else {
      v.st = St.HIT; v.sf = 0;
      const decay = idiv(v.comboHits - 1, r.hitstunDecayEvery);
      v.stun = h.hitstun - decay < r.minHitstun ? r.minHitstun : h.hitstun - decay;
      v.vx = dir * h.pushX;
    }
    addKi(a, r.kiHit, fa, r);
    addKi(v, r.kiTaken, fv, r);
    pushEvent(ev, isThrow ? Ev.THROW : Ev.HIT, s.frame, ai, slot, h.tier, cx, cy, v.comboHits);
  }
  // A cornered victim cannot move back, so the attacker is pushed away instead.
  if (isMelee && atWall && a.y === 0 && !isThrow) a.vx = -dir * h.pushX;
  if (h.hitstop > s.hitstop) s.hitstop = h.hitstop;
}

function resolveHits(s: State, pack: SimPack, ev: SimEvent[]): void {
  const r = pack.rules;
  // Find both players' melee hits first so that trades are possible.
  const pend: { ai: number; k: number; cx: number; cy: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const p = s.players[i]!;
    if (p.st !== St.ATTACK || p.move < 0) continue;
    const f = pack.fighters[p.fighter]!;
    const m = f.moves[p.move]!;
    const v = s.players[1 - i]!;
    const vr = hurtRect(v, pack.fighters[v.fighter]!);
    for (let k = 0; k < m.hits.length; k++) {
      const h = m.hits[k]!;
      if (p.sf < h.from || p.sf > h.to || (p.hitMask & (1 << k)) !== 0) continue;
      if (!canBeHit(s, v, r, h.throw === 1)) continue;
      const hr = boxRect(p, h.box.x, h.box.y, h.box.w, h.box.h);
      if (!overlap(hr, vr)) continue;
      const ox0 = hr.x0 > vr.x0 ? hr.x0 : vr.x0;
      const ox1 = hr.x1 < vr.x1 ? hr.x1 : vr.x1;
      const oy0 = hr.y0 > vr.y0 ? hr.y0 : vr.y0;
      const oy1 = hr.y1 < vr.y1 ? hr.y1 : vr.y1;
      pend.push({ ai: i, k, cx: idiv(ox0 + ox1, 2), cy: idiv(oy0 + oy1, 2) });
      break;
    }
  }
  for (let n = 0; n < pend.length; n++) {
    const q = pend[n]!;
    const p = s.players[q.ai]!;
    const m = pack.fighters[p.fighter]!.moves[p.move];
    if (!m) continue; // the attacker was hit by a trade and lost the move
    const h = m.hits[q.k]!;
    p.hitMask |= 1 << q.k;
    p.connected = 1;
    applyHit(s, q.ai, h, h.throw === 1, true, p.facing, q.cx, q.cy, p.move, pack, ev);
  }

  // Projectiles: move, cancel each other, then hit.
  for (let n = 0; n < s.projs.length; n++) {
    const pr = s.projs[n]!;
    pr.x += pr.vx;
    pr.life--;
  }
  const rectOf = (n: number): Rect => {
    const pr = s.projs[n]!;
    const d = pack.fighters[s.players[pr.owner]!.fighter]!.moves[pr.slot]!.projectile!;
    const hw = idiv(d.w * SUB, 2);
    const hh = idiv(d.h * SUB, 2);
    return { x0: pr.x - hw, x1: pr.x + hw, y0: pr.y - hh, y1: pr.y + hh };
  };
  for (let n = 0; n < s.projs.length; n++) {
    for (let m2 = n + 1; m2 < s.projs.length; m2++) {
      const pa = s.projs[n]!;
      const pb = s.projs[m2]!;
      if (pa.owner !== pb.owner && pa.life > 0 && pb.life > 0 && overlap(rectOf(n), rectOf(m2))) {
        pa.life = 0; pb.life = 0;
        pushEvent(ev, Ev.CLASH, s.frame, pa.owner, 0, 2, idiv(pa.x + pb.x, 2), pa.y, 0);
      }
    }
  }
  const lim = idiv(r.stageWidth * SUB, 2) + 64 * SUB;
  for (let n = 0; n < s.projs.length; n++) {
    const pr = s.projs[n]!;
    if (pr.life <= 0) continue;
    if (pr.x > lim || pr.x < -lim) { pr.life = 0; continue; }
    const v = s.players[1 - pr.owner]!;
    if (!canBeHit(s, v, r, false)) continue;
    const d = pack.fighters[s.players[pr.owner]!.fighter]!.moves[pr.slot]!.projectile!;
    if (overlap(rectOf(n), hurtRect(v, pack.fighters[v.fighter]!))) {
      applyHit(s, pr.owner, d, false, false, pr.vx > 0 ? 1 : -1, pr.x, pr.y, pr.slot, pack, ev);
      pr.life = 0;
    }
  }
  const alive = [];
  for (let n = 0; n < s.projs.length; n++) if (s.projs[n]!.life > 0) alive.push(s.projs[n]!);
  s.projs = alive;
}

// ---------- round flow ----------

function postFrame(s: State, pack: SimPack, ev: SimEvent[]): void {
  const r = pack.rules;
  for (let i = 0; i < 2; i++) {
    const p = s.players[i]!;
    const f = pack.fighters[p.fighter]!;
    if (p.st !== St.HIT && p.st !== St.LAUNCH && p.st !== St.DOWN) {
      p.comboHits = 0; p.comboDmg = 0; p.juggle = 0;
    }
    if (p.st !== St.BLOCK && p.st !== St.BREAK) {
      if (p.guardWait < r.guardRegenDelay) p.guardWait++;
      else p.guard = clamp(p.guard + r.guardRegenRate, 0, f.stats.guardMax);
    }
    if (s.training === 1) {
      if (p.comboHits === 0) {
        if (p.regenWait < r.trainingRegenDelay) p.regenWait++;
        else p.hp = f.stats.hp;
      }
      if (s.kiRefill === 1 && p.st !== St.ATTACK) p.ki = r.kiMax;
    } else if (p.lastStand === 0 && p.hp > 0 && p.hp * 100 <= f.stats.hp * r.lastStandHpPercent) {
      p.lastStand = 1;
      p.ki = clamp(p.ki + r.lastStandKi, 0, r.kiMax);
      pushEvent(ev, Ev.LAST_STAND, s.frame, i, 0, 0, p.x, p.y, 0);
    }
  }
  if (s.phase !== Phase.FIGHT || s.training === 1) return;

  const a = s.players[0]!;
  const b = s.players[1]!;
  if (a.hp <= 0 || b.hp <= 0) {
    for (let i = 0; i < 2; i++) {
      const p = s.players[i]!;
      if (p.hp > 0) continue;
      p.hp = 0;
      s.players[1 - i]!.wins += 1;
      if (p.st !== St.LAUNCH && p.st !== St.DOWN) {
        p.st = St.LAUNCH; p.sf = 0; p.move = -1;
        p.vy = 5 * SUB; p.vx = -p.facing * 3 * SUB;
      }
      pushEvent(ev, Ev.KO, s.frame, i, 0, 3, p.x, p.y + 100 * SUB, 0);
    }
    s.phase = Phase.KO; s.phaseT = r.koSlowFrames;
    return;
  }
  s.timer--;
  if (s.timer <= 0) {
    const fa = pack.fighters[a.fighter]!;
    const fb = pack.fighters[b.fighter]!;
    const sa = a.hp * fb.stats.hp;
    const sb = b.hp * fa.stats.hp;
    if (sa >= sb) a.wins += 1;
    if (sb >= sa) b.wins += 1;
    pushEvent(ev, Ev.TIME_UP, s.frame, sa > sb ? 0 : sb > sa ? 1 : 2, 0, 0, 0, 0, 0);
    s.phase = Phase.ROUND_END; s.phaseT = r.roundEndFrames;
  }
}

function gameplay(s: State, in0: number, in1: number, pack: SimPack, ev: SimEvent[]): void {
  if (s.hitstop > 0) { s.hitstop--; return; }
  updatePlayer(s, 0, in0, pack, ev);
  updatePlayer(s, 1, in1, pack, ev);
  physics(s, 0, pack, ev);
  physics(s, 1, pack, ev);
  separate(s, pack);
  updateFacing(s);
  resolveHits(s, pack, ev);
  postFrame(s, pack, ev);
}

/** Advances the fight by one frame. Never changes `prev`. */
export function step(prev: State, input0: number, input1: number, pack: SimPack): StepResult {
  const s = cloneState(prev);
  const ev: SimEvent[] = [];
  const r = pack.rules;
  s.frame++;
  const in0 = input0 & INPUT_MASK;
  const in1 = input1 & INPUT_MASK;
  bufferInput(s.players[0]!, in0, r);
  bufferInput(s.players[1]!, in1, r);

  if (s.freeze > 0) { s.freeze--; return { state: s, events: ev }; }

  switch (s.phase) {
    case Phase.INTRO:
      s.players[0]!.bufTtl = 0; s.players[1]!.bufTtl = 0;
      s.players[0]!.dashReqT = 0; s.players[1]!.dashReqT = 0;
      s.phaseT--;
      if (s.phaseT <= 0) {
        s.phase = Phase.FIGHT;
        pushEvent(ev, Ev.ROUND_START, s.frame, 0, s.round, 0, 0, 0, 0);
      }
      break;
    case Phase.FIGHT:
      gameplay(s, in0, in1, pack, ev);
      break;
    case Phase.KO:
      // Slow motion: the fight advances on one frame in three.
      s.phaseT--;
      if (s.phaseT % 3 === 0) gameplay(s, 0, 0, pack, ev);
      if (s.phaseT <= 0) { s.phase = Phase.ROUND_END; s.phaseT = r.roundEndFrames; }
      break;
    case Phase.ROUND_END: {
      gameplay(s, 0, 0, pack, ev);
      s.phaseT--;
      if (s.phaseT <= 0) {
        const w0 = s.players[0]!.wins >= r.roundsToWin;
        const w1 = s.players[1]!.wins >= r.roundsToWin;
        if (w0 || w1) {
          s.winner = w0 && w1 ? 2 : w0 ? 0 : 1;
          s.phase = Phase.MATCH_END;
          pushEvent(ev, Ev.MATCH_END, s.frame, 0, s.winner, 0, 0, 0, 0);
        } else {
          pushEvent(ev, Ev.ROUND_END, s.frame, 0, s.round, 0, 0, 0, 0);
          s.round++;
          resetRound(s, pack);
        }
      }
      break;
    }
    case Phase.MATCH_END:
      gameplay(s, 0, 0, pack, ev);
      break;
  }
  return { state: s, events: ev };
}
