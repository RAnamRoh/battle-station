# Spec Delta

## Purpose

Defines how work moves from a human intent to shipped, documented behaviour: OpenSpec changes, the human approval gates, and decision records. This lets requirements, design and art direction change safely over time.

## ADDED Requirements

### Requirement: Every intent becomes an OpenSpec change
Any new feature or change to existing behaviour SHALL start as an OpenSpec change folder holding a proposal, delta specs, a design (when needed) and tasks, before any implementation code is written.

#### Scenario: Product owner states a new idea
- **WHEN** the product owner describes something they want built
- **THEN** the agent asks clarifying questions, creates a change in `openspec/changes/<change-id>/`, and stops for approval without writing code

#### Scenario: Trivial fix
- **WHEN** a change only fixes a typo, a broken link or formatting, and does not alter behaviour
- **THEN** it MAY skip the change folder, but it SHALL still use a Conventional Commit

### Requirement: Human approval gates
Work SHALL pass three human gates: Gate 1 approves the proposal, delta specs and draft ADRs; Gate 2 reviews each bolt, including a play-test when game feel is affected; Gate 3 approves the merge to `main` and the archive.

#### Scenario: Gate 1 not yet passed
- **WHEN** a change's proposal has not been approved
- **THEN** the agent SHALL NOT start implementation tasks for that change

#### Scenario: Bolt finished
- **WHEN** a bolt's tasks are complete
- **THEN** typecheck and tests pass, a Conventional Commit exists, and the agent presents a summary for review before starting the next bolt

### Requirement: Living specs reflect current behaviour
`openspec/specs/` SHALL describe how the game behaves now. Specs SHALL change only by archiving an approved change that merges its delta.

#### Scenario: Change archived
- **WHEN** an approved change is archived
- **THEN** its ADDED, MODIFIED and REMOVED requirements are merged into `openspec/specs/`, and the change folder moves to `openspec/changes/archive/` with a date prefix

#### Scenario: Code and spec disagree
- **WHEN** the agent finds that implemented behaviour differs from a living spec
- **THEN** it stops and asks the product owner which one is correct, and records the answer as a change. It does not silently edit either one.

### Requirement: Decisions are recorded and superseded, never deleted
Significant architecture, technology, data-model, tenancy, payment or art-direction decisions SHALL be recorded as MADR files in `docs/decisions/NNNN-title.md`. An accepted decision SHALL be reversed only by a new ADR that supersedes it.

#### Scenario: Reversing a decision
- **WHEN** the product owner decides to change an accepted decision (for example, the art style)
- **THEN** a new ADR is written with "Supersedes ADR-NNNN", the old ADR's status becomes "superseded by ADR-MMMM", and the old ADR's content stays unchanged

### Requirement: Requirement changes have a defined path
A change to work in progress SHALL be made by editing that change's artifacts. A change to shipped behaviour SHALL be made with a new change that uses MODIFIED or REMOVED requirements and lists its impact.

#### Scenario: Changing shipped behaviour
- **WHEN** the product owner wants shipped behaviour changed
- **THEN** a new change lists the affected specs, code, content data, replays and tokens before Gate 1

### Requirement: Sensitive changes always need explicit approval
The agent SHALL get explicit product-owner approval before changing any of the following:
- the sim determinism contract
- the netcode model
- the data schema
- authentication, payments or tenancy
- secrets or infrastructure
- art direction
- anything involving a real person's likeness
- agent rules, hooks or permissions

#### Scenario: Agent wants to add a hook
- **WHEN** the agent believes a new Claude Code hook or permission rule would help
- **THEN** it proposes the exact change and waits for approval instead of editing the settings
