# Proposal: Online versus

## Intent

> "I want the game to be played online so that me and my friends can play it… let's focus on building the
> multiplayer first because it will be the core of our game." (product owner, 2026-11-14)

**Gates:** Gates 1 and 2 are delegated for this run (product owner, 2026-11-24). Gate 3 stays with the product owner.
This change is stacked on `versus-modes-and-roster`.

**Needs explicit sign-off at Gate 3:** this change sets the netcode model and adds backend infrastructure,
both of which are "ask first" items. They follow the architecture the product owner approved in the research
report, and are recorded as ADR-0013 with status `proposed`.

## Why

Online 1v1 with coworkers is the core of the product. It must start from a link, feel responsive on office
Wi-Fi and mobile data, and never let two players see different fights.

## What Changes

- New `packages/netcode`: rollback netcode on top of the deterministic sim, with input delay, prediction,
  time sync, and checksums that detect a desync.
- New `apps/match`: a Cloudflare Worker with one Durable Object per room. It creates rooms with short codes,
  runs the lobby, passes connection-setup messages between the two players, and relays inputs when a
  direct connection is not possible. In production the same Worker serves the game's files.
- `apps/web`: Play Online in the menu, create or join a room, invite link with copy and share, a lobby with
  fighter pick and ready-up, connection status, online result screen with rematch.
- Transport: a direct browser-to-browser connection (WebRTC data channel) when the network allows it,
  falling back to relay through the room without the players doing anything.

Out of scope: spectating, replays and clips, accounts, leaderboards, server-side result verification,
TURN relay credentials (needs the product owner's Cloudflare account), and public deployment.

## Capabilities

### New Capabilities
- `online-play`: how two devices play one fight together and stay in agreement.
- `match-rooms`: rooms, invite links, the lobby and connection setup.

### Modified Capabilities
- None.

## ADRs needed

Yes: ADR-0013 (online play model: rollback with a confirmed state, hybrid transport, rooms as Durable Objects).

## Open questions

- (product) Deploying needs a free Cloudflare account and one login command from the product owner.
- (tech) A TURN relay improves direct connections on strict networks. It needs account credentials; until then the room relay covers those cases.
- (product) What should happen when a player leaves mid-match? For now the match ends without a result.

## Impact

- New dependencies: `wrangler` and `@cloudflare/workers-types` (dev only, free).
- Local development now runs two processes: the game (Vite) and the room server (Wrangler).
