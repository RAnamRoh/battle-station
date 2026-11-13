# How we work: a guide for the product owner

You decide **what** gets built and **why**. Claude builds it and keeps everything documented.
Nothing is set in stone: every decision can be changed, and the project keeps a record of why.

## The loop (AI-DLC on OpenSpec)

```
 You: an idea ("intent")
      │
      ▼
 Claude asks questions ──► writes a CHANGE: proposal + spec changes + design + tasks
      │
      ▼
 ✅ GATE 1: you read the proposal and approve it (or ask for edits)
      │
      ▼
 Claude builds it in BOLTS (2–6 small tasks; tests pass and a commit at the end of each)
      │
      ▼
 ✅ GATE 2: after each bolt you look at it / play it and say "continue" or "change X"
      │
      ▼
 ✅ GATE 3: you approve. The change is merged and ARCHIVED:
            its spec changes become part of the "living spec"
```

### What to say at each step

| You want to… | Say something like |
|---|---|
| Start something new | "New intent: I want a training room where I can test moves on my phone." |
| Approve a proposal | "Approved", or "Change X in the proposal, then approved." |
| Give feedback after a bolt | "Heavy attack feels slow" or "Continue." |
| Change something that's already built | "Change request: blocking should be a button, not hold-back." Claude opens a new change for it. |
| Reverse a big decision | "Let's switch art style to Y." Claude writes a new decision record that replaces the old one. The old one is kept for history. |
| See where things stand | "What's in progress?" Claude runs `pnpm spec list`. |

## The three kinds of documents

| Kind | Where | What it answers | Changes how |
|---|---|---|---|
| **Living specs** | `openspec/specs/` | How does the game behave **right now**? | Only via an approved change |
| **Decision records (ADRs)** | `docs/decisions/` | **Why** did we choose this? | Never edited. A new ADR replaces an old one |
| **Changes** | `openspec/changes/` | What are we changing **now**, and what's the plan? | Freely while in progress; archived when done |

Numbers that need tuning (damage, speed, frame data) live in `content/` as data files, not in specs.
That way, balancing the game never requires rewriting the rules.

## Things Claude will always ask you about first

- How the fight simulation or the online play fundamentally works
- Data structure, logins, payments, multi-company (white-label) setup, hosting and secrets
- Art direction, and anything involving a real person's face or name
- Claude's own rules, hooks and permissions
- Anything that costs money (the MVP budget is $0)

## Ground rules

- **The repo is public.** Photos of coworkers, signed consent forms and secrets never go into it.
- **Original only.** No franchise, game, studio or celebrity names in anything we make.
- **Consent first.** A coworker becomes a fighter only after signing the consent form (template in `docs/legal/consent/`, to be written).

## Glossary

| Term | Meaning |
|---|---|
| Intent | What you want, and why, in your own words |
| Change | A folder holding one intent's proposal, spec edits, design and tasks |
| Bolt | A small batch of tasks (a few hours) that ends working and committed |
| Spec | A description of how something behaves, with "WHEN … THEN …" examples |
| ADR | Architecture Decision Record: a one-page "we chose X because Y" |
| Archive | Finishing a change: its spec edits are merged into the living specs |
| Sim | The fight simulation: the pure game logic that every machine computes identically |
| Frame | One 1/60th of a second. Attack timings are measured in frames |
