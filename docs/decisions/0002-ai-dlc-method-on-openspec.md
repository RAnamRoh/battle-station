---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0002: AI-DLC method on OpenSpec rails

## Context and Problem Statement

The product owner wants to follow AIDLC (AI-Driven Development Lifecycle). Everything must stay changeable, so a single current description of the game's behaviour is required.

## Considered Options

- AWS AI-DLC engine (awslabs/aidlc-workflows)
- GitHub Spec Kit
- BMAD Method
- OpenSpec, with the AI-DLC method (intents, bolts, human gates)

## Decision Outcome

Chosen: **the AI-DLC method running through OpenSpec 2.x**. The AWS engine keeps a record per intent but no single current spec, installs about 316 files and hooks, and is enterprise- and AWS-oriented. OpenSpec merges change deltas into living specs. Superpowers may be added later, limited to TDD and debugging.

### Consequences

- Good: specs always describe the current game, there is a clear path for every kind of change, and the specs are plain markdown with no lock-in.
- Bad: we are not using the official AWS tool. Gates are enforced by convention and the agent rules, not by the engine.

## More Information

`docs/research/aidlc-research.md` · `docs/process/how-we-work.md` · https://github.com/Fission-AI/OpenSpec · https://github.com/awslabs/aidlc-workflows
