import { Btn } from '@bs/sim';

/** Maps `KeyboardEvent.code` values to input bits. */
export type KeyMap = Record<string, number>;

/** One player on the whole keyboard. */
export const KEYS_SOLO: KeyMap = {
  KeyW: Btn.UP, KeyS: Btn.DOWN, KeyA: Btn.LEFT, KeyD: Btn.RIGHT,
  ArrowUp: Btn.UP, ArrowDown: Btn.DOWN, ArrowLeft: Btn.LEFT, ArrowRight: Btn.RIGHT,
  KeyJ: Btn.LIGHT, KeyK: Btn.HEAVY, KeyL: Btn.KI,
  Space: Btn.GUARD, KeyO: Btn.CHARGE, KeyI: Btn.SUPER,
};

/** Two players sharing one keyboard: left side. */
export const KEYS_LEFT: KeyMap = {
  KeyW: Btn.UP, KeyS: Btn.DOWN, KeyA: Btn.LEFT, KeyD: Btn.RIGHT,
  KeyF: Btn.LIGHT, KeyG: Btn.HEAVY, KeyH: Btn.KI,
  KeyV: Btn.GUARD, KeyR: Btn.CHARGE, KeyT: Btn.SUPER,
};

/** Two players sharing one keyboard: right side. */
export const KEYS_RIGHT: KeyMap = {
  ArrowUp: Btn.UP, ArrowDown: Btn.DOWN, ArrowLeft: Btn.LEFT, ArrowRight: Btn.RIGHT,
  KeyJ: Btn.LIGHT, KeyK: Btn.HEAVY, KeyL: Btn.KI,
  KeyM: Btn.GUARD, KeyO: Btn.CHARGE, KeyI: Btn.SUPER,
};

/** Left and right together, or up and down together, cancel out. */
export function cleanDirections(bits: number): number {
  if ((bits & Btn.LEFT) && (bits & Btn.RIGHT)) bits &= ~(Btn.LEFT | Btn.RIGHT);
  if ((bits & Btn.UP) && (bits & Btn.DOWN)) bits &= ~(Btn.UP | Btn.DOWN);
  return bits;
}

export class KeyboardInput {
  private held = new Set<string>();
  private map: KeyMap;
  private readonly onDown = (e: KeyboardEvent) => {
    if (this.map[e.code] === undefined) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    this.held.add(e.code);
    e.preventDefault();
  };
  private readonly onUp = (e: KeyboardEvent) => { this.held.delete(e.code); };
  private readonly onBlur = () => { this.held.clear(); };

  constructor(map: KeyMap) {
    this.map = map;
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  setMap(map: KeyMap): void { this.map = map; this.held.clear(); }

  read(): number {
    let bits = 0;
    for (const code of this.held) bits |= this.map[code] ?? 0;
    return cleanDirections(bits);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
