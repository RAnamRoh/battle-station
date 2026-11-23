import { step, type SimEvent, type State } from '@bs/sim';
import { pack } from './pack';

/** Whatever runs the fight: local play now, online play later. The screen only ever talks to this. */
export interface FightDriver {
  state: State;
  /** Advances one 60 Hz tick and returns the events to show and hear. */
  advance(): SimEvent[];
  /** A short status line shown over the fight (for example while waiting for the other player). */
  status?: string;
  /** When true the screen holds still: no ticks, no effects. */
  paused?: boolean;
}

/** Both players on this device. */
export class LocalDriver implements FightDriver {
  state: State;
  paused = false;
  constructor(state: State, private readonly inputs: [() => number, () => number]) {
    this.state = state;
  }
  advance(): SimEvent[] {
    if (this.paused) return [];
    const r = step(this.state, this.inputs[0](), this.inputs[1](), pack.sim);
    this.state = r.state;
    return r.events;
  }
}
