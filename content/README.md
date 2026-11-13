# content/

Game content as **data** (ADR-0007). Changing a move, a fighter or a stage should never require editing simulation code.

- `core/`: the base pack, with `fighters/`, `moves/`, `stages/`, `rulesets/` and `i18n/`. Authored in YAML.
- `tenants/`: demo and test tenant overlays only. Real tenant config lives in the database.
- `_schemas/` (generated): JSON Schemas for editor autocomplete.
- `migrations/` (later): scripts for content schema changes.

Each pack splits **gameplay** data (frame data, hitboxes) from **presentation** data (art, names, colours).
Replays pin the gameplay hash, so changing the art never breaks old replays.
