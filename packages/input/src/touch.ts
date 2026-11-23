import { Btn } from '@bs/sim';

const BUTTONS: { id: string; bit: number; label: string }[] = [
  { id: 'light', bit: Btn.LIGHT, label: 'L' },
  { id: 'heavy', bit: Btn.HEAVY, label: 'H' },
  { id: 'ki', bit: Btn.KI, label: 'KI' },
  { id: 'guard', bit: Btn.GUARD, label: 'GRD' },
  { id: 'charge', bit: Btn.CHARGE, label: 'CHG' },
  { id: 'super', bit: Btn.SUPER, label: 'SUPER' },
];

/** True when the device's main pointer is a finger. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/**
 * On-screen stick and buttons. Works with several fingers at once.
 * The stick floats: it appears where the left thumb lands. Output is digital (8 directions).
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  private stickId = -1;
  private stickX = 0;
  private stickY = 0;
  private dirBits = 0;
  /** pointerId -> button bit currently under that finger. */
  private fingers = new Map<number, number>();
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly buttonEls = new Map<number, HTMLElement>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML =
      `<div class="touch-stick-zone"></div><div class="touch-base"><div class="touch-knob"></div></div>` +
      `<div class="touch-buttons">${BUTTONS.map((b) => `<div class="touch-btn touch-${b.id}" data-bit="${b.bit}">${b.label}</div>`).join('')}</div>`;
    parent.appendChild(this.root);
    this.base = this.root.querySelector('.touch-base')!;
    this.knob = this.root.querySelector('.touch-knob')!;
    this.root.querySelectorAll<HTMLElement>('.touch-btn').forEach((el) => this.buttonEls.set(Number(el.dataset.bit), el));

    const opts = { passive: false } as const;
    this.root.addEventListener('pointerdown', this.onDown, opts);
    this.root.addEventListener('pointermove', this.onMove, opts);
    this.root.addEventListener('pointerup', this.onEnd, opts);
    this.root.addEventListener('pointercancel', this.onEnd, opts);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setVisible(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
    if (!on) this.reset();
  }

  /** Greys out the super button until the meter is full. */
  setSuperReady(ready: boolean): void {
    this.buttonEls.get(Btn.SUPER)?.classList.toggle('ready', ready);
  }

  read(): number {
    let bits = this.dirBits;
    for (const bit of this.fingers.values()) bits |= bit;
    return bits;
  }

  private reset(): void {
    this.stickId = -1; this.dirBits = 0; this.fingers.clear();
    this.base.classList.remove('on');
    for (const el of this.buttonEls.values()) el.classList.remove('down');
  }

  private buttonAt(x: number, y: number): number {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const btn = el?.closest<HTMLElement>('.touch-btn');
    return btn ? Number(btn.dataset.bit) : 0;
  }

  private paintButtons(): void {
    const down = new Set(this.fingers.values());
    for (const [bit, el] of this.buttonEls) el.classList.toggle('down', down.has(bit));
  }

  private readonly onDown = (e: PointerEvent) => {
    e.preventDefault();
    try { this.root.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone; nothing to capture */ }
    const rect = this.root.getBoundingClientRect();
    const bit = this.buttonAt(e.clientX, e.clientY);
    if (bit) {
      this.fingers.set(e.pointerId, bit);
      this.paintButtons();
      return;
    }
    if (this.stickId === -1 && e.clientX - rect.left < rect.width * 0.5) {
      this.stickId = e.pointerId;
      this.stickX = e.clientX; this.stickY = e.clientY;
      this.base.style.left = `${e.clientX - rect.left}px`;
      this.base.style.top = `${e.clientY - rect.top}px`;
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.dirBits = 0;
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerId === this.stickId) {
      const max = this.base.offsetWidth * 0.5;
      let dx = e.clientX - this.stickX;
      let dy = e.clientY - this.stickY;
      const len = Math.hypot(dx, dy);
      // The base follows the thumb when it is dragged past the edge, so reversing direction is quick.
      if (len > max * 1.4) {
        const pull = (len - max * 1.4) / len;
        this.stickX += dx * pull; this.stickY += dy * pull;
        const rect = this.root.getBoundingClientRect();
        this.base.style.left = `${this.stickX - rect.left}px`;
        this.base.style.top = `${this.stickY - rect.top}px`;
        dx = e.clientX - this.stickX; dy = e.clientY - this.stickY;
      }
      const cl = Math.min(1, max / (len || 1));
      this.knob.style.transform = `translate(calc(-50% + ${dx * cl}px), calc(-50% + ${dy * cl}px))`;
      let bits = 0;
      if (len > max * 0.3) {
        // Eight directions: each axis counts when it holds a fair share of the push.
        const ax = Math.abs(dx) / len;
        const ay = Math.abs(dy) / len;
        if (ax > 0.38) bits |= dx > 0 ? Btn.RIGHT : Btn.LEFT;
        if (ay > 0.5) bits |= dy > 0 ? Btn.DOWN : Btn.UP;
      }
      this.dirBits = bits;
      return;
    }
    if (this.fingers.has(e.pointerId)) {
      // Sliding a thumb from one button to another presses the new one.
      const bit = this.buttonAt(e.clientX, e.clientY);
      if (bit && bit !== this.fingers.get(e.pointerId)) {
        this.fingers.set(e.pointerId, bit);
        this.paintButtons();
      }
    }
  };

  private readonly onEnd = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerId === this.stickId) {
      this.stickId = -1; this.dirBits = 0;
      this.base.classList.remove('on');
    }
    if (this.fingers.delete(e.pointerId)) this.paintButtons();
  };
}

