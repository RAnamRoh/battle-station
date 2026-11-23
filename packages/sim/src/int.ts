// Integer helpers. This is the only sim file allowed to use the division operator.

/** Integer division, truncating toward zero. */
export function idiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Move v toward zero by step, without crossing it. */
export function approachZero(v: number, step: number): number {
  if (v > 0) return v > step ? v - step : 0;
  if (v < 0) return v < -step ? v + step : 0;
  return 0;
}
