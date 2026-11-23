# Spec Delta

## Purpose

Defines how two devices play the same fight over a network: each player's own actions feel immediate, and both always end up seeing the same fight.

## ADDED Requirements

### Requirement: Immediate local response
A player's own inputs SHALL take effect after a small fixed delay, without waiting for the other player's inputs to arrive.

#### Scenario: Slow network
- **WHEN** the other player's inputs arrive late
- **THEN** the local player's fighter still responds on time, and the game predicts the other fighter until the inputs arrive

### Requirement: Both players see the same fight
When a prediction turns out wrong, the game SHALL correct itself so that both devices reach exactly the same fight state for every frame.

#### Scenario: Lost and reordered messages
- **WHEN** some network messages are lost, delayed or arrive out of order
- **THEN** both devices still compute identical states for every confirmed frame

#### Scenario: Same result
- **WHEN** an online match ends
- **THEN** both devices show the same winner

### Requirement: Limited prediction
The game SHALL stop advancing when it has gone a set number of frames without the other player's inputs, and SHALL continue when they arrive.

#### Scenario: Connection stalls
- **WHEN** nothing arrives from the other player for longer than the prediction limit
- **THEN** the fight pauses with a visible "waiting" notice and resumes on its own when messages arrive

### Requirement: Desync detection
The two devices SHALL regularly compare a checksum of the confirmed fight state, and SHALL tell the players if they differ.

#### Scenario: Checksums differ
- **WHEN** the devices' checksums for the same frame differ
- **THEN** the match stops and both players are told the match went out of sync

### Requirement: Same content on both sides
An online match SHALL only start when both players have the same gameplay data.

#### Scenario: One player has an old version
- **WHEN** the players' gameplay hashes differ
- **THEN** the second player is told to reload to get the latest version, and no match starts

### Requirement: Opponent leaves
When the other player disconnects during a match, the game SHALL end the match and say why.

#### Scenario: Opponent closes the tab
- **WHEN** the other player's connection is lost and does not return within a short time
- **THEN** the remaining player sees that the opponent left and can return to the lobby
