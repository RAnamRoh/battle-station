---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0001: Record decisions with MADR

## Context and Problem Statement

Requirements, tech and art direction will change over time. We need to remember *why* each choice was made, and change our minds without losing that history.

## Considered Options

- MADR files in `docs/decisions/`
- Decisions only inside specs or chat history
- Wiki or external tool

## Decision Outcome

Chosen: **MADR 4 files in git**. Accepted ADRs are never edited; they are superseded by a new ADR.

### Consequences

- Good: full history of reasons, readable by humans and the agent, free.
- Bad: needs discipline to write one for each significant choice (the agent drafts them).

## More Information

https://adr.github.io/madr/ · `docs/research/aidlc-research.md`
