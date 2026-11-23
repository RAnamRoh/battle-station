/**
 * Colours and type used by the canvas and the page.
 * Placeholder until the design-token package exists (ADR-0008); keep every colour here so the move is mechanical.
 */
export const theme = {
  ink: 0x14121f,
  paper: 0xf5f1e6,
  hp: 0xffd23f,
  hpLow: 0xff5a4d,
  hpLag: 0xd7263d,
  barBack: 0x2a2738,
  ki: 0x35c9ff,
  kiFull: 0xffb703,
  guard: 0x9be89b,
  p1: 0x4ea8ff,
  p2: 0xff6b6b,
  sparks: [0xfff3b0, 0xffa94d, 0x7fe7ff, 0xff7ae5],
  block: 0x8fd3ff,
  font: '"Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif',
} as const;