/** Styles for the touch controls. Sizes scale with the viewport so they fit any phone. */
export const TOUCH_CSS = `
.touch { position: absolute; inset: 0; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; z-index: 5; }
.touch-stick-zone { position: absolute; left: 0; top: 0; width: 50%; height: 100%; }
.touch-base { position: absolute; width: min(30vh, 150px); height: min(30vh, 150px); margin: calc(min(30vh, 150px) / -2) 0 0 calc(min(30vh, 150px) / -2);
  border-radius: 50%; background: rgba(255,255,255,.10); border: 2px solid rgba(255,255,255,.35); display: none; pointer-events: none; }
.touch-base.on { display: block; }
.touch-knob { position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; border-radius: 50%; background: rgba(255,255,255,.55); transform: translate(-50%,-50%); }
.touch-buttons { position: absolute; right: max(12px, env(safe-area-inset-right)); bottom: max(10px, env(safe-area-inset-bottom)); width: min(62vh, 290px); height: min(56vh, 260px); }
.touch-btn { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%;
  width: 29%; aspect-ratio: 1; font: 700 min(4.2vh, 18px)/1 system-ui, sans-serif; color: #fff; letter-spacing: .5px;
  background: rgba(20,20,30,.45); border: 2px solid rgba(255,255,255,.55); }
.touch-btn.down { background: rgba(255,255,255,.55); color: #111; transform: scale(.94); }
.touch-light  { right: 34%; bottom: 0;    border-color: #6fd3ff; }
.touch-heavy  { right: 2%;  bottom: 16%;  border-color: #ff8f6b; }
.touch-ki     { right: 20%; bottom: 36%;  border-color: #ffe066; }
.touch-guard  { right: 66%; bottom: 14%;  width: 25%; border-color: #9be89b; }
.touch-charge { right: 52%; bottom: 46%;  width: 23%; border-color: #c9a6ff; }
.touch-super  { right: 0;   bottom: 62%;  width: 31%; aspect-ratio: 1.9; border-radius: 999px; opacity: .35; border-color: #ff5edb; }
.touch-super.ready { opacity: 1; background: rgba(255,94,219,.45); animation: touch-pulse .7s infinite alternate; }
@keyframes touch-pulse { to { box-shadow: 0 0 18px 4px rgba(255,94,219,.8); } }
`;
