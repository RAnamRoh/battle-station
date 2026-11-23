/** Subpixels per pixel. Positions and speeds in state are in subpixels. */
export const SUB = 256;

/** Input bits. LEFT and RIGHT are absolute; the sim converts them to back and forward. */
export const Btn = {
  UP: 1,
  DOWN: 2,
  LEFT: 4,
  RIGHT: 8,
  LIGHT: 16,
  HEAVY: 32,
  KI: 64,
  GUARD: 128,
  CHARGE: 256,
  SUPER: 512,
} as const;
export const INPUT_MASK = 1023;
export const DIR_BITS = Btn.UP | Btn.DOWN | Btn.LEFT | Btn.RIGHT;
export const BUTTON_BITS = Btn.LIGHT | Btn.HEAVY | Btn.KI | Btn.SUPER;

/** Move slots. Every fighter uses the same layout. */
export const Slot = {
  L5: 0, L6: 1, L4: 2, L2: 3,
  H5: 4, H6: 5, H4: 6, H2: 7,
  JL: 8, JH: 9,
  K5: 10, K6: 11, K2: 12, K4: 13,
  SUPER: 14, THROW: 15,
} as const;
export const SLOT_NAMES = [
  '5L', '6L', '4L', '2L', '5H', '6H', '4H', '2H', 'jL', 'jH', '5K', '6K', '2K', '4K', 'super', 'throw',
] as const;
export const SLOT_COUNT = 16;

export const Cls = { LIGHT: 0, HEAVY: 1, KI: 2, SUPER: 3, THROW: 4 } as const;

export const St = {
  IDLE: 0, CROUCH: 1, JUMP: 2, ATTACK: 3, HIT: 4, BLOCK: 5, LAUNCH: 6, DOWN: 7, GETUP: 8,
  CHARGE: 9, GUARD: 10, BREAK: 11, DASH: 12, BACKDASH: 13,
} as const;

export const Phase = { INTRO: 0, FIGHT: 1, KO: 2, ROUND_END: 3, MATCH_END: 4 } as const;

export const Ev = {
  ROUND_START: 1, SWING: 2, HIT: 3, BLOCK: 4, GUARD_BREAK: 5, SUPER: 6, PROJECTILE: 7, CLASH: 8,
  JUMP: 9, LAND: 10, KNOCKDOWN: 11, KO: 12, TIME_UP: 13, ROUND_END: 14, MATCH_END: 15,
  DASH: 16, LAST_STAND: 17, THROW: 18,
} as const;

/** Something that happened on a frame. Sound and effects react to these; they never feed back into the sim. */
export interface SimEvent {
  t: number; // Ev
  f: number; // frame
  p: number; // player index the event belongs to (attacker for hits)
  a: number; // slot, round or winner, depending on type
  b: number; // tier or hit index
  x: number; // px
  y: number; // px
  n: number; // damage or combo count
}

/** A rectangle in pixels. x is the distance in front of the fighter's centre; y is the height of its bottom edge above the feet. */
export interface Box { x: number; y: number; w: number; h: number }

export interface HitProps {
  damage: number;
  guardDamage: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  /** Knockback speed, subpixels per frame. */
  pushX: number;
  /** Upward launch speed, subpixels per frame. 0 means the victim stays grounded. */
  launchY: number;
  /** 0 light, 1 heavy, 2 power, 3 super. Used for effects. */
  tier: number;
}

export interface HitDef extends HitProps {
  from: number;
  to: number;
  box: Box;
  /** 1 = a throw: ignores guard, only connects on a grounded, free opponent. */
  throw: number;
}

export interface ProjectileDef extends HitProps {
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  life: number;
}

export interface MoveSegment { from: number; to: number; speed: number }

export interface MoveDef {
  cls: number;
  total: number;
  kiCost: number;
  air: number;
  invFrom: number;
  invTo: number;
  hits: HitDef[];
  moveX: MoveSegment[];
  projectile: ProjectileDef | null;
}

export interface FighterStats {
  hp: number;
  width: number;
  height: number;
  crouchHeight: number;
  walkF: number;
  walkB: number;
  jumpVy: number;
  jumpVx: number;
  gravity: number;
  dashSpeed: number;
  dashFrames: number;
  backdashSpeed: number;
  backdashFrames: number;
  /** Percent. 100 = normal. */
  damageMul: number;
  kiGainMul: number;
  guardMax: number;
}

export interface FighterDef {
  id: string;
  stats: FighterStats;
  /** Indexed by Slot. null means the fighter falls back to the neutral variant. */
  moves: (MoveDef | null)[];
  /** Slots used by the Simple-controls auto chain. */
  autoChain: number[];
}

export interface Rules {
  roundsToWin: number;
  roundFrames: number;
  introFrames: number;
  koSlowFrames: number;
  roundEndFrames: number;
  stageWidth: number;
  startGap: number;
  kiMax: number;
  kiStart: number;
  kiHit: number;
  kiBlock: number;
  kiTaken: number;
  kiCharge: number;
  superFreeze: number;
  comboScale: number[];
  juggleLimit: number;
  hitstunDecayEvery: number;
  minHitstun: number;
  guardRegenDelay: number;
  guardRegenRate: number;
  guardBreakStun: number;
  bufferFrames: number;
  dashTapWindow: number;
  backdashInvul: number;
  friction: number;
  downFrames: number;
  getupFrames: number;
  lastStandHpPercent: number;
  lastStandKi: number;
  simpleDamagePercent: number;
  trainingRegenDelay: number;
}

/** The gameplay half of a content pack: everything the sim needs. */
export interface SimPack {
  rules: Rules;
  fighters: FighterDef[];
}

export interface PlayerState {
  fighter: number;
  simple: number;
  x: number; y: number; vx: number; vy: number;
  facing: number;
  hp: number; ki: number; guard: number; guardWait: number;
  st: number; sf: number;
  move: number; hitMask: number; connected: number; chain: number;
  stun: number;
  comboHits: number; comboDmg: number; juggle: number;
  prevIn: number;
  bufBtn: number; bufDir: number; bufTtl: number;
  dirPrev1: number; dirPrev2: number;
  tapDir: number; tapT: number; dashReq: number; dashReqT: number;
  invul: number;
  wins: number;
  lastStand: number;
  regenWait: number;
}

export interface ProjectileState {
  owner: number; slot: number;
  x: number; y: number; vx: number; life: number;
}

export interface State {
  frame: number;
  phase: number; phaseT: number;
  round: number; timer: number;
  hitstop: number; freeze: number;
  /** -1 undecided, 0 or 1 a player, 2 a draw. */
  winner: number;
  training: number; kiRefill: number;
  rngA: number; rngB: number; rngC: number; rngD: number;
  players: PlayerState[];
  projs: ProjectileState[];
}

export interface MatchConfig {
  fighters: [number, number];
  seed: number;
  training?: boolean;
  kiRefill?: boolean;
  simple?: [boolean, boolean];
}

export interface StepResult { state: State; events: SimEvent[] }
