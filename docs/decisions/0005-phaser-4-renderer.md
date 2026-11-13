---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0005: Phaser 4 as renderer and input host

## Context and Problem Statement

We need sprite atlases, multitouch, scaling, audio, camera effects and post-processing in the browser, written by an AI agent.

## Considered Options

- Phaser 4
- PixiJS v8 plus our own audio and input
- Godot web export
- KAPLAY or Excalibur

## Decision Outcome

Chosen: **Phaser 4 (pinned)**, used only behind a render layer that *reads* sim state. Official Phaser 4 agent skills ship in the npm package.

### Consequences

- Good: everything is built in, and switching to Pixi is cheap because the sim never imports Phaser.
- Bad: v4 is young and most AI training data covers Phaser 3. Mitigation: the official v4 skills, context7 docs and pinning.

## More Information

`docs/research/research-report.md` · https://github.com/phaserjs/phaser
