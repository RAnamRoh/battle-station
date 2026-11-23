# Battle Station (working title)

A browser 2D online fighting game where **your coworkers are the fighters**. It is built for quick 1v1 matches on desktop or phone, with invite links, departments and leaderboards.

> Status: **first playable MVP** on the `change/online-versus` branch, waiting for the product owner's approval to merge.
> Five placeholder fighters, one stage, CPU and two-player modes, training, and online 1v1 from an invite link.

## Play it

Requires Node 22+ and pnpm 10 (`corepack enable pnpm`).

```bash
pnpm install
pnpm play
```

Then open **http://localhost:8787**. Press `Ctrl+C` in the terminal to stop.

### Controls (keyboard)

| Action | Keys |
|---|---|
| Move, jump, crouch | `W` `A` `S` `D` or arrow keys |
| Dash | tap forward or back twice |
| Light / Heavy | `J` / `K` (hold a direction for a different move) |
| Ki blast and power moves | `L` (with a direction) |
| Guard | `Space`, or hold away from the opponent |
| Charge ki | hold `O` |
| Super (full meter) | `I` |
| Throw | `J` + `K` together, up close |
| Pause | `Esc` |

On a phone, turn it sideways: a stick appears under your left thumb and buttons under your right.
**Simple controls** (the default on phones) turn repeated light presses into a combo; change this in Settings.

### Play online with someone on the same Wi-Fi

1. Run `pnpm play`. The terminal prints a network address such as `http://192.168.0.137:8787`.
2. Open that address on both devices (laptop or phone).
3. One player chooses **Play Online → Create a room** and shares the link or the 5-character code.
4. Both pick a fighter and press **Ready**.

The two devices connect directly when the network allows it and through the room server when it does not.

### Put it on the internet (free)

This needs a free Cloudflare account. Run these once:

```bash
pnpm --filter @bs/match exec wrangler login   # opens the browser to sign in
pnpm run deploy                               # builds the game and publishes it
```

Wrangler prints the public address (`https://battle-station.<your-name>.workers.dev`). Share room links from there.
Not done yet: a TURN relay for strict networks (the room relay covers those cases) and result checking on the server.

## Development

```bash
pnpm dev         # game on :5173 with live reload, room server on :8787
pnpm test        # all automated tests
pnpm typecheck
pnpm spec list   # changes in progress
```

Fighters, moves and rules are data in [`content/core/`](content/core/). Edit a YAML file and reload to tune the game;
`rookie.yaml` is the commented template for a new fighter.

Useful address options while testing: `?lag=120` adds network delay to online play, `?relay` turns off the direct connection.

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

## Licence
To be decided. Until a licence is added, all rights are reserved. Game art depicting real people is **not** licensed for reuse.
