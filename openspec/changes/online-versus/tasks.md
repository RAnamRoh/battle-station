# Tasks

## 1. Bolt 1: Netcode

- [x] 1.1 `packages/netcode`: transport interface, message encoding, rollback session, time sync, checksums
- [x] 1.2 Tests: two sessions over a lossy, delayed, reordering link agree with each other and with a plain run; stall and resume; desync is reported
- [x] 1.3 Write ADR-0013 (status: proposed)

## 2. Bolt 2: Room server

- [x] 2.1 `apps/match`: room logic (`RoomCore`) with tests
- [x] 2.2 Worker, Durable Object, room-code creation, `/api/ice`, static assets config

## 3. Bolt 3: Online in the client

- [x] 3.1 Room connection, hybrid transport (WebRTC with relay fallback), net driver
- [x] 3.2 Play Online: create/join, invite link, lobby, ready-up, start
- [x] 3.3 Online result with rematch; opponent-left and out-of-sync notices

## 4. Bolt 4: Verify

- [x] 4.1 Two browser pages play a full online match locally, with and without the direct connection
- [ ] 4.2 README: how to run locally, how to play on the same Wi-Fi, how to deploy
