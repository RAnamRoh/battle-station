import type Phaser from 'phaser';
import { Cls, St, SUB, type FighterDef, type PlayerState } from '@bs/sim';
import type { Presentation } from '@bs/content-schema/types';
import { hex } from '../pack';

/** Screen position of the ground line and of world x = 0. */
export const GROUND_Y = 452;
export const WORLD_CX = 480;

type Pt = [number, number];

/** A pose in units of the fighter's height. x points forward, y points up. */
interface Pose {
  hip: Pt;
  neck: Pt;
  handF: Pt; handB: Pt;
  footF: Pt; footB: Pt;
  /** Rotation of the whole body about the feet, in radians. Positive falls backward. */
  rot: number;
  lift: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function stand(): Pose {
  return {
    hip: [0, 0.47], neck: [0.03, 0.8],
    handF: [0.2, 0.68], handB: [0.1, 0.62],
    footF: [0.12, 0], footB: [-0.12, 0],
    rot: 0, lift: 0,
  };
}

/** Works out the pose for a fighter from sim state. Presentation only: nothing here affects the fight. */
function poseFor(p: PlayerState, f: FighterDef, time: number, victory: boolean): Pose {
  const H = f.stats.height;
  const q = stand();
  const bob = Math.sin(time * 0.11 + p.fighter) * 0.008;
  switch (p.st) {
    case St.IDLE: {
      if (victory) {
        q.handF = [0.1, 1.12 + bob]; q.handB = [-0.12, 0.5]; q.neck = [0, 0.82];
        break;
      }
      q.hip[1] += bob; q.neck[1] += bob;
      if (p.vx !== 0) {
        const ph = time * 0.3;
        q.footF = [0.12 + Math.sin(ph) * 0.11, Math.max(0, Math.cos(ph)) * 0.05];
        q.footB = [-0.12 - Math.sin(ph) * 0.11, Math.max(0, -Math.cos(ph)) * 0.05];
        q.neck[0] += p.vx * p.facing > 0 ? 0.03 : -0.02;
      }
      break;
    }
    case St.CROUCH:
      q.hip = [-0.02, 0.26]; q.neck = [0.05, 0.54];
      q.handF = [0.2, 0.46]; q.handB = [0.1, 0.4];
      q.footF = [0.17, 0]; q.footB = [-0.15, 0];
      break;
    case St.JUMP:
      q.footF = [0.1, 0.16]; q.footB = [-0.08, 0.1];
      q.handF = [0.16, 0.86]; q.handB = [-0.1, 0.8];
      q.neck = [0.05, 0.8];
      break;
    case St.GUARD: case St.BLOCK:
      q.neck = [-0.02, 0.78]; q.hip = [-0.03, 0.44];
      q.handF = [0.17, 0.74]; q.handB = [0.15, 0.6];
      if (p.st === St.BLOCK) q.neck[0] -= 0.03;
      break;
    case St.CHARGE:
      q.hip = [0, 0.4]; q.neck = [0, 0.72];
      q.handF = [0.2, 0.36 + bob * 3]; q.handB = [-0.2, 0.36 + bob * 3];
      q.footF = [0.18, 0]; q.footB = [-0.18, 0];
      break;
    case St.HIT: {
      const k = Math.min(1, p.sf / 4);
      q.neck = [-0.1 * k - 0.04, 0.78]; q.hip = [0.02, 0.46];
      q.handF = [0.02, 0.56]; q.handB = [-0.16, 0.66];
      break;
    }
    case St.BREAK: {
      const w = Math.sin(time * 0.4) * 0.03;
      q.neck = [0.1 + w, 0.7]; q.hip = [0, 0.44];
      q.handF = [0.16 + w, 0.36]; q.handB = [-0.02 + w, 0.34];
      break;
    }
    case St.LAUNCH:
      q.rot = p.vy > 0 ? 0.9 : 1.25;
      q.handF = [0.12, 0.9]; q.handB = [-0.14, 0.86];
      q.footF = [0.14, 0.08]; q.footB = [-0.04, 0.02];
      q.lift = 0.12;
      break;
    case St.DOWN:
      q.rot = Math.PI / 2; q.lift = 0.06;
      q.handF = [0.16, 0.7]; q.handB = [-0.16, 0.74];
      break;
    case St.GETUP: {
      const k = ease(p.sf / 14);
      q.rot = lerp(Math.PI / 2, 0, k); q.lift = lerp(0.06, 0, k);
      q.hip = [0, lerp(0.3, 0.47, k)]; q.neck = [0.04, lerp(0.6, 0.8, k)];
      break;
    }
    case St.DASH:
      q.neck = [0.2, 0.74]; q.hip = [0.04, 0.44];
      q.footF = [0.22, 0.04]; q.footB = [-0.24, 0.08];
      q.handF = [0.24, 0.6]; q.handB = [-0.16, 0.56];
      break;
    case St.BACKDASH:
      q.neck = [-0.12, 0.8];
      q.footF = [0.18, 0.06]; q.footB = [-0.16, 0.02];
      break;
    case St.ATTACK: {
      const m = p.move >= 0 ? f.moves[p.move] : null;
      if (!m) break;
      const fr = p.sf;
      if (m.air) { q.footF = [0.1, 0.16]; q.footB = [-0.08, 0.1]; }
      // Aim at the hit that is active now, or the next one coming.
      let hit = m.hits[0];
      for (const h of m.hits) { if (fr <= h.to) { hit = h; break; } hit = h; }
      let target: Pt = [0.3, 0.6];
      let start = 6;
      let end = 10;
      if (hit) {
        target = [Math.min(0.62, (hit.box.x + hit.box.w) / H), (hit.box.y + hit.box.h * 0.5) / H];
        start = hit.from; end = hit.to;
      } else if (m.projectile) {
        target = [m.projectile.x / H + 0.05, m.projectile.y / H];
        start = m.projectile.frame; end = start + 6;
      }
      const prevEnd = hit && m.hits.indexOf(hit) > 0 ? m.hits[m.hits.indexOf(hit) - 1]!.to : 0;
      let ext: number;
      if (fr < start) {
        // Wind up slowly, then snap out just before the hit: the snap is what sells the punch.
        const t = Math.max(0, Math.min(1, (fr - prevEnd) / Math.max(1, start - prevEnd)));
        ext = prevEnd > 0 ? 0.4 + 0.6 * t * t * t : t < 0.6 ? -0.35 * ease(t / 0.6) : -0.35 + 1.35 * ((t - 0.6) / 0.4) ** 2;
      }
      else if (fr <= end) ext = 1;
      else ext = 1 - ease((fr - end) / Math.max(1, m.total - end));
      const both = m.cls === Cls.KI || m.cls === Cls.SUPER || m.cls === Cls.THROW;
      const tall = hit ? hit.box.h > 140 : false;
      if (tall && m.cls !== Cls.SUPER) {
        // Rising strike: the fist travels up through the box.
        const up = ease((fr - start + 2) / Math.max(1, end - start + 2));
        q.handF = lerpPt([0.14, 0.4], [0.16, Math.min(1.25, (hit!.box.y + hit!.box.h) / H)], up);
        q.neck = [0.06, 0.82 + up * 0.06]; q.hip = [0.02, 0.47 + up * 0.06];
      } else if (target[1] < 0.32 && !both) {
        const rest: Pt = m.air ? [0.1, 0.16] : [0.12, 0];
        q.footF = lerpPt(rest, target, Math.max(0, ext));
        q.neck = [-0.06 * Math.max(0, ext), 0.78];
        q.handF = [0.12, 0.66]; q.handB = [-0.1, 0.6];
      } else {
        const rest: Pt = [0.2, 0.68];
        const wind: Pt = [-0.08, Math.max(0.5, target[1])];
        q.handF = ext < 0 ? lerpPt(rest, wind, -ext / 0.35) : lerpPt(rest, target, ext);
        if (both) q.handB = lerpPt([0.1, 0.62], [target[0] - 0.03, target[1] - 0.05], Math.max(0, ext));
        q.neck = [0.03 + 0.09 * Math.max(0, ext), 0.79];
        q.hip = [0.03 * Math.max(0, ext), 0.46];
        q.footF = [0.16, 0]; q.footB = [-0.16, 0];
      }
      break;
    }
  }
  return q;
}

interface Part { a: Pt; b: Pt; w: number; c: number }

/** Draws one placeholder fighter. `flash` paints it white for a moment after being hit. */
export function drawFighter(
  g: Phaser.GameObjects.Graphics, p: PlayerState, f: FighterDef, look: Presentation,
  time: number, flash: boolean, victory: boolean, ghost = 1,
): void {
  const H = f.stats.height;
  const bulk = look.look.bulk / 100;
  const q = poseFor(p, f, time, victory);
  const ox = WORLD_CX + p.x / SUB;
  const oy = GROUND_Y - p.y / SUB;
  const cos = Math.cos(q.rot);
  const sin = Math.sin(q.rot);
  const T = (pt: Pt): Pt => {
    const x = pt[0] * cos - pt[1] * sin;
    const y = pt[0] * sin + pt[1] * cos + q.lift;
    return [ox + p.facing * x * H, oy - Math.max(0.02, y) * H];
  };
  const mid = (a: Pt, b: Pt, bend: number): Pt => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return [mx - dy * bend, my + dx * bend];
  };

