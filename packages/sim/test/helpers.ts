import { createMatch, step, Btn, type SimEvent, type SimPack, type State } from '../src/index';
import fixture from './fixture.pack.json';

/** A frozen copy of the first fighter's data, so tuning the real content does not move these tests. */
export const pack = fixture as unknown as SimPack;
export const B = Btn;

export function training(extra: { kiRefill?: boolean; simple?: [boolean, boolean] } = {}): State {
  return createMatch({ fighters: [0, 0], seed: 1, training: true, ...extra }, pack);
}

export function versus(): State {
  return createMatch({ fighters: [0, 0], seed: 1 }, pack);
}

export interface Run { state: State; events: SimEvent[] }

/** Runs a script: each entry is [frames, input0, input1]. */
export function run(start: State, script: [number, number, number][]): Run {
  let state = start;
  const events: SimEvent[] = [];
  for (const [n, a, b] of script) {
    for (let i = 0; i < n; i++) {
      const r = step(state, a, b, pack);
      state = r.state;
      for (const e of r.events) events.push(e);
    }
  }
  return { state, events };
}

/** Puts the two fighters next to each other (pixels apart). */
export function close(s: State, gapPx = 80): State {
  s.players[0]!.x = -gapPx * 128;
  s.players[1]!.x = gapPx * 128;
  return s;
}
