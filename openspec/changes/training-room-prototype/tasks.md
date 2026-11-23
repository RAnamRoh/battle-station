# Tasks

## 1. Bolt 1: Sim core

- [x] 1.1 Scaffold `packages/sim` with types, integer helpers, PRNG, state copy and checksum
- [x] 1.2 Implement movement, attacks, hits, guarding, cancels, ki, projectiles, supers, throws, rounds
- [x] 1.3 Tests: mechanics scenarios, determinism, snapshot/resume, banned-API scan, golden replay

## 2. Bolt 2: Content

- [x] 2.1 `packages/content-schema`: Zod schemas, compile step, gameplay hash, CLI
- [x] 2.2 `content/core`: one placeholder fighter and the stage, in YAML; tests for validation errors

## 3. Bolt 3: Web client

- [x] 3.1 `packages/input`: keyboard and touch to bitmask
- [x] 3.2 `apps/web`: Phaser scene, fixed-step loop, placeholder fighter drawing, HUD
- [x] 3.3 Hit sparks, shake, super cut-in, synthesised sound
- [x] 3.4 Training aids: dummy modes, ki refill, hit-area display, combo counter

## 4. Bolt 4: Verify

- [x] 4.1 Run in a real browser (desktop and phone-sized touch emulation) and fix what is found
- [ ] 4.2 Product-owner play-test (deferred to the end of this run)
