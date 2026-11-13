---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0007: Data-driven content packs

## Context and Problem Statement

Fighters, moves, frame data, stages, rulesets and tenant branding will change constantly. Other companies will add their own. Replays must keep working when art changes.

## Considered Options

- Hard-code content in TypeScript
- JSON authored by hand
- YAML in the repo, compiled to schema-validated JSON packs

## Decision Outcome

Chosen: **YAML in `content/`, validated with Zod schemas and compiled to JSON packs**. Each pack is split into a gameplay layer (frame data, hitboxes) and a presentation layer (art, names, colours). Replays pin the hash of the gameplay layer. Tenants may override presentation and add fighters; changing gameplay needs a separate ruleset and leaderboard.

### Consequences

- Good: tuning means editing data, the admin panel can use the same schemas, and reskins never break replays.
- Bad: a content build step and schema migrations to maintain.

## More Information

`docs/research/structure-research.md` §3 · https://zod.dev/json-schema · RFC 8785
