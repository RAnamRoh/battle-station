---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0012: Storage tiers; personal data never in git

## Context and Problem Statement

The repository is public. Art, audio and video files are large. Coworker photos and consent records are personal data under Bangladesh's Personal Data Protection Act 2026.

## Considered Options

- Everything in git
- Git LFS for everything
- Tiered: git, Git LFS and R2

## Decision Outcome

Chosen: **tiered storage**. Text and small assets go in git. Curated source art goes in Git LFS (kept under about 2 GB). Raw captures, renders and generated variants go in Cloudflare R2, tracked by committed manifests. **Photos, likeness sources, consent records, payment data and secrets never enter git.** Only consent text templates are committed.

### Consequences

- Good: the repo stays small, it stays free, and there are no privacy leaks in a public repo.
- Bad: two places to look for media, and R2 sync scripts are needed later.

## More Information

`docs/research/structure-research.md` §5 · `.gitignore`
