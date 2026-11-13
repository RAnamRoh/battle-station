# Claude Code skills, plugins and MCPs: research (2026-11-14)

Star counts, licences and last-push dates come from `gh api`. Install counts come from the skills.sh leaderboard. "Official mkt" means `anthropics/claude-plugins-official`, where third-party plugins are pinned to a specific git commit. Nothing has been installed yet.

## Recommended minimal set (install order)
| # | Item | Install | Why |
|---|---|---|---|
| 1 | claude-md-management (official) | `/plugin install claude-md-management@claude-plugins-official` | Keeps CLAUDE.md lean and records what each session learned |
| 2 | typescript-lsp (official) | `/plugin install typescript-lsp@claude-plugins-official` (needs typescript-language-server) | Lets Claude navigate and check TypeScript code |
| 3 | AWS AI-DLC (awslabs/aidlc-workflows, 6.1k★, v2.11.4, MIT-0) | Download and read install.sh first → `aidlc config --harness claude` | The single owner of the development process |
| 4 | obra/superpowers (317k★, MIT, official) | `/plugin install superpowers@claude-plugins-official` + `SUPERPOWERS_DISABLE_TELEMETRY=1` | Limited to test-first development, debugging, verification and worktrees. It must not run its own planning. |
| 5 | context7 (64.8k★, MIT) | `/plugin install context7@claude-plugins-official` | Current docs for Phaser 4, Workers and other libraries |
| 6 | cloudflare skills (3.4k★, Apache-2.0) | `/plugin install cloudflare@claude-plugins-official` | Durable Objects, wrangler, D1, R2 |
| 7 | Phaser official skills (ship inside the npm package) | Copy only the ones we need from `node_modules/phaser/skills/` | Phaser 4 API (most models know Phaser 3) |
| 8 | gamedev-skills: game-feel, game-ai, input-systems (8.8k★, Apache-2.0) | `npx skills add gamedev-skills/awesome-gamedev-agent-skills --skill game-feel ...` | Game feel, CPU opponent AI, input handling |
| 9 | microsoft/playwright-cli + skills (15.2k★, Apache-2.0) | `npm i -g @playwright/cli && playwright-cli install --skills` | End-to-end tests; uses fewer tokens than the MCP version |
| 10 | commit-commands (official) | `/plugin install commit-commands@claude-plugins-official` | Git commits and PRs |
| 11 | Our own `deterministic-sim` / `rollback-netcode` skills | Written with skill-creator | No skill for this exists anywhere |

**Later:**
- mattpocock `grill-with-docs` (decision records and a glossary of project terms)
- pr-review-toolkit
- hookify (a guard that blocks non-deterministic code in the sim)
- agent-sprite-forge
- pixelfx
- elevenlabs
- coreyhaines31/marketingskills (60k★)
- changesets or release-please

**Skip:**

| Item | Reason |
|---|---|
| Spec Kit, OpenSpec, BMAD | Run only one development process. OpenSpec is the fallback if AI-DLC feels too heavy. |
| affaan-m/ECC | Huge bundle that overlaps everything above |
| claude-mem | Background worker with a paid upsell |
| Playwright MCP, GitHub MCP | Use too many tokens; the `gh` CLI already works |
| webapp-testing | Its helper is written in Python |
| remotion skills | No licence, and HyperFrames already covers video |
| Design-token skills | None is popular or well maintained |

## Conflicts
- **Only one development process.** AI-DLC, Spec Kit, OpenSpec and BMAD each run their own process, so pick one.
- **Superpowers and mattpocock overlap with AI-DLC.** Superpowers' brainstorm and plan steps, and mattpocock's to-spec and implement-spec, duplicate AI-DLC's planning stages and approval gates. CLAUDE.md must say that AI-DLC's documents are the source of truth.

## Security
- **Many skills are unsafe.** In a February 2026 Snyk scan of 3,984 skills, 36.8% had a security issue and 76 contained confirmed malicious payloads (https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/).
- **Where to install from:** prefer the official marketplace or a known GitHub organisation. Avoid aggregator mirror sites and copycat publisher names such as "101-skills/superpowers".
- **Before and after installing:**
  - Read each SKILL.md and its scripts.
  - Pin versions.
  - Commit `.claude/skills` so any change shows up in a diff.
  - Never pipe a `curl` download straight into the shell without reading it.
- **Telemetry opt-outs:** `DISABLE_TELEMETRY=1`, `SUPERPOWERS_DISABLE_TELEMETRY=1`, `OPENSPEC_TELEMETRY=0`.

## Not verified
- Which files `aidlc config` writes, and how it interacts with Superpowers' startup hook.
- Whether `npx skills add` accepts more than one `--skill` flag.
- How mature Phaser's `experimental_sync` is.
- Context7's free-tier limits.
