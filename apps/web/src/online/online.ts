import { RollbackSession } from '@bs/netcode';
import { ROOM_CODE } from '@bs/match/protocol';
import { createMatch, Phase, type SimEvent, type State } from '@bs/sim';
import type { App } from '../app';
import { sfx } from '../audio';
import { fighterCard } from '../cards';
import type { FightDriver } from '../driver';
import { pack } from '../pack';
import { portrait } from '../portrait';
import type { FightView } from '../render/scene';
import { button, el, sheet } from '../ui';
import { HybridTransport, PeerLink, RoomConnection } from './room';

/** Runs an online fight through the rollback session. */
class NetDriver implements FightDriver {
  state: State;
  status = '';
  info = '';
  paused = false;
  constructor(readonly session: RollbackSession, private readonly read: () => number, private readonly transport: HybridTransport) {
    this.state = session.state;
  }
  advance(): SimEvent[] {
    const s = this.session;
    const events = s.tick(this.read());
    this.state = s.state;
    const silent = s.silentMs;
    this.status = s.desync ? 'Out of sync' : silent > 4000 ? 'Opponent is not responding…' : s.stalled ? 'Waiting for opponent…' : '';
    this.info = `${this.transport.direct ? 'direct' : 'relayed'}${s.ping >= 0 ? ` · ${Math.round(s.ping)} ms` : ''}`;
    return events;
  }
}

/** Online play: create or join a room, the lobby, the match, and the rematch. */
export class Online {
  private room: RoomConnection | null = null;
  private transport: HybridTransport | null = null;
  private peer: PeerLink | null = null;
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  private inMatch = false;
  private lobbyEl: HTMLElement | null = null;
  private refreshLobby: (() => void) | null = null;
  /** For automated checks: force inputs through the room instead of the direct link. */
  relayOnly = new URLSearchParams(location.search).has('relay');

  constructor(private readonly app: App) {
    app.menuExtras.push(() => button('Play Online', () => this.entry()));
  }

  /** Opens the join sheet when the page was opened from an invite link. */
  openFromUrl(): boolean {
    const m = /^\/r\/([A-Za-z0-9]{5})\/?$/.exec(location.pathname);
    const code = (m?.[1] ?? new URLSearchParams(location.search).get('room') ?? '').toUpperCase();
    if (!ROOM_CODE.test(code)) return false;
    this.app.menu();
    this.entry(code);
    return true;
  }

  private setUrl(code: string | null): void {
    const q = new URLSearchParams(location.search);
    q.delete('room');
    const extra = q.size ? `?${q.toString().replace(/=(?=&|$)/g, '')}` : '';
    try { history.replaceState(null, '', code ? `/r/${code}${extra}` : `/${extra}`); } catch { /* not allowed here: the link still works */ }
  }

  private inviteUrl(code: string): string { return `${location.origin}/r/${code}`; }

