# packages/

Shared libraries. Each one exports TypeScript source directly; there is no per-package build step (ADR-0003).

| Package | Purpose | Status |
|---|---|---|
| `sim/` | Deterministic fight simulation: `step(state, inputs) -> state`. Integer math, seeded RNG, **no engine/DOM/network/clock imports** (ADR-0004) | built |
| `input/` | Keyboard and touch mapped to a per-frame input bitmask. Gamepad comes later. | built |
| `render-phaser/` | Phaser scenes that *draw* sim state (ADR-0005). For now this lives in `apps/web/src/render`. | planned |
| `netcode/` | Rollback session, time sync, checksums; takes any transport (ADR-0013) | built |
| `bots/` | The CPU opponent: three levels, produces inputs only | built |
| `content-schema/` | Zod schemas and the build step that turns `content/core` YAML into a pack with a gameplay hash (ADR-0007) | built |
| `content-runtime/` | Pack loading, layering and hash verification | planned |
| `tokens/` | Design tokens (DTCG) built into CSS variables and a TS constant for Phaser (ADR-0008) | planned |
| `protocol/`, `ui/`, `theme-runtime/`, `platform/`, `db/`, `config/`, `sim-testkit/` | See `docs/research/structure-research.md` | planned |