  const white = 0xffffff;
  const col = (c: string) => (flash ? white : hex(c));
  const body = col(look.colours.body);
  const trim = col(look.colours.trim);
  const skin = col(look.colours.skin);
  const hair = col(look.colours.hair);

  const limbW = 0.085 * H * (0.8 + bulk * 0.2);
  const torsoW = 0.2 * H * bulk;
  const shoulderF: Pt = [q.neck[0] + 0.02, q.neck[1] - 0.04];
  const shoulderB: Pt = [q.neck[0] - 0.03, q.neck[1] - 0.04];
  const elbowF = mid(shoulderF, q.handF, -0.22);
  const elbowB = mid(shoulderB, q.handB, -0.22);
  const kneeF = mid(q.hip, q.footF, 0.2);
  const kneeB = mid(q.hip, q.footB, 0.2);

  const parts: Part[] = [
    { a: T(shoulderB), b: T(elbowB), w: limbW, c: body },
    { a: T(elbowB), b: T(q.handB), w: limbW * 0.9, c: skin },
    { a: T(q.hip), b: T(kneeB), w: limbW * 1.15, c: trim },
    { a: T(kneeB), b: T(q.footB), w: limbW, c: trim },
    { a: T(q.hip), b: T(q.neck), w: torsoW, c: body },
    { a: T(q.hip), b: T(kneeF), w: limbW * 1.15, c: trim },
    { a: T(kneeF), b: T(q.footF), w: limbW, c: trim },
    { a: T(shoulderF), b: T(elbowF), w: limbW, c: body },
    { a: T(elbowF), b: T(q.handF), w: limbW * 0.9, c: skin },
  ];
  const headC = T([q.neck[0] + 0.035, q.neck[1] + 0.115]);
  const headR = 0.095 * H;
  const ink = 0x14121f;
  const outline = 4;