  /** The first sheet: your name, then create a room or join one. */
  entry(joinCode = ''): void {
    const st = this.app.settings;
    const name = el('input', { class: 'field', maxlength: '16', placeholder: 'Your name', value: st.name, autocomplete: 'off' });
    const code = el('input', { class: 'field code', maxlength: '5', placeholder: 'CODE', value: joinCode, autocomplete: 'off', autocapitalize: 'characters' });
    const note = el('p', { class: 'muted', text: '' });
    const useName = (): string | null => {
      const v = name.value.trim();
      if (!v) { note.textContent = 'Enter a name so your opponent knows who you are.'; name.focus(); return null; }
      st.name = v; this.app.applySettings();
      return v;
    };
    const close = () => { s.close(); if (joinCode) this.setUrl(null); };
    const join = () => {
      const n = useName();
      if (!n) return;
      const c = code.value.trim().toUpperCase();
      if (!ROOM_CODE.test(c)) { note.textContent = 'Room codes are 5 letters and numbers.'; return; }
      s.close();
      this.lobby(c, n);
    };
    const create = async () => {
      const n = useName();
      if (!n) return;
      note.textContent = 'Creating room…';
      try {
        const res = await fetch('/api/rooms', { method: 'POST' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { code: string };
        s.close();
        this.lobby(body.code, n);
      } catch {
        note.textContent = 'Could not reach the room server. Is it running?';
      }
    };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    const s = sheet(this.app.ui, joinCode
      ? [el('h2', { text: `Join room ${joinCode}` }), el('div', { class: 'row set' }, [name]), note, el('div', { class: 'row' }, [button('Join', join), button('Cancel', close, true)])]
      : [
          el('h2', { text: 'Play online' }),
          el('div', { class: 'row set' }, [name]),
          el('div', { class: 'row set' }, [button('Create a room', () => void create())]),
          el('div', { class: 'row set' }, [el('span', { class: 'muted', text: 'or join with a code' }), code, button('Join', join, true)]),
          note,
          button('Back', close, true),
        ], close);
    setTimeout(() => (st.name ? (joinCode ? null : code) : name)?.focus(), 50);
  }

  private leave(): void {
    this.peer?.close(); this.peer = null;
    this.room?.close(); this.room = null;
    this.transport = null;
    this.inMatch = false;
    this.lobbyEl = null; this.refreshLobby = null;
    this.setUrl(null);
    this.app.menu();
  }

  private fail(title: string, text: string): void {
    this.peer?.close(); this.peer = null;
    this.room?.close(); this.room = null;
    this.inMatch = false;
    this.setUrl(null);
    this.app.menu();
    const s = sheet(this.app.ui, [el('h2', { text: title }), el('p', { text }), button('OK', () => s.close())], () => s.close());
  }

  private lobby(code: string, name: string): void {
    this.app.endFight();
    this.setUrl(code);
    const room = new RoomConnection(code, { t: 'hello', name, hash: pack.gameplayHash, simple: this.app.simple });
    this.room = room;
    const transport = new HybridTransport(room);
    transport.relayOnly = this.relayOnly;
    transport.lagMs = Math.max(0, Math.min(1000, Number(new URLSearchParams(location.search).get('lag')) || 0));
    this.transport = transport;
    void fetch('/api/ice').then((r) => r.json()).then((b: { iceServers?: RTCIceServer[] }) => { if (b.iceServers?.length) this.iceServers = b.iceServers; }).catch(() => undefined);

    room.onError = (reason) => this.fail(
      reason === 'full' ? 'Room is full' : reason === 'version' ? 'Update needed' : 'Could not join',
      reason === 'full' ? 'Two players are already in this room. Ask for a new link.'
        : reason === 'version' ? 'Your opponent has a different version of the game. Reload the page to get the latest one, then join again.'
        : 'The room did not accept the connection.');
    room.onClosed = () => this.fail('Connection lost', 'The connection to the room was lost.');
    room.onSignal = (data) => {
      if (!this.peer && room.slot === 1 && !this.relayOnly) this.makePeer(false);
      void this.peer?.signal(data);
    };
    room.onRoom = () => {
      const has = room.players.length === 2;
      if (has && !this.peer && room.slot === 0 && !this.relayOnly) this.makePeer(true);
      if (!has) {
        this.peer?.close(); this.peer = null; transport.setPeer(null);
        if (this.inMatch) this.opponentLeft();
      }
      this.refreshLobby?.();
    };
    room.onJoined = () => this.showLobby();
    room.onStart = (msg) => this.startMatch(msg.seed, msg.fighters, msg.simple);

    this.app.setScreen(el('div', { class: 'menu' }, [el('h2', { text: `Joining room ${code}…` }), button('Cancel', () => this.leave(), true)]));
  }

  private makePeer(initiator: boolean): void {
    if (!this.room || !this.transport) return;
    this.peer = new PeerLink(this.room, initiator, this.iceServers);
    this.peer.onChange = () => this.refreshLobby?.();
    this.transport.setPeer(this.peer);
  }

  private showLobby(): void {
    const room = this.room;
    if (!room) return;
    this.app.endFight();
    this.inMatch = false;
    const url = this.inviteUrl(room.code);
    const link = el('input', { class: 'field link', value: url, readonly: 'true' });
    const copied = el('span', { class: 'muted', text: '' });
    const copy = async () => {
      try { await navigator.clipboard.writeText(url); copied.textContent = 'Copied!'; }
      catch { link.focus(); link.select(); copied.textContent = 'Press Ctrl+C / hold to copy'; }
    };
    const share = async () => {
      try { await navigator.share({ title: 'Battle Station', text: `${room.me?.name ?? 'Someone'} challenges you to a fight!`, url }); }
      catch { void copy(); }
    };
    const seats = el('div', { class: 'seats' });
    const status = el('div', { class: 'muted lobby-status' });
    const grid = el('div', { class: 'grid lobby-grid' });
    const ready = button('Ready', () => {
      const me = room.me;
      if (!me || me.fighter < 0) return;
      sfx.ui();
      room.send({ t: 'ready', ready: !me.ready });
    });
    pack.fighters.forEach((_f, i) => grid.append(fighterCard(i, () => { sfx.ui(); room.send({ t: 'pick', fighter: i }); }, true)));

    const seat = (label: string, p: { name: string; fighter: number; ready: boolean } | undefined) => {
      const look = p && p.fighter >= 0 ? pack.fighters[p.fighter]?.presentation : undefined;
      return el('div', { class: `seat${p?.ready ? ' ready' : ''}` }, [
        look ? portrait(look, 64) : el('div', { class: 'seat-empty', text: p ? '?' : '…' }),
        el('div', {}, [
          el('div', { class: 'muted', text: label }),
          el('div', { class: 'fname', text: p ? p.name : 'Waiting for opponent' }),
          el('div', { class: 'fsub', text: p ? (look ? look.name : 'Choosing a fighter…') + (p.ready ? ' · READY' : '') : 'Share the link below' }),
        ]),
      ]);
    };
    this.refreshLobby = () => {
      const me = room.me;
      const opp = room.opponent;
      seats.replaceChildren(seat('You', me), seat('Opponent', opp));
      grid.querySelectorAll('.fcard').forEach((c, n) => c.classList.toggle('taken', n === me?.fighter));
      ready.disabled = !me || me.fighter < 0;
      ready.textContent = me?.ready ? 'Ready ✓ (tap to cancel)' : 'Ready';
      ready.classList.toggle('alt', me?.ready === true);
      status.textContent = !opp ? 'Waiting for your opponent to open the link.'
        : this.relayOnly || !this.peer ? 'Connection: relayed through the room.'
        : this.peer.open ? 'Connection: direct.' : 'Connection: setting up a direct link… (relayed until then)';
    };
    this.lobbyEl = el('div', { class: 'select lobby' }, [
      el('div', { class: 'row select-head' }, [
        button('Leave', () => this.leave(), true),
        el('h2', { class: 'select-title', text: 'Room' }),
        el('div', { class: 'roomcode', text: room.code }),
      ]),
      el('div', { class: 'row invite' }, [link, button('Copy link', () => void copy(), true), ...(typeof navigator.share === 'function' ? [button('Share', () => void share(), true)] : []), copied]),
      seats, status, grid,
      el('div', { class: 'row', style: 'justify-content:center' }, [ready]),
    ]);
    this.app.setScreen(this.lobbyEl);
    this.refreshLobby();
  }

  private startMatch(seed: number, fighters: [number, number], simple: [boolean, boolean]): void {
    const room = this.room;
    const transport = this.transport;
    if (!room || !transport) return;
    this.refreshLobby = null;
    this.app.endFight();
    this.app.setScreen(null);
    this.app.soloControls();
    this.inMatch = true;

    const initial = createMatch({ fighters, seed, simple }, pack.sim);
    const session = new RollbackSession({ pack: pack.sim, initial, local: room.slot, transport });
    const driver = new NetDriver(session, this.app.readLocal, transport);
    const names: [string, string] = ['', ''];
    for (const p of room.players) names[p.slot] = p.slot === room.slot ? `${p.name} (you)` : p.name;

    let endShown = false;
    let endWait = 0;
    const view: FightView = {
      driver,
      stageId: pack.stages[0]!.id,
      showBoxes: false,
      labels: names,
      onTick: (s) => {
        this.app.touch.setSuperReady(s.players[room.slot]!.ki >= pack.sim.rules.kiMax);
        if (endShown || !this.inMatch) return;
        if (session.desync) {
          endShown = true;
          this.afterMatch('Out of sync', 'The two devices disagreed about the fight, so it was stopped. This is a bug worth reporting.', null);
        } else if (session.finished && session.state.phase === Phase.MATCH_END && ++endWait > 110) {
          endShown = true;
          const w = session.confirmed.winner;
          const who = w === 2 ? null : pack.fighters[session.confirmed.players[w]!.fighter]!.presentation;
          this.afterMatch(w === 2 ? 'Draw' : w === room.slot ? 'You win!' : 'You lose', who ? `“${who.quotes.win}”` : 'Evenly matched.', who);
        }
      },
    };
    this.app.show(view);
    (window as unknown as Record<string, unknown>).__NET__ = { session, transport, room };
  }

  /** The sheet after a match: rematch needs both players to ask. */
  private afterMatch(title: string, text: string, who: (typeof pack.fighters)[number]['presentation'] | null): void {
    const room = this.room;
    if (!room) return;
    const rematch = button('Rematch', () => {
      room.send({ t: 'ready', ready: true });
      rematch.disabled = true;
      rematch.textContent = 'Waiting for opponent…';
    });
    const s = sheet(this.app.ui, [
      el('div', { class: 'result' }, [
        who ? portrait(who, 110) : el('span'),
        el('div', {}, [el('h2', { text: title }), ...(who ? [el('div', { class: 'fname', text: who.name })] : []), el('p', { class: 'quote', text })]),
      ]),
      el('div', { class: 'row' }, [
        rematch,
        button('Back to lobby', () => { room.send({ t: 'ready', ready: false }); this.showLobby(); }, true),
        button('Leave room', () => this.leave(), true),
      ]),
    ]);
    this.app.overlay = s;
  }

  private opponentLeft(): void {
    this.inMatch = false;
    this.app.endFight();
    this.showLobby();
    const s = sheet(this.app.ui, [el('h2', { text: 'Opponent left' }), el('p', { text: 'Your opponent left the room. You can wait here for them or share the link with someone else.' }), button('OK', () => s.close())], () => s.close());
  }
}
