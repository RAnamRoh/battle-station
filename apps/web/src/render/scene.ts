import Phaser from 'phaser';
import { activeHitRects, hurtRect, Phase, St, SUB, type State } from '@bs/sim';
import type { FightDriver } from '../driver';
import { hex, pack } from '../pack';
import { theme } from '../theme';
import { drawFighter, GROUND_Y, shade, WORLD_CX } from './fighter';
import { Fx } from './fx';

export const VIEW_W = 960;
export const VIEW_H = 540;
const TICK_MS = 1000 / 60;

export interface FightView {
  driver: FightDriver;
  stageId: string;
  showBoxes: boolean;
  /** Called after every tick, for page-side UI such as the touch super button. */
  onTick?: (state: State) => void;
}

function text(scene: Phaser.Scene, x: number, y: number, size: number, colour = '#ffffff', thick = 6): Phaser.GameObjects.Text {
  return scene.add.text(x, y, '', {
    fontFamily: theme.font, fontSize: `${size}px`, fontStyle: 'italic', color: colour,
    stroke: '#14121f', strokeThickness: thick,
  }).setScrollFactor(0).setDepth(12);
}

/** Draws the fight. Reads sim state; never changes it. */
export class FightScene extends Phaser.Scene {
  view: FightView | null = null;
  fx!: Fx;
  private acc = 0;
  private time60 = 0;
  private layers: Phaser.GameObjects.Graphics[] = [];
  private gWorld!: Phaser.GameObjects.Graphics;
  private gFx!: Phaser.GameObjects.Graphics;
  private gHud!: Phaser.GameObjects.Graphics;
  private tTimer!: Phaser.GameObjects.Text;
  private tNames!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private tCombo!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private tBanner!: Phaser.GameObjects.Text;
  private tSub!: Phaser.GameObjects.Text;
  private tCut!: Phaser.GameObjects.Text;
  private tCutSub!: Phaser.GameObjects.Text;
  private tStatus!: Phaser.GameObjects.Text;
  private shownHp = [0, 0];
  private trail: { x: number; y: number }[][] = [[], []];
  private stageDrawn = '';
  private lastRound = -1;

  constructor() { super('fight'); }

  create(): void {
    for (let i = 0; i < 4; i++) this.layers.push(this.add.graphics().setDepth(i));
    this.layers[0]!.setScrollFactor(0);
    this.layers[1]!.setScrollFactor(0.25);
    this.layers[2]!.setScrollFactor(0.6);
    this.gWorld = this.add.graphics().setDepth(5);
    this.gFx = this.add.graphics().setDepth(6);
    this.gHud = this.add.graphics().setDepth(10).setScrollFactor(0);
    this.tTimer = text(this, VIEW_W / 2, 36, 40).setOrigin(0.5);
    this.tNames = [text(this, 44, 80, 16, '#ffffff', 4), text(this, VIEW_W - 44, 80, 16, '#ffffff', 4).setOrigin(1, 0)];
    this.tCombo = [text(this, 50, 150, 34, '#ffd23f'), text(this, VIEW_W - 50, 150, 34, '#ffd23f').setOrigin(1, 0)];
    this.tBanner = text(this, VIEW_W / 2, 220, 96, '#ffffff', 12).setOrigin(0.5).setDepth(14);
    this.tSub = text(this, VIEW_W / 2, 292, 26, '#ffffff', 6).setOrigin(0.5).setDepth(14);
    this.tCut = text(this, 0, 0, 54, '#ffffff', 10).setDepth(16);
    this.tCutSub = text(this, 0, 0, 26, '#ffd23f', 6).setDepth(16);
    this.tStatus = text(this, VIEW_W / 2, 110, 22, '#ffffff', 5).setOrigin(0.5);
    this.fx = new Fx(this.cameras.main, () => this.names());
  }

  private names(): [string, string] {
    const s = this.view?.driver.state;
    if (!s) return ['', ''];
    return [pack.fighters[s.players[0]!.fighter]!.presentation.name, pack.fighters[s.players[1]!.fighter]!.presentation.name];
  }

