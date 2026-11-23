# Spec Delta

## Purpose

Defines how a player gets from opening the page to fighting and back: menus, modes, character select, pausing, results and settings.

## ADDED Requirements

### Requirement: Main menu and modes
The game SHALL open on a main menu offering Versus CPU, Training and How to play, and SHALL offer a two-player mode on devices with a keyboard.

#### Scenario: Start a CPU match
- **WHEN** a player chooses Versus CPU, picks a fighter and a difficulty
- **THEN** a match starts against a CPU-controlled fighter

#### Scenario: Two players on one keyboard
- **WHEN** two players choose the two-player mode and each picks a fighter
- **THEN** a match starts with each player using their own half of the keyboard

### Requirement: Character select
Before a match, each side SHALL choose a fighter from the roster, seeing each fighter's name, style, strengths and stats.

#### Scenario: Random opponent
- **WHEN** a player chooses a random CPU opponent
- **THEN** the opponent's fighter is picked for them

### Requirement: Match result and rematch
When a match is decided, the game SHALL show the winner and SHALL offer a rematch, a return to character select and a return to the menu.

#### Scenario: Rematch
- **WHEN** a player chooses rematch
- **THEN** a new match starts at once with the same fighters

### Requirement: Pause
A player SHALL be able to pause a local match, see the controls and quit to the menu.

#### Scenario: Pause and resume
- **WHEN** a player pauses and then resumes
- **THEN** the fight continues from the same moment

### Requirement: Settings are remembered
The game SHALL let the player change sound volume, screen shake and the control preset, and SHALL remember these on the device.

#### Scenario: Returning player
- **WHEN** a player who turned sound off reopens the game
- **THEN** sound is still off

#### Scenario: Reduced effects
- **WHEN** a player turns screen shake off
- **THEN** hits no longer shake the screen
