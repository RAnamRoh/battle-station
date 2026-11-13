# AGENTS.md: working rules for AI agents

Browser 2D online 1v1 fighting game. The fighters are real coworkers, who have given consent. Gameplay is anime-arena-fighter style; the look is early-90s arcade comic. All characters, names and assets are original.
The product owner is new to game development; you implement. Explain things in plain language.

## Process (read `docs/process/how-we-work.md`)
We use the AI-DLC method running through OpenSpec (ADR-0002).
- **Intent → change.** Every feature or behaviour change starts as `openspec/changes/<id>/` (proposal, delta specs, design, tasks). Use `/openspec-explore`, then `/openspec-propose`.
- **Gate 1:** the product owner approves the proposal. Write no implementation code before that.
- **Bolts:** 2–6 tasks. Each ends with typecheck and tests passing, plus one Conventional Commit. Then stop for **Gate 2** review or play-test.
- **Gate 3:** the product owner approves the merge to `main` and `/openspec-archive-change`, which merges the deltas into `openspec/specs/`.
- Trivial fixes (typos, links, formatting) may skip the change folder.
- If code and a spec disagree, **stop and ask** which is right. Never silently edit a spec.
- In-flight change: edit its artifacts. Shipped behaviour: open a new change with MODIFIED or REMOVED requirements.

## Where things live
- `openspec/specs/`: **current behaviour** (source of truth). `openspec/changes/`: work in flight and archive.
- `docs/decisions/`: ADRs (MADR). Never edit an accepted ADR; supersede it with a new one (copy `template.md`).
- `docs/process/`, `docs/game-design/`, `docs/architecture/`: living docs. `docs/research/`: dated research snapshots.
- `apps/`: deployable shells. `packages/`: shared libs (TS source, no per-package build).
- `content/`: fighters, moves, stages and rulesets as YAML data. **Tuning numbers go here, never in specs or sim code.**
- `art/style/`: versioned art-style bibles. `art/generated/`: AI output with `*.gen.json` provenance.
- `marketing/`: brand, briefs, scripts, storyboards, replays, compositions (HyperFrames), social.
- Each top-level folder has a README. Read it before adding files there.

## Stack (see ADRs 0003–0012)
- pnpm 10 workspaces with a catalog (versions in `pnpm-workspace.yaml`), Turborepo, TypeScript 6 strict.
- `packages/sim`: deterministic fight sim. Phaser 4 is renderer only. Cloudflare Workers, Durable Objects, D1, R2 and TURN.
- Vitest for unit tests, Playwright for e2e. Zod for content schemas. DTCG tokens with Style Dictionary. HyperFrames for video.
- **The MVP budget is $0.** Never add a paid service or dependency without asking.

## Commands
- `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm dev`
- `pnpm spec list`, `pnpm spec validate --all`, `pnpm spec show <change>`
- Set `OPENSPEC_TELEMETRY=0` when running openspec.

## Hard rules
1. **Determinism:** `packages/sim/**` follows `.claude/rules/sim-determinism.md`, with no exceptions.
2. **Personal data:** never commit photos of real people, consent records, payment data or secrets (ADR-0012). Never force-add ignored files.
3. **Original IP only:** no franchise, studio, game or celebrity names in prompts, assets, content or marketing.
4. **Likeness:** generating or changing a real person's likeness needs their recorded consent and the product owner's approval.
5. **Ask first:** changes to the determinism contract, netcode model, data schema, auth, payments, tenancy, infrastructure or secrets, art direction, agent rules, hooks or permissions.
6. **Git:** work on a branch named `change/<openspec-change-id>`. Use Conventional Commits with the scope set to the capability, e.g. `feat(combat-sim): ...`. Never push to `main` without Gate 3 approval. The repo is **public**.
7. **Dependencies:** pin them via the catalog. Read a third-party skill's files before installing it.

## Definition of done (per bolt)
- `pnpm typecheck` and `pnpm test` pass. Sim changes have golden replay tests.
- Tasks are checked off in `tasks.md`. The commit is made. A plain-language summary is ready for the product owner.
