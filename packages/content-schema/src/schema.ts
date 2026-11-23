import { z } from 'zod';

const int = z.int();
const pos = z.int().min(0);

/** [x, y, w, h] in pixels. x is the distance in front of the fighter's centre; y is the bottom edge above the feet. */
const box = z.tuple([int, int, pos, pos]);

const hitProps = {
  damage: pos,
  guardDamage: pos.optional(),
  chip: pos.default(0),
  hitstun: pos.optional(),
  blockstun: pos.optional(),
  hitstop: pos.optional(),
  /** Knockback speed in subpixels per frame (256 = 1 px per frame). */
  pushX: pos.optional(),
  /** Upward launch speed in subpixels per frame. 0 keeps the victim on the ground. */
  launchY: pos.default(0),
  tier: z.enum(['light', 'heavy', 'power', 'super']).optional(),
};

export const hitSchema = z.strictObject({
  from: z.int().min(1),
  to: z.int().min(1),
  box,
  throw: z.boolean().default(false),
  ...hitProps,
});

export const projectileSchema = z.strictObject({
  frame: z.int().min(1),
  /** [x, y] spawn point in pixels, relative to the fighter. */
  at: z.tuple([int, int]),
  /** [w, h] in pixels. */
  size: z.tuple([pos, pos]),
  speed: z.int().min(1),
  life: z.int().min(1),
  ...hitProps,
});

export const moveSchema = z.strictObject({
  cls: z.enum(['light', 'heavy', 'ki', 'super', 'throw']),
  total: z.int().min(1),
  kiCost: pos.default(0),
  air: z.boolean().default(false),
  /** [from, to] frames during which the fighter cannot be hit. */
  invulnerable: z.tuple([z.int().min(1), z.int().min(1)]).optional(),
  hits: z.array(hitSchema).default([]),
  /** Self-movement: [from, to, speed] with speed in subpixels per frame. */
  moveX: z.array(z.tuple([z.int().min(1), z.int().min(1), int])).default([]),
  projectile: projectileSchema.optional(),
});

export const slotName = z.enum([
  '5L', '6L', '4L', '2L', '5H', '6H', '4H', '2H', 'jL', 'jH', '5K', '6K', '2K', '4K', 'super', 'throw',
]);

export const statsSchema = z.strictObject({
  hp: z.int().min(1),
  width: z.int().min(1),
  height: z.int().min(1),
  crouchHeight: z.int().min(1),
  walkF: pos, walkB: pos,
  jumpVy: pos, jumpVx: pos, gravity: z.int().min(1),
  dashSpeed: pos, dashFrames: z.int().min(1),
  backdashSpeed: pos, backdashFrames: z.int().min(1),
  damageMul: z.int().min(1), kiGainMul: z.int().min(1),
  guardMax: z.int().min(1),
});

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const presentationSchema = z.strictObject({
  name: z.string().min(1),
  department: z.string().default(''),
  archetype: z.string().default(''),
  tagline: z.string().default(''),
  superName: z.string().default('Super'),
  quotes: z.strictObject({ intro: z.string().default(''), win: z.string().default('') }).default({ intro: '', win: '' }),
  colours: z.strictObject({ body: colour, trim: colour, skin: colour, hair: colour, aura: colour }),
  look: z.strictObject({
    hair: z.enum(['short', 'bald', 'flat', 'swept', 'cap', 'long']).default('short'),
    beard: z.enum(['none', 'full', 'goatee', 'long', 'chinstrap']).default('none'),
    glasses: z.boolean().default(false),
    /** Body width in percent of the default placeholder build. */
    bulk: z.int().min(50).max(200).default(100),
  }),
});

export const fighterSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  gameplay: z.strictObject({
    stats: statsSchema,
    autoChain: z.array(slotName).default([]),
    moves: z.partialRecord(slotName, moveSchema),
  }),
  presentation: presentationSchema,
});

export const rulesSchema = z.strictObject({
  roundsToWin: z.int().min(1),
  roundFrames: z.int().min(1),
  introFrames: pos, koSlowFrames: pos, roundEndFrames: pos,
  stageWidth: z.int().min(200), startGap: z.int().min(50),
  kiMax: z.int().min(1), kiStart: pos, kiHit: pos, kiBlock: pos, kiTaken: pos, kiCharge: pos,
  superFreeze: pos,
  comboScale: z.array(z.int().min(1).max(100)).min(1),
  juggleLimit: z.int().min(1),
  hitstunDecayEvery: z.int().min(1), minHitstun: z.int().min(1),
  guardRegenDelay: pos, guardRegenRate: pos, guardBreakStun: z.int().min(1),
  bufferFrames: z.int().min(3), dashTapWindow: z.int().min(1), backdashInvul: pos,
  friction: z.int().min(1),
  downFrames: z.int().min(1), getupFrames: z.int().min(1),
  lastStandHpPercent: pos, lastStandKi: pos,
  simpleDamagePercent: z.int().min(1).max(100),
  trainingRegenDelay: pos,
});

export const stageSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  colours: z.strictObject({
    skyTop: colour, skyBottom: colour, far: colour, mid: colour, floor: colour, floorLine: colour, accent: colour,
  }),
});

export type FighterSource = z.infer<typeof fighterSchema>;
export type Presentation = z.infer<typeof presentationSchema>;
export type StageDef = z.infer<typeof stageSchema>;
