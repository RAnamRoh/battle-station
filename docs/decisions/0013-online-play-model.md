---
status: proposed
date: 2026-11-24
decision-makers: product owner, Claude Code
---

# 0013: Online play: rollback with a confirmed state, hybrid transport, rooms as Durable Objects

## Context and Problem Statement

Online 1v1 is the core of the product. Players are on office Wi-Fi and mobile data in Bangladesh, often behind firewalls. Each player's own actions must feel immediate, both must see the same fight, and a match must start from a link with no setup. ADR-0004 gives us a deterministic, pure simulation; ADR-0006 gives us Cloudflare on free tiers.

## Considered Options

- Delay-based lockstep (wait for both inputs every frame)
- Server-authoritative simulation in the room, with clients as viewers
- Rollback (GGPO-style) with a ring of snapshots
- Rollback with a single confirmed state plus a predicted state
- Transport: WebSocket relay only; WebRTC only; WebRTC with relay fallback

## Decision Outcome

Chosen: **rollback with a confirmed state and a predicted state, over a hybrid transport, with one Durable Object per room.**

- Each device advances a `confirmed` fight with both players' real inputs and a `predicted` fight that runs ahead on a guess. A wrong guess rebuilds `predicted` from `confirmed`. Because `step` never changes its input, no snapshot ring is needed.
- Input delay is 2 frames and the prediction limit is 8 frames. The device that runs ahead skips a frame now and then.
- Every 60 confirmed frames the devices exchange a checksum. A mismatch stops the match and tells the players.
- Inputs travel on a WebRTC data channel (unordered, no retransmits) when a direct connection works, and through the room's WebSocket otherwise. Every message repeats the last 20 frames of inputs, so loss, duplication and reordering are harmless.
- A room is a Durable Object named by its code. It runs the lobby, passes connection-setup messages, relays inputs when needed, and checks that both players have the same gameplay hash.
- The room does not yet verify results. Results must not feed leaderboards until it does.

### Consequences

- Good: immediate local response; exact agreement, tested under loss and jitter; works behind strict firewalls through the relay; costs nothing to run at office scale.
- Good: the confirmed state and the input logs are exactly what replays, spectating and server verification need later.
- Bad: we own the netcode. The determinism rules and the netcode tests are mandatory.
- Bad: relayed play uses TCP, so one lost packet delays those behind it. A TURN relay (needs account credentials) or a direct path avoids this.
- Bad: effects for a mispredicted event may play and then be corrected; they are never repeated.

## More Information

`docs/research/research-report.md` §2 · ADR-0004 · ADR-0006 · `packages/netcode` · `apps/match` · https://github.com/pond3r/ggpo
