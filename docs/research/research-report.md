# Office Fighter: Lead Architect's Research Report

*Research synthesis, 2026-11-14. For discussion only; no code has been written yet.*

All game content will be original. The games named below are only examples of a genre or art era, and none of their characters, names, moves or logos will go into the game.

---

## 1. TL;DR: recommended stack

Underneath everything is one design rule. **The fight is a small, pure TypeScript function:** `step(state, p1Input, p2Input) → state`. It runs 60 times a second, uses integer math, takes its randomness from a seeded generator, and imports no engine. Online play, replays, spectating, highlight clips, CPU opponents, leaderboard anti-cheat and server-side verification all reuse that one function. Every other choice in the stack sits around it.

| Layer | Pick | Why (one line) | Runner-up |
|---|---|---|---|
| Fight simulation | **Our own engine-free TS package** (`packages/sim`) | No maintained, permissively licensed TS fighter core exists, and owning this code is what makes rollback, replays and verification possible | Read the code of `chessunyan/strongest-ai-model-showdown` (MIT, 4 stars) and Ikemen GO (MIT, Go) for ideas only |
| Renderer / input host | **Phaser 4.2.1** (pinned) | Atlases, multitouch, scaling, audio, camera effects and filters are built in, and 28 official agent skills ship inside the npm package | PixiJS v8 plus our own audio and input. Switching is cheap because the sim imports no engine |
| Netcode | **Our own GGPO-style rollback loop** (~600–1000 LOC) over a native `RTCDataChannel` (`ordered:false, maxRetransmits:0`) | Every JS rollback library is dormant (NetplayJS, telegraph) or a toy (rollback-netcode v0.0.6). GGRS is mature but needs Rust/WASM | Vendor or fork NetplayJS for a throwaway spike |
| Rooms / signaling / relay / verification | **Cloudflare Durable Object per room via PartyServer** | A room needs a stateful process for signaling, spectators, a WebSocket relay fallback, and replaying the sim to verify results. Supabase can't host that (2 s CPU cap, pub/sub only) | Raw Durable Objects with WebSocket Hibernation (zero dependencies, since PartyServer is pre-1.0) |
| NAT traversal | **Cloudflare Realtime TURN** (UDP plus TLS on 443) | Office firewalls and mobile CGNAT will break pure P2P. The first 1,000 GB/month is free, so it costs effectively $0 | coturn, self-hosted (for B2B data residency) |
| Hosting | **Cloudflare Workers Static Assets** | Unlimited free bandwidth for large sprite atlases. Client and rooms live in one account | (avoid Vercel/Netlify: bandwidth is metered) |
| Database / storage | **Cloudflare D1** (SQLite) + **R2** | Free at office scale. D1 allows one database per tenant later. R2 has no egress fees | Supabase Postgres as a phase-2 option for the admin back office |
| Auth | **Better Auth on D1** (email OTP first, Microsoft/Google SSO later) | Runs on Workers. Its organization plugin maps to tenants and departments | Supabase Auth, or WorkOS for enterprise SSO in phase 4 |
| Ratings | **Glicko-2 (`glicko2js`)**, shown as friendly leagues | The game is pure 1v1. Department standings are aggregates, not team ratings | OpenSkill, only if real team battles appear |
| Art: sprites | **agent-sprite-forge vs aldegad/sprite-gen bake-off** (image-to-video from one approved master still) | Both are Claude Code skills. Video keeps identity across frames far better than generating each frame separately | Per-pose image generation from a model sheet |
| Art: image/video provider | **fal.ai as the single gateway** (it hosts Nano Banana Pro, GPT Image 2, FLUX Kontext, Kling, Seedance, Wan) | One account, one MCP and one billing relationship, with every model family to bake off | OpenAI or Google direct; ComfyUI self-hosted later |
| Art: VFX | **patch-gg/pixelfx** (244 code-driven effects plus a skill) | Ki blasts, auras, sparks and the combo counter come from code, recolourable per character | Phaser particles plus filters |
| Placeholder fighters | **PixelLab official MCP** | Has punch, kick, uppercut and fireball templates, so engine work starts on day one | Grey boxes |
| Audio | **Kenney CC0** + **ZzFX** now; **ElevenLabs Voice Design** (designed voices, *never* clones) later | Resale-safe from day one | ACE-Step 1.5 (MIT, self-run music) |
| Share cards | **Satori + resvg** OG images | One rich preview works in Slack, Teams, WhatsApp and iMessage with no app install | Takumi |
| Clips | **Re-simulate offscreen → WebCodecs → Mediabunny** MP4, with a **gifenc** fallback | Replays are only a few KB, so clips cost nothing to produce on the server | Server-side ffmpeg later |
| PWA | **vite-plugin-pwa** + **khmyznikov/pwa-install** | Home-screen install is the only way to get chrome-free play on iPhone | (none) |
| Testing | **Vitest** (determinism and SyncTest) + **Playwright** (two contexts, one match) + **Chrome DevTools MCP** | Claude Code can prove netcode correctness headlessly | Playwright MCP |
| Observability | **Sentry (EU)** for crashes, **PostHog Cloud EU** for the share funnel, a **D1 netcode-telemetry row** per match | Shows whether the game spreads and whether the netcode holds | Grafana Faro |
| Payments (later) | **Stripe Billing** (B2B) + **Stripe Managed Payments** (consumer fee, merchant of record) | Verified to support Norwegian businesses and video games. Polar bans face-swap products | Paddle (confirm acceptance first) |

**Estimated MVP running cost: about $5–6/month** (optional Workers Paid at $5 plus a domain). AI image costs are per character and are measured during the bake-off.

---

## 2. Multiplayer architecture

### 2.1 End to end

```
 Player A (phone/laptop)                                   Player B
 ┌───────────────────────────┐                     ┌───────────────────────────┐
 │ Phaser 4 (VIEW ONLY)      │                     │ Phaser 4 (VIEW ONLY)      │
 │  ▲ reads state, plays FX  │                     │  ▲                        │
 │ Rollback loop             │  RTCDataChannel     │ Rollback loop             │
 │  sim.step() @60Hz ◄──────►│◄═══ unordered, ════►│◄──────► sim.step() @60Hz  │
 │  snapshots[10], inputs    │  0 retransmits,     │                           │
 │ Input: touch/kbd/pad      │  last 16 frames     │                           │
 │  → 16-bit bitmask         │  per packet         │                           │
 └──────┬────────────────────┘  (direct, or via    └──────────┬────────────────┘
        │ WebSocket (signaling,  Cloudflare TURN               │
        │ relay fallback,        TLS:443)                      │
        │ result upload)                                       │
        ▼                                                      ▼
 ┌─────────────────────────── Cloudflare (one account) ──────────────────────────┐
 │ Worker (Hono): /r/:code → OG card + app shell   /api/ice → mint TURN creds    │
 │                /api/rooms → short code          /api/auth/* (Better Auth)     │
 │ Room Durable Object (PartyServer), one per match:                             │
 │   lobby/presence → SDP/ICE relay → WS input relay if P2P fails →              │
 │   spectator fan-out (confirmed inputs, ~2s behind) → end-of-match:            │
 │   receive both input logs → REPLAY packages/sim → write verified result       │
 │ D1: tenants, departments, players, characters, matches, ratings, netcode stats│
 │ R2: character packs, replays, desync bundles, (private) photo uploads         │
 │ Static Assets: game client + hashed immutable atlases (free bandwidth)        │
 └───────────────────────────────────────────────────────────────────────────────┘
        ▲
 Spectators / office TV: open /r/AB12?watch → receive confirmed inputs → run sim locally
```