  /** Starts showing a fight. */
  show(view: FightView): void {
    this.view = view;
    this.acc = 0;
    this.lastRound = -1;
    this.trail = [[], []];
    if (this.fx) { this.fx.banner = null; this.fx.cutIn = null; this.fx.particles = []; this.fx.combo.forEach((c) => (c.t = 0)); }
    const s = view.driver.state;
    this.shownHp = [s.players[0]!.hp, s.players[1]!.hp];
  }

  override update(_t: number, delta: number): void {
    const view = this.view;
    if (!view) { this.clear(); return; }
    this.acc += Math.min(delta, 250);
    let n = 0;
    while (this.acc >= TICK_MS && n < 4 && !view.driver.paused) {
      this.acc -= TICK_MS; n++;
      this.time60++;
      const events = view.driver.advance();
      const s = view.driver.state;
      this.fx.handle(events, s);
      this.fx.update();
      if (s.phase === Phase.INTRO && s.round !== this.lastRound && s.phaseT < pack.sim.rules.introFrames - 8) {
        this.lastRound = s.round;
        this.fx.say(`ROUND ${s.round}`, '', 50);
      }
      for (let i = 0; i < 2; i++) {
        const p = s.players[i]!;
        const tr = this.trail[i]!;
        tr.push({ x: p.x, y: p.y });
        if (tr.length > 6) tr.shift();
        if (this.shownHp[i]! > p.hp) this.shownHp[i] = Math.max(p.hp, this.shownHp[i]! - Math.max(2, (this.shownHp[i]! - p.hp) * 0.06));
        else this.shownHp[i] = p.hp;
      }
      view.onTick?.(s);
    }
    if (this.acc > TICK_MS * 4) this.acc = 0;
    this.draw(view);
  }

  private clear(): void {
    this.gWorld?.clear(); this.gFx?.clear(); this.gHud?.clear();
    for (const t of [this.tTimer, this.tBanner, this.tSub, this.tCut, this.tCutSub, this.tStatus, ...(this.tNames ?? []), ...(this.tCombo ?? [])]) t?.setText('');
  }

