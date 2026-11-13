---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0011: HyperFrames for marketing video

## Context and Problem Statement

We need trailers and social clips, ideally made from real gameplay, at $0.

## Considered Options

- HyperFrames
- Remotion
- Manual screen recording plus an editor

## Decision Outcome

Chosen: **HyperFrames (Apache-2.0)**, already available as Claude Code skills. Footage is rendered frame by frame from saved replays plus "director tracks" (camera moves, slow-motion) stored as data in `marketing/replays/`.

### Consequences

- Good: free, scriptable, and reproducible. The same replay produces 16:9, 9:16 and 1:1 cuts.
- Bad: needs a replay-renderer app. Remotion is the fallback, but it needs a paid licence for companies above 3 people.

## More Information

https://github.com/heygen-com/hyperframes · `docs/research/structure-research.md` §5
