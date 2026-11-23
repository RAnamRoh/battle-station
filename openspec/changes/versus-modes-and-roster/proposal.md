# Proposal: Versus modes and the first roster

## Intent

> "The MVP will have 4-5 playable characters, which can be used to fight; each character will have different
> stats to keep things interesting. There will be 1 stage." (product owner, 2026-11-14)

**Gates:** Gates 1 and 2 are delegated for this run (product owner, 2026-11-24). Gate 3 stays with the product owner.
This change builds on `training-room-prototype`, which is not archived yet, so its branch is stacked on that one.

## Why

The training room proves the fighting works. To be a game it needs opponents, a choice of fighters, complete
matches with a winner, and a way to move between modes without reloading the page.

## What Changes

- Four more placeholder fighters, giving five with different stats and signature moves:
  all-rounder, rushdown, zoner, grappler and speedster. They are data files only; no sim code changes.
- A CPU opponent with three difficulty levels (new `packages/bots`).
- A game shell: main menu, character select, pause, result screen with rematch, and settings
  (sound, screen shake, control preset) remembered on the device.
- Modes: Versus CPU, two players on one keyboard, and Training with a fighter of your choice.

Out of scope: online play (next change), real art, story mode, accounts and leaderboards.

## Capabilities

### New Capabilities
- `fighter-roster`: which fighters exist and what must differ between them.
- `cpu-opponent`: the computer-controlled opponent.
- `game-shell`: menus, modes, character select, pause, results and settings.

### Modified Capabilities
- None. (`training-room` gains fighter choice through `game-shell`; its own requirements are unchanged.)

## ADRs needed

No.

## Open questions

- (product) Fighter names, departments and quotes are placeholders, to be replaced by real coworkers who consent.
- (product) Balance is a first pass. A bot-versus-bot check flags extreme matchups only.

## Impact

- New files in `content/core/fighters/`, new `packages/bots`, changes in `apps/web`.
- The content pack's gameplay hash changes because fighters are added.