### 2.2 The rollback loop (how it actually works)

1. **Every frame (16.67 ms):** sample the local input as a bitmask, schedule it for `frame + inputDelay`, and send a packet containing the last 16 unacknowledged frames of input. Redundancy means one lost packet costs nothing.
2. **If the remote input for this frame hasn't arrived:** predict it as "same as last frame", step the sim, and save a snapshot. Snapshots go in a ring buffer of 10. Each snapshot is a flat object under 1 KB.
3. **When the real remote input arrives and differs from the prediction:** load the snapshot from that frame and re-run `step()` up to now (at most 8 frames, a trivial cost even on phones). The renderer only ever draws the newest state.
4. **Time sync:** each side reports its frame advantage. The side running ahead waits one frame now and then, as GGPO does. Without this, one player rolls back constantly.
5. **Input delay:** `clamp(ceil((RTT/2)/16.7), 1, 3)` frames, default 2. The rollback window is 8 frames. Ping is shown in the lobby.
6. **Desync detection:** every 30 confirmed frames both peers exchange an FNV hash of the state. A mismatch uploads a bundle (seed, build hash, input log) to R2 and fires a Sentry event, which gives a reproducible bug report.
7. **Effects and audio survive rollback.** The sim emits events such as `hit(frame, player, moveId, seq)`. A `FxDirector` and `SoundDirector` outside the sim deduplicate by that key within the rollback window. If a rollback removes a hit, its sound fades out over about 50 ms. Pitch variation comes from a hash of the key, never `Math.random`. This follows NetherRealm's MK/Injustice approach of keeping effects out of the sim.
8. **Hidden tab or locked phone:** `visibilitychange` sends a pause request. After 10 s the match pauses, and after 20 s more it is a forfeit. On reconnect, the peer with the most confirmed frames sends a snapshot.

**Determinism rules, enforced by lint and CI from commit #1:**
- Positions use integer subpixels (1 px = 256 units).
- Frame data is integers.
- The PRNG is an inlined `sfc32` whose state lives in the snapshot.
- No `Math.random`, `Date`, `performance`, `Math.sin/cos/pow/exp/atan2`, `**`, `/` (use an `idiv()` helper), float literals, `for...in`, or imports of Phaser or the DOM anywhere in `packages/sim/**`.
- A dev-mode assert checks that every numeric state field passes `Number.isInteger`.
- Cross-engine check: Playwright replays the same input log in Chromium and WebKit, because iPhones run JavaScriptCore, not V8.

### 2.3 What makes it "seamless" (link → punching in under 15 s)

1. Player A taps **Fight a coworker** and gets `play.<domain>/r/K7QX`, plus a QR code, Copy and the native Share sheet.
2. Player B opens the link from Slack or Teams, where it shows a rich card with the challenger's portrait. The page opens straight to "**Name + department → Tap to fight**", with no signup and a guest session. The tap also unlocks audio on iOS.
3. Character select is a 15-second timer, which hides connection setup. While it runs, ICE gathering uses Cloudflare STUN, then TURN over UDP, then TURN over TLS on 443. If no DataChannel is up within about 4 s, inputs are relayed through the room's WebSocket instead. Players never see an error; the lobby just shows a small "relayed" icon.
4. Countdown, then FIGHT.
5. After the match: one-tap mutual **Rematch** (3-second countdown), a **Share result** card, and an auto-clipped KO.

Before writing any online code, **run a network test from each office**, using a `/nettest` page or the WebRTC Trickle-ICE sample with Cloudflare TURN credentials. Corporate Wi-Fi is the most likely thing to break, more than distance. Every pairing within Europe is under 35 ms RTT, which is comfortably playable.

### 2.4 Leaderboard trust (resolved)

**The server writes every result from day one.** Both clients upload their input logs and checksums to the room. The Durable Object re-runs `packages/sim` (milliseconds of CPU, well inside its 30 s budget) and writes the verified result to D1. The room already sees the traffic, so this costs almost nothing, and paid self-registration will need it anyway. A disconnect while losing counts as a loss after a timeout.

---

## 3. Fighting mechanics spec (MVP)

### 3.1 Input model

One device-agnostic **16-bit bitmask per frame**: `UP DOWN BACK FORWARD | LIGHT HEAVY KI GUARD CHARGE SUPER`. BACK and FORWARD are relative to the direction the fighter faces. The netcode, replays, the CPU AI and remapping all use this one interface.

| Action | Keyboard (default) | Gamepad | Touch (landscape) |
|---|---|---|---|
| Move / jump / crouch | WASD (+ arrows) | Left stick / D-pad | Floating 8-way stick in the left 40% of the screen, 12–15% dead zone, **digital output** (D-pad mode toggle in settings) |
| Light | J | X | LIGHT |
| Heavy | K | Y | HEAVY |
| Ki (power attack) | L | B | KI |
| Guard | Space (also: hold back) | RB (also: hold back) | GUARD (also: hold back on the stick) |
| Charge ki (hold) | O | LB | CHARGE (its own button, so a Ki tap stays instant) |
| Super | I (or Ki at full meter) | RT | SUPER, greyed out until the meter is full |
| Dash | Double-tap forward or back | same | Flick the stick |
| Throw | Light + Heavy close up | X+Y | LIGHT + HEAVY |

Touch buttons are 64–72 CSS px in an arc on the right. Phaser's `input.activePointers` is set to **4**, because the default of 1 breaks stick-plus-button input. Pointer capture sits on the overlay, not on individual buttons, so a thumb can slide between buttons. Safe-area insets come from `env(safe-area-inset-*)`. Phones are landscape-only, with a "rotate your phone" screen.

**Two control presets:** **Simple** is the default on touch. Mashing LIGHT gives a 3-hit auto-chain, KI plus a direction gives a power attack, and the super works with SUPER or KI at full meter. Simple deals 10% less damage. **Pro** is the default on keyboard and pad, with every command normal and manual routes that clearly out-damage the auto-chain.

**Buffer:** a button press is buffered for **6 frames**. The direction is the one held at any point in the **3 frames** before the press. Touch players get +2 frames on both.

### 3.2 Move list template (identical slots for every character; each character is data plus an atlas)

