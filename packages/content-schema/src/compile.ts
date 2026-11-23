import { createHash } from 'node:crypto';
import { Cls, SLOT_NAMES, type FighterDef, type HitProps, type MoveDef, type Rules, type SimPack } from '@bs/sim';
import type { z } from 'zod';
import type { ContentPack } from './pack';
import { fighterSchema, rulesSchema, stageSchema } from './schema';

export interface SourceFile { path: string; data: unknown }

export class ContentError extends Error {}

const CLS: Record<string, number> = { light: Cls.LIGHT, heavy: Cls.HEAVY, ki: Cls.KI, super: Cls.SUPER, throw: Cls.THROW };
const TIER: Record<string, number> = { light: 0, heavy: 1, power: 2, super: 3 };

/** Default feel per tier, so content files only state what differs. */
const TIER_DEFAULTS = [
  { guardDamage: 6, hitstun: 14, blockstun: 10, hitstop: 6, pushX: 1024 },
  { guardDamage: 14, hitstun: 20, blockstun: 14, hitstop: 10, pushX: 1536 },
  { guardDamage: 18, hitstun: 24, blockstun: 18, hitstop: 12, pushX: 1792 },
  { guardDamage: 10, hitstun: 26, blockstun: 22, hitstop: 12, pushX: 1024 },
] as const;

function parse<S extends z.ZodType>(schema: S, file: SourceFile): z.infer<S> {
  const res = schema.safeParse(file.data);
  if (!res.success) {
    const lines = res.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ContentError(`${file.path} is not valid:\n${lines.join('\n')}`);
  }
  return res.data;
}

type RawHitProps = {
  damage: number; guardDamage?: number | undefined; chip: number; hitstun?: number | undefined;
  blockstun?: number | undefined; hitstop?: number | undefined; pushX?: number | undefined; launchY: number;
  tier?: string | undefined;
};

function hitProps(h: RawHitProps, clsTier: number): HitProps {
  const tier = h.tier === undefined ? clsTier : TIER[h.tier]!;
  const d = TIER_DEFAULTS[tier]!;
  return {
    damage: h.damage,
    guardDamage: h.guardDamage ?? d.guardDamage,
    chip: h.chip,
    hitstun: h.hitstun ?? d.hitstun,
    blockstun: h.blockstun ?? d.blockstun,
    hitstop: h.hitstop ?? d.hitstop,
    pushX: h.pushX ?? d.pushX,
    launchY: h.launchY,
    tier,
  };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export function compilePack(id: string, rulesFile: SourceFile, fighterFiles: SourceFile[], stageFiles: SourceFile[]): ContentPack {
  const rules: Rules = parse(rulesSchema, rulesFile);
  const fighters: FighterDef[] = [];
  const shown: ContentPack['fighters'] = [];
  const sorted = [...fighterFiles].sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const file of sorted) {
    const src = parse(fighterSchema, file);
    if (shown.some((f) => f.id === src.id)) throw new ContentError(`${file.path}: duplicate fighter id "${src.id}"`);
    const moves: (MoveDef | null)[] = [];
    for (const name of SLOT_NAMES) {
      const m = src.gameplay.moves[name];
      if (!m) { moves.push(null); continue; }
      const cls = CLS[m.cls]!;
      const clsTier = cls === Cls.LIGHT ? 0 : cls === Cls.SUPER ? 3 : cls === Cls.KI ? 2 : 1;
      for (const h of m.hits) {
        if (h.to < h.from || h.to > m.total) {
          throw new ContentError(`${file.path}: move ${name} has a hit outside frames 1..${m.total}`);
        }
      }
      if (m.hits.length > 30) throw new ContentError(`${file.path}: move ${name} has more than 30 hits`);
      const isAir = name === 'jL' || name === 'jH';
      if (m.air !== isAir) throw new ContentError(`${file.path}: move ${name} must have air: ${isAir}`);
      moves.push({
        cls,
        total: m.total,
        kiCost: m.kiCost,
        air: m.air ? 1 : 0,
        invFrom: m.invulnerable ? m.invulnerable[0] : 0,
        invTo: m.invulnerable ? m.invulnerable[1] : 0,
        hits: m.hits.map((h) => ({
          from: h.from, to: h.to,
          box: { x: h.box[0], y: h.box[1], w: h.box[2], h: h.box[3] },
          throw: h.throw ? 1 : 0,
          ...hitProps(h, clsTier),
        })),
        moveX: m.moveX.map((s) => ({ from: s[0], to: s[1], speed: s[2] })),
        projectile: m.projectile
          ? {
              frame: m.projectile.frame,
              x: m.projectile.at[0], y: m.projectile.at[1],
              w: m.projectile.size[0], h: m.projectile.size[1],
              speed: m.projectile.speed, life: m.projectile.life,
              ...hitProps(m.projectile, clsTier),
            }
          : null,
      });
    }
    for (const need of ['5L', '5H'] as const) {
      if (!src.gameplay.moves[need]) throw new ContentError(`${file.path}: move ${need} is required`);
    }
    const autoChain = src.gameplay.autoChain.map((n) => {
      const idx = SLOT_NAMES.indexOf(n);
      if (!moves[idx]) throw new ContentError(`${file.path}: autoChain uses ${n}, which the fighter does not have`);
      return idx;
    });
    fighters.push({ id: src.id, stats: src.gameplay.stats, moves, autoChain });
    shown.push({ id: src.id, presentation: src.presentation });
  }
  if (fighters.length === 0) throw new ContentError('The pack has no fighters');
  const stages = [...stageFiles].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f) => parse(stageSchema, f));
  const sim: SimPack = { rules, fighters };
  const gameplayHash = createHash('sha256').update(canonical(sim)).digest('hex');
  return { id, gameplayHash, sim, fighters: shown, stages };
}
