---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0004: Deterministic, engine-free fight simulation

## Context and Problem Statement

Online play (rollback), replays, spectating, highlight clips, CPU bots and server-side result verification all need two machines to compute *exactly* the same fight from the same inputs.

## Considered Options

- Use the engine's physics and timing
- A JS rollback library (all dormant or toys as of 2026-11)
- Our own pure TypeScript sim package

## Decision Outcome

Chosen: **our own pure TS package `packages/sim`**: `step(state, inputs) -> state` at 60 Hz. It uses integer math only (1 px = 256 subpixels) and a seeded PRNG stored in the state. It must not use `Math.random`, `Date`, floats, trig functions, or any engine, DOM or network imports. Hitstop, super freeze and KO slow-motion are integer counters inside the sim.

### Consequences

- Good: one function powers online play, replays, bots, verification and video, and we can swap the renderer.
- Bad: we own the rollback and determinism code, and one stray float causes silent desyncs. Lint, SyncTest and a cross-browser replay test are mandatory from the first commit.

## More Information

`docs/research/research-report.md` §2 · `.claude/rules/sim-determinism.md` · GGPO https://github.com/pond3r/ggpo
