# apps/

Deployable things. Each app is a thin shell over the shared `packages/`. Apps hold no game rules.

| App | Purpose | Status |
|---|---|---|
| `web/` | The game client (Vite + Phaser 4): menus, fights, online lobby. The **only** game client. PWA install comes later. | built |
| `match/` | Cloudflare Worker + one Durable Object per room: room codes, lobby, connection setup, input relay. Serves the built game in production. Replay verification comes later. | built |
| `api/` | Cloudflare Worker: accounts, leaderboards, tenants, D1 access | planned |
| `admin/` | Super-admin and tenant-admin panel | planned |
| `gen/` | AI fighter generation pipeline | planned |
| `replay-renderer/` | Headless page that turns a replay into frames for trailers and visual tests | planned |
| `mobile/` | Capacitor wrapper only (ADR-0010) | later |

Folders are created by the OpenSpec change that needs them, not ahead of time.
