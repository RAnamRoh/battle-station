# Tasks

## 1. Bolt 1: Workspace and process

- [x] 1.1 Initialise git (`main`), pnpm workspace with catalog, Turborepo, `tsconfig.base.json`
- [x] 1.2 Initialise OpenSpec for Claude Code and write `openspec/config.yaml` (context, rules, operations)
- [x] 1.3 Write this change's proposal, delta specs, design and tasks; `openspec validate` passes

## 2. Bolt 2: Skeleton and decisions

- [x] 2.1 Create top-level areas, each with a README (`apps`, `packages`, `content`, `art`, `audio`, `marketing`, `docs`, `tools`, `e2e`)
- [x] 2.2 Move research notes to `docs/research/`
- [x] 2.3 Write the MADR template and ADRs 0001–0012
- [x] 2.4 Write `.gitignore` and `.gitattributes`, covering personal data, renders, secrets and build output

## 3. Bolt 3: Guidance

- [x] 3.1 Write `AGENTS.md` (≤150 lines) and `CLAUDE.md` (`@AGENTS.md`)
- [x] 3.2 Write `.claude/rules/` for sim determinism, content and marketing, scoped by path
- [x] 3.3 Write `docs/process/how-we-work.md` for the product owner
- [x] 3.4 Write the root `README.md`

## 4. Bolt 4: Tooling and publish

- [x] 4.1 Install the agreed official plugins at project scope (claude-md-management, context7, cloudflare, commit-commands). typescript-lsp is deferred until code exists, because it needs typescript-language-server on the PATH.
- [x] 4.2 Review and add third-party skills (gamedev: game-feel, game-ai, input-systems)
- [ ] 4.3 Commit with Conventional Commits, create the public GitHub repo `battle-station`, and push
- [ ] 4.4 Archive this change after product-owner approval (already given on 2026-11-14)
