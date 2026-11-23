# Spec Delta

## Purpose

Gives a solo player an opponent that fights back at a chosen level of difficulty, using the same controls a person has.

## ADDED Requirements

### Requirement: Plays by the same rules
The CPU opponent SHALL act only by producing the same inputs a human player can produce.

#### Scenario: No special powers
- **WHEN** the CPU fights
- **THEN** its fighter obeys the same move timings, ki costs and limits as a human-controlled fighter

### Requirement: Three difficulty levels
The CPU opponent SHALL offer Easy, Normal and Hard, which differ in how quickly it reacts, how often it guards and how often it makes mistakes.

#### Scenario: Harder is stronger
- **WHEN** Hard plays Easy over many automated matches with the same fighter
- **THEN** Hard wins clearly more often

### Requirement: Uses the whole move set
The CPU opponent SHALL move, guard, attack, use ki moves and use its super when the meter is full.

#### Scenario: Super
- **WHEN** the CPU has a full ki meter and the opponent is in range
- **THEN** it uses its super within a short time

### Requirement: Repeatable
Given the same starting seed and the same fight state, the CPU opponent SHALL choose the same inputs.

#### Scenario: Same seed
- **WHEN** two CPU-versus-CPU matches run with the same seeds
- **THEN** they end with the same result
