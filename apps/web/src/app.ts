import { botInput, createBot, LEVEL_NAMES, Level } from '@bs/bots';
import { isTouchDevice, KEYS_LEFT, KEYS_RIGHT, KEYS_SOLO, KeyboardInput, TOUCH_CSS, TouchControls } from '@bs/input';
import { Btn, createMatch, Phase, type State } from '@bs/sim';
import { sfx } from './audio';
import { LocalDriver, type FightDriver } from './driver';
import { pack } from './pack';
import { fighterCard } from './cards';
import { portrait } from './portrait';
import { createGame, type FightScene, type FightView } from './render/scene';
import { loadSettings, saveSettings, type Settings } from './settings';
import { button, chip, controlsHelp, el, optionsBar, sheet } from './ui';

export type Mode = 'cpu' | 'local' | 'training';

interface FightSetup { mode: Mode; fighters: [number, number]; level: number }

const DUMMY_MODES: { label: string; input: number }[] = [
  { label: 'Dummy: stands', input: 0 },
  { label: 'Dummy: guards', input: Btn.GUARD },
  { label: 'Dummy: crouches', input: Btn.DOWN },
  { label: 'Dummy: jumps', input: Btn.UP },
];

/** Owns the page: which screen is showing and which fight is running. The canvas only draws. */
export class App {
  readonly ui = document.getElementById('ui')!;
  readonly scene: FightScene;
  readonly touchDevice = isTouchDevice();
  readonly touch: TouchControls;
  settings: Settings = loadSettings();
  keyboards: KeyboardInput[] = [];
  private screen: HTMLElement | null = null;
  overlay: { close: () => void } | null = null;
  /** Scripted inputs for automated checks: one entry per frame, used instead of the real controls. */
  private scripted: number[] = [];
  private pauseAfterScript = false;
  private current: FightView | null = null;
  onEscape: (() => void) | null = null;

