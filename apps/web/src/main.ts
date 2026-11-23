import { Btn, createMatch, type State } from '@bs/sim';
import { isTouchDevice, KEYS_SOLO, KeyboardInput, TOUCH_CSS, TouchControls } from '@bs/input';
import { sfx } from './audio';
import { LocalDriver } from './driver';
import { pack } from './pack';
import { createGame, type FightView } from './render/scene';
import './style.css';
import { button, chip, controlsHelp, el, optionsBar, sheet } from './ui';

const ui = document.getElementById('ui')!;
const { scene } = createGame(document.getElementById('game')!);
document.head.append(el('style', { text: TOUCH_CSS }));

const touchDevice = isTouchDevice();
const keyboard = new KeyboardInput(KEYS_SOLO);
const touch = new TouchControls(ui);
touch.setVisible(touchDevice);
/** Scripted inputs for automated checks: one entry per frame, used instead of the real controls. */
const scripted: number[] = [];
let pauseAfterScript = false;
const readLocal = (): number => {
  if (scripted.length) {
    const v = scripted.shift()!;
    if (!scripted.length && pauseAfterScript) queueMicrotask(() => { const d = current?.driver; if (d instanceof LocalDriver) d.paused = true; });
    return v;
  }
  return keyboard.read() | touch.read();
};
let current: FightView | null = null;

for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sfx.unlock(), { passive: true });

const DUMMY_MODES: { label: string; input: (s: State) => number }[] = [
  { label: 'Dummy: stands', input: () => 0 },
  { label: 'Dummy: guards', input: () => Btn.GUARD },
  { label: 'Dummy: crouches', input: () => Btn.DOWN },
  { label: 'Dummy: jumps', input: () => Btn.UP },
];

function startTraining(): void {
  let dummy = 0;
  let simple = touchDevice;
  let view: FightView;
  const make = (keep?: State): void => {
    const state = createMatch({ fighters: [0, 0], seed: 1, training: true, kiRefill: keep ? keep.kiRefill === 1 : false, simple: [simple, false] }, pack.sim);
    const driver: LocalDriver = new LocalDriver(state, [readLocal, (): number => DUMMY_MODES[dummy]!.input(driver.state)]);
    view = { driver, stageId: pack.stages[0]!.id, showBoxes: view?.showBoxes ?? false, onTick: (s) => touch.setSuperReady(s.players[0]!.ki >= pack.sim.rules.kiMax) };
    scene.show(view);
    expose(view);
  };
  make();

  const bar = optionsBar('Options', [
    chip(DUMMY_MODES[0]!.label, (b) => { dummy = (dummy + 1) % DUMMY_MODES.length; b.textContent = DUMMY_MODES[dummy]!.label; }),
    chip('Ki refill', (b) => { const s = view.driver.state; s.kiRefill = s.kiRefill ? 0 : 1; b.classList.toggle('on', s.kiRefill === 1); }),
    chip('Hit areas', (b) => { view.showBoxes = !view.showBoxes; b.classList.toggle('on', view.showBoxes); }),
    chip(simple ? 'Controls: Simple' : 'Controls: Pro', (b) => { simple = !simple; b.textContent = simple ? 'Controls: Simple' : 'Controls: Pro'; make(view.driver.state); }),
    chip('Reset', () => make(view.driver.state)),
    chip('How to play', () => {
      const s = sheet(ui, [el('h2', { text: 'How to play' }), controlsHelp(touchDevice), el('p', { class: 'muted', text: 'Simple controls: tap light repeatedly for an automatic combo. Pro controls: every move by hand, a little more damage.' }), button('Got it', () => s.close())], () => s.close());
    }),
  ]);
  ui.append(bar);
}

/** A test seam: lets automated checks and the console read the live fight. */
function expose(view: FightView): void {
  current = view;
  (window as unknown as Record<string, unknown>).__GAME__ = {
    view, pack,
    getState: () => view.driver.state,
    /** Plays [frames, input] pairs for player 1, then optionally freezes the fight on the last frame. */
    script: (steps: [number, number][], pause = true) => {
      for (const [n, input] of steps) for (let i = 0; i < n; i++) scripted.push(input);
      pauseAfterScript = pause;
      if (view.driver instanceof LocalDriver) view.driver.paused = false;
    },
    resume: () => { if (view.driver instanceof LocalDriver) view.driver.paused = false; },
  };
}

startTraining();
