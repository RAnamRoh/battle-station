/** Player preferences, remembered on this device. Holds preferences only, never personal data. */
export interface Settings {
  volume: number;
  muted: boolean;
  shake: boolean;
  flashes: boolean;
  /** Simple controls (auto combos). null = decide from the device: on for touch, off for keyboard. */
  simple: boolean | null;
  name: string;
}

const KEY = 'battle-station.settings.v1';
const DEFAULTS: Settings = { volume: 0.5, muted: false, shake: true, flashes: true, simple: null, name: '' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* private browsing or blocked storage: fall back to defaults */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: settings last for this visit only */ }
}
