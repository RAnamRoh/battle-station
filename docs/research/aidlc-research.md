# AI-DLC and spec-driven development: research (2026-11-14)

## AWS AI-DLC
- **Origin:** a blog post by Raja SP at AWS on 2025-07-31 (https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/). The repo is https://github.com/awslabs/aidlc-workflows: v2.11.4 (2026-11-13), about 6.1k stars, MIT-0, with new preview releases almost every day.
- **Method:**
  - **Intent:** the business goal.
  - **Unit of Work:** replaces the epic.
  - **Bolt:** replaces the sprint and lasts hours to days.
  - **Phases:** Inception, Construction and Operations, with "Mob Elaboration" and "Mob Construction" sessions where humans validate what the AI proposes.
  - **Ground rules:** "the user decides, the AI executes"; approval gates; ask questions before assuming.
- **Engine in v2.x:** 5 phases, 33 stages, 14 agents and 11 profiles (classic, express, mvp, feature, bugfix, ...). Installing it for Claude Code writes about 316 files plus its own hooks and settings into `.claude/`. Work is recorded per intent in `aidlc/spaces/default/intents/<id>/`.
- **Main weakness for this project:** there is **no living spec**. Each new requirement is a new intent folder, so after many intents the current description of the game is scattered across all of them. It also leans towards enterprise and AWS, carries heavy ceremony, and its internals change often.

## Other frameworks (stars from the GitHub API, 2026-11-14)
| Framework | Stars / state | How a change flows | Fit |
|---|---|---|---|
| **OpenSpec** (Fission-AI) | 74.8k, v2.0.0 on 2026-11-11 | Each change gets a folder (proposal, design, tasks, delta specs marked ADDED/MODIFIED/REMOVED). Archiving merges the deltas into the **living specs** in `openspec/specs/`. | **Best fit for requirements that change often** |
| GitHub Spec Kit | 149.7k, v1.4.0 | One folder per feature; no merge into a single current spec | Good for brand-new features; the "constitution" idea is worth copying |
| Kiro specs | Kiro IDE only (a Claude Code port exists: cc-sdd) | One spec per feature, plus steering files | Worth borrowing ideas from |
| BMAD | 55.3k, version 7 coming out mid-November 2026 with breaking changes | A loop of persona agents (product manager, architect, developer, tester) | Heavy. Has a small Game Dev module. |
| Agent OS v3 | 5.6k | Standards-first | Low activity |
| Taskmaster | 28.4k, stalled since April 2026, Commons Clause licence | Task graph | Avoid |
| Superpowers | 317k | Adds discipline (TDD, debugging, review); not a spec system | Use only for its execution skills |
| GSD | 64.1k, stalled since May 2026 | Roadmap phases | Avoid |

## Practices that cope well with change
- **Decision records (ADRs), using the MADR 4.0 template:** one file per decision, `docs/decisions/NNNN-title.md`, with a status of proposed / accepted / superseded. **Never edit an accepted ADR.** Write a new one that supersedes it.
- **Where each kind of information lives:**
  - **Behaviour** goes in living specs.
  - **The reason** for a structural choice goes in an ADR.
  - **The plan and tasks** go in the change folder.
  - **History** lives in the archive and git.
- **Design tokens:** the W3C DTCG format reached its first stable version (2025.10). Build them with Style Dictionary and give the tokens package its own version number. Code refers to meaning-based tokens such as "health bar fill", never raw colour values, and each tenant gets its own theme.
- **Version history:** Conventional Commits plus release-please (single package) or changesets (a monorepo with several packages).
- **CLAUDE.md:** under 200 lines. Point to spec files by path instead of `@`-importing them, because imported files are loaded in full. Rules that apply to one area go in `.claude/rules/*.md` with `paths:` frontmatter. Rules that must never be broken go in hooks or permissions, not in prose.

## Recommendation (from the research)
- **Process:** follow the AI-DLC **method** (intent, units, bolts, human approval gates) using **OpenSpec as the tool**.
- **Alongside it:**
  - MADR decision records
  - DTCG design tokens
  - Conventional Commits with release-please or changesets
  - Superpowers, used only for TDD and debugging
- **Don't install the full AI-DLC engine on day one.**
- **Option B:** use the official engine, limited to its `express`, `mvp` and `bugfix` profiles, and after each intent update the living specs and ADRs by hand.

### How AI-DLC terms map onto OpenSpec
| AI-DLC | Here |
|---|---|
| Intent | The Intent and Why sections of `proposal.md` |
| Inception / Mob Elaboration | `/openspec-explore` → `/openspec-propose`: Claude asks questions, then you approve |
| Unit of Work | A capability spec, or one change folder |
| Bolt | One apply session or PR, of 2–6 tasks, ending with tests passing and a commit |
| Construction | `/openspec-apply-change`, with a checkpoint where you review and play-test each bolt |
| Operations | Deploy and monitoring tasks; what you learn becomes new intents |
| Self-learning guardrails | Corrections become entries in `.claude/rules` or `openspec/config.yaml`, once you approve them |

### Approval gates
- **Gate 1:** approve the proposal, delta specs and any draft ADR.
- **Gate 2:** after each bolt, review the diff and play the game.
- **Gate 3:** approve the merge to main and the archive (which updates the living specs), and accept the ADRs.

**Always needs your approval:**
- the determinism contract and the netcode model
- the data schema, authentication, payments and tenancy
- secrets and infrastructure
- art direction
- anything involving real coworkers' likeness
- changes to rules, hooks or permissions

### Requirement changes
- **Work still in progress:** edit that change's files. No extra ceremony.
- **Behaviour that has already shipped:** open a new change with MODIFIED or REMOVED requirements and an impact list (specs, code, content data, replays, tokens).
- **Reversing a decision:** write a new ADR that supersedes the old one.
- **Art-style pivot:** a token change with a version bump, plus an ADR and a rewrite of `docs/art-direction/`.
- **Code and spec disagree:** Claude opens a change, and you decide which one is right.

Sources: the AI-DLC repo and blog above; https://github.com/Fission-AI/OpenSpec; https://github.com/github/spec-kit; https://kiro.dev/docs/specs/; https://github.com/bmad-code-org/BMAD-METHOD; https://adr.github.io/madr/; https://www.designtokens.org/; https://code.claude.com/docs/en/memory
