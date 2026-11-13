---
paths:
  - "content/**"
  - "packages/content-*/**"
---
# Content rules (ADR-0007)
- Content is YAML authored in `content/`, validated against the Zod schemas, and compiled to JSON packs.
- Keep **gameplay** fields (frame data, hitboxes, damage, speeds) separate from **presentation** fields (art references, names, colours, quotes).
- Changing a gameplay field changes the pack's gameplay hash, which invalidates replays for that pack. Say so in the change proposal.
- Names, quotes and personalities of real coworkers need their approval. No franchise names or move names.
