import { pack } from './pack';
import { portrait } from './portrait';
import { el } from './ui';

/** A fighter card for character select and the online lobby. */
export function fighterCard(i: number, onClick: () => void, compact = false): HTMLButtonElement {
  const p = pack.fighters[i]!.presentation;
  const st = pack.sim.fighters[i]!.stats;
  const bar = (label: string, v: number) => el('div', { class: 'stat' }, [el('span', { text: label }), el('i', {}, [el('b', { style: `width:${Math.round(Math.max(0.12, Math.min(1, v)) * 100)}%` })])]);
  const card = el('button', { class: `fcard${compact ? ' compact' : ''}`, style: `--c:${p.colours.body}` }, [
    portrait(p, compact ? 56 : 84),
    el('div', { class: 'fname', text: p.name }),
    el('div', { class: 'fsub', text: compact ? p.archetype : `${p.archetype} · ${p.department}` }),
    ...(compact ? [] : [el('div', { class: 'ftag', text: p.tagline })]),
    bar('Health', (st.hp - 800) / 350),
    bar('Speed', (st.walkF - 600) / 600),
    bar('Power', (st.damageMul - 85) / 25),
    ...(compact ? [] : [bar('Ki', (st.kiGainMul - 60) / 70)]),
  ]);
  card.addEventListener('click', onClick);
  return card;
}
