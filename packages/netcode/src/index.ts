import { hashState, Phase, step, type SimEvent, type SimPack, type State } from '@bs/sim';

/**
 * Rollback netcode (ADR-0013).
 *
 * Each device keeps two copies of the fight:
 *  - `confirmed`: advanced only with both players' real inputs. Both devices compute the same one.
 *  - `state` (predicted): what is drawn. It runs ahead using a guess for the other player's inputs.
 * When a real input differs from the guess, the predicted copy is rebuilt from the confirmed one.
 */

/** Anything that can carry small messages to the other player. Messages may be lost, repeated or reordered. */
export interface Transport {
  send(data: Uint8Array): void;
  onMessage: ((data: Uint8Array) => void) | null;
}

export interface SessionOptions {
  pack: SimPack;
  initial: State;
  /** Which player this device controls: 0 or 1. */
  local: number;
  transport: Transport;
  /** Frames between pressing a button and it taking effect. Hides small network delays. */
  inputDelay?: number;
  /** How many frames the game may run ahead without the other player's inputs. */
  maxPrediction?: number;
  /** Clock in milliseconds. Injected so tests can control time. */
  now?: () => number;
}

const MSG_INPUT = 1;
const MSG_CHECK = 2;
const INPUTS_PER_MESSAGE = 20;
const CHECK_EVERY = 60;
const FRAME_MS = 1000 / 60;

export class RollbackSession {
  /** The predicted fight: draw this one. */
  state: State;
  /** The fight as agreed by both devices so far. */
  confirmed: State;
  /** Frames simulated in `state`. */
  frame = 0;
  /** Frames simulated in `confirmed`. */
  confirmedFrame = 0;

  /** Round-trip time to the other player, in milliseconds (smoothed). -1 until measured. */
  ping = -1;
  /** True while the game is holding still, waiting for the other player's inputs. */
  stalled = false;
  /** True once the two devices have disagreed about the fight. The match cannot continue. */
  desync = false;
  /** How many frames were re-simulated in total because of wrong guesses. */
  rollbackFrames = 0;
  /** Checksums of the confirmed fight, by frame. */
  readonly checks = new Map<number, number>();

  private readonly pack: SimPack;
  private readonly local: number;
  private readonly transport: Transport;
  private readonly delay: number;
  private readonly maxPrediction: number;
  private readonly now: () => number;

  private readonly localInputs: number[] = [];
  private readonly remoteInputs: (number | undefined)[] = [];
  /** The remote input the predicted fight used for each frame. */
  private readonly used: number[] = [];
  private lastRemote = -1;
  private peerAck = -1;
  private peerFrame = 0;
  private peerHeardAt = -1;
  private peerStamp = 0;
  private dirty = false;
  private ticks = 0;
  private readonly peerChecks = new Map<number, number>();
  private readonly shown = new Map<string, number>();

  constructor(o: SessionOptions) {
    this.pack = o.pack;
    this.state = o.initial;
    this.confirmed = o.initial;
    this.local = o.local;
    this.transport = o.transport;
    this.delay = o.inputDelay ?? 2;
    this.maxPrediction = o.maxPrediction ?? 8;
    this.now = o.now ?? (() => Date.now());
    for (let f = 0; f < this.delay; f++) this.localInputs[f] = 0;
    this.transport.onMessage = (data) => this.receive(data);
  }

  /** Milliseconds since anything arrived from the other player. -1 before the first message. */
  get silentMs(): number {
    return this.peerHeardAt < 0 ? -1 : this.now() - this.peerHeardAt;
  }

  get finished(): boolean {
    return this.confirmed.phase === Phase.MATCH_END;
  }

  /** The inputs this device has locked in so far, for replays and checks. */
  localInputLog(): readonly number[] { return this.localInputs; }

  /** Call once per 60 Hz tick with the local player's input. Returns the events to show and hear. */
  tick(localInput: number): SimEvent[] {
    const out: SimEvent[] = [];
    this.ticks++;
    this.advanceConfirmed();

    if (this.dirty) {
      // A guess was wrong: rebuild the predicted fight from the agreed one.
      this.dirty = false;
      let s = this.confirmed;
      for (let f = this.confirmedFrame; f < this.frame; f++) {
        const r = this.stepWith(s, f);
        s = r.state;
        this.collect(r.events, out);
        this.rollbackFrames++;
      }
      this.state = s;
    }

    this.stalled = this.frame - (this.lastRemote + 1) >= this.maxPrediction;
    let advance = !this.stalled && !this.desync;

    // Time sync: if this device is running ahead of the other, wait a frame now and then.
    if (advance && this.peerHeardAt >= 0 && this.ticks % 4 === 0) {
      const since = this.now() - this.peerHeardAt + (this.ping > 0 ? this.ping / 2 : 0);
      const peerNow = this.peerFrame + since / FRAME_MS;
      if (this.frame - peerNow > 1) advance = false;
    }

    if (advance) {
      const at = this.frame + this.delay;
      if (this.localInputs[at] === undefined) this.localInputs[at] = localInput & 1023;
      const r = this.stepWith(this.state, this.frame);
      this.state = r.state;
      this.frame++;
      this.collect(r.events, out);
    }
    this.sendInputs();
    if (this.ticks % 240 === 0) this.prune();
    return out;
  }

