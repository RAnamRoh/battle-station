# Proposal: Establish project foundation

## Intent

> "From the beginning we need a solid base we can build on, even if we plan a mobile version later.
> All the specs, decisions and the design system should be structured from the start, plus a dedicated
> folder for marketing video production. Nothing is set in stone: requirements, design system and art
> style can all change over time, so it has to adapt to change."
> (product owner, 2026-11-14)

## Why

There is no code yet. Every later change (fighting, online play, art, leaderboards, mobile, white-label)
depends on where things live, how decisions are recorded, and how a requirement change flows through
the project. Settling this first is cheap; changing it after the code exists is expensive.

## What Changes

- Adopt the **AI-DLC method running through OpenSpec**: intents become changes, bolts, and 3 human gates.
  Living specs live in `openspec/specs/`, and decisions are recorded as MADR ADRs in `docs/decisions/`.
- Create the **monorepo skeleton**: pnpm workspaces with a version catalog and Turborepo.
  Top-level areas: `apps/`, `packages/`, `content/`, `art/`, `audio/`, `marketing/`, `docs/`, `tools/`, `e2e/`.
  Each area gets a README stating its purpose. Code packages are created only when a change needs them.
- Write **ADRs 0001-0012** for the decisions already made in research. They cover:
  - how decisions are recorded and how changes flow;
  - the monorepo and repository layout;
  - the deterministic sim and Phaser 4;
  - Cloudflare and the $0 budget;
  - data-driven content;
  - design tokens and the art-style bible;
  - the PWA-first mobile path;
  - HyperFrames for video;
  - storage tiers for large files and personal data.
- Write **agent guidance**: `AGENTS.md`, plus `CLAUDE.md` pointing to it, and path-scoped `.claude/rules/`
  (sim determinism, content, marketing).
- Write **a human guide**, `docs/process/how-we-work.md`, for the product owner.
- Add the agreed **Claude Code plugins and skills**.
- Publish as a **public GitHub repository**.

Out of scope: any game code, the Phaser setup, the netcode, and art. Those come in later changes,
starting with the training-room prototype.

## Capabilities

### New Capabilities
- `development-process`: how intents become changes, the human gates, how decisions are recorded and superseded, and how requirement changes flow.
- `repository-layout`: where each kind of artefact lives, the rule that changing things are data, and the rule that personal data never enters git.

### Modified Capabilities
- None.

## ADRs needed

Yes: ADRs 0001-0012, all created by this change.

## Open questions

- (product) The game's public name. The repo is named `battle-station` for now and can be renamed cheaply.
- (product) The chat integration (Microsoft Teams or Google Chat). This is deferred.

## Impact

- New files only. There is no existing code.
- Adds root dev dependencies: `turbo`, `typescript`, `@fission-ai/openspec`.
- Creates a public GitHub repo, so everything committed becomes public.
