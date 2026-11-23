import { DurableObject } from 'cloudflare:workers';
import { CODE_ALPHABET, ROOM_CODE, type ClientMsg, type ServerMsg } from './protocol';
import { handleLeave, handleMessage, newSeat, relayTarget, type Outgoing, type Seat } from './room-core';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS?: Fetcher;
  /** Optional Cloudflare TURN credentials. Without them only a public STUN server is offered. */
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/rooms' && request.method === 'POST') {
      const bytes = crypto.getRandomValues(new Uint8Array(5));
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      return json({ code });
    }

    const ws = /^\/api\/rooms\/([A-Za-z0-9]+)\/ws$/.exec(path);
    if (ws) {
      const code = ws[1]!.toUpperCase();
      if (!ROOM_CODE.test(code)) return json({ error: 'bad room code' }, 400);
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'expected a WebSocket' }, 426);
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      return room.fetch(request);
    }

    if (path === '/api/ice') return json({ iceServers: await iceServers(env) });
    if (path.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function iceServers(env: Env): Promise<unknown[]> {
  const stun = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return stun;
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }),
    });
    if (!res.ok) return stun;
    const body = (await res.json()) as { iceServers?: unknown[] };
    return Array.isArray(body.iceServers) && body.iceServers.length ? body.iceServers : stun;
  } catch {
    return stun;
  }
}

const MAX_TEXT = 8192;
const MAX_BINARY = 512;

/**
 * One match room. It keeps no storage: everything it knows about a player lives with that player's
 * connection, so the room can sleep between messages (WebSocket hibernation) at no cost.
 */
export class Room extends DurableObject<Env> {
  private seats(): { seats: Seat[]; sockets: Map<string, WebSocket> } {
    const seats: Seat[] = [];
    const sockets = new Map<string, WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      const seat = ws.deserializeAttachment() as Seat | null;
      if (!seat) continue;
      seats.push(seat);
      sockets.set(seat.id, ws);
    }
    return { seats, sockets };
  }

  private deliver(seats: Seat[], sockets: Map<string, WebSocket>, out: Outgoing[]): void {
    for (const seat of seats) sockets.get(seat.id)?.serializeAttachment(seat);
    for (const o of out) {
      try { sockets.get(o.to)?.send(JSON.stringify(o.msg satisfies ServerMsg)); } catch { /* that player has gone; their close event follows */ }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(newSeat(crypto.randomUUID()));
    void request;
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const me = ws.deserializeAttachment() as Seat | null;
    if (!me) return;
    const { seats, sockets } = this.seats();
    if (typeof message !== 'string') {
      // Game inputs: passed straight to the other player. Used when a direct connection is not possible.
      if (message.byteLength > MAX_BINARY) return;
      const to = relayTarget(seats, me.id);
      if (to) { try { sockets.get(to)?.send(message); } catch { /* gone */ } }
      return;
    }
    if (message.length > MAX_TEXT) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(message) as ClientMsg; } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    const code = this.ctx.id.name ?? '';
    const out = handleMessage(seats, me.id, msg, code, () => crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff);
    this.deliver(seats, sockets, out);
    for (const o of out) if (o.msg.t === 'error') sockets.get(o.to)?.close(4000, o.msg.reason);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> { this.left(ws); }
  override async webSocketError(ws: WebSocket): Promise<void> { this.left(ws); }

  private left(ws: WebSocket): void {
    const me = ws.deserializeAttachment() as Seat | null;
    if (!me) return;
    const { seats, sockets } = this.seats();
    if (!seats.some((s) => s.id === me.id)) seats.push(me);
    const out = handleLeave(seats, me.id);
    sockets.delete(me.id);
    this.deliver(seats, sockets, out);
    try { ws.close(); } catch { /* already closed */ }
  }
}
