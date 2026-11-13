# Spec Delta

## Purpose

Defines where each kind of project artefact lives, so that code, content, art, marketing and decisions can each change independently. It also keeps personal data out of the public repository.

## ADDED Requirements

### Requirement: Top-level areas have a single purpose
The repository SHALL organise work into these top-level areas, each with a README stating its purpose: `apps/`, `packages/`, `content/`, `art/`, `audio/`, `marketing/`, `docs/`, `tools/`, `e2e/` and `openspec/`.

#### Scenario: New contributor looks for marketing material
- **WHEN** someone needs the video production files
- **THEN** they find briefs, scripts, storyboards, replays, compositions and social cuts under `marketing/`, as described in `marketing/README.md`

### Requirement: Things that change are data
Fighters, moves, frame data, stages, rulesets, tenant branding, design tokens and the art-style definition SHALL be stored as versioned data files validated by schemas, not hard-coded in game logic.

#### Scenario: Tuning a move
- **WHEN** a move's damage or timing must change
- **THEN** the change is made in `content/` data, without editing simulation code

#### Scenario: Changing the art style
- **WHEN** the art style changes
- **THEN** a new versioned style definition is added under `art/style/`, and the old one remains available

### Requirement: The fight simulation is isolated from platforms
The fight simulation SHALL live in its own package with no dependency on the rendering engine, the DOM, the network or the clock. Web, mobile, server verification, replays and video rendering SHALL all reuse that package.

#### Scenario: Adding a mobile app later
- **WHEN** a native mobile wrapper is added
- **THEN** it adds only a thin `apps/mobile` shell and platform adapters, and the simulation and content are unchanged

### Requirement: Personal data never enters git
Photos, likeness source images, consent records, payment data and secrets SHALL NOT be committed to the repository. Only consent text templates may be committed.

#### Scenario: Someone tries to commit a coworker's photo
- **WHEN** a commit contains files from a personal-data location or matching an ignored secret pattern
- **THEN** `.gitignore` excludes it, and the agent refuses to force-add it

### Requirement: Large binaries use the right storage tier
Text and small assets SHALL live in git. Raw captures, renders and generated variants SHALL be stored outside git, with a committed manifest.

#### Scenario: Rendering a trailer
- **WHEN** a marketing video is rendered
- **THEN** the render output stays out of git (it is ignored) and is recorded in a manifest when it is uploaded to storage
