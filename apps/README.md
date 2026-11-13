# apps/

Deployable things. Each app is a thin shell over the shared `packages/`. Apps hold no game rules.

| App | Purpose | Status |
|---|---|---|
| `web/` | The game client (Vite + Phaser 4). Runs in the browser and installs as a PWA. The **only** game client. | next change |
| `match/` | Cloudflare Worker + Durable Objects: rooms, WebRTC signalling, relay fallback, server-side replay verification | planned |
| `api/` | Cloudflare Worker: accounts, leaderboards, tenants, D1 access | planned |
| `admin/` | Super-admin and tenant-admin panel | planned |
| `gen/` | AI fighter generation pipeline | planned |
| `replay-renderer/` | Headless page that turns a replay into frames for trailers and visual tests | planned |
| `mobile/` | Capacitor wrapper only (ADR-0010) | later |

Folders are created by the OpenSpec change that needs them, not ahead of time.
