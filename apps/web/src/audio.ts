/** Small synthesised sound effects, so the prototype needs no audio files. Purely cosmetic. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.5;
  muted = false;

  /** Browsers only allow sound after a tap or key press. Call this from one. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = freq, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master || this.muted) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  /** key varies the pitch a little so repeated hits do not sound identical. */
  hit(tier: number, key: number): void {
    const p = 1 + ((key % 7) - 3) * 0.025;
    if (tier <= 0) { this.noise(0.07, 0.5, 3200); this.tone(210 * p, 0.07, 'square', 0.22, 90); }
    else if (tier === 1) { this.noise(0.14, 0.8, 1900); this.tone(140 * p, 0.14, 'sawtooth', 0.35, 50); }
    else if (tier === 2) { this.noise(0.2, 0.9, 1500); this.tone(110 * p, 0.2, 'sawtooth', 0.4, 40); this.tone(420, 0.1, 'square', 0.12, 180); }
    else { this.noise(0.3, 1, 1200); this.tone(90 * p, 0.3, 'sawtooth', 0.5, 30); this.tone(600, 0.16, 'square', 0.15, 150); }
  }
  block(): void { this.noise(0.05, 0.35, 5000); this.tone(520, 0.06, 'triangle', 0.25, 380); }
  swing(cls: number): void { this.noise(cls === 0 ? 0.06 : 0.11, cls === 0 ? 0.12 : 0.2, cls === 0 ? 2600 : 1400); }
  jump(): void { this.tone(240, 0.12, 'triangle', 0.14, 480); }
  land(): void { this.noise(0.05, 0.16, 700); }
  dash(): void { this.noise(0.12, 0.2, 2200); }
  knockdown(): void { this.noise(0.18, 0.6, 500); this.tone(70, 0.18, 'sine', 0.5, 35); }
  blast(): void { this.tone(880, 0.22, 'sawtooth', 0.2, 220); this.noise(0.12, 0.25, 4000); }
  clash(): void { this.tone(700, 0.2, 'square', 0.2, 1400); this.noise(0.2, 0.5, 3000); }
  guardBreak(): void { this.tone(900, 0.35, 'square', 0.3, 110); this.noise(0.3, 0.7, 2500); }
  superStart(): void {
    this.tone(180, 0.6, 'sawtooth', 0.3, 900);
    this.tone(360, 0.6, 'square', 0.14, 1800);
    this.noise(0.6, 0.35, 6000);
  }
  ko(): void { this.tone(300, 0.9, 'sawtooth', 0.4, 40); this.noise(0.6, 0.9, 900); }
  lastStand(): void { this.tone(330, 0.12, 'square', 0.2, 660); this.tone(660, 0.25, 'square', 0.2, 990, 0.1); }
  announce(kind: 'round' | 'fight' | 'win'): void {
    if (kind === 'round') { this.tone(440, 0.14, 'square', 0.2); }
    else if (kind === 'fight') { this.tone(440, 0.1, 'square', 0.25); this.tone(660, 0.1, 'square', 0.25, 660, 0.1); this.tone(880, 0.3, 'square', 0.25, 880, 0.2); }
    else { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.22, f, i * 0.13)); }
  }
  ui(): void { this.tone(700, 0.05, 'square', 0.12, 900); }
}

export const sfx = new Sfx();
