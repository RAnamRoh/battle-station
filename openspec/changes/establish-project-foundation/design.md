# Design

## Context

The folder is empty apart from the research notes in `docs/`. The product owner is new to game development, and Claude Code does the implementation. The research behind every decision is in `docs/research/`.

## Goals / Non-Goals

**Goals:**
- Give every kind of artefact an obvious home, so that later changes stay small.
- Make change cheap: data over code, ADRs that supersede rather than overwrite, and living specs.
- Keep the agent's context lean: a short `AGENTS.md`, plus rules scoped by path.

**Non-Goals:**
- No game code, build config for apps, CI, or deploy in this change.
- No empty code packages "for later". Packages are created by the change that needs them.

## Decisions

All decisions are recorded as ADRs in `docs/decisions/`:

| ADR | Decision |
|---|---|
| 0001 | Record decisions with MADR, superseding rather than editing |
| 0002 | AI-DLC method on OpenSpec rails (not the AWS AI-DLC engine, Spec Kit or BMAD) |
| 0003 | pnpm workspaces + catalog + Turborepo; internal packages ship TS source |
| 0004 | Deterministic, engine-free fight simulation in TypeScript (integer math) |
| 0005 | Phaser 4 as the renderer and input host, behind a render package |
| 0006 | Cloudflare (Workers, Durable Objects, D1, R2, TURN) on free tiers; $0 MVP |
| 0007 | Data-driven content: YAML → schema-validated JSON packs; gameplay/presentation hash split |
| 0008 | Design tokens in the W3C DTCG format, built with Style Dictionary; per-tenant themes |
| 0009 | Versioned art-style bible as data; cel-shaded comic style with mild caricature |
| 0010 | PWA first; Capacitor as the future mobile wrapper |
| 0011 | HyperFrames for marketing video; replays as footage source |
| 0012 | Storage tiers: git / Git LFS / R2; personal data never in git |

Research documents move from `docs/` to `docs/research/` so that `docs/` holds living documentation.

## Risks / Trade-offs

- **Process overhead on a solo project.** Mitigation: trivial fixes skip the change folder, and bolts are small.
- **A public repo exposes everything.** Mitigation: personal data is excluded by `.gitignore` and by this spec. Research notes contain no private data (checked).
- **OpenSpec 2.0 is new.** Mitigation: the version is pinned in `package.json`. Specs are plain markdown, so the tool can be dropped without losing anything.
- **Plugins and skills are a supply-chain risk.** Mitigation: only official-marketplace plugins now, everything else is reviewed before installing, and versions are pinned.
