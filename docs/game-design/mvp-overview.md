# The game as built (MVP)

A living summary for people. The rules themselves are in `openspec/specs/` (after each change is archived), and every number is in `content/core/`.

## The fight

- One on one, on flat ground with jumps. A match is first to 2 rounds; a round lasts 60 seconds.
- **Light** attacks are fast and start combos. **Heavy** attacks hit harder and are slower. Holding a direction changes the move:
  forward (advancing), back (close defence or anti-air), down (low or sweep), or in the air.
- A move that connects can be cancelled into a stronger kind: light → heavy → ki move → super. Later hits in a combo do less damage.
- **Ki** fills when you hit, when you are hit, and fastest when you hold charge (you cannot act while charging).
  Half a bar buys a ki blast, one bar a power move, and three bars the super.
- **Guard** with the button or by holding away. Guarding drains a gauge; when it empties you are stunned. Throws beat guard.
- **Last stand:** once per round, dropping below a quarter health grants a bar of ki.
- Simple controls chain light → light → heavy → rush automatically for 10% less damage.

## The fighters (placeholders)

| Fighter | Style | Strength | Weakness | Back + ki |
|---|---|---|---|---|
| The Rookie | All-rounder | No bad matchups | Nothing stands out | Mid-range beam |
| Hotfix | Rushdown | Speed, pressure | Low health | Teleport strike |
| Ledger | Zoner | Ki gain, blasts | Slow up close | Big fast blast |
| Big Policy | Grappler | Health, damage, grabs | Slowest | Command grab |
| Cold Call | Speedster | Fastest | Weakest guard | Evasive counter-strike |

Names, departments and quotes are stand-ins until coworkers volunteer and consent.

## What "feel" is made of

Hit pause, sparks at the point of contact, a white flash on the victim, screen shake from heavy hits upward,
a cut-in and freeze for supers, slow motion on the knockout, and a damage-lag segment on the health bar.
Pauses and slow motion are part of the fight rules, so both online players see exactly the same thing.