  // Ink outline first, then colour on top, so the figure reads as one shape.
  for (const part of parts) stroke(g, part.a, part.b, part.w + outline * 2, ink, ghost);
  g.fillStyle(ink, ghost); g.fillCircle(headC[0], headC[1], headR + outline);
  for (const part of parts) stroke(g, part.a, part.b, part.w, part.c, ghost);

  // Fists and feet.
  const hf = T(q.handF);
  const hb = T(q.handB);
  g.fillStyle(skin, ghost);
  g.fillCircle(hb[0], hb[1], limbW * 0.62);
  g.fillCircle(hf[0], hf[1], limbW * 0.7);

  // Head. Angles follow the body rotation so the face stays on the front.
  const dir = p.facing;
  const tilt = -q.rot * dir;
  g.fillStyle(skin, ghost); g.fillCircle(headC[0], headC[1], headR);
  const A = (deg: number) => (deg * Math.PI) / 180 + tilt;
  const beard = look.look.beard;
  if (beard !== 'none') {
    // Beards are a toned colour mass, never pure black, so they read apart from hair and shadow.
    g.fillStyle(flash ? white : shade(hex(look.colours.hair), 26), ghost);
    const depth = beard === 'long' ? 1.5 : beard === 'full' ? 1.12 : 1.04;
    const from = dir > 0 ? (beard === 'goatee' ? 30 : -5) : (beard === 'goatee' ? 95 : 55);
    const to = dir > 0 ? (beard === 'goatee' ? 85 : 125) : (beard === 'goatee' ? 150 : 185);
    g.slice(headC[0], headC[1] + (depth - 1) * headR * 0.5, headR * depth, A(from), A(to), false);
    g.fillPath();
    if (beard !== 'chinstrap') { g.fillStyle(skin, ghost); g.fillCircle(headC[0] + dir * headR * 0.1, headC[1] - headR * 0.12, headR * 0.78); }
  }
  g.fillStyle(hair, ghost);
  const style = look.look.hair;
  if (style !== 'bald') {
    const back = dir > 0 ? 170 : 190;
    const front = dir > 0 ? 330 : 370;
    const lo = Math.min(back, front) - (style === 'long' ? (dir > 0 ? 50 : 0) : 0);
    const hi = Math.max(back, front) + (style === 'long' ? (dir > 0 ? 0 : 50) : 0);
    const r = style === 'flat' ? headR * 1.12 : style === 'swept' ? headR * 1.16 : headR * 1.05;
    g.slice(headC[0] - dir * (style === 'swept' ? headR * 0.12 : 0), headC[1] - headR * 0.08, r, A(lo), A(hi), false);
    g.fillPath();
    if (style === 'cap') {
      g.fillStyle(trim, ghost);
      g.slice(headC[0], headC[1] - headR * 0.1, headR * 1.08, A(180), A(360), false); g.fillPath();
      g.fillRect(headC[0] + (dir > 0 ? 0 : -headR * 1.5), headC[1] - headR * 0.3, headR * 1.5, headR * 0.22);
    }
  }
  // Eye and brow.
  const ex = headC[0] + dir * headR * 0.45 * Math.cos(tilt);
  const ey = headC[1] - headR * 0.08 + dir * headR * 0.45 * Math.sin(tilt);
  g.fillStyle(ink, ghost);
  g.fillCircle(ex, ey, headR * 0.11);
  if (look.look.glasses) {
    g.lineStyle(3, ink, ghost);
    g.strokeCircle(ex, ey, headR * 0.3);
    g.lineBetween(ex - dir * headR * 0.3, ey, ex - dir * headR * 0.95, ey - headR * 0.08);
  }
}

function stroke(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, w: number, c: number, alpha: number): void {
  g.lineStyle(w, c, alpha);
  g.lineBetween(a[0], a[1], b[0], b[1]);
  g.fillStyle(c, alpha);
  g.fillCircle(a[0], a[1], w / 2);
  g.fillCircle(b[0], b[1], w / 2);
}

/** Lightens a colour by a number of points per channel. */
export function shade(c: number, by: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, v + by));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}