| Slot | Input | Role (default template) |
|---|---|---|
| 5L | Light | Fast jab, starts the auto-chain |
| 6L | Forward + Light | Advancing poke |
| 4L | Back + Light | Close, safe "get off me" |
| 2L | Down + Light | Low poke (must be blocked low? **No high/low in MVP.** Kept as a short-range fast option) |
| 5H | Heavy | Big mid-range hit, launches |
| 6H | Forward + Heavy | Lunging overhead-style hit; on Guard it breaks guard faster |
| 4H | Back + Heavy | Anti-air |
| 2H | Down + Heavy | Sweep, causes knockdown |
| jL / jH | in the air | Air attacks |
| Ki | Ki (neutral) | **Ki blast** projectile (costs ½ bar) |
| 6Ki | Forward + Ki | **Rush power attack**, a multi-hit dash strike (1 bar) |
| 2Ki | Down + Ki | **Rising power attack**, invulnerable reversal (1 bar) |
| 4Ki | Back + Ki | **Signature power** (beam, counter or command grab, depending on archetype) (1 bar) |
| Super | SUPER at 3 bars | Named super with a cut-in portrait (3 bars) |
| Throw | L+H close | Beats Guard |
| Guard | GUARD / hold back | Blocks everything except throws |
| Charge | hold CHARGE | +1 bar per ~60 frames. You can't act while charging |
| Dash | double-tap | Forward dash or back step |

**Gatling chain:** L → L → L, L → H, H → any Ki power attack, power attack → Super.

**Anti-infinite rules:**
- Damage scaling per hit in a combo: 100 / 90 / 80 / 70 / 60%, with a floor of 30%.
- A juggle point limit of 6.
- Hitstun decays by 1 frame for every 3 hits.

### 3.3 Meter rules

- **Ki meter:** 3 bars of 100 units each. Each round starts with 1 bar.
- **Gain:** +6 for each hit landed, +4 for each hit blocked, **+8 for each hit taken** (a visible comeback mechanic), and +100 per 60 frames of Charge.
- **Costs:** ki blast 50, power attack 100, super 300.
- **Last Stand:** once per round, below 25% HP, the player gets +1 bar and a visible aura. There are no hidden multipliers.
- **Guard gauge:** 100. Blocked hits drain it by the move's guard damage, and it regenerates after 60 frames without blocking. At 0 there is a guard break: 40 frames of stun and a big flash.
- **Chip damage:** melee does 0. Ki attacks do 10% of their damage through block. Chip can't kill.

### 3.4 Frame-data defaults (60 fps; starting tuning table, retune in playtests)

**Resolved hitstop conflict:** this game's light hits sit *between* the generic juice advice and anime-fighter tables. Light hitstop is 6 frames, which keeps mashing snappy on touch. Heavier tiers match the commercial range.

| Tier | Startup | Active | Recovery | Hitstop | Hitstun | Blockstun | On block | Damage | Shake |
|---|---|---|---|---|---|---|---|---|---|
| Light | 5 | 2 | 8 | 6 | 13 | 9 | −1 | 30 | none |
| Heavy | 10 | 3 | 18 | 10 | 20 | 14 | −6 | 70 | small |
| Power attack | 14 | 4–12 | 24 | 13 | 26 | 18 | −10 | 140 | medium + zoom |
| Super | 4 after freeze | multi | 40 | 16 per hit, 24 on the finisher | — | 22 | −15 | 320 | large |
| Throw | 5 | 2 | 22 | 12 | knockdown | — | unblockable | 90 | small |

- Super freeze: 40 frames, with the background dimmed to 30%, a cut-in strip and a voice call-out.
- KO: 45 frames of sim-side slow motion (one sim step every 3 render frames), then a flash, then "K.O.!".
- Hitstop, super freeze and KO slow motion are **integer counters inside the sim**, never engine time scaling. Shake, sparks and flashes are cosmetic and are driven by events.
- Rounds last 60 seconds, best of 3 (first to 2 wins), about 3 minutes per set.

### 3.5 Five stat archetypes (all original; future AI-generated characters must pick one, with capped values)

| Archetype | HP | Walk | Dash | Damage × | Ki gain × | Guard gauge | Signature (4Ki) | One clear weakness |
|---|---|---|---|---|---|---|---|---|
| **All-rounder** | 1000 | 100% | 100% | 1.00 | 1.00 | 100 | Mid-range beam | Nothing stands out |
| **Rushdown** | 900 | 115% | 130% | 0.95 | 1.10 | 90 | Teleport-strike | Low HP, weak at long range |
| **Zoner** | 950 | 90% | 90% | 0.95 | 1.25 | 100 | Fast double ki blast | Poor up close, slow wake-up |
| **Grappler / Tank** | 1150 | 85% | 80% | 1.15 | 0.85 | 130 | Command grab | Slow, easy to zone |
| **Speedster** | 850 | 125% | 140% | 0.85 | 1.00 | 80 | Afterimage counter | Fragile guard and HP |

Office mapping idea: each MVP character comes from a different department. Balance is checked by a headless bot-vs-bot 5×5 matrix in Vitest on every balance change. Matchups outside a 40–60% win rate are flagged, then confirmed by human play.

**Post-MVP mechanics, one at a time behind data flags:** Vanish (a paid combo-breaker, 1 bar), beam clash (a mash duel that works well on touch), dragon-dash, flight.

---

## 4. Fun factor checklist

### MVP (must-have)
- [ ] **Tune feel with one character against a training dummy on a real phone before any netcode.**
- [ ] Hit bundle per tier: hitstop, a spark at the contact point, layered SFX with ±5–10% pitch variation (deterministic hash), a 1–2 frame white flash on the victim, pushback. Trauma-based screen shake (Eiserloh model) on Heavy and above only.
- [ ] Super: freeze, darkened screen, diagonal cut-in with the HD portrait and the super's name, call-out, camera punch-in, shockwave, impact frame.
- [ ] KO: slow motion, flash, "K.O.!", zoom on the loser, winner pose and quote.
- [ ] HUD: lifebars with a damage-lag red segment and smooth drain, a centred timer, segmented ki meter with a flashing MAX, combo counter with damage, round and FIGHT banners.
- [ ] Simple and Pro presets. Visible comeback via meter from damage taken and Last Stand, with no hidden multipliers.
- [ ] One-tap rematch. Character select to fight in under 15 s. 60-second rounds.
- [ ] Personality: an intro line, taunt, victory quote, named super and portrait set for each character, moderated by an admin.
- [ ] Training room: input display, hitbox overlay, Fantasy-Strike-style frame advantage (+3 / −6 pop-ups), dummy block modes, one record/playback slot, reset.
- [ ] Short touch-first tutorial (skippable) built from event-checked lessons.
- [ ] CPU opponent: a utility AI with Easy, Normal and Hard set by reaction delay (30/18/10 frames) and mistake rate, plus 3 personalities. Arcade ladder of 4–5 fights.
- [ ] Accessibility: shake slider from 0 to 100%, reduce-flashing mode (at most 3 flashes per second), separate volume sliders, left-handed touch layout, mute-by-default option for the office.

### Later
- Vanish, beam clash, dash or flight; stage "permanence" (cracks after supers); a breakable or reactive crowd.
- Ghost challenges: fight a coworker's AI copy, built offline by kNN over their own match logs, opt-in.
- Seeded daily challenge; lunchtime brackets (brackets-manager.js); monthly seasons; Department War weighted by participation; a "most improved" award (and **never** a "worst player" list).
- Alt colour palettes in department colours; an announcer voice pack; optional "Arcade CRT" filter (a port of the public-domain crt-lottes, off on phones).

