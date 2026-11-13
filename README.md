# Battle Station (working title)

A browser 2D online fighting game where **your coworkers are the fighters**. It is built for quick 1v1 matches on desktop or phone, with invite links, departments and leaderboards.

> Status: **foundation laid**. There is no playable build yet. The next change is a placeholder fighter in a training room.

## Highlights (planned)
- Light and heavy attacks with direction variants, power attacks, a ki meter, supers and blocking
- Online play with rollback netcode, playable from an invite link in seconds
- Touch controls for phone browsers, installable as an app (PWA)
- An early-90s arcade comic look. All characters are original.
- Departments, leaderboards, and white-label support for other offices (later)

## How this project is run
We follow the **AI-DLC** method using **OpenSpec** (see [ADR-0002](docs/decisions/0002-ai-dlc-method-on-openspec.md)).
- Start here: [docs/process/how-we-work.md](docs/process/how-we-work.md)
- Current behaviour: [`openspec/specs/`](openspec/specs/)
- Decisions and the reasons behind them: [`docs/decisions/`](docs/decisions/)
- Research behind the decisions: [`docs/research/`](docs/research/)

## Repository map
| Folder | Purpose |
|---|---|
| `apps/` | Deployable shells: the web game, Workers, admin, mobile wrapper (later) |
| `packages/` | Shared libraries: the deterministic fight sim, input, netcode, tokens… |
| `content/` | Fighters, moves, stages and rulesets as data |
| `art/` | Versioned art-style bibles, source art, generated art with provenance |
| `audio/` | Sound and music sources with licences |
| `marketing/` | Brand, campaign briefs, scripts, storyboards, video compositions, social cuts |
| `docs/` | Process, decisions, game design, architecture, legal templates, research |
| `openspec/` | Living specs and changes |
| `tools/`, `e2e/` | Dev scripts and end-to-end tests |

## Development
Requires Node 22+ and pnpm 10 (`corepack enable pnpm`).
```bash
pnpm install
pnpm spec list        # see changes in progress
```

## Licence
To be decided. Until a licence is added, all rights are reserved. Game art depicting real people is **not** licensed for reuse.
