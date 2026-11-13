---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0003: pnpm workspaces + Turborepo monorepo

## Context and Problem Statement

The game client, servers, admin panel, a future mobile wrapper and many shared packages must share code and stay consistent.

## Considered Options

- npm workspaces
- pnpm workspaces + Turborepo
- Nx
- moon

## Decision Outcome

Chosen: **pnpm workspaces with a version catalog, plus Turborepo**. Internal packages export TS source, with no build step per package. This is the same pattern Cloudflare's repositories and tldraw use.

### Consequences

- Good: one version of each dependency, cached tasks, $0, and it can move to Nx later because the workspaces are plain pnpm.
- Bad: Turborepo cannot cache source-only packages (acceptable at this size).

## More Information

`docs/research/structure-research.md` · https://pnpm.io/catalogs · https://turborepo.dev/docs/core-concepts/internal-packages
