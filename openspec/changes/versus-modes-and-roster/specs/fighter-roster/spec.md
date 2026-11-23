# Spec Delta

## Purpose

Defines the set of playable fighters and what makes each one play differently, so that choosing a fighter is a real choice.

## ADDED Requirements

### Requirement: Five fighters with distinct play styles
The game SHALL offer five fighters, each with its own health, speed, damage, ki gain and guard strength, and each with one clear strength and one clear weakness.

#### Scenario: Different stats
- **WHEN** the roster is listed
- **THEN** no two fighters have the same combination of health, walking speed and damage

#### Scenario: Signature move
- **WHEN** a player uses back + ki with any fighter
- **THEN** that fighter's own signature power attack comes out

### Requirement: Shared move layout
Every fighter SHALL use the same inputs for the same kinds of move, so a player who learns one fighter can pick up another.

#### Scenario: Switching fighters
- **WHEN** a player presses forward + light with any fighter
- **THEN** a forward light attack comes out

### Requirement: Fighters are added without code changes
A fighter SHALL be defined entirely by a content file holding gameplay data and presentation data.

#### Scenario: Adding a fighter
- **WHEN** a valid fighter file is added to the content folder and the content is rebuilt
- **THEN** the fighter appears in character select and is playable

### Requirement: No runaway matchups
A fighter SHALL NOT win more than 80% of automated CPU-versus-CPU matches against any other fighter.

#### Scenario: Balance check
- **WHEN** the automated matchup check runs every pairing
- **THEN** every pairing's win rate is between 20% and 80%
