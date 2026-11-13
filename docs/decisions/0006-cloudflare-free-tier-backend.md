---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0006: Cloudflare free tier backend; $0 MVP

## Context and Problem Statement

The MVP budget is $0. We need static hosting, a stateful room per match (signalling, relay, verification), a database, file storage and a TURN relay for office and mobile networks.

## Considered Options

- Cloudflare (Workers, Durable Objects, D1, R2, TURN)
- Supabase
- Colyseus or Nakama on a VPS
- Vercel or Netlify

## Decision Outcome

Chosen: **Cloudflare on free plans**. Use a `*.workers.dev` address until a domain is wanted. Durable Objects use the SQLite backend, which is available on the free plan.

### Consequences

- Good: one account, free static bandwidth, a room process per match, and a free TURN relay.
- Bad: vendor lock-in for rooms. Mitigation: `netcode` takes a transport interface, and the room logic is plain TS.

## More Information

`docs/research/research-report.md` · https://developers.cloudflare.com/durable-objects/platform/pricing/
