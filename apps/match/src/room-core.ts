import { MAX_NAME, type ClientMsg, type PlayerInfo, type ServerMsg } from './protocol';

/** What the room remembers about one connection. slot -1 means "connected but not seated yet". */
export interface Seat {
  id: string;
  slot: number;
  name: string;
  fighter: number;
  ready: boolean;
  simple: boolean;
  hash: string;
}

export interface Outgoing { to: string; msg: ServerMsg }

export function newSeat(id: string): Seat {
  return { id, slot: -1, name: '', fighter: -1, ready: false, simple: false, hash: '' };
}

function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  // Keep letters, digits, spaces and a little punctuation; drop anything that could be markup or control codes.
  const kept = Array.from(s).filter((ch) => /[\p{L}\p{N} ._'-]/u.test(ch)).join('').trim().slice(0, MAX_NAME);
  return kept || 'Player';
}

function roomUpdate(seats: Seat[]): Outgoing[] {
  const players: PlayerInfo[] = seats.filter((s) => s.slot >= 0).sort((a, b) => a.slot - b.slot)
    .map((s) => ({ slot: s.slot, name: s.name, fighter: s.fighter, ready: s.ready }));
  return seats.filter((s) => s.slot >= 0).map((s) => ({ to: s.id, msg: { t: 'room', players } as ServerMsg }));
}

/**
 * The room's rules, with no network or storage code, so they can be tested directly.
 * Changes `seats` in place and returns the messages to send.
 */
export function handleMessage(seats: Seat[], fromId: string, msg: ClientMsg, code: string, randomSeed: () => number): Outgoing[] {
  const me = seats.find((s) => s.id === fromId);
  if (!me) return [];
  const seated = seats.filter((s) => s.slot >= 0);
  switch (msg.t) {
    case 'hello': {
      if (me.slot >= 0) return [];
      if (typeof msg.hash !== 'string' || msg.hash.length > 80) return [{ to: fromId, msg: { t: 'error', reason: 'bad' } }];
      if (seated.length >= 2) return [{ to: fromId, msg: { t: 'error', reason: 'full' } }];
      if (seated.length === 1 && seated[0]!.hash !== msg.hash) return [{ to: fromId, msg: { t: 'error', reason: 'version' } }];
      me.slot = seated.some((s) => s.slot === 0) ? 1 : 0;
      me.name = cleanName(msg.name);
      me.hash = msg.hash;
      me.simple = msg.simple === true;
      return [{ to: fromId, msg: { t: 'joined', slot: me.slot, code } }, ...roomUpdate(seats)];
    }
    case 'pick': {
      if (me.slot < 0 || !Number.isInteger(msg.fighter) || msg.fighter < 0 || msg.fighter > 63) return [];
      me.fighter = msg.fighter;
      me.ready = false;
      return roomUpdate(seats);
    }
    case 'ready': {
      if (me.slot < 0 || me.fighter < 0) return [];
      me.ready = msg.ready === true;
      const both = seats.filter((s) => s.slot >= 0);
      if (both.length === 2 && both.every((s) => s.ready)) {
        const a = both.find((s) => s.slot === 0)!;
        const b = both.find((s) => s.slot === 1)!;
        // Ready is cleared so that a rematch needs both players to ask again.
        a.ready = false; b.ready = false;
        const start: ServerMsg = { t: 'start', seed: randomSeed(), fighters: [a.fighter, b.fighter], simple: [a.simple, b.simple] };
        return [{ to: a.id, msg: start }, { to: b.id, msg: start }, ...roomUpdate(seats)];
      }
      return roomUpdate(seats);
    }
    case 'signal': {
      if (me.slot < 0) return [];
      const other = seats.find((s) => s.slot >= 0 && s.id !== fromId);
      return other ? [{ to: other.id, msg: { t: 'signal', data: msg.data } }] : [];
    }
    default:
      return [];
  }
}

/** A connection closed. Returns the update for whoever is left. */
export function handleLeave(seats: Seat[], id: string): Outgoing[] {
  const i = seats.findIndex((s) => s.id === id);
  if (i < 0) return [];
  const wasSeated = seats[i]!.slot >= 0;
  seats.splice(i, 1);
  if (!wasSeated) return [];
  for (const s of seats) s.ready = false;
  return roomUpdate(seats);
}

/** The seat that should receive relayed inputs from `fromId`. */
export function relayTarget(seats: Seat[], fromId: string): string | null {
  const me = seats.find((s) => s.id === fromId);
  if (!me || me.slot < 0) return null;
  return seats.find((s) => s.slot >= 0 && s.id !== fromId)?.id ?? null;
}
