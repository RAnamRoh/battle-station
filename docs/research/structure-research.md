# Project structure and system design: research (2026-11-14)

## Picks
| Area | Pick | Why / source |
|---|---|---|
| Monorepo | **pnpm workspaces + catalogs + Turborepo**. Internal packages export `src/*.ts` directly, with no build step per package. | Same setup as cloudflare/workers-sdk, cloudflare/templates and tldraw. Costs $0. Easy to move to Nx later. https://pnpm.io/catalogs, https://turborepo.dev/docs/core-concepts/internal-packages |
| TS | One `tsconfig.base.json` (strict, noUncheckedIndexedAccess, verbatimModuleSyntax). Add project references only if type checking gets slow. | Turborepo docs; TS 7 went GA on 2026-07-08 |
| Mobile | **Installable web app (PWA) now; a Capacitor wrapper later. Not Tauri.** | Same browser engine underneath. Phaser has an official Capacitor tutorial. Apple App Store rules: ship the game code inside the app; content packs can be downloaded because they are data. In-app payments must go through Apple, so keep payments on the web or B2B. |
| Game content | YAML in the repo → `content:build` (validate with Zod 4 → check cross-references → convert to integers) → JSON packs. JSON Schema is generated for editor autocomplete and the admin panel's forms. | https://zod.dev/json-schema |
| Content versioning | Each pack is split into **gameplay** data (frame data, hitboxes) and **presentation** data (art, names, colours). `gameplayHash` = SHA-256 of the gameplay data in a canonical JSON form (RFC 8785). Replays store the sim version, ruleset, hashes, seed and inputs. Old packs are kept forever in R2. | Changing art never breaks old replays |
| Tenants (other companies) | Packs are layered: base → tenant → event. A tenant can override presentation only, and can add its own fighters. Changing gameplay means a separate ruleset and leaderboard. Real tenant config lives in D1/R2, not git. | |
| Design tokens | W3C DTCG 2025.10 token files, built with **Style Dictionary** into CSS variables plus a TypeScript constant the Phaser canvas can use. Three tiers: primitive → semantic → component. Tenants override the semantic and brand tiers. | https://www.designtokens.org/tr/2025.10/format/, https://styledictionary.com/info/dtcg/ |
| Art-style "bible" | `art/style/<styleId>@<ver>/style.yaml` holds palette references, outline weight, shading bands and Gemini prompt fragments. Every generated image gets a `*.gen.json` sidecar recording how it was made. Changing the style means a new styleId, and old and new styles can coexist. | |
| UI | Menus, lobby and admin are normal web pages layered over the game. The in-fight HUD is drawn in Phaser. | https://phaser.io/devlogs/166 |
| Video | **HyperFrames** (Apache-2.0, no fees). Remotion needs a paid licence once a company has more than 3 people. Trailer footage is rendered frame by frame from saved replays, plus "director tracks" (camera moves, slow-motion) stored as data. | https://github.com/heygen-com/hyperframes, https://www.remotion.dev/docs/license/pricing |
| Large files | Three tiers: plain git for text, Git LFS for curated art (kept under about 2 GB; the free LFS quota is 10 GiB), and **Cloudflare R2** for raw captures and renders, tracked by manifest files. | GitHub LFS billing docs; https://developers.cloudflare.com/r2/pricing/ |
| CI | GitHub Actions, checking only the packages a change affects. A private repo on the free plan gets about 2,000 Linux minutes a month; public repos are unlimited. | GitHub Actions billing docs |
| Personal data | Photos, consent records and payments live in a private R2 bucket and D1 only. Git holds just the consent text templates. A gitleaks scan in CI catches secrets and personal data. | |
| Licences | REUSE spec, `CREDITS.md`, `art/provenance/` | https://reuse.software/spec-3.3/ |

## Full target tree (a map; folders are created as they are needed)
```
apps/        web (the only game client, PWA) · admin · api (Worker) · match (Worker + Durable Objects)
             · gen (AI fighter pipeline) · replay-renderer · mobile (later, Capacitor wrapper only)
packages/    sim · sim-testkit · netcode · bots · protocol · content-schema · content-runtime
             · render-phaser · input · ui · tokens · theme-runtime · platform · db · config · tsconfig
content/     _schemas · core (fighters, moves, stages, rulesets, i18n) · tenants (demo only) · migrations
art/         style · source (LFS) · generated (+provenance) · provenance · build (gitignored)
audio/
marketing/   brand · briefs · scripts · storyboards · replays · captures · compositions · social · renders (gitignored)
docs/        decisions (ADRs) · architecture · game-design · content-guide · runbooks · legal (text templates only)
tools/       content · atlas · gen · media · replay
e2e/         Playwright
```

## Decisions kept open on purpose
These choices sit behind clear boundaries, so each can be swapped later without large rewrites:
- task runner
- TypeScript build mode
- Zod / Valibot
- Style Dictionary / Terrazzo
- Phaser / Pixi
- DOM UI framework
- mobile wrapper
- network transport
- HyperFrames / Remotion
- binary storage
- art style
- tenant isolation
- rulesets
- payment provider
- AI image model

## Not verified
- Touch latency in an app's web view compared with the browser: measure it on real devices.
- Phaser 4's API for rendering a frame on demand: needs a quick experiment.
- How mature Tauri's mobile support is today.