### Don't
- Shake on every light hit, play sound from sim code, make supers unskippable after first viewing, use random damage or crits, allow unbreakable infinites, or allow free-text chat. Use a fixed, rate-limited emote set instead.

---

## 5. Art pipeline

### 5.1 Target look (resolved): **painted HD**, not pixel art
- Fixed **960×540 logical canvas** (Scale.FIT), with fighters **220–240 px tall**. AI likenesses survive much better when painted than at 128 px of pixel art. An optional pixel/"hibit" finish can be tried on one character during the bake-off.
- The early-90s arcade comic look is **baked into the assets, not added by shaders**: bold ink outlines, 2–3 hard cel tones, an offline palette lock per character.
- **Style guide prompt fragments** go into every prompt:
  - era: original early-1990s arcade beat-'em-up / American comic hybrid, hand-inked, cel-shaded
  - a 3 px black outer contour
  - one key light from the upper-left, warm key and cool shadow
  - about 16 colours per fighter
  - near-orthographic side view, flat chroma background
- **Banned-terms list:** no franchise, studio or game names, ever.

### 5.2 Step by step (MVP characters, run by Claude, approved by you)

1. **Consent form** signed by the employee, plus 3–5 photos.
2. **Master still:** a likeness edit through fal (Nano Banana Pro vs GPT Image 2, in a bake-off on one consenting employee), using the style-guide prompt and a full-body side view on chroma. **You approve it.** This image becomes the single source of identity for the character.
3. **HD portrait set:** select card, super cut-in and victory pose. These carry the real likeness and are the most shareable art.
4. **Per-move image-to-video clips** from the master still, using **agent-sprite-forge** (or sprite-gen if it wins the bake-off). Video models via fal: Kling v3/4.0, Seedance 2.x and Wan 3.0, chosen per move after testing. Each take is automatically checked for identity, feet, zoom and background, with up to 3 retakes.
5. **Deterministic cleanup** by the skill's scripts: chroma key (with rembg/BiRefNet as fallback), register to a shared foot anchor, pick loops, retime one-shots, colour-lock, finish, validate.
6. **Contact-sheet review** by you, about 5 minutes per move. Touch up the occasional frame in LibreSprite or Aseprite.
7. **Frame data and hitboxes are authored in our own in-game debug editor**, which Claude builds; no maintained open-source tool does this well. Animation maps sim frames to images (one image can be held for several frames). Hitboxes are **never derived from pixels**, and the frame data is locked *before* the art.
8. **Pack** into WebP atlases of at most 2048 px per page (the skill's own Phaser export, with free-tex-packer-core only for a final combined atlas). Per-character lazy loading.
9. **VFX** come from code via **pixelfx**: auras, beams, sparks, KO flash and combo counter, recoloured per character.
10. **Placeholders** during engine work: PixelLab MCP fighters, so netcode and feel work never wait on art.

### 5.3 Frame budget per character (the arcade way: few, strong key poses)

| Animation | Frames | Animation | Frames |
|---|---|---|---|
| Idle (loop) | 6 | Normals ×10 (startup / active-hold / recovery) | 3–4 each ≈ 36 |
| Walk fwd/back | 6 + 6 | Ki blast / 3 power attacks | 4 + 3×5 = 19 |
| Dash / backstep | 3 + 3 | Super (character part; beam is VFX) | 6 |
| Jump (up/fall) | 4 | Throw (attacker + victim) | 4 + 3 |
| Crouch | 2 | Charge (loop) | 4 |
| Guard (stand/air) | 2 | Hitstun (light/heavy) / knockdown / get-up | 2 + 2 + 4 + 3 |
| Intro / win / lose / taunt | 4 + 4 + 2 + 3 | **Total** | **≈ 130 images**, generated as ~18 video clips |

With painted art at 240 px, that is about 2 atlas pages of 2048² per character. Expect roughly 15–25 image calls plus 18 clips plus retakes. **Measure the real cost on character #1 before pricing registration.**

### 5.4 Stage (1 for MVP)
Use agent-sprite-forge's **generate2dmap**. Paint one master stage first, then generate 4–5 layers against it:
- repeating sky (scroll 0–0.1)
- repeating far silhouette (0.2–0.3)
- mid plate with an animated crowd loop of 4–8 frames (0.5–0.7)
- floor (1.0)
- an optional sparse foreground (1.1–1.3)

`validate_parallax.py` checks every camera corner at 16:9 and 19.5:9. The stage is 1.6–2 screens wide, and the floor line sits at 82–86% of screen height. An office-themed stage with a cheering crowd of real coworkers (opt-in) is the shareable choice.

### 5.5 Automated pipeline for self-registration (phase 3)
`upload + consent + work-email verification → moderation (OpenAI omni-moderation: sexual and self-harm scores; human review for minors and impersonation) → master still → **admin approval** → archetype selection (fixed timings and hitboxes, so only the appearance is new) → clips → cleanup → contact-sheet **admin approval** → pack → publish`.

This runs as a durable **Trigger.dev** workflow with fal webhooks; Edge-style functions time out. A provider-abstraction interface (modelled on `route_media.py`) and **model versions pinned per character** keep regenerated moves consistent. ComfyUI with comfyui-mcp and Qwen-Image-Edit/Wan is held in reserve for cost, provider policy or data residency. Raw photos are deleted once the sprites are approved.

---

## 6. Shareability plan (ranked by impact ÷ effort)

| # | Feature | Impact | Effort | Phase |
|---|---|---|---|---|
| 1 | **Invite link + room code + QR + native share**; guest play with no signup | ★★★★★ | S | MVP |
| 2 | **OG share cards** (Satori + resvg, 1200×630) for room, result, character and leaderboard pages | ★★★★★ | S | MVP |
| 3 | **One-tap rematch + post-match result card** drawn on the game canvas (`canvas.toBlob` → `navigator.share`) | ★★★★ | S | MVP |
| 4 | **Spectate link** (`?watch`, confirmed inputs, never rolls back), good on the office TV | ★★★★ | S–M | MVP |
| 5 | **Replay links** (fflate input log, a few KB, pinned to build and content hashes) | ★★★★ | M | MVP |
| 6 | **PWA install** (vite-plugin-pwa + pwa-install sheet) | ★★★ | S | MVP |
| 7 | **Share-funnel analytics** (PostHog EU: link open → first punch → rematch → share), tagged per share source | ★★★ (proves the B2B pitch) | S | MVP |
| 8 | **Auto KO and super clips** (re-sim → WebCodecs → Mediabunny MP4, WebM or gifenc fallback, ~6 s at 480p, in a worker) | ★★★★★ | L | Office launch |
| 9 | **Slack or Teams webhook posts** (results, weekly Department War standings) behind one "post event" adapter. Use Teams *Workflows* webhooks, because the old O365 connectors died in May 2026 | ★★★★ | S–M | Office launch |
| 10 | **`/fight @colleague` bot** with Join and Rematch buttons (Bolt JS / Teams SDK) | ★★★★ | M | Office launch |
| 11 | Character "super move cards" auto-generated for each new fighter | ★★★ | S | Office launch |
| 12 | Brackets page (brackets-manager + viewer) | ★★★ | M | Office launch |
| 13 | Teams tab or meeting-stage spectator; Slack Work Objects unfurls behind SSO | ★★ | M–L | B2B |
| 14 | Inter-office challenges + "put your office in the ring" footer on public cards | ★★★★ (B2B loop) | M | B2B |
| 15 | Discord Activity build | ★★ | M | Later |

**Defaults:**
- Public share pages use long unguessable IDs and contain no personal data in URLs.
- **Likenesses are not shown publicly by default.** A tenant toggle allows public sharing, and individual employees opt in.

---

## 7. Platform & business roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Engine (weeks 1–4)** | Sim package, determinism CI, one placeholder fighter against a dummy, touch controls, feel tuning; then local 2P; then rollback over a fake lossy transport in one tab | Feels great on a mid-range phone; SyncTest is green |
| **1. Online MVP (weeks 5–9)** | Room Durable Object, TURN, invite links, spectate, replays, server-verified results, 5 characters, 1 stage, CPU ladder, training mode, OG cards, PWA, Sentry + PostHog | 20 coworkers play 100 matches; under 1 desync per 500 matches; relay rate measured |
| **2. Office launch** | Better Auth (company SSO if available), departments, leaderboards (department wins, best per department, best overall, Glicko-2 leagues, seasons), consent records, delete-my-character flow, "AI-generated likeness" badge, clips, Slack/Teams posts, admin panel (react-admin over our Hono API), admin-triggered character generation | Weekly active players across departments |
| **3. Self-registration** | Paid flow (Stripe Managed Payments), automated generation with human approval, moderation, archetype caps | Measured per-character cost < fee; merchant-of-record eligibility approved |
| **4. B2B white-label** | Tenants resolved by hostname, one D1 database per tenant, R2 prefix per tenant, theme JSON plus stage and fighter packs, WorkOS SSO and SCIM department mapping, Stripe Billing per seat or slot, per-tenant chat config, story mode | First paying external office |

Multi-tenancy hooks go in **from day one**, even with one tenant: a `tenant_id` on every row, rooms namespaced as `tenant:room`, and branding, rosters and stages stored as data.

### Legal & privacy must-dos (the research assumed Norway/EU: **please confirm your country**)
1. **Written likeness consent** for every employee, with a working withdrawal that hard-deletes photos, sprites and voice, and anonymises the character in match history. Participation is optional, with a non-likeness avatar as an equal alternative, because EU and Nordic regulators doubt that consent is freely given at work. Keep it separate from HR.
2. **GDPR:** photos are personal data. Don't build face-recognition embeddings, which would make them Article 9 biometric data. Sign DPAs with Cloudflare, fal (and whichever model provider), Sentry and PostHog. A DPIA is advisable. Use EU regions. Raw photos go in a private R2 bucket and are purged once sprites are approved.
3. **Norway, åndsverkloven § 104** (right to one's own image) covers photographs. Its reach to stylised derivatives is unclear, but consent covers it either way.
4. **fal AUP:** likeness use requires the depicted person's consent. Self-registration must verify that the uploader is the person shown (work email plus human review).
5. **EU AI Act Art. 50** deepfake disclosure has applied in the EU since 2026-08-02. Per secondary sources it is not yet in the EEA Agreement, so it doesn't yet bind a Norway-only deployment. Add an "AI-generated likeness / voices" badge and credits anyway; it costs almost nothing.
6. **No voice cloning** until there is a written consent flow and a legal review (BIPA, California AB 2602 and others if you ever have US tenants). Use designed voices.
7. **VAT:** a Norwegian seller registers for ordinary MVA above NOK 50k. Selling to EU consumers triggers non-Union OSS from the first euro, so a merchant of record (Stripe Managed Payments) is worth its extra ~3.5%. Apply early, describing the product accurately as "consented self-likeness in a game"; rejection is the likeliest blocker for the self-registration model.
8. **Franchise IP:** never use franchise, studio or game names in marketing, prompts or banners; never copy signature moves; never train on ripped sprites.
9. **One short review by a Norwegian lawyer before taking any money.**

---

## 8. Tools, skills and MCPs for Claude Code

```bash
# 1. Scaffold (official template; bump Phaser after cloning, template predates 4.2.1)
git clone https://github.com/phaserjs/template-vite-ts office-fighter && cd office-fighter
npm i phaser@4.2.1
npm i -D vitest @playwright/test wrangler@^4.135 @cloudflare/vitest-plugin
npx playwright install chromium webkit
npm i partyserver partysocket hono better-auth fflate nanoid qr-code-styling glicko2js
npm i -D vite-plugin-pwa satori @resvg/resvg-js sharp free-tex-packer-core

# 2. Official Phaser 4 skills: they ship INSIDE the npm package, so copy them (sidesteps the CLI question)
mkdir -p .claude/skills
for s in animations sprites-and-images input-keyboard-mouse-touch scale-and-responsive scenes \
         loading-assets cameras particles filters-and-postfx audio-and-sound text-and-bitmaptext \
         v4-new-features v3-to-v4-migration; do cp -R node_modules/phaser/skills/$s .claude/skills/; done
#   (alternative: npx skills add phaserjs/phaser --skill <name> -a claude-code)

# 3. Selected general game-dev skills only (skip the 79-skill router)
git clone --depth 1 https://github.com/gamedev-skills/awesome-gamedev-agent-skills /tmp/gds
cp -R /tmp/gds/skills/disciplines/{game-feel,input-systems,game-ai,create-game-assets} .claude/skills/
#   NOTE: override game-feel's time-scaled hitstop in CLAUDE.md (hitstop lives in the sim)

# 4. First-party testing skill (base for our e2e skill)
npx skills add anthropics/skills --skill webapp-testing -a claude-code

# 5. Cloudflare skills (Durable Objects, wrangler, best practices); repo ships a .claude-plugin manifest
/plugin marketplace add cloudflare/skills
#   Cloudflare MCP (logs/observability): add per github.com/cloudflare/mcp-server-cloudflare README,
#   with a token scoped to dev/staging ONLY

# 6. Art: sprite + stage + VFX skills
/plugin marketplace add 0x0funky/agent-sprite-forge
git clone --depth 1 https://github.com/aldegad/sprite-gen   /tmp/sprite-gen   # bake-off contender
git clone --depth 1 https://github.com/patch-gg/pixelfx      /tmp/pixelfx      # copy its skill folder
claude mcp add --transport http fal https://mcp.fal.ai/mcp-relay              # single image/video gateway
#   PixelLab MCP (placeholders): configure per https://api.pixellab.ai/mcp/docs

# 7. Audio (phase 2)
npx skills add elevenlabs/skills      # do NOT install the archived local elevenlabs-mcp

# 8. Already present in this environment: Chrome DevTools MCP (visual checks, CPU-throttled phone profiling)
```

**Project-local skills Claude will write:** `fighting-sim` (move schema, frame data, hit resolution), `netcode-determinism` (lint rules, SyncTest, the event-deduplication pattern), `sprite-pipeline` (style-guide fragments, banned terms, the bake-off winner's flow).

**CLAUDE.md test loop:** typecheck → Vitest (determinism, SyncTest rolling back 1–8 frames every tick, serialize round-trip, bot fuzzing, frame-data table, 5×5 bot balance matrix) → Playwright (two contexts in one room with injected latency → matching checksums at frame 600; a `hasTouch` mobile smoke test; Chromium-vs-WebKit replay) → DevTools visual and performance check.

The game exposes a test seam on `window.__GAME__` (`getState`, `advanceFrames`, `pushInput`). Netcode tests use Phaser's HEADLESS or Canvas renderer, because CI has no GPU.

**Read every SKILL.md before installing. Pin versions.** Skills and MCPs are prompt-injection and supply-chain surfaces.

---

## 9. Master resource list (verified items only)

### Netcode & rollback
- **GGPO** — https://github.com/pond3r/ggpo — MIT — The canonical rollback design; copy its loop, time sync and SyncTest.
- **GGRS** — https://github.com/gschup/ggrs — MIT/Apache-2.0 — Modern Rust GGPO; reference for its session and SyncTest design.
- **extreme_bevy** — https://github.com/johanhelsing/extreme_bevy — CC0 — The clearest end-to-end browser rollback tutorial.
- **NetplayJS** — https://github.com/rameshvarun/netplayjs — ISC — TS rollback over WebRTC; dormant since 2024, read only.
- **rollback-netcode** — https://github.com/someusername6/rollback-netcode — MIT — Good TS API shape and desync hashing; v0.0.6, read only.
- **Infil netcode explainer** — https://words.infil.net/w02-netcode.html — article — Required reading on delay vs rollback.
- **8 Frames in 16ms (NetherRealm, GDC 2018)** — https://gdcvault.com/play/1025471/8-Frames-in-16ms-Rollback — talk — How effects and audio survive rollback.
- **RTCDataChannel** — https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel — web standard — The transport.
- **Cloudflare Realtime TURN** — https://developers.cloudflare.com/realtime/turn/ — service — 1,000 GB/month free, TLS on 443.
- **coturn** — https://github.com/coturn/coturn — BSD-style — Self-hosted TURN for B2B data residency.
- **WebRTC Trickle ICE sample** — https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ — BSD-3 — Zero-code office network test.
- **bevy_roll_safe audio** — https://docs.rs/crate/bevy_roll_safe/0.7.0/source/src/audio.rs — MIT/Apache — Rollback-safe sound deduplication to port.

### Backend & hosting
- **PartyServer (cloudflare/partykit)** — https://github.com/cloudflare/partykit — ISC — Room Durable Objects plus partysocket.
- **Durable Objects (WebSockets)** — https://developers.cloudflare.com/durable-objects/best-practices/websockets/ — service — Hibernation API.
- **Workers Static Assets** — https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ — service — Free, unlimited asset bandwidth.
- **Worker Previews** — https://developers.cloudflare.com/workers/previews/ — service — A playable build per PR with its own Durable Object namespace.
- **cloudflare/workers-sdk** — https://github.com/cloudflare/workers-sdk — Apache-2.0 — wrangler, miniflare, vitest plugin.
- **wrangler-action** — https://github.com/cloudflare/wrangler-action — Apache-2.0 — CI deploys.
- **Better Auth** — https://github.com/better-auth/better-auth — MIT — Auth on Workers and D1, with org and SSO plugins.
- **Supabase** — https://github.com/supabase/supabase — Apache-2.0 — Phase-2 option for the admin back office.
- **glicko2js** — https://github.com/mmai/glicko2js — MIT — Ratings.
- **openskill.js** — https://github.com/philihp/openskill.js — MIT — Only if team battles appear.
- **Sentry JS** — https://github.com/getsentry/sentry-javascript — MIT — Crashes (EU region).
- **PostHog JS** — https://github.com/PostHog/posthog-js — MIT — Share funnel and feature flags.

### Engine, input & mobile
- **Phaser 4** — https://github.com/phaserjs/phaser — MIT — Renderer and input host; skills in `/skills`.
- **phaserjs/template-vite-ts** — https://github.com/phaserjs/template-vite-ts — MIT — Scaffold.
- **PixiJS v8** — https://github.com/pixijs/pixijs — MIT — Fallback renderer.
- **pixijs-skills** — https://github.com/pixijs/pixijs-skills — MIT — Agent plugin if we switch to Pixi.
- **rex plugins (Phaser 4 build)** — https://github.com/rexrainbow/phaser3-rex-notes — MIT — Fallback joystick and buttons.
- **nipplejs** — https://github.com/yoannmoinet/nipplejs — MIT — Fallback DOM joystick (dynamic mode only for multitouch).
- **MDN mobile touch** — https://developer.mozilla.org/en-US/docs/Games/Techniques/Control_mechanisms/Mobile_touch — docs — Basis for the hand-rolled input layer.
- **iOS PWA notes (firt.dev)** — https://firt.dev/notes/pwa-ios/ — article — The iPhone capability truth table.
- **pwa-install** — https://github.com/khmyznikov/pwa-install — MIT — Install sheet.
- **vite-plugin-pwa** — https://github.com/vite-pwa/vite-plugin-pwa — MIT — PWA.
- **unmute** — https://github.com/swevans/unmute — MIT — iOS silent-switch fallback.

### Fighting-game design
- **Infil's glossary** — https://glossary.infil.net/ — website — Shared vocabulary.
- **Infil's KI guide** — https://ki.infil.net/basics2.html — website — Systems primer.
- **M. Paul Weeks, "How to Design a Fighting Game"** — https://docs.google.com/presentation/d/1RwvkLXTgdlhFkg6llKDseYNbLZC-uXyR4bQNxRIvrFc/htmlpresent — public deck — Checklist from a shipped browser rollback fighter.
- **CritPoints, Hitstun in Depth** — https://critpoints.net/2016/08/14/stunning-detail/ — blog — Hit resolution theory.
- **CritPoints, Auto Combos** — https://critpoints.net/2023/05/04/whats-the-deal-with-auto-combos — blog — The case against auto-combos as a crutch.
- **CritPoints, Beginners** — https://critpoints.net/2018/03/17/how-to-cater-to-fighting-game-beginners/ — blog — Branchable auto-chains.
- **Sirlin, Showing Frame Advantage** — https://www.sirlin.net/posts/a-fighting-game-first-showing-frame-advantage — article — Training-mode feedback.
- **DeLucas, Asymmetrical balance via frame data** — https://www.gamedeveloper.com/design/theory-aiding-asymmetrical-balance-with-frame-data — article — Lock frame data before art.
- **Dustloop Attack Attributes** — https://dustloop.com/w/GGACR/Attack_Attributes — CC BY-SA — Tuning tables.
- **Ikemen GO** — https://github.com/ikemen-engine/Ikemen-GO — MIT (code) — Move, lifebar and stage data schemas to model ours on (no assets).
- **Photon Quantum fighter docs** — https://doc.photonengine.com/quantum/v2/game-samples/fighting/fighter-system — docs — Deterministic hit-order pattern.
- **Killer Instinct Shadow AI** — https://gamedeveloper.com/programming/the-killer-groove-the-shadow-ai-of-killer-instinct — article — Ghost AI blueprint.
- **DareFightingICE** — https://github.com/TeamFightingICE/FightingICE — no license — Delayed-perception bot pattern, read only.
- **strongest-ai-model-showdown** — https://github.com/chessunyan/strongest-ai-model-showdown — MIT (code only) — The closest TS analog (rollback, AI, touch).
- **bryc PRNGs** — https://github.com/bryc/code/blob/master/jshash/PRNGs.md — public domain/MIT — sfc32 and mulberry32.
- **pure-rand** — https://github.com/dubzzz/pure-rand — MIT — PRNG package alternative.
- **mistreevous** — https://github.com/nikkorn/mistreevous — MIT — Behaviour trees for later story bosses.

### Game feel, audio & UI
- **awesome-gamedev-agent-skills** — https://github.com/gamedev-skills/awesome-gamedev-agent-skills — Apache-2.0 — game-feel, input and AI skills.
- **Sakurai on Creating Games** — https://www.youtube.com/@sora_sakurai_en — video — Hitstop and hit effects.
- **Juicing Your Cameras (Eiserloh, GDC 2016)** — https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing — talk — Trauma-based shake.
- **ZzFX** — https://github.com/KilledByAPixel/ZzFX — MIT — Placeholder sound effects as code.
- **Kenney Impact Sounds** — https://kenney.nl/assets/impact-sounds — CC0 — Hit sounds.
- **Kenney Fighter voiceover** — https://kenney.nl/assets/voiceover-pack-fighter — CC0 — Day-one announcer.
- **Kenney Music Jingles** — https://kenney.nl/assets/music-jingles — CC0 — Stingers.
- **ElevenLabs skills** — https://github.com/elevenlabs/skills — MIT — TTS, sound effects, music generation.
- **Eleven Music terms** — https://elevenlabs.io/music-terms — terms — Indie Game limits; no reusable library for tenants.
- **ACE-Step 1.5** — https://github.com/ace-step/ACE-Step-1.5 — MIT — Self-run music fallback.
- **Kokoro-82M** — https://huggingface.co/hexgrad/Kokoro-82M — Apache-2.0 — Free TTS lines.
- **audiosprite** — https://github.com/tonistiigi/audiosprite — MIT — Audio sprite packing.
- **brackets-manager.js** — https://github.com/Drarig29/brackets-manager.js — MIT — Tournaments.
- **Google Fonts: Bangers / Anton / Teko / Barlow Condensed / Bowlby One SC** — https://github.com/google/fonts — OFL-1.1 — Arcade typography that is safe for white-label.
- **SnowB BMF** — https://github.com/SilenceLeo/snowb-bmf — MIT — Baked outlined bitmap fonts.
- **libretro glsl-shaders (crt-lottes)** — https://github.com/libretro/glsl-shaders — public domain (crt-lottes only) — Optional CRT mode.
- **Fabien Sanglard CPS-1 graphics** — https://fabiensanglard.net/cps1_gfx/index.html — article — Era-accurate layer anatomy.

### Art pipeline
- **agent-sprite-forge** — https://github.com/0x0funky/agent-sprite-forge — MIT — Master still → video → finished frames; generate2dmap for stages.
- **aldegad/sprite-gen** — https://github.com/aldegad/sprite-gen — Apache-2.0 — Bake-off contender: Phaser export, recolour, curation UI.
- **patch-gg/pixelfx** — https://github.com/patch-gg/pixelfx — MIT — 244 code-driven effects.
- **fal.ai models** — https://fal.ai/models — commercial — Image and video gateway.
- **fal MCP docs** — https://fal.ai/docs/documentation/setting-up/mcp — docs — mcp-relay endpoint.
- **fal AUP** — https://fal.ai/legal/acceptable-use-policy — terms — Likeness consent clauses.
- **OpenAI image generation** — https://developers.openai.com/api/docs/guides/image-generation — commercial — GPT Image.
- **PixelLab MCP** — https://api.pixellab.ai/mcp/docs — commercial — Placeholder fighters with move templates.
- **rembg** — https://github.com/danielgatis/rembg — MIT — Background removal.
- **BiRefNet** — https://github.com/ZhengPeng7/BiRefNet — MIT — Hair and aura mattes.
- **free-tex-packer-core** — https://github.com/odrick/free-tex-packer-core — MIT — Atlas packing.
- **sharp** — https://github.com/lovell/sharp — Apache-2.0 — Image processing.
- **LibreSprite** — https://github.com/LibreSprite/LibreSprite — GPL-2.0 — Free frame touch-up.
- **comfyui-mcp** — https://github.com/artokun/comfyui-mcp — MIT — Self-hosted fallback (24 GB GPU).
- **Qwen-Image-Layered** — https://github.com/QwenLM/Qwen-Image-Layered — Apache-2.0 — Stage layer decomposition fallback.

### Shareability
- **Satori** — https://github.com/vercel/satori — MPL-2.0 — OG cards.
- **Mediabunny** — https://github.com/Vanilagy/mediabunny — MPL-2.0 — Client-side MP4 muxing.
- **gifenc** — https://github.com/mattdesl/gifenc — MIT — GIF fallback (finished; pin it).
- **qr-code-styling** — https://github.com/kozakdenys/qr-code-styling — MIT — Branded QR codes.
- **nanoid** — https://github.com/ai/nanoid — MIT — Room codes and share IDs.
- **fflate** — https://github.com/101arrowz/fflate — MIT — Replay compression.
- **Slack Bolt JS** — https://github.com/slackapi/bolt-js — MIT — `/fight` bot.
- **Teams SDK** — https://github.com/microsoft/teams-sdk — MIT — Teams bot.
- **Teams connector retirement** — https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/ — article — Use Workflows webhooks instead.
- **Web Share files** — https://web.dev/articles/files/share-files — docs — Sharing clips from phones.

### Tooling & testing
- **Playwright** — https://github.com/microsoft/playwright — Apache-2.0 — Two-context online tests.
- **Vitest** — https://github.com/vitest-dev/vitest — MIT — Determinism suite.
- **Chrome DevTools MCP** — https://github.com/ChromeDevTools/chrome-devtools-mcp — Apache-2.0 — Visual and performance checks.
- **vercel-labs/skills** — https://github.com/vercel-labs/skills — MIT — `npx skills` installer.
- **anthropics/skills (webapp-testing)** — https://github.com/anthropics/skills — per-skill Apache-2.0 — Base for e2e testing.
- **cloudflare/skills** — https://github.com/cloudflare/skills — Apache-2.0 — Durable Object and wrangler guidance.
- **cloudflare/mcp-server-cloudflare** — https://github.com/cloudflare/mcp-server-cloudflare — Apache-2.0 — Logs and observability.

### Platform (later phases)
- **Trigger.dev** — https://github.com/triggerdotdev/trigger.dev — Apache-2.0 — Durable generation workflow.
- **react-admin** — https://github.com/marmelab/react-admin — MIT — Super-admin panel.
- **Stripe Node** — https://github.com/stripe/stripe-node — MIT — Billing.
- **Stripe Managed Payments** — https://docs.stripe.com/payments/managed-payments — commercial — Merchant of record for consumer fees.
- **OpenAI moderation** — https://developers.openai.com/api/docs/guides/moderation — free API — First-pass image filter (sexual and self-harm only).
- **WorkOS** — https://workos.com/ — commercial — Enterprise SSO and SCIM (phase 4).
- **Norwegian åndsverkloven § 104** — https://lovdata.no/lov/2018-06-15-40/§104 — law — Right to one's own image.

**Avoid:** simple-peer, Rune, Hathora (shut down 2026), Playroom, PocketBase (archived), Polar (bans face-swap), Lemon Squeezy, Udio, MusicGen and F5-TTS weights (non-commercial), Chatterbox (retired), the archived local elevenlabs-mcp, LayerDiffuse, AnimatedDrawings (archived), gif.js, mk.js, Yuka, Godot web export, and GPL code such as Footsies and attacke (read only, never copy).

---

## 10. Risks & hard truths

1. **Sprite consistency is the hardest problem in the whole product, not the netcode.** AI video drifts on fast limbs, hands and props. Expect retakes and a human contact-sheet review for every move of every character. "Fully automated self-registration" may never reach arcade quality without a reviewer. That is why archetypes, admin approval and per-character model pinning matter.
2. **Rollback is unforgiving.** One `Math.random`, one float, or one Phaser tween driving gameplay causes silent desyncs that show up only between iPhone and Android. The lint rules, SyncTest and cross-engine replay test are **non-negotiable from day one**. We will own all of this code; there is no library to blame.
3. **Office networks may block P2P.** TURN over TLS on 443 plus the WebSocket relay will probably work, but TCP paths bring back head-of-line stalls and more visible rollbacks. A TLS-inspecting proxy can break TURNS entirely. **Test from the real office before building online play.**
4. **Phones:**
   - iPhone Safari has no fullscreen, no orientation lock, no haptics and no vibration. Audio is locked until a tap and is muted by the silent switch unless the experimental `audioSession` workaround works.
   - Backgrounding pauses the game.
   - Touch players will lose to keyboard players. Tag the input device on leaderboards.
   - Mid-range Android can stutter with full-screen filters or large atlases, so keep a texture budget (pages ≤ 2048, roughly 100–150 MB resident) and keep filters off by default.
5. **Touch precision vs direction+button commands.** Forward+Light vs neutral Light on a virtual stick is error-prone. Mitigations are generous buffers, direction lookback, the Simple preset and real-phone testing in week 1.
6. **Fun is not guaranteed by mechanics.** The Budokai-style formula has been criticised as one-note, and auto-combos can become a crutch. Personality (coworker likenesses, quotes, supers) and social loops will drive play more than depth. Playtest early.
7. **Phaser 4 is young and has been quiet since 2026-08,** and LLMs mostly know Phaser 3. Mitigations: the official v4 skills, a pinned version, and an engine-free sim so a switch to Pixi takes days, not weeks.
8. **Dependency maturity:** PartyServer is pre-1.0, Worker Previews are new, gifenc is finished but unmaintained, and AI model names change every few months. Keep wrappers thin and pin everything.
9. **Legal and consent:** coworkers may feel pressured to take part, someone may upload a photo of their boss, and merchant-of-record providers screen "AI likeness" products hard. A Stripe rejection would stall the paid self-registration plan.
10. **Cost is unknown until measured.** Per-character AI cost (about 15–25 images plus 18 clips plus retakes) must be measured on character #1 before you set a registration fee.
11. **Balance across AI-generated rosters:** without fixed archetype templates and capped stats, paid registrations could break competitive leaderboards.
12. **Replays break across patches** unless every replay pins the build and content hashes and old sim versions stay loadable. Keep the MP4 for notable matches.

---

## 11. Decisions you need to make before coding (with my recommended default)

1. **Which country is the company in (and future customers)?** *Default: Norway/EU, which the research assumed. It changes the legal and VAT sections if wrong.*
2. **Real coworker likenesses in the MVP, or original fighters first?** *Default: real coworkers who volunteer, with signed consent forms, plus an original-avatar option. This is the core hook.*
3. **Painted HD (~240 px) or pixel-art (~128 px) look?** *Default: painted HD at a 960×540 base, because likenesses survive. We'll try pixel on one character in the bake-off.*
4. **Cloudflare-only backend for the MVP (Workers + Durable Objects + D1 + R2 + TURN)?** *Default: yes. Supabase stays a phase-2 option. Do you have, or can you put, a domain on Cloudflare DNS?*
5. **Can we run a 10-minute network test from the office (Wi-Fi type, VPN, TLS proxy)?** *Default: yes, in week 1, before any online code.*
6. **Login:** company SSO (Microsoft 365 or Google) or email codes? *Default: guest play from links for casual matches, email OTP for leaderboard credit, SSO at office launch.*
7. **Which chat tool does the office use (Slack, Teams, Google Chat)?** *Default: whichever you use gets the first webhook and bot.*
8. **Is the game on the public internet or behind VPN/SSO?** *Default: public, with unguessable share links and likenesses hidden from public cards unless opted in.*
9. **Controls:** OK with the 6-button scheme (Light, Heavy, Ki, Guard, Charge, Super), Simple preset on touch, landscape-only phones? *Default: yes.*
10. **Movement:** flat ground plane with jumps, or flight and air dashes? *Default: ground plus jumps for the MVP; flight later.*
11. **Do CPU and arcade wins count toward department leaderboards?** *Default: no. Department boards count online PvP only; solo boards are separate.*
12. **Ranking for "best player":** win count, win rate, or skill rating with seasons? *Default: Glicko-2 shown as leagues, monthly seasons, plus a "most wins" board for fun.*
13. **Budget:** OK with about $5/month hosting plus pay-per-use AI generation (a fal.ai account), and later about $22–99/month for ElevenLabs? *Default: yes to fal now, ElevenLabs only once audio becomes the bottleneck. MVP audio is Kenney CC0 and ZzFX.*
14. **Who do we use for the art bake-off?** *Default: 1–2 consenting coworkers, 3 moves each (idle, forward+light, super) through agent-sprite-forge and sprite-gen.*
15. **Will you review each move's contact sheet (about 5 minutes per move)?** *Default: yes. It is the real quality gate.*
16. **First stage theme?** *Default: an office rooftop at sunset with an opt-in cheering crowd of coworkers.*
17. **Voices:** AI-designed voices that each person picks, or real cloned voices? *Default: designed voices only. No cloning until there is legal review.*
18. **Is this run under your employer or as a personal side project?** *This decides who the data controller is and which entity applies to Stripe. Default: personal side project for the MVP, with your employer's informal blessing in writing.*

**Proposed first milestone once these are answered:** one placeholder fighter against a training dummy on your phone, with hitstop, sparks, shake, a super cut-in and touch controls, running on the deterministic sim with a passing SyncTest. If that doesn't feel good, nothing else matters.
