# Decision records (ADRs)

One file per significant decision, using the [MADR 4](https://adr.github.io/madr/) format. Copy `template.md` to start a new one.

**Rules:**
- Never edit an accepted decision. To change it, write a new ADR with "Supersedes ADR-NNNN" and set the old one's status to `superseded by ADR-MMMM`.
- Number files in order: `NNNN-kebab-title.md`.
- A decision becomes `accepted` when the product owner approves the change that introduced it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-decisions-with-madr.md) | Record decisions with MADR | accepted |
| [0002](0002-ai-dlc-method-on-openspec.md) | AI-DLC method on OpenSpec rails | accepted |
| [0003](0003-pnpm-turborepo-monorepo.md) | pnpm workspaces + Turborepo monorepo | accepted |
| [0004](0004-deterministic-engine-free-sim.md) | Deterministic, engine-free fight sim | accepted |
| [0005](0005-phaser-4-renderer.md) | Phaser 4 as renderer and input host | accepted |
| [0006](0006-cloudflare-free-tier-backend.md) | Cloudflare free tier backend; $0 MVP | accepted |
| [0007](0007-data-driven-content-packs.md) | Data-driven content packs | accepted |
| [0008](0008-dtcg-design-tokens.md) | DTCG design tokens with Style Dictionary | accepted |
| [0009](0009-versioned-art-style-bible.md) | Versioned art-style bible; cel-shaded comic style | accepted |
| [0010](0010-pwa-first-capacitor-later.md) | PWA first, Capacitor later | accepted |
| [0011](0011-hyperframes-marketing-video.md) | HyperFrames for marketing video | accepted |
| [0012](0012-storage-tiers-and-personal-data.md) | Storage tiers; personal data never in git | accepted |
| [0013](0013-online-play-model.md) | Online play: rollback, hybrid transport, rooms as Durable Objects | proposed |
