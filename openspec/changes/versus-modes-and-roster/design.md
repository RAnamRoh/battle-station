# Design

## Context

`training-room-prototype` delivered the sim, content build, input and a single-screen web client.

## Goals / Non-Goals

**Goals:** five fighters from data only; a CPU that is fun for beginners; a shell that online play can plug into.

**Non-Goals:** tournament-level AI, final balance, accounts.

## Decisions

- **Fighters:** one YAML file each, sharing the slot layout. Archetype differences come from stats, frame data and the 4K signature move:
  beam (all-rounder), teleport strike (rushdown), heavy fast blast (zoner), command grab (grappler), evasive counter-strike (speedster).
- **CPU (`packages/bots`):** a small rule-based planner. Every few frames (shorter at higher difficulty) it reads distance, the opponent's state, incoming projectiles and its own ki, then queues a short input sequence written in forward/back terms. It keeps its own seeded random state. It produces input bitmasks only.
- **Balance check:** a test plays every pairing CPU-versus-CPU and fails on win rates outside 20%–80%.
- **Shell:** plain DOM screens over the canvas (ADR-0008 direction: menus in DOM, HUD in canvas). One `App` object owns the current screen and the active fight; the scene only draws.
- **Settings:** one JSON value in `localStorage`. This holds preferences only, never personal data.
- **Two-player keys:** left half (WASD + F G H, R T V) and right half (arrows + J K L, I O M).

## Risks / Trade-offs

- Keyboards limit how many keys register at once → documented; gamepad support is a later change.
- Bot quality is modest → three levels cover beginners; stronger AI can replace the planner behind the same function.
