import { describe, expect, it } from 'vitest';
import type { ClientMsg, ServerMsg } from '../src/protocol';
import { handleLeave, handleMessage, newSeat, relayTarget, type Seat } from '../src/room-core';

function room() {
  const seats: Seat[] = [];
  const inbox = new Map<string, ServerMsg[]>();
  const connect = (id: string) => { seats.push(newSeat(id)); inbox.set(id, []); };
  const send = (id: string, msg: ClientMsg) => {
    for (const o of handleMessage(seats, id, msg, 'ABCDE', () => 1234)) inbox.get(o.to)?.push(o.msg);
  };
  const leave = (id: string) => { for (const o of handleLeave(seats, id)) inbox.get(o.to)?.push(o.msg); };
  const last = (id: string) => inbox.get(id)!.at(-1)!;
  const all = (id: string) => inbox.get(id)!;
  return { seats, connect, send, leave, last, all };
}
const hello = (name: string, hash = 'h1'): ClientMsg => ({ t: 'hello', name, hash, simple: false });

describe('match room', () => {
  it('seats two players and tells each about the other', () => {
    const r = room();
    r.connect('a'); r.connect('b');
    r.send('a', hello('Asha'));
    expect(r.all('a')[0]).toEqual({ t: 'joined', slot: 0, code: 'ABCDE' });
    r.send('b', hello('Babu'));
    expect(r.all('b')[0]).toEqual({ t: 'joined', slot: 1, code: 'ABCDE' });
    const msg = r.last('a');
    expect(msg.t === 'room' && msg.players.map((p) => p.name)).toEqual(['Asha', 'Babu']);
  });

  it('tells a third person the room is full', () => {
    const r = room();
    for (const id of ['a', 'b', 'c']) r.connect(id);
    r.send('a', hello('A')); r.send('b', hello('B')); r.send('c', hello('C'));
    expect(r.last('c')).toEqual({ t: 'error', reason: 'full' });
  });

  it('refuses a player whose game data differs', () => {
    const r = room();
    r.connect('a'); r.connect('b');
    r.send('a', hello('A', 'new')); r.send('b', hello('B', 'old'));
    expect(r.last('b')).toEqual({ t: 'error', reason: 'version' });
  });

  it('starts only when both have picked and are ready, and sends both the same start', () => {
    const r = room();
    r.connect('a'); r.connect('b');
    r.send('a', hello('A')); r.send('b', hello('B'));
    r.send('a', { t: 'ready', ready: true }); // no fighter yet: ignored
    r.send('a', { t: 'pick', fighter: 2 });
    r.send('a', { t: 'ready', ready: true });
    expect(r.all('a').some((m) => m.t === 'start')).toBe(false);
    r.send('b', { t: 'pick', fighter: 4 });
    r.send('b', { t: 'ready', ready: true });
    const sa = r.all('a').find((m) => m.t === 'start');
    const sb = r.all('b').find((m) => m.t === 'start');
    expect(sa).toEqual({ t: 'start', seed: 1234, fighters: [2, 4], simple: [false, false] });
    expect(sb).toEqual(sa);
  });

  it('needs both players to ask again for a rematch', () => {
    const r = room();
    r.connect('a'); r.connect('b');
    r.send('a', hello('A')); r.send('b', hello('B'));
    r.send('a', { t: 'pick', fighter: 0 }); r.send('b', { t: 'pick', fighter: 1 });
    r.send('a', { t: 'ready', ready: true }); r.send('b', { t: 'ready', ready: true });
    const starts = () => r.all('a').filter((m) => m.t === 'start').length;
    expect(starts()).toBe(1);
    r.send('a', { t: 'ready', ready: true });
    expect(starts()).toBe(1);
    r.send('b', { t: 'ready', ready: true });
    expect(starts()).toBe(2);
  });

  it('passes connection-setup messages and inputs only to the other player', () => {
    const r = room();
    r.connect('a'); r.connect('b'); r.connect('c');
    r.send('a', hello('A')); r.send('b', hello('B'));
    r.send('a', { t: 'signal', data: { sdp: 'x' } });
    expect(r.last('b')).toEqual({ t: 'signal', data: { sdp: 'x' } });
    expect(relayTarget(r.seats, 'a')).toBe('b');
    expect(relayTarget(r.seats, 'c')).toBeNull();
  });

  it('frees the seat when a player leaves, and the next person takes it', () => {
    const r = room();
    r.connect('a'); r.connect('b'); r.connect('c');
    r.send('a', hello('A')); r.send('b', hello('B'));
    r.leave('a');
    const msg = r.last('b');
    expect(msg.t === 'room' && msg.players.length).toBe(1);
    r.send('c', hello('C'));
    expect(r.all('c')[0]).toEqual({ t: 'joined', slot: 0, code: 'ABCDE' });
  });

  it('cleans up display names', () => {
    const r = room();
    r.connect('a');
    r.send('a', hello('  <b>Rakib</b> the very very long name  '));
    const msg = r.last('a');
    expect(msg.t === 'room' && msg.players[0]!.name).toBe('bRakibb the very');
  });
});
