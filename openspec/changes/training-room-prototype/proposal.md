# Proposal: Training-room prototype

## Intent

> "Let's do placeholders first, see how it feels, then we will work with assets." (product owner, 2026-11-14)
> "Work until you get it to a working version, the first MVP… follow AI-DLC." (product owner, 2026-11-24)

The product owner wants to feel the fighting on a laptop and a phone before any art or online work.

**Gates:** on 2026-11-24 the product owner asked the agent to keep working until the MVP runs. Gates 1 and 2
are treated as delegated for this run. Gate 3 (merge to `main` and archive) stays with the product owner.

## Why

Every later feature (roster, CPU, online play, replays) runs on the fight simulation. If the fighting
does not feel good with a placeholder, nothing built on top will fix it.

## What Changes

- New `packages/sim`: the deterministic fight simulation (ADR-0004). It covers movement, jumps, dashes,
  light and heavy attacks with direction variants, cancels, a ki meter with charging, ki blasts, power
  attacks, supers, guarding, guard break, throws, knockdowns, hitstop, rounds and KO.
- New `packages/content-schema` and `content/core/`: fighters and moves as YAML data, validated and
  compiled into a pack with a gameplay hash (ADR-0007). One placeholder fighter.
- New `packages/input`: keyboard and touch mapped to one per-frame input bitmask.
- New `apps/web`: a Phaser 4 page (ADR-0005) with a training room. It has a code-drawn placeholder
  fighter, a dummy, HUD, hit sparks, screen shake, a super cut-in, synthesised sound, and touch controls.

Out of scope: more fighters, versus modes and menus (next change), online play (the change after), AI art.

## Capabilities

### New Capabilities
- `combat-sim`: the rules of a fight and the determinism contract.
- `player-input`: how keyboard and touch become fight inputs.
- `training-room`: the practice mode against a dummy.

### Modified Capabilities
- None.

## ADRs needed

No. This implements ADR-0004, ADR-0005 and ADR-0007.

## Open questions

- (product) Feel tuning values are first guesses from research. They live in `content/` and will change after play-tests.

## Impact

- New dependencies: `phaser`, `vite`, `vitest`, `zod`, `yaml`, `tsx` (all free, pinned in the catalog).
- No backend. Runs locally with `pnpm dev`.
