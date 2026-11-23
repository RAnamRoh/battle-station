# Spec Delta

## Purpose

Defines the rules of a one-on-one fight and the determinism contract that lets every machine compute the same fight from the same inputs.

## ADDED Requirements

### Requirement: Deterministic stepping
The simulation SHALL advance one frame at a time from a state, two players' inputs and a content pack, and SHALL produce an identical state on every machine for identical inputs.

#### Scenario: Same inputs, same result
- **WHEN** two simulations start from the same match settings and receive the same input sequence
- **THEN** their state checksums are equal on every frame

#### Scenario: Snapshot and resume
- **WHEN** a state is copied, the original is advanced, and the copy is advanced with the same inputs
- **THEN** both reach the same checksum

### Requirement: Movement
A fighter SHALL be able to walk, crouch, jump, and dash forward or back, and SHALL always face the opponent when free to act on the ground.

#### Scenario: Dash
- **WHEN** a player taps forward twice quickly
- **THEN** the fighter dashes forward faster than walking

#### Scenario: Stage edge
- **WHEN** a fighter walks into the edge of the stage
- **THEN** the fighter stops at the edge

### Requirement: Attacks with direction variants
A fighter SHALL have light and heavy attacks, and the held direction (neutral, forward, back, down, or in the air) SHALL select a different variant of each.

#### Scenario: Forward light
- **WHEN** a player holds forward and presses light
- **THEN** the forward-light variant comes out instead of the neutral light

#### Scenario: Hit
- **WHEN** an attack's hit area overlaps the opponent and the opponent is not guarding
- **THEN** the opponent loses health, is stunned and is pushed back

### Requirement: Combos and cancels
A move that connects SHALL be cancellable into a stronger class of move (light, then heavy, then ki, then super), and damage SHALL scale down as a combo grows.

#### Scenario: Light into heavy
- **WHEN** a light attack hits and the player presses heavy before it ends
- **THEN** the heavy attack starts immediately and the hits count as one combo

#### Scenario: Damage scaling
- **WHEN** a combo continues past its first hit
- **THEN** each later hit deals a smaller share of its base damage, down to a floor

### Requirement: Guarding
A grounded fighter who is free to act SHALL block attacks while holding guard or holding away from the opponent. Blocking SHALL drain a guard gauge, and an empty gauge SHALL cause a guard break.

#### Scenario: Blocked attack
- **WHEN** an attack reaches a guarding fighter
- **THEN** the fighter takes no damage from a melee attack and enters block stun

#### Scenario: Guard break
- **WHEN** blocked attacks empty the guard gauge
- **THEN** the fighter is stunned and cannot block for a short time

#### Scenario: Throw beats guard
- **WHEN** a fighter throws a guarding opponent at close range
- **THEN** the throw connects

### Requirement: Ki meter, power attacks and supers
A fighter SHALL have a ki meter that fills by landing hits, taking hits and charging. Ki blasts and power attacks SHALL spend ki, and a super SHALL be available only with a full meter.

#### Scenario: Charging
- **WHEN** a player holds charge while free to act
- **THEN** the ki meter fills steadily and the fighter cannot act until charge is released

#### Scenario: Super needs full meter
- **WHEN** a player presses super without a full meter
- **THEN** no super comes out

#### Scenario: Super
- **WHEN** a player presses super with a full meter
- **THEN** the fight freezes briefly, the meter empties and the super attack starts

### Requirement: Rounds
A match SHALL be played in rounds. A round SHALL end when a fighter's health reaches zero or the timer runs out, and the first fighter to win the required number of rounds SHALL win the match.

#### Scenario: Knockout
- **WHEN** a fighter's health reaches zero
- **THEN** the round ends, the other fighter gains a round win, and a new round starts unless the match is decided

#### Scenario: Time out
- **WHEN** the round timer reaches zero
- **THEN** the fighter with more health remaining wins the round

### Requirement: Tuning lives in content
Fighter stats and move data SHALL be read from a validated content pack, and the pack SHALL carry a hash of its gameplay data.

#### Scenario: Invalid content
- **WHEN** a content file is missing a required field or has a non-integer gameplay value
- **THEN** the content build fails with a message naming the file and field
