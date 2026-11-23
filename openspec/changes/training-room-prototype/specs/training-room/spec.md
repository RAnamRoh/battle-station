# Spec Delta

## Purpose

Gives a player a place to practise and to judge how the fighting feels, against an opponent that does not fight back.

## ADDED Requirements

### Requirement: Practice against a dummy
The training room SHALL place the player against a dummy with no round timer, and SHALL restore the dummy's health shortly after a combo ends.

#### Scenario: Dummy recovers
- **WHEN** the player stops hitting the dummy
- **THEN** the dummy's health returns to full after a short pause

### Requirement: Feedback on every hit
Hits SHALL be shown with a brief freeze, a spark at the point of contact and a sound, and heavier attacks SHALL also shake the screen. A super SHALL show a cut-in.

#### Scenario: Heavy hit
- **WHEN** a heavy attack hits
- **THEN** the player sees a spark and a screen shake and hears a heavier sound

### Requirement: Training aids
The training room SHALL show a combo counter with damage, and SHALL let the player refill ki, switch the dummy between standing and guarding, and show hit areas.

#### Scenario: Show hit areas
- **WHEN** the player turns on the hit-area display
- **THEN** attack and body areas are drawn over the fighters