  constructor() {
    this.scene = createGame(document.getElementById('game')!).scene;
    document.head.append(el('style', { text: TOUCH_CSS }));
    this.touch = new TouchControls(this.ui);
    this.touch.setVisible(false);
    for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sfx.unlock(), { passive: true });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.onEscape) this.onEscape(); });
    this.applySettings();
  }

  get simple(): boolean { return this.settings.simple ?? this.touchDevice; }

  applySettings(): void {
    sfx.volume = this.settings.volume;
    sfx.muted = this.settings.muted;
    if (this.scene.fx) this.scene.fx.settings = { shake: this.settings.shake ? 1 : 0, flashes: this.settings.flashes };
    saveSettings(this.settings);
  }

  // ---------- screens ----------

  setScreen(node: HTMLElement | null): void {
    this.screen?.remove();
    this.overlay?.close();
    this.overlay = null;
    this.screen = node;
    if (node) this.ui.append(node);
  }

  endFight(): void {
    for (const k of this.keyboards) k.dispose();
    this.keyboards = [];
    this.touch.setVisible(false);
    this.scene.view = null;
    this.current = null;
    this.onEscape = null;
  }

  menu(): void {
    this.endFight();
    const items: HTMLElement[] = [];
    for (const extra of this.menuExtras) items.push(extra());
    items.push(button('Versus CPU', () => this.select('cpu')));
    if (!this.touchDevice) items.push(button('2 Players', () => this.select('local'), true));
    items.push(
      button('Training', () => this.select('training'), true),
      button('How to play', () => this.help(), true),
      button('Settings', () => this.settingsSheet(), true),
    );
    this.setScreen(el('div', { class: 'menu' }, [
      el('div', { class: 'logo' }, [el('span', { text: 'BATTLE' }), el('span', { class: 'logo2', text: 'STATION' })]),
      el('div', { class: 'tag', text: 'Settle it after the stand-up.' }),
      el('div', { class: 'menu-items' }, items),
      el('div', { class: 'foot muted', text: 'Prototype build · placeholder fighters' }),
    ]));
  }

  /** Extra main-menu buttons added by other features (online play registers itself here). */
  menuExtras: (() => HTMLElement)[] = [];

  help(): void {
    const s = sheet(this.ui, [
      el('h2', { text: 'How to play' }),
      controlsHelp(this.touchDevice),
      el('p', { class: 'muted', text: 'Land hits to fill the ki meter. Ki pays for blasts and power moves; a full meter unlocks your super. Guarding stops attacks but not throws.' }),
      el('p', { class: 'muted', text: 'Simple controls: tap light repeatedly for an automatic combo. Pro controls: every move by hand, for a little more damage.' }),
      button('Got it', () => s.close()),
    ], () => s.close());
  }

  settingsSheet(onClose?: () => void): void {
    const st = this.settings;
    const toggle = (label: () => string, flip: () => void) => chip(label(), (b) => { flip(); b.textContent = label(); this.applySettings(); sfx.ui(); });
    const vol = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(st.volume * 100)), class: 'slider' });
    vol.addEventListener('input', () => { st.volume = Number(vol.value) / 100; this.applySettings(); });
    vol.addEventListener('change', () => sfx.hit(1, 0));
    const close = () => { s.close(); onClose?.(); };
    const s = sheet(this.ui, [
      el('h2', { text: 'Settings' }),
      el('div', { class: 'row set' }, [el('span', { text: 'Volume' }), vol, toggle(() => (st.muted ? 'Sound: off' : 'Sound: on'), () => { st.muted = !st.muted; })]),
      el('div', { class: 'row set' }, [
        toggle(() => (st.shake ? 'Screen shake: on' : 'Screen shake: off'), () => { st.shake = !st.shake; }),
        toggle(() => (st.flashes ? 'Flashes: on' : 'Flashes: off'), () => { st.flashes = !st.flashes; }),
      ]),
      el('div', { class: 'row set' }, [
        toggle(() => (this.simple ? 'Controls: Simple' : 'Controls: Pro'), () => { st.simple = !this.simple; }),
        el('span', { class: 'muted', text: 'Simple = automatic combos. Applies from the next match.' }),
      ]),
      button('Done', close),
    ], close);
  }

  /** Character select. Calls back with the chosen fighters (and CPU level). */
  select(mode: Mode, done?: (fighters: [number, number], level: number) => void): void {
    this.endFight();
    let step = 0;
    let level: number = Level.NORMAL;
    const picks: number[] = [];
    const titles = mode === 'local'
      ? ['Player 1: choose your fighter', 'Player 2: choose your fighter']
      : mode === 'cpu' ? ['Choose your fighter', 'Choose your opponent'] : ['Choose your fighter', 'Choose the training dummy'];
    const title = el('h2', { class: 'select-title', text: titles[0]! });
    const extras = el('div', { class: 'row select-extras' });
    const grid = el('div', { class: 'grid' });
    const finish = () => {
      const fighters: [number, number] = [picks[0]!, picks[1]!];
      if (done) done(fighters, level); else this.fight({ mode, fighters, level });
    };
    const pick = (i: number) => {
      sfx.ui();
      picks[step] = i;
      step++;
      if (step >= 2) { finish(); return; }
      title.textContent = titles[1]!;
      grid.querySelectorAll('.fcard').forEach((c, n) => c.classList.toggle('taken', n === i));
      extras.replaceChildren();
      if (mode !== 'local') extras.append(button('Random', () => pick(Math.floor(Math.random() * pack.fighters.length)), true));
      if (mode === 'cpu') {
        const chips = LEVEL_NAMES.map((name, n) => chip(name, () => { level = n; chips.forEach((c, k) => c.classList.toggle('on', k === n)); }, n === level));
        extras.append(el('span', { class: 'muted', text: 'Difficulty' }), ...chips);
      }
    };
    pack.fighters.forEach((_f, i) => grid.append(fighterCard(i, () => pick(i))));
    this.setScreen(el('div', { class: 'select' }, [
      el('div', { class: 'row select-head' }, [button('Back', () => this.menu(), true), title]),
      grid, extras,
    ]));
  }

  // ---------- fights ----------

  readLocal = (): number => {
    if (this.scripted.length) {
      const v = this.scripted.shift()!;
      if (!this.scripted.length && this.pauseAfterScript) queueMicrotask(() => { if (this.current) this.current.driver.paused = true; });
      return v;
    }
    return (this.keyboards[0]?.read() ?? 0) | this.touch.read();
  };

  /** Turns on the one-player controls: the whole keyboard, plus touch on phones. */
  soloControls(): void {
    for (const k of this.keyboards) k.dispose();
    this.keyboards = [new KeyboardInput(KEYS_SOLO)];
    this.touch.setVisible(this.touchDevice);
  }

  fight(setup: FightSetup): void {
    this.endFight();
    this.setScreen(null);
    const training = setup.mode === 'training';
    const seed = (Math.random() * 0x7fffffff) | 0;
    const state = createMatch({ fighters: setup.fighters, seed, training, simple: [this.simple, setup.mode === 'local' ? this.simple : false] }, pack.sim);

    let dummy = 0;
    let bot = createBot(setup.level, seed ^ 0x51ed);
    let input2: () => number;
    if (setup.mode === 'local') {
      this.keyboards = [new KeyboardInput(KEYS_LEFT), new KeyboardInput(KEYS_RIGHT)];
      input2 = () => this.keyboards[1]!.read();
    } else {
      this.keyboards = [new KeyboardInput(KEYS_SOLO)];
      this.touch.setVisible(this.touchDevice);
      input2 = () => {
        if (!training) return botInput(bot, driver.state, 1, pack.sim);
        return dummy < DUMMY_MODES.length ? DUMMY_MODES[dummy]!.input : botInput(bot, driver.state, 1, pack.sim);
      };
    }
    const driver: LocalDriver = new LocalDriver(state, [this.readLocal, input2]);

    let endShown = false;
    let endWait = 0;
    const view: FightView = {
      driver,
      stageId: pack.stages[0]!.id,
      showBoxes: false,
      onTick: (s) => {
        this.touch.setSuperReady(s.players[0]!.ki >= pack.sim.rules.kiMax);
        if (s.phase === Phase.MATCH_END && !endShown && ++endWait > 110) { endShown = true; this.result(s, setup); }
      },
    };
    this.show(view);

    const pause = () => {
      if (endShown || this.overlay) return;
      driver.paused = true;
      const resume = () => { s.close(); this.overlay = null; driver.paused = false; };
      const s = sheet(this.ui, [
        el('h2', { text: 'Paused' }),
        setup.mode === 'local' ? localKeys() : controlsHelp(this.touchDevice),
        el('div', { class: 'row', style: 'margin-top:14px' }, [
          button('Resume', resume),
          button('Settings', () => { s.close(); this.overlay = null; this.settingsSheet(() => pause()); }, true),
          button('Quit to menu', () => this.menu(), true),
        ]),
      ]);
      this.overlay = s;
    };
    this.onEscape = () => { if (this.overlay && driver.paused) { this.overlay.close(); this.overlay = null; driver.paused = false; } else pause(); };

    if (training) {
      const labels = [...DUMMY_MODES.map((d) => d.label), ...LEVEL_NAMES.map((n) => `Dummy: fights (${n})`)];
      this.setScreen(optionsBar('Options', [
        chip(labels[0]!, (b) => {
          dummy = (dummy + 1) % labels.length;
          b.textContent = labels[dummy]!;
          if (dummy >= DUMMY_MODES.length) bot = createBot(dummy - DUMMY_MODES.length, seed);
        }),
        chip('Ki refill', (b) => { const s = driver.state; s.kiRefill = s.kiRefill ? 0 : 1; b.classList.toggle('on', s.kiRefill === 1); }),
        chip('Hit areas', (b) => { view.showBoxes = !view.showBoxes; b.classList.toggle('on', view.showBoxes); }),
        chip('Reset', () => this.fight(setup)),
        chip('Pause', pause),
      ]));
    } else {
      const bar = el('div', { class: 'bar fold open' }, [chip('Pause', pause)]);
      this.setScreen(bar);
    }
  }

  /** Shows a fight driven by any driver (local or online). */
  show(view: FightView): void {
    this.current = view;
    this.scene.show(view);
    this.applySettings();
    (window as unknown as Record<string, unknown>).__GAME__ = {
      view, pack, app: this,
      getState: () => view.driver.state,
      /** Plays [frames, input] pairs for player 1, then optionally freezes the fight on the last frame. */
      script: (steps: [number, number][], pause = true) => {
        for (const [n, input] of steps) for (let i = 0; i < n; i++) this.scripted.push(input);
        this.pauseAfterScript = pause;
        view.driver.paused = false;
      },
      resume: () => { view.driver.paused = false; },
    };
  }

  private result(s: State, setup: FightSetup): void {
    const w = s.winner;
    const who = w === 2 ? null : pack.fighters[s.players[w]!.fighter]!.presentation;
    const label = setup.mode === 'cpu' ? (w === 0 ? 'You win!' : w === 1 ? 'You lose' : 'Draw') : w === 2 ? 'Draw' : `Player ${w + 1} wins!`;
    const sh = sheet(this.ui, [
      el('div', { class: 'result' }, [
        who ? portrait(who, 110) : el('span'),
        el('div', {}, [
          el('h2', { text: label }),
          el('div', { class: 'fname', text: who ? who.name : 'Nobody' }),
          el('p', { class: 'quote', text: who ? `“${who.quotes.win}”` : 'Evenly matched.' }),
        ]),
      ]),
      el('div', { class: 'row' }, [
        button('Rematch', () => this.fight(setup)),
        button('Change fighters', () => this.select(setup.mode), true),
        button('Menu', () => this.menu(), true),
      ]),
    ]);
    this.overlay = sh;
  }
}

function localKeys(): HTMLElement {
  const k = (...keys: string[]) => keys.map((x) => `<kbd>${x}</kbd>`).join(' ');
  const t = el('table');
  t.innerHTML = [
    ['', '<b>Player 1</b>', '<b>Player 2</b>'],
    ['Move', k('W', 'A', 'S', 'D'), 'Arrow keys'],
    ['Light / Heavy / Ki', k('F', 'G', 'H'), k('J', 'K', 'L')],
    ['Guard', k('V'), k('M')],
    ['Charge / Super', k('R', 'T'), k('O', 'I')],
  ].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
  return t;
}

export type { FightDriver };
