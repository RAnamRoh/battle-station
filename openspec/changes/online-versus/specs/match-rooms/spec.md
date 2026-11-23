# Spec Delta

## Purpose

Defines how two people get into the same match: creating a room, sharing an invite link, picking fighters and starting, with as few steps as possible.

## ADDED Requirements

### Requirement: Create a room and invite by link
A player SHALL be able to create a private room and get a short code and a link that another player can open to join.

#### Scenario: Create and share
- **WHEN** a player chooses to create a room
- **THEN** they see a room code and an invite link with copy and share actions

#### Scenario: Join by link
- **WHEN** another player opens the invite link
- **THEN** they arrive in that room's lobby after entering a display name, without creating an account

#### Scenario: Join by code
- **WHEN** a player types a valid room code
- **THEN** they join that room

### Requirement: Two players per room
A room SHALL hold two players. A third person who tries to join SHALL be told the room is full.

#### Scenario: Room is full
- **WHEN** a third person opens the invite link while two players are in the room
- **THEN** they see that the room is full

### Requirement: Lobby
In the lobby each player SHALL choose a fighter and mark themselves ready, and SHALL see the other player's name, choice and ready state.

#### Scenario: Both ready
- **WHEN** both players are ready
- **THEN** the match starts for both at the same time with the fighters they chose

#### Scenario: Waiting for an opponent
- **WHEN** only one player is in the room
- **THEN** that player sees that they are waiting and can still share the link

### Requirement: Connection chosen automatically
The game SHALL try to connect the two players directly and SHALL fall back to relaying through the room when a direct connection cannot be made, without asking the players to do anything.

#### Scenario: Direct connection blocked
- **WHEN** the network blocks a direct connection
- **THEN** the match still starts and is playable, and the lobby shows that the connection is relayed

### Requirement: Rematch
After an online match, both players SHALL be able to ask for a rematch, and a new match SHALL start when both have asked.

#### Scenario: Rematch
- **WHEN** both players choose rematch
- **THEN** a new match starts in the same room

### Requirement: No personal data required
Joining a room SHALL require only a display name chosen by the player.

#### Scenario: Guest play
- **WHEN** a player joins a room
- **THEN** they are not asked for an email address, password or any other personal detail
