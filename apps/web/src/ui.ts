/** Tiny DOM helpers for the page-side UI (menus and option chips sit over the canvas). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export function chip(label: string, onClick: (self: HTMLButtonElement) => void, on = false): HTMLButtonElement {
  const b = el('button', { class: `chip${on ? ' on' : ''}`, text: label });
  b.addEventListener('click', () => { onClick(b); b.blur(); });
  return b;
}

export function button(label: string, onClick: () => void, alt = false): HTMLButtonElement {
  const b = el('button', { class: `btn${alt ? ' alt' : ''}`, text: label });
  b.addEventListener('click', () => { onClick(); b.blur(); });
  return b;
}

/** A full-screen sheet with one card. Returns a function that closes it. */
export function sheet(parent: HTMLElement, content: (Node | string)[], onBackdrop?: () => void): { root: HTMLDivElement; close: () => void } {
  const card = el('div', { class: 'card' }, content);
  const root = el('div', { class: 'sheet' }, [card]);
  const close = () => root.remove();
  if (onBackdrop) root.addEventListener('click', (e) => { if (e.target === root) onBackdrop(); });
  parent.append(root);
  return { root, close };
}

export function controlsHelp(touch: boolean): HTMLElement {
  if (touch) {
    return el('div', {}, [
      el('table', {}, [
        row('Move, jump, crouch', 'Left thumb: stick'),
        row('Dash', 'Flick the stick twice the same way'),
        row('Light / Heavy', 'L / H  (hold a direction for other moves)'),
        row('Ki blast and power moves', 'KI  (with a direction)'),
        row('Guard', 'GRD, or hold away from the opponent'),
        row('Charge ki', 'Hold CHG'),
        row('Super', 'SUPER when the meter is full'),
        row('Throw', 'L + H together, up close'),
      ]),
    ]);
  }
  const k = (...keys: string[]) => keys.map((x) => `<kbd>${x}</kbd>`).join(' ');
  const t = el('table');
  t.innerHTML = [
    ['Move, jump, crouch', k('W', 'A', 'S', 'D') + ' or arrows'],
    ['Dash', 'Tap forward or back twice'],
    ['Light / Heavy', k('J') + ' / ' + k('K') + ' (hold a direction for other moves)'],
    ['Ki blast and power moves', k('L') + ' (with a direction)'],
    ['Guard', k('Space') + ', or hold away from the opponent'],
    ['Charge ki', 'Hold ' + k('O')],
    ['Super', k('I') + ' when the meter is full'],
    ['Throw', k('J') + ' + ' + k('K') + ' together, up close'],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  return t;
}

function row(a: string, b: string): HTMLTableRowElement {
  return el('tr', {}, [el('td', { text: a }), el('td', { text: b })]);
}

/** A row of option chips that folds down to one button, so it never covers the fight. */
export function optionsBar(label: string, chips: HTMLElement[]): HTMLDivElement {
  const bar = el('div', { class: 'bar fold' });
  const toggle = chip(label, () => { bar.classList.toggle('open'); toggle.classList.toggle('on', bar.classList.contains('open')); });
  toggle.classList.add('toggle');
  bar.append(toggle, ...chips);
  return bar;
}
