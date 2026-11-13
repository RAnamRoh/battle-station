---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0010: PWA first, Capacitor later

## Context and Problem Statement

Phone play is required now, and a store app may come later.

## Considered Options

- PWA only
- Capacitor wrapper
- Tauri 2 mobile

## Decision Outcome

Chosen: **ship as a PWA now; add an `apps/mobile` Capacitor wrapper only when needed**. All native calls go through a `platform` interface.

### Consequences

- Good: $0, no store review, and the mobile app later is a thin wrapper.
- Bad: on iPhone a PWA has no fullscreen API or orientation lock. App Store in-app purchase rules will constrain paid features.

## More Information

`docs/research/structure-research.md` §2 · https://capacitorjs.com/docs/guides/games
