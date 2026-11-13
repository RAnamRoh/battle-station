# packages/

Shared libraries. Each one exports TypeScript source directly; there is no per-package build step (ADR-0003).

| Package | Purpose | Status |
|---|---|---|
| `sim/` | Deterministic fight simulation: `step(state, inputs) -> state`. Integer math, seeded RNG, **no engine/DOM/network/clock imports** (ADR-0004) | next change |
| `input/` | Keyboard, gamepad and touch mapped to a per-frame input bitmask | next change |
| `render-phaser/` | Phaser scenes that *draw* sim state. No game rules (ADR-0005) | planned |
| `netcode/` | Rollback, input delay, transport adapters | planned |
| `content-schema/` | Zod schemas for fighters, moves, stages, rulesets, tenants and styles; also emits JSON Schema (ADR-0007) | planned |
| `content-runtime/` | Pack loading, layering and hash verification | planned |
| `tokens/` | Design tokens (DTCG) built into CSS variables and a TS constant for Phaser (ADR-0008) | planned |
| `protocol/`, `bots/`, `ui/`, `theme-runtime/`, `platform/`, `db/`, `config/`, `sim-testkit/` | See `docs/research/structure-research.md` | planned |
