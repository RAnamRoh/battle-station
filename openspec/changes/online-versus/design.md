# Design

## Context

The sim is deterministic and pure (`step` never changes its input), which is what makes rollback cheap to build. The shell already runs fights through a `FightDriver`.

## Goals / Non-Goals

**Goals:** a link-to-fight flow in seconds; responsive play at typical latencies; no silent desyncs; works behind strict firewalls via relay.

**Non-Goals:** spectators, replays, result verification, ranking, TURN, deployment automation.

## Decisions

See ADR-0013.

- **Rollback with a confirmed state.** Each device keeps two states: `confirmed` (advanced only with both players' real inputs) and `predicted` (what is drawn). When real inputs differ from the prediction, `predicted` is rebuilt from `confirmed`. This needs no snapshot ring, and the confirmed state gives exact checksums.
- **Input delay** of 2 frames; prediction limit of 8 frames; the device that runs ahead skips a frame now and then (time sync).
- **Messages.** Each input message carries the last 20 frames of inputs, the sender's frame, the frame it has received up to, and timing values for ping. Losing a message costs nothing. Checksums go every 60 confirmed frames.
- **Events.** Effects and sound come from predicted frames. Each event has a key (frame, type, player, values); an event already shown is not shown again after a rollback.
- **Transport interface.** `send(bytes)` / `onMessage`. `HybridTransport` sends on the WebRTC data channel (unordered, no retransmit) when open, otherwise on the room WebSocket. Duplicates and reordering are harmless by design.
- **Rooms.** One Durable Object per room code, using WebSocket hibernation; player details live in socket attachments, so the object holds no other state. The room logic is a plain class (`RoomCore`) with unit tests; the Durable Object is a thin wrapper.
- **Start.** When both are ready the room sends `start` with a random seed, both fighters and each player's control preset.
- **Version check.** `hello` carries the content pack's gameplay hash; the room rejects a mismatch.
- **Serving.** In production the Worker serves `apps/web/dist` as static assets and handles `/api/*`. In development Vite proxies `/api` to Wrangler.
- **ICE servers.** `/api/ice` returns a public STUN server, plus Cloudflare TURN credentials when the account secrets are configured.

## Risks / Trade-offs

- Relay goes over TCP, so a lost packet delays the ones behind it → more visible corrections on bad networks. TURN or a direct path avoids this.
- A background tab stops the game loop → the other player stalls. For now this shows "waiting"; forfeits are a later change.
- No server verification yet → results must not feed a leaderboard until that exists.
- The Durable Object wrapper is checked in a real local run with two browsers, not in unit tests.
