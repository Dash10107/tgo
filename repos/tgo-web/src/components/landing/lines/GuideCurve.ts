/**
 * A polyline that starts life as a straight horizontal stroke and can be
 * deformed by a stack of smooth, composable operations. Every deformation is
 * scaled by an `amount`, and all of them reduce to the straight baseline at
 * amount = 0 – which is what lets a line bend through a segment and return
 * cleanly to straight at the next transition.
 *
 * Points are stored in a preallocated Float32Array; per-frame updates do not
 * allocate apart from the SVG path string itself.
 */

const TAU = Math.PI * 2;

const smooth = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/** Window weight: 0 outside [from, to], easing up to 1 in the centre. */
const window01 = (x: number, from: number, to: number): number => {
  if (x <= from || x >= to) return 0;
  const s = Math.sin(((x - from) / (to - from)) * Math.PI);
  return s * s;
};

export interface BumpOptions {
  center: number;
  spread: number;
  amount: number;
}

export interface WaveOptions {
  from: number;
  to: number;
  amount: number;
  /** Full cycles across the window. */
  cycles: number;
  phase: number;
}

export interface LoopOptions {
  center: number;
  /** Peak loop radius in px; the loop opens as amount goes 0 → 1. */
  radius: number;
  amount: number;
  /** -1 loops upward, +1 loops downward. */
  direction?: number;
}

export interface StepsOptions {
  from: number;
  to: number;
  steps: number;
  rise: number;
  amount: number;
}

export class GuideCurve {
  readonly count: number;
  readonly points: Float32Array;
  private baseline = 0;
  private x0 = 0;
  private x1 = 0;

  constructor(count: number) {
    this.count = count;
    this.points = new Float32Array(count * 2);
  }

  reset(x0: number, x1: number, baseline: number): this {
    this.x0 = x0;
    this.x1 = x1;
    this.baseline = baseline;
    const span = x1 - x0;
    for (let i = 0; i < this.count; i++) {
      this.points[i * 2] = x0 + (span * i) / (this.count - 1);
      this.points[i * 2 + 1] = baseline;
    }
    return this;
  }

  /** Gaussian lift – a single smooth bend. */
  bump({ center, spread, amount }: BumpOptions): this {
    if (amount === 0) return this;
    const inv = 1 / (2 * spread * spread);
    for (let i = 0; i < this.count; i++) {
      const dx = this.points[i * 2] - center;
      this.points[i * 2 + 1] += amount * Math.exp(-dx * dx * inv);
    }
    return this;
  }

  /** Sine wave that tapers to zero at both ends of its window. */
  wave({ from, to, amount, cycles, phase }: WaveOptions): this {
    if (amount === 0) return this;
    const k = (TAU * cycles) / (to - from);
    for (let i = 0; i < this.count; i++) {
      const x = this.points[i * 2];
      const w = window01(x, from, to);
      if (w > 0) this.points[i * 2 + 1] += amount * w * Math.sin((x - from) * k + phase);
    }
    return this;
  }

  /**
   * Trochoid loop: as amount grows the stroke first lifts, then folds back on
   * itself into a closed loop, with tangents that stay continuous at both ends.
   */
  loop({ center, radius, amount, direction = -1 }: LoopOptions): this {
    if (amount <= 0) return this;
    const half = radius * 2.3;
    const from = center - half;
    const to = center + half;
    const a = (to - from) / TAU;
    const b = radius * 1.7 * amount;
    for (let i = 0; i < this.count; i++) {
      const x = this.points[i * 2];
      if (x <= from || x >= to) continue;
      const u = (x - from) / (to - from);
      const theta = u * TAU;
      const env = Math.sin(u * Math.PI) ** 2;
      const bb = b * env;
      this.points[i * 2] = from + a * theta + bb * Math.sin(theta);
      this.points[i * 2 + 1] += direction * bb * (1 - Math.cos(theta)) * 0.5;
    }
    return this;
  }

  /** Smooth staircase that rises in `steps` and settles back to baseline. */
  stepsUp({ from, to, steps, rise, amount }: StepsOptions): this {
    if (amount === 0) return this;
    const span = to - from;
    const stepW = span / (steps + 1.5);
    for (let i = 0; i < this.count; i++) {
      const x = this.points[i * 2];
      if (x <= from || x >= to) continue;
      let y = 0;
      for (let s = 0; s < steps; s++) {
        const edge = from + stepW * (s + 0.5);
        y += smooth((x - edge) / (stepW * 0.35));
      }
      y -= steps * smooth((x - (to - stepW * 0.9)) / (stepW * 0.7));
      this.points[i * 2 + 1] -= y * rise * amount;
    }
    return this;
  }

  /** Vertical offset with an arbitrary per-x envelope, used for strands. */
  offset(amount: number, envelope: (t: number) => number): this {
    if (amount === 0) return this;
    const span = this.x1 - this.x0 || 1;
    for (let i = 0; i < this.count; i++) {
      const t = (this.points[i * 2] - this.x0) / span;
      this.points[i * 2 + 1] += amount * envelope(t);
    }
    return this;
  }

  /** Point at normalised position t along the sample array. */
  pointAt(t: number, out: { x: number; y: number }): { x: number; y: number } {
    const f = Math.min(Math.max(t, 0), 1) * (this.count - 1);
    const i = Math.floor(f);
    const j = Math.min(i + 1, this.count - 1);
    const r = f - i;
    out.x = this.points[i * 2] + (this.points[j * 2] - this.points[i * 2]) * r;
    out.y = this.points[i * 2 + 1] + (this.points[j * 2 + 1] - this.points[i * 2 + 1]) * r;
    return out;
  }

  get base(): number {
    return this.baseline;
  }

  toPath(): string {
    const p = this.points;
    let d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    for (let i = 1; i < this.count; i++) {
      d += `L${p[i * 2].toFixed(1)} ${p[i * 2 + 1].toFixed(1)}`;
    }
    return d;
  }
}
