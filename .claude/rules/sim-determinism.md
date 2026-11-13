---
paths:
  - "packages/sim/**"
  - "packages/netcode/**"
  - "content/**/rulesets/**"
---
# Simulation determinism rules (ADR-0004)

Both players' machines, the server verifier and every replay must compute **bit-identical** state from the same inputs.

**Must:**
- `step(state, inputs) -> state` at a fixed 60 Hz. State is a plain serialisable object: no classes holding hidden state, no Maps iterated for logic.
- Integer math only. Positions are subpixels (1 px = 256). Divide with an integer helper (`idiv`), never `/`.
- Randomness only from the seeded PRNG (sfc32), whose state lives inside the sim state.
- Hitstop, super freeze and KO slow-motion are integer frame counters in state.
- Emit events (hit, block, ko, ...) carrying `(frame, player, moveId, seq)`. Sound and effects are handled **outside** the sim.
- Every behaviour change adds or updates a golden replay test (input log + seed → expected state hash).

**Never in sim code:**
- `Math.random`, `Date`, `performance`, timers
- `Math.sin/cos/tan/atan2/pow/exp/sqrt`, `**`, float literals
- `for...in`
- imports of Phaser, DOM, network or Node APIs
- reading content at runtime without its gameplay hash