  private drawStage(id: string): void {
    const st = pack.stages.find((x) => x.id === id) ?? pack.stages[0]!;
    const c = st.colours;
    const [sky, far, mid, floor] = this.layers as [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
    for (const g of this.layers) g.clear();
    sky.fillGradientStyle(hex(c.skyTop), hex(c.skyTop), hex(c.skyBottom), hex(c.skyBottom), 1);
    sky.fillRect(0, 0, VIEW_W, GROUND_Y);
    sky.fillStyle(hex(c.accent), 0.9); sky.fillCircle(700, 330, 70);
    sky.fillStyle(hex(c.accent), 0.25); sky.fillCircle(700, 330, 100);
    // A fixed pseudo-random skyline, so the stage looks the same every time.
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let x = -260; x < VIEW_W + 300; ) {
      const w = 50 + rnd() * 70;
      const h = 90 + rnd() * 190;
      far.fillStyle(hex(c.far), 1); far.fillRect(x, GROUND_Y - h, w, h);
      far.fillStyle(hex(c.accent), 0.35);
      for (let wy = GROUND_Y - h + 12; wy < GROUND_Y - 30; wy += 22) {
        for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rnd() > 0.55) far.fillRect(wx, wy, 7, 10);
      }
      x += w + 6;
    }
    for (let x = -700; x < VIEW_W + 700; ) {
      const w = 110 + rnd() * 120;
      const h = 40 + rnd() * 90;
      mid.fillStyle(hex(c.mid), 1); mid.fillRect(x, GROUND_Y - h, w, h);
      mid.fillStyle(shade(hex(c.mid), 22), 1); mid.fillRect(x, GROUND_Y - h, w, 6);
      if (rnd() > 0.5) { mid.fillStyle(shade(hex(c.mid), -14), 1); mid.fillRect(x + w * 0.3, GROUND_Y - h - 26, 8, 26); mid.fillRect(x + w * 0.3 - 10, GROUND_Y - h - 30, 28, 6); }
      x += w + 30 + rnd() * 80;
    }
    const half = pack.sim.rules.stageWidth / 2 + 200;
    floor.fillStyle(hex(c.floor), 1); floor.fillRect(WORLD_CX - half, GROUND_Y - 6, half * 2, VIEW_H - GROUND_Y + 6);
    floor.fillStyle(hex(c.floorLine), 1); floor.fillRect(WORLD_CX - half, GROUND_Y - 6, half * 2, 5);
    floor.lineStyle(2, hex(c.floorLine), 0.35);
    for (let x = -half; x <= half; x += 90) floor.lineBetween(WORLD_CX + x, GROUND_Y, WORLD_CX + x * 1.35, VIEW_H);
    floor.lineBetween(WORLD_CX - half, GROUND_Y + 30, WORLD_CX + half, GROUND_Y + 30);
    // Railings mark the ends of the stage.
    const edge = pack.sim.rules.stageWidth / 2;
    floor.lineStyle(6, hex(c.accent), 0.8);
    for (const sx of [-edge - 6, edge + 6]) {
      floor.lineBetween(WORLD_CX + sx, GROUND_Y - 110, WORLD_CX + sx, GROUND_Y);
      floor.lineBetween(WORLD_CX + sx - 14, GROUND_Y - 110, WORLD_CX + sx + 14, GROUND_Y - 110);
    }
    this.stageDrawn = id;
  }

  private draw(view: FightView): void {
    if (this.stageDrawn !== view.stageId) this.drawStage(view.stageId);
    const s = view.driver.state;
    const rules = pack.sim.rules;
    const g = this.gWorld;
    g.clear(); this.gFx.clear();

    // Camera follows the midpoint between the fighters.
    const midX = (s.players[0]!.x + s.players[1]!.x) / 2 / SUB;
    const maxScroll = (rules.stageWidth - VIEW_W) / 2 + 20;
    const want = Phaser.Math.Clamp(midX, -maxScroll, maxScroll);
    this.cameras.main.scrollX += (want - this.cameras.main.scrollX) * 0.18;

    const dim = this.fx.cutIn ? 0.55 : s.freeze > 0 ? 0.45 : 0;
    const winner = s.phase === Phase.MATCH_END || s.phase === Phase.ROUND_END ? (s.winner >= 0 ? s.winner : roundLeader(s)) : -1;

    for (let i = 0; i < 2; i++) {
      const p = s.players[i]!;
      const f = pack.sim.fighters[p.fighter]!;
      const sx = WORLD_CX + p.x / SUB;
      const air = Math.min(1, p.y / SUB / 200);
      g.fillStyle(0x000000, 0.3 * (1 - air * 0.6));
      g.fillEllipse(sx, GROUND_Y + 2, f.stats.width * (1.5 - air * 0.5), 14);
    }
    if (dim > 0) { g.fillStyle(0x0a0814, dim); g.fillRect(this.cameras.main.scrollX - 50, 0, VIEW_W + 100, VIEW_H); }

    // Draw the attacker last so their limbs sit on top.
    const order = s.players[0]!.st === St.ATTACK ? [1, 0] : [0, 1];
    for (const i of order) {
      const p = s.players[i]!;
      const f = pack.sim.fighters[p.fighter]!;
      const look = pack.fighters[p.fighter]!.presentation;
      const aura = hex(look.colours.aura);
      const sx = WORLD_CX + p.x / SUB;
      const sy = GROUND_Y - p.y / SUB;
      const H = f.stats.height;

      if (p.st === St.CHARGE || p.ki >= rules.kiMax) {
        const strong = p.st === St.CHARGE;
        const pulse = 0.5 + 0.5 * Math.sin(this.time60 * (strong ? 0.5 : 0.15));
        g.fillStyle(aura, strong ? 0.2 + pulse * 0.15 : 0.08 + pulse * 0.05);
        g.fillEllipse(sx, sy - H * 0.5, H * (strong ? 0.75 + pulse * 0.12 : 0.6), H * (strong ? 1.25 + pulse * 0.1 : 1.1));
        if (strong) {
          g.lineStyle(3, aura, 0.8);
          for (let k = 0; k < 5; k++) {
            const ph = (this.time60 * 4 + k * 37) % 100;
            const lx = sx + Math.sin(k * 2.4) * H * 0.3;
            g.lineBetween(lx, sy - ph * 1.8, lx, sy - ph * 1.8 - 22);
          }
        }
      }
      if (p.st === St.DASH || p.st === St.BACKDASH) {
        const tr = this.trail[i]!;
        for (let k = 0; k < tr.length - 1; k += 2) {
          const ghost = { ...p, x: tr[k]!.x, y: tr[k]!.y };
          drawFighter(g, ghost, f, look, this.time60, false, false, 0.12 + k * 0.04);
        }
      }
      drawFighter(g, p, f, look, this.time60, this.fx.hitFlash[i]! > 0, winner === i && p.st === St.IDLE);

      if (p.st === St.GUARD || p.st === St.BLOCK) {
        g.lineStyle(p.st === St.BLOCK ? 7 : 4, theme.block, p.st === St.BLOCK ? 0.95 : 0.6);
        const a0 = p.facing > 0 ? -1.1 : Math.PI - 1.1;
        g.beginPath(); g.arc(sx + p.facing * 8, sy - H * 0.55, H * 0.42, a0, a0 + 2.2); g.strokePath();
      }
      if (p.st === St.BREAK) {
        for (let k = 0; k < 3; k++) {
          const a = this.time60 * 0.2 + k * 2.1;
          g.fillStyle(0xffe066, 1);
          g.fillCircle(sx + Math.cos(a) * 34, sy - H - 22 + Math.sin(a) * 8, 6);
        }
      }

      // Beams: long attack areas are drawn as a blast from the hands.
      const m = p.st === St.ATTACK && p.move >= 0 ? f.moves[p.move] : null;
      if (m) {
        const wide = m.hits.filter((h) => h.box.w >= 300);
        if (wide.length && p.sf >= wide[0]!.from && p.sf <= wide[wide.length - 1]!.to) {
          const b = wide[0]!.box;
          const live = wide.some((h) => p.sf >= h.from && p.sf <= h.to);
          const x0 = sx + p.facing * b.x;
          const cy = sy - b.y - b.h / 2;
          const hh = b.h * (live ? 1 : 0.6) * (0.9 + 0.1 * Math.sin(this.time60 * 1.3));
          const w = b.w * p.facing;
          this.gFx.fillStyle(aura, 0.45); this.gFx.fillRect(Math.min(x0, x0 + w), cy - hh * 0.65, Math.abs(w), hh * 1.3);
          this.gFx.fillStyle(aura, 0.9); this.gFx.fillRect(Math.min(x0, x0 + w), cy - hh * 0.4, Math.abs(w), hh * 0.8);
          this.gFx.fillStyle(0xffffff, 0.95); this.gFx.fillRect(Math.min(x0, x0 + w), cy - hh * 0.2, Math.abs(w), hh * 0.4);
          this.gFx.fillCircle(x0, cy, hh * 0.5);
        }
      }

      if (view.showBoxes) {
        const hr = hurtRect(p, f);
        this.gFx.lineStyle(2, 0x41ff8a, 0.9);
        this.gFx.strokeRect(WORLD_CX + hr.x0 / SUB, GROUND_Y - hr.y1 / SUB, (hr.x1 - hr.x0) / SUB, (hr.y1 - hr.y0) / SUB);
        for (const r of activeHitRects(p, f)) {
          this.gFx.fillStyle(0xff2d55, 0.4);
          this.gFx.fillRect(WORLD_CX + r.x0 / SUB, GROUND_Y - r.y1 / SUB, (r.x1 - r.x0) / SUB, (r.y1 - r.y0) / SUB);
        }
      }
    }

    for (const pr of s.projs) {
      const owner = s.players[pr.owner]!;
      const def = pack.sim.fighters[owner.fighter]!.moves[pr.slot]!.projectile!;
      const aura = hex(pack.fighters[owner.fighter]!.presentation.colours.aura);
      const x = WORLD_CX + pr.x / SUB;
      const y = GROUND_Y - pr.y / SUB;
      const r = def.h / 2;
      const dir = pr.vx > 0 ? 1 : -1;
      for (let k = 3; k >= 1; k--) { this.gFx.fillStyle(aura, 0.18 * (4 - k)); this.gFx.fillCircle(x - dir * k * 14, y, r * (1 - k * 0.15)); }
      this.gFx.fillStyle(aura, 0.9); this.gFx.fillCircle(x, y, r * 1.15);
      this.gFx.fillStyle(0xffffff, 1); this.gFx.fillCircle(x + dir * 3, y, r * 0.6);
      if (view.showBoxes) { this.gFx.lineStyle(2, 0xff2d55, 1); this.gFx.strokeRect(x - def.w / 2, y - def.h / 2, def.w, def.h); }
    }

    this.fx.draw(this.gFx);
    this.drawHud(s, view);
  }

  private drawHud(s: State, view: FightView): void {
    const g = this.gHud;
    const rules = pack.sim.rules;
    g.clear();
    const barW = 380;
    for (let i = 0; i < 2; i++) {
      const p = s.players[i]!;
      const f = pack.sim.fighters[p.fighter]!;
      const left = i === 0;
      const x0 = left ? 40 : VIEW_W - 40 - barW;
      const fill = (y: number, h: number, frac: number, colour: number) => {
        const w = Math.max(0, Math.min(1, frac)) * barW;
        // Bars drain toward the centre of the screen.
        g.fillStyle(colour, 1); g.fillRect(left ? x0 + barW - w : x0, y, w, h);
      };
      g.fillStyle(theme.ink, 1); g.fillRect(x0 - 4, 20, barW + 8, 30);
      g.fillStyle(theme.barBack, 1); g.fillRect(x0, 24, barW, 22);
      fill(24, 22, this.shownHp[i]! / f.stats.hp, theme.hpLag);
      const low = p.hp * 4 <= f.stats.hp;
      fill(24, 22, p.hp / f.stats.hp, low ? theme.hpLow : theme.hp);
      g.fillStyle(0xffffff, 0.25); g.fillRect(x0, 24, barW, 5);

      // Ki: three bars. Guard: a thin line under it.
      const kw = 240;
      const kx = left ? 40 : VIEW_W - 40 - kw;
      g.fillStyle(theme.ink, 1); g.fillRect(kx - 3, 51, kw + 6, 16);
      const full = p.ki >= rules.kiMax;
      const flashOn = full && Math.floor(this.time60 / 6) % 2 === 0;
      for (let b = 0; b < 3; b++) {
        const seg = (kw - 8) / 3;
        const sx = left ? kx + b * (seg + 4) : kx + kw - seg - b * (seg + 4);
        const per = rules.kiMax / 3;
        const frac = Math.max(0, Math.min(1, (p.ki - b * per) / per));
        g.fillStyle(theme.barBack, 1); g.fillRect(sx, 54, seg, 10);
        g.fillStyle(full ? (flashOn ? 0xffffff : theme.kiFull) : frac >= 1 ? theme.ki : shade(theme.ki, -70), 1);
        g.fillRect(left ? sx : sx + seg * (1 - frac), 54, seg * frac, 10);
      }
      const gw = kw * (p.guard / f.stats.guardMax);
      g.fillStyle(theme.barBack, 1); g.fillRect(kx, 70, kw, 4);
      g.fillStyle(p.st === St.BREAK ? theme.hpLow : theme.guard, 1); g.fillRect(left ? kx : kx + kw - gw, 70, gw, 4);

      // Round wins.
      for (let r = 0; r < (s.training ? 0 : rules.roundsToWin); r++) {
        const cx = left ? VIEW_W / 2 - 70 - r * 22 : VIEW_W / 2 + 70 + r * 22;
        g.fillStyle(theme.ink, 1); g.fillCircle(cx, 64, 9);
        g.fillStyle(r < p.wins ? theme.hp : theme.barBack, 1); g.fillCircle(cx, 64, 6);
      }
      const look = pack.fighters[p.fighter]!.presentation;
      this.tNames[i]!.setText(look.name.toUpperCase());
      const c = this.fx.combo[i]!;
      this.tCombo[i]!.setText(c.t > 0 && c.hits >= 2 ? `${c.hits} HITS\n${c.dmg} dmg` : c.t > 0 && s.training ? `${c.dmg} dmg` : '');
      this.tCombo[i]!.setAlpha(Math.min(1, c.t / 15));
    }
    this.tTimer.setText(s.training ? '∞' : String(Math.max(0, Math.ceil(s.timer / 60))));
    this.tTimer.setColor(!s.training && s.timer < 600 ? '#ff5a4d' : '#ffffff');

    const b = this.fx.banner;
    if (b) {
      const k = Math.min(1, b.t / 6);
      this.tBanner.setText(b.text).setColor(b.colour).setScale(1.6 - 0.6 * k).setAlpha(Math.min(1, (b.dur - b.t) / 10));
      this.tBanner.setFontSize(b.text.length > 12 ? 60 : 96);
      this.tSub.setText(b.sub).setAlpha(k);
    } else { this.tBanner.setText(''); this.tSub.setText(''); }

    const cut = this.fx.cutIn;
    if (cut) {
      // Super cut-in: a diagonal band with the fighter's name and the super's name.
      const i = cut.player;
      const look = pack.fighters[s.players[i]!.fighter]!.presentation;
      const k = Math.min(1, cut.t / 7);
      const out = Math.max(0, (cut.t - 38) / 8);
      const colour = hex(look.colours.body);
      const y = 150;
      const slide = (1 - k) * (i === 0 ? -VIEW_W : VIEW_W) + out * (i === 0 ? VIEW_W : -VIEW_W);
      g.fillStyle(theme.ink, 0.95);
      g.fillPoints([{ x: slide - 40, y: y + 20 }, { x: slide + VIEW_W + 40, y: y - 40 }, { x: slide + VIEW_W + 40, y: y + 150 }, { x: slide - 40, y: y + 210 }] as Phaser.Math.Vector2[], true);
      g.fillStyle(colour, 1);
      g.fillPoints([{ x: slide - 40, y: y + 34 }, { x: slide + VIEW_W + 40, y: y - 26 }, { x: slide + VIEW_W + 40, y: y + 136 }, { x: slide - 40, y: y + 196 }] as Phaser.Math.Vector2[], true);
      g.lineStyle(3, 0xffffff, 0.35);
      for (let n = 0; n < 9; n++) {
        const lx = ((this.time60 * 46 + n * 140) % (VIEW_W + 300)) - 150;
        const xx = i === 0 ? lx : VIEW_W - lx;
        g.lineBetween(slide + xx, y + 60 + (n % 4) * 28, slide + xx + (i === 0 ? 110 : -110), y + 53 + (n % 4) * 28);
      }
      // A large head in the fighter's colours stands in for the portrait.
      const hx = slide + (i === 0 ? 170 : VIEW_W - 170);
      g.fillStyle(theme.ink, 1); g.fillCircle(hx, y + 84, 76);
      g.fillStyle(hex(look.colours.skin), 1); g.fillCircle(hx, y + 84, 70);
      g.fillStyle(hex(look.colours.hair), 1); g.slice(hx, y + 78, 74, Math.PI, Math.PI * 2, false); g.fillPath();
      g.fillStyle(theme.ink, 1);
      g.fillRect(hx + (i === 0 ? 14 : -44), y + 76, 30, 9);
      g.fillRect(hx + (i === 0 ? 10 : -40), y + 112, 30, 7);
      this.tCut.setText(look.superName.toUpperCase()).setOrigin(i === 0 ? 0 : 1, 0.5).setPosition(slide + (i === 0 ? 280 : VIEW_W - 280), y + 70).setAlpha(1);
      this.tCutSub.setText(look.name.toUpperCase()).setOrigin(i === 0 ? 0 : 1, 0.5).setPosition(slide + (i === 0 ? 284 : VIEW_W - 284), y + 118).setAlpha(1);
    } else { this.tCut.setText(''); this.tCutSub.setText(''); }

    if (this.fx.screenFlash > 0) { g.fillStyle(0xffffff, this.fx.screenFlash / 9); g.fillRect(0, 0, VIEW_W, VIEW_H); }
    this.tStatus.setText(view.driver.status ?? '');
  }
}

function roundLeader(s: State): number {
  const a = s.players[0]!;
  const b = s.players[1]!;
  if (a.hp <= 0 && b.hp > 0) return 1;
  if (b.hp <= 0 && a.hp > 0) return 0;
  return -1;
}

export function createGame(parent: HTMLElement): { game: Phaser.Game; scene: FightScene } {
  const scene = new FightScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#14121f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
    fps: { target: 60 },
    input: { keyboard: false, mouse: false, touch: false },
    audio: { noAudio: true },
    banner: false,
  });
  return { game, scene };
}
