---
status: accepted
date: 2026-11-14
decision-makers: product owner, Claude Code
---

# 0008: DTCG design tokens with Style Dictionary

## Context and Problem Statement

Colours, type and spacing are shared by DOM menus and the Phaser canvas. White-label tenants need their own branding. The design system will change.

## Considered Options

- Hard-coded CSS and constants
- Tailwind theme only
- W3C DTCG tokens built with Style Dictionary or Terrazzo

## Decision Outcome

Chosen: **DTCG 2025.10 token files in `packages/tokens`**, in three tiers: primitive, semantic, component. They are built with Style Dictionary into CSS variables and a typed TS constant for Phaser. Each tenant has a theme file that overrides only the semantic and brand tiers. The tokens package gets semantic versioning.

### Consequences

- Good: one source for every surface, cheap rebrands and per-tenant themes, and a standard format (we can switch to Terrazzo).
- Bad: Style Dictionary does not yet fully support DTCG 2025.10 (planned for v5).

## More Information

https://www.designtokens.org/tr/2025.10/format/ · https://styledictionary.com/info/dtcg/
