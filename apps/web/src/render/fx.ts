import type Phaser from 'phaser';
import { Ev, type SimEvent, type State } from '@bs/sim';
import { sfx } from '../audio';
import { theme } from '../theme';
import { GROUND_Y, WORLD_CX } from './fighter';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; c: number; size: number; kind: 0 | 1 | 2 }

export interface Banner { text: string; sub: string; t: number; dur: number; colour: string }

export interface FxSettings { shake: number; flashes: boolean }

/** Sparks, shake, banners and sound. Reacts to sim events; never changes the fight. */
export class Fx {
  particles: Particle[] = [];
  /** Frames left of the white hit flash, per player. */
  hitFlash = [0, 0];
  screenFlash = 0;
  banner: Banner | null = null;
  cutIn: { player: number; t: number } | null = null;
  combo = [{ hits: 0, dmg: 0, t: 0 }, { hits: 0, dmg: 0, t: 0 }];
  settings: FxSettings = { shake: 1, flashes: true };

  constructor(private readonly cam: Phaser.Cameras.Scene2D.Camera, private readonly names: () => [string, string]) {}

  private shake(ms: number, amount: number): void {
    if (this.settings.shake > 0) this.cam.shake(ms, amount * this.settings.shake);
  }

  private burst(x: number, y: number, n: number, c: number, speed: number, size: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = 8 + Math.floor(Math.random() * 10);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c, size, kind: 0 });
    }
  }
  private ring(x: number, y: number, c: number, size: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 12, max: 12, c, size, kind: 1 });
  }
  private dust(x: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const life = 14 + Math.floor(Math.random() * 8);
      this.particles.push({ x: x + (Math.random() - 0.5) * 30, y: GROUND_Y - 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.2, life, max: life, c: 0xcfc8e8, size: 5 + Math.random() * 5, kind: 2 });
    }
  }
  say(text: string, sub = '', dur = 70, colour = '#ffffff'): void {
    this.banner = { text, sub, t: 0, dur, colour };
  }

  handle(events: SimEvent[], state: State): void {
    for (const e of events) {
      const x = WORLD_CX + e.x;
      const y = GROUND_Y - e.y;
      switch (e.t) {
        case Ev.HIT: case Ev.THROW: {
          const tier = e.b;
          this.burst(x, y, 7 + tier * 5, theme.sparks[tier] ?? 0xffffff, 5 + tier * 2.2, 3 + tier);
          this.ring(x, y, 0xffffff, 16 + tier * 12);
          this.hitFlash[1 - e.p] = 4;
          if (tier === 1) this.shake(90, 0.005);
          else if (tier === 2) this.shake(140, 0.009);
          else if (tier >= 3) this.shake(180, 0.013);
          sfx.hit(tier, e.f + e.a);
          const v = state.players[1 - e.p]!;
          this.combo[e.p] = { hits: v.comboHits, dmg: v.comboDmg, t: 80 };
          break;
        }
        case Ev.BLOCK:
          this.ring(x, y, theme.block, 22);
          this.burst(x, y, 4, theme.block, 3, 2);
          sfx.block();
          break;
        case Ev.GUARD_BREAK:
          this.ring(x, y, 0xffffff, 70);
          this.burst(x, y, 22, theme.block, 9, 4);
          this.shake(200, 0.012);
          this.say('GUARD BREAK', '', 50, '#8fd3ff');
          sfx.guardBreak();
          break;
        case Ev.SUPER:
          this.cutIn = { player: e.p, t: 0 };
          sfx.superStart();
          break;
        case Ev.SWING: sfx.swing(e.b); break;
        case Ev.PROJECTILE: sfx.blast(); this.ring(x, y, 0xffffff, 18); break;
        case Ev.CLASH: this.ring(x, y, 0xffffff, 50); this.burst(x, y, 16, 0xffffff, 7, 3); sfx.clash(); break;
        case Ev.JUMP: this.dust(x, 3); sfx.jump(); break;
        case Ev.LAND: this.dust(x, 3); sfx.land(); break;
        case Ev.DASH: this.dust(x, 5); sfx.dash(); break;
        case Ev.KNOCKDOWN: this.dust(x, 9); this.shake(100, 0.005); sfx.knockdown(); break;
        case Ev.LAST_STAND:
          this.ring(x, GROUND_Y - 100, 0xff5edb, 90);
          this.say('LAST STAND!', `${this.names()[e.p]} gains ki`, 55, '#ff7ae5');
          sfx.lastStand();
          break;
        case Ev.KO:
          this.say('K.O.!', '', 120, '#ffd23f');
          if (this.settings.flashes) this.screenFlash = 8;
          this.shake(350, 0.016);
          sfx.ko();
          break;
        case Ev.TIME_UP: this.say('TIME UP', '', 110); sfx.announce('round'); break;
        case Ev.ROUND_START: this.say('FIGHT!', '', 45, '#ffd23f'); sfx.announce('fight'); break;
        case Ev.MATCH_END: {
          const w = e.a;
          this.say(w === 2 ? 'DRAW' : `${this.names()[w] ?? ''} WINS`, '', 100000, '#ffd23f');
          sfx.announce('win');
          break;
        }
      }
    }
  }

  /** Once per tick. */
  update(): void {
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === 0) { p.vx *= 0.9; p.vy = p.vy * 0.9 + 0.25; }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (let i = 0; i < 2; i++) {
      if (this.hitFlash[i]! > 0) this.hitFlash[i]!--;
      if (this.combo[i]!.t > 0) this.combo[i]!.t--;
    }
    if (this.screenFlash > 0) this.screenFlash--;
    if (this.banner && ++this.banner.t > this.banner.dur) this.banner = null;
    if (this.cutIn && ++this.cutIn.t > 46) this.cutIn = null;
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    for (const p of this.particles) {
      const k = p.life / p.max;
      if (p.kind === 0) {
        g.lineStyle(p.size, p.c, k);
        g.lineBetween(p.x, p.y, p.x - p.vx * 2.2, p.y - p.vy * 2.2);
      } else if (p.kind === 1) {
        g.lineStyle(5 * k + 1, p.c, k);
        g.strokeCircle(p.x, p.y, p.size * (1.4 - k));
      } else {
        g.fillStyle(p.c, k * 0.5);
        g.fillCircle(p.x, p.y, p.size * (1.3 - k * 0.5));
      }
    }
  }
}
