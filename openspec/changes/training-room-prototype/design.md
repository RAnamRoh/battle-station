# Design

## Context

No game code exists. ADR-0004 (deterministic sim), ADR-0005 (Phaser as renderer only) and ADR-0007 (content as data) set the shape.

## Goals / Non-Goals

**Goals:** a sim that already contains every MVP mechanic; a placeholder that reads clearly; the same build playable with keyboard and touch.

**Non-Goals:** balance, real art, menus, more than one fighter, online play.

## Decisions

- **Sim API:** `createMatch(config, pack)`, `step(state, in0, in1, pack) -> { state, events }`, `hashState(state)`, `cloneState(state)`.
  State holds only integers in plain objects, so copying and hashing are generic and cannot drift apart.
- **Units:** 1 px = 256 subpixels; the ground is y = 0 and up is positive. 60 frames per second.
- **Freezes are sim state:** hitstop, super freeze and KO slow-motion are counters inside the state.
- **Events:** the sim returns hit, block, KO, super and similar events. Sound and effects react to events and never feed back into the sim.
- **Input:** a 10-bit mask per player per frame. Left and right are absolute; the sim turns them into forward and back.
  The sim keeps a 6-frame button buffer and a 3-frame direction lookback.
- **Moves as data:** each move lists timed hits (frames, hit area, damage, stun, launch), ki cost, cancel class, optional
  self-movement and an optional projectile. Fighters share a slot layout (5L, 6L, 4L, 2L, 5H, 6H, 4H, 2H, jL, jH, 5K, 6K, 2K, 4K, super, throw).
- **Content build:** `content/core/**/*.yaml` → Zod validation → `content/_build/core.pack.json` with `gameplayHash` (FNV-1a over canonical JSON of gameplay fields). The build output is not committed.
- **Rendering:** Phaser 4 scene with a fixed 960×540 canvas scaled to fit. Fighters are drawn each frame from sim state with Graphics (pose tables per state). HUD in canvas; touch controls and training options in DOM over the canvas.
- **Loop:** fixed 60 Hz accumulator drives `step`; rendering reads the newest state.
- **Sound:** small Web Audio synth; no audio files yet.
- **Determinism guard:** a test scans `packages/sim/src` for banned APIs and float literals; golden replay tests pin checksums.

## Risks / Trade-offs

- Phaser 4 is new to most tooling → keep Phaser use to Graphics, Text, Scale and Camera; verify in a real browser.
- Feel values are guesses → all in YAML for quick tuning.
- No ESLint yet → the banned-API scan covers the critical determinism rules; full linting is a later change.
