---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0009: Versioned art-style bible; cel-shaded comic style

## Context and Problem Statement

Art comes from Gemini (Nano Banana) for free. Most fighters are bearded men who must still look distinct. The style may change later.

## Considered Options

- Semi-realistic painted
- Big-head / super-deformed
- Graphic-novel heavy blacks
- Cel-shaded comic with mild caricature

## Decision Outcome

Chosen: **a cel-shaded comic look with mild caricature** (thick ink outline, flat colour plus one hard shadow tone, about 7 heads tall), generated on a flat magenta background. The retro look is added in post-processing (downscale, palette lock). It is stored as data in `art/style/<id>@<ver>/`, along with prompt fragments, an identity sheet for each person, and a roster distinctness table. Placeholders come first; the art comes in a later change.

### Consequences

- Good: most consistent across edits, easy to animate, and keeps beards distinct. A new style is just a new version folder.
- Bad: free Gemini quotas (about 20 images a day, unverified) make each fighter take days. Consistency still needs human review.

## More Information

`docs/research/art-style-research.md`
