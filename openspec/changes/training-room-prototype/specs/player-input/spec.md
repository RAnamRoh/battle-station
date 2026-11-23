# Spec Delta

## Purpose

Defines how keyboard and touch controls become the single per-frame input that the fight simulation understands, so every device plays by the same rules.

## ADDED Requirements

### Requirement: One input format for every device
Every control device SHALL produce the same per-frame set of held directions and buttons: up, down, left, right, light, heavy, ki, guard, charge and super.

#### Scenario: Keyboard
- **WHEN** a player holds the move-right key and presses the light key
- **THEN** the input for that frame contains right and light

### Requirement: Touch controls
On a touch device the game SHALL show an on-screen stick and buttons that work with several fingers at once.

#### Scenario: Move and attack together
- **WHEN** a player holds the stick with one thumb and taps a button with the other
- **THEN** both are registered in the same frame

#### Scenario: Portrait phone
- **WHEN** a phone is held upright
- **THEN** the game asks the player to rotate it

### Requirement: Forgiving button timing
A button pressed shortly before the fighter can act SHALL still take effect when the fighter becomes able to act.

#### Scenario: Early press
- **WHEN** a player presses an attack a few frames before a previous move ends
- **THEN** the attack comes out on the first possible frame
