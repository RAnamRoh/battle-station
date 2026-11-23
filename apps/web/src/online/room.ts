import type { ClientMsg, PlayerInfo, ServerMsg } from '@bs/match/protocol';
import type { Transport } from '@bs/netcode';

/** The connection to a match room: lobby messages as JSON, relayed game inputs as binary. */
export class RoomConnection {
  slot = -1;
  players: PlayerInfo[] = [];
  onJoined: (() => void) | null = null;
  onRoom: (() => void) | null = null;
  onStart: ((msg: Extract<ServerMsg, { t: 'start' }>) => void) | null = null;
  onSignal: ((data: unknown) => void) | null = null;
  onError: ((reason: string) => void) | null = null;
  onClosed: (() => void) | null = null;
  onBinary: ((data: Uint8Array) => void) | null = null;
  private ws: WebSocket;
  private closedByUs = false;
  private refused = false;

  constructor(readonly code: string, hello: Extract<ClientMsg, { t: 'hello' }>) {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${scheme}://${location.host}/api/rooms/${code}/ws`);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.send(hello);
    this.ws.onmessage = (e) => {
      if (typeof e.data !== 'string') { this.onBinary?.(new Uint8Array(e.data as ArrayBuffer)); return; }
      let msg: ServerMsg;
      try { msg = JSON.parse(e.data) as ServerMsg; } catch { return; }
      switch (msg.t) {
        case 'joined': this.slot = msg.slot; this.onJoined?.(); break;
        case 'room': this.players = msg.players; this.onRoom?.(); break;
        case 'start': this.onStart?.(msg); break;
        case 'signal': this.onSignal?.(msg.data); break;
        case 'error': this.refused = true; this.onError?.(msg.reason); break;
      }
    };
    this.ws.onclose = () => { if (!this.closedByUs && !this.refused) this.onClosed?.(); };
  }

  get opponent(): PlayerInfo | undefined { return this.players.find((p) => p.slot !== this.slot); }
  get me(): PlayerInfo | undefined { return this.players.find((p) => p.slot === this.slot); }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
  sendBinary(data: Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data as Uint8Array<ArrayBuffer>);
  }
  close(): void {
    this.closedByUs = true;
    this.ws.close();
  }
}

type Signal = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

/** A direct browser-to-browser link for inputs. Set up through the room; optional. */
export class PeerLink {
  open = false;
  onData: ((data: Uint8Array) => void) | null = null;
  onChange: (() => void) | null = null;
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];

  constructor(private readonly room: RoomConnection, initiator: boolean, iceServers: RTCIceServer[]) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.onicecandidate = (e) => { if (e.candidate) room.send({ t: 'signal', data: { ice: e.candidate.toJSON() } satisfies Signal }); };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed' || this.pc.connectionState === 'disconnected') this.setOpen(false);
    };
    if (initiator) {
      // Unordered and never re-sent: a late input is useless, and the netcode repeats inputs anyway.
      this.attach(this.pc.createDataChannel('inputs', { ordered: false, maxRetransmits: 0 }));
      void this.pc.createOffer().then(async (offer) => {
        await this.pc.setLocalDescription(offer);
        room.send({ t: 'signal', data: { sdp: offer } satisfies Signal });
      }).catch(() => this.setOpen(false));
    } else {
      this.pc.ondatachannel = (e) => this.attach(e.channel);
    }
  }

  private setOpen(v: boolean): void {
    if (this.open !== v) { this.open = v; this.onChange?.(); }
  }

  private attach(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => this.setOpen(true);
    dc.onclose = () => this.setOpen(false);
    dc.onmessage = (e) => { if (e.data instanceof ArrayBuffer) this.onData?.(new Uint8Array(e.data)); };
  }

  async signal(data: unknown): Promise<void> {
    const s = data as Signal;
    try {
      if (s.sdp) {
        await this.pc.setRemoteDescription(s.sdp);
        for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c);
        if (s.sdp.type === 'offer') {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.room.send({ t: 'signal', data: { sdp: answer } satisfies Signal });
        }
      } else if (s.ice) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(s.ice);
        else this.pendingIce.push(s.ice);
      }
    } catch { /* a failed direct link is fine: inputs keep flowing through the room */ }
  }

  send(data: Uint8Array): boolean {
    if (!this.open || !this.dc) return false;
    try { this.dc.send(data as Uint8Array<ArrayBuffer>); return true; } catch { return false; }
  }

  close(): void {
    this.setOpen(false);
    try { this.dc?.close(); this.pc.close(); } catch { /* already closed */ }
  }
}

/** Sends inputs directly when it can and through the room when it cannot. The netcode does not care which. */
export class HybridTransport implements Transport {
  onMessage: ((data: Uint8Array) => void) | null = null;
  peer: PeerLink | null = null;
  /** For testing the relay path: never use the direct link. */
  relayOnly = false;

  constructor(private readonly room: RoomConnection) {
    room.onBinary = (d) => this.onMessage?.(d);
  }

  setPeer(peer: PeerLink | null): void {
    this.peer = peer;
    if (peer) peer.onData = (d) => this.onMessage?.(d);
  }

  get direct(): boolean { return !this.relayOnly && this.peer?.open === true; }

  /** For trying out a bad connection: delays every message by this many milliseconds (`?lag=120`). */
  lagMs = 0;

  send(data: Uint8Array): void {
    if (this.lagMs > 0) {
      const copy = data.slice();
      setTimeout(() => this.sendNow(copy), this.lagMs * (0.7 + Math.random() * 0.6));
    } else this.sendNow(data);
  }

  private sendNow(data: Uint8Array): void {
    if (!this.relayOnly && this.peer?.send(data)) return;
    this.room.sendBinary(data);
  }
}
