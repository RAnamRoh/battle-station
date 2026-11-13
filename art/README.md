# art/

- `style/`: **versioned art-style bibles** (ADR-0009), for example `style/arcade-cel@1/style.yaml`. Each holds the palette, outline weight, shading bands and AI prompt fragments. A new style is a new folder, so old and new styles can coexist.
- `source/`: curated master art (Git LFS when added).
- `generated/`: accepted AI outputs. Each image has a `*.gen.json` sidecar recording the model, prompt hash, style version and date. `_inbox/` is ignored.
- `provenance/`: licences and third-party asset records.
- `build/` (ignored): packed atlases.

**Never put photos of real people here.** Likeness source photos are personal data and live outside git (ADR-0012).
