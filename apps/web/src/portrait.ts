import type { Presentation } from '@bs/content-schema/types';

/** Draws a small placeholder portrait (head and shoulders) for menus. Real art replaces this later. */
export function portrait(look: Presentation, size: number, flip = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = `${size}px`; c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  if (flip) { g.translate(size, 0); g.scale(-1, 1); }
  const ink = '#14121f';
  const cx = size * 0.5;
  const cy = size * 0.44;
  const r = size * 0.27;
  const bulk = look.look.bulk / 100;
  g.lineJoin = 'round';
  // Shoulders.
  g.fillStyle = ink;
  g.beginPath(); g.ellipse(cx, size * 1.02, size * 0.42 * bulk + 4, size * 0.34 + 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.colours.body;
  g.beginPath(); g.ellipse(cx, size * 1.02, size * 0.42 * bulk, size * 0.34, 0, 0, Math.PI * 2); g.fill();
  // Head.
  g.fillStyle = ink; g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.colours.skin; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  const beard = look.look.beard;
  if (beard !== 'none') {
    g.fillStyle = lighten(look.colours.hair, 26);
    const drop = beard === 'long' ? r * 0.55 : beard === 'full' ? r * 0.16 : 0;
    g.beginPath();
    if (beard === 'goatee') g.ellipse(cx + r * 0.25, cy + r * 0.78, r * 0.36, r * 0.34, 0, 0, Math.PI * 2);
    else { g.arc(cx, cy, r, 0.05 * Math.PI, 0.95 * Math.PI); g.quadraticCurveTo(cx, cy + r + drop * 2.4, cx + r * Math.cos(0.05 * Math.PI), cy + r * Math.sin(0.05 * Math.PI)); }
    g.fill();
    if (beard !== 'chinstrap' && beard !== 'goatee') {
      g.fillStyle = look.colours.skin;
      g.beginPath(); g.ellipse(cx + r * 0.08, cy + r * 0.12, r * 0.8, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    } else if (beard === 'chinstrap') {
      g.fillStyle = look.colours.skin;
      g.beginPath(); g.ellipse(cx, cy + r * 0.05, r * 0.86, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const hair = look.look.hair;
  if (hair !== 'bald') {
    g.fillStyle = hair === 'cap' ? look.colours.trim : look.colours.hair;
    g.beginPath();
    const lift = hair === 'flat' ? 1.14 : hair === 'swept' ? 1.2 : 1.06;
    g.ellipse(cx - (hair === 'swept' ? r * 0.12 : 0), cy - r * 0.12, r * 1.05, r * lift * 0.95, 0, Math.PI, Math.PI * 2);
    g.fill();
    if (hair === 'flat') g.fillRect(cx - r * 1.02, cy - r * 1.2, r * 2.04, r * 0.3);
    if (hair === 'long') { g.fillRect(cx - r * 1.08, cy - r * 0.2, r * 0.36, r * 1.3); }
    if (hair === 'cap') g.fillRect(cx, cy - r * 0.32, r * 1.5, r * 0.22);
  }
  // Eyes and brow.
  g.fillStyle = ink;
  g.beginPath(); g.arc(cx + r * 0.05, cy + r * 0.02, r * 0.09, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.58, cy + r * 0.02, r * 0.09, 0, Math.PI * 2); g.fill();
  if (look.look.glasses) {
    g.strokeStyle = ink; g.lineWidth = 3;
    g.strokeRect(cx - r * 0.2, cy - r * 0.18, r * 0.5, r * 0.4);
    g.strokeRect(cx + r * 0.36, cy - r * 0.18, r * 0.5, r * 0.4);
  }
  return c;
}

function lighten(colour: string, by: number): string {
  const n = parseInt(colour.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, v + by));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}