  private remoteFor(f: number): number {
    const known = this.remoteInputs[f];
    if (known !== undefined) return known;
    return this.lastRemote >= 0 ? this.remoteInputs[this.lastRemote]! : 0;
  }

  private stepWith(s: State, f: number) {
    const mine = this.localInputs[f] ?? 0;
    const theirs = this.remoteFor(f);
    this.used[f] = theirs;
    return this.local === 0 ? step(s, mine, theirs, this.pack) : step(s, theirs, mine, this.pack);
  }

  private advanceConfirmed(): void {
    while (this.confirmedFrame < this.frame && this.remoteInputs[this.confirmedFrame] !== undefined) {
      const f = this.confirmedFrame;
      const mine = this.localInputs[f] ?? 0;
      const theirs = this.remoteInputs[f]!;
      this.confirmed = (this.local === 0 ? step(this.confirmed, mine, theirs, this.pack) : step(this.confirmed, theirs, mine, this.pack)).state;
      this.confirmedFrame++;
      if (this.confirmedFrame % CHECK_EVERY === 0) {
        const h = hashState(this.confirmed);
        this.checks.set(this.confirmedFrame, h);
        const m = new Uint8Array(9);
        const v = new DataView(m.buffer);
        v.setUint8(0, MSG_CHECK);
        v.setUint32(1, this.confirmedFrame);
        v.setUint32(5, h);
        this.transport.send(m);
        this.compare(this.confirmedFrame);
      }
    }
  }

  private compare(frame: number): void {
    const a = this.checks.get(frame);
    const b = this.peerChecks.get(frame);
    if (a !== undefined && b !== undefined && a !== b) this.desync = true;
  }

  /** Shows each event once, even if the frame it belongs to is simulated again after a rollback. */
  private collect(events: SimEvent[], out: SimEvent[]): void {
    for (const e of events) {
      const key = `${e.f}:${e.t}:${e.p}:${e.a}:${e.b}`;
      if (this.shown.has(key)) continue;
      this.shown.set(key, e.f);
      out.push(e);
    }
  }

  private prune(): void {
    const old = this.confirmedFrame - 120;
    for (const [k, f] of this.shown) if (f < old) this.shown.delete(k);
    for (const f of this.checks.keys()) if (f < this.confirmedFrame - 3600) this.checks.delete(f);
    for (const f of this.peerChecks.keys()) if (f < this.confirmedFrame - 3600) this.peerChecks.delete(f);
  }

  private sendInputs(): void {
    const top = this.localInputs.length - 1;
    let start = this.peerAck + 1;
    if (start < top - INPUTS_PER_MESSAGE + 1) start = top - INPUTS_PER_MESSAGE + 1;
    if (start < 0) start = 0;
    const count = top - start + 1 > 0 ? top - start + 1 : 0;
    const m = new Uint8Array(24 + count * 2);
    const v = new DataView(m.buffer);
    const now = this.now();
    v.setUint8(0, MSG_INPUT);
    v.setUint32(1, this.frame);
    v.setInt32(5, this.lastRemote);
    v.setUint32(9, Math.floor(now) >>> 0);
    v.setUint32(13, this.peerStamp);
    v.setUint16(17, this.peerHeardAt < 0 ? 0 : Math.min(65535, Math.floor(now - this.peerHeardAt)));
    v.setUint32(19, start);
    v.setUint8(23, count);
    for (let i = 0; i < count; i++) v.setUint16(24 + i * 2, this.localInputs[start + i] ?? 0);
    this.transport.send(m);
  }

  private receive(data: Uint8Array): void {
    if (data.length < 9) return;
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const type = v.getUint8(0);
    const now = this.now();
    if (type === MSG_CHECK) {
      const frame = v.getUint32(1);
      this.peerChecks.set(frame, v.getUint32(5));
      this.compare(frame);
      this.peerHeardAt = now;
      return;
    }
    if (type !== MSG_INPUT || data.length < 24) return;
    const count = v.getUint8(23);
    if (data.length < 24 + count * 2) return;
    const peerFrame = v.getUint32(1);
    if (peerFrame >= this.peerFrame) {
      // Only the newest message is used for timing; older ones may arrive late.
      this.peerFrame = peerFrame;
      this.peerHeardAt = now;
      this.peerStamp = v.getUint32(9);
      const echo = v.getUint32(13);
      if (echo !== 0) {
        const rtt = (Math.floor(now) >>> 0) - echo - v.getUint16(17);
        if (rtt >= 0 && rtt < 5000) this.ping = this.ping < 0 ? rtt : this.ping * 0.85 + rtt * 0.15;
      }
    }
    const ack = v.getInt32(5);
    if (ack > this.peerAck) this.peerAck = ack;
    const start = v.getUint32(19);
    for (let i = 0; i < count; i++) {
      const f = start + i;
      if (this.remoteInputs[f] !== undefined) continue;
      const value = v.getUint16(24 + i * 2) & 1023;
      this.remoteInputs[f] = value;
      if (f < this.frame && this.used[f] !== value) this.dirty = true;
    }
    while (this.remoteInputs[this.lastRemote + 1] !== undefined) this.lastRemote++;
  }
}
