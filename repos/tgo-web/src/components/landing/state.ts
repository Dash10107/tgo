import type { PhaseRange } from './config';

/**
 * Shared, mutable animation state for the landing page.
 *
 * GSAP scroll timelines write into this object and the WebGL frame loop and
 * guide lines read from it every frame. It is intentionally *not* React state:
 * nothing here should ever trigger a re-render.
 */
export interface LandingState {
  /** Raw progress of each scroll section, 0 → 1. */
  hero: number;
  converge: number;
  story: number;
  quote: number;
  finale: number;
  /** Progress through the whole document, 0 → 1. */
  page: number;
  /** Normalised pointer position, -1 → 1 (y up). */
  pointer: { x: number; y: number };
  /** Projected screen position/size of the centerpiece, in CSS pixels. */
  object: { x: number; y: number; radius: number; visible: number };
  reducedMotion: boolean;
  isTouch: boolean;
}

export const landingState: LandingState = {
  hero: 0,
  converge: 0,
  story: 0,
  quote: 0,
  finale: 0,
  page: 0,
  pointer: { x: 0, y: 0 },
  object: { x: 0, y: 0, radius: 0, visible: 0 },
  reducedMotion: false,
  isTouch: false,
};

export const resetLandingState = (): void => {
  landingState.hero = 0;
  landingState.converge = 0;
  landingState.story = 0;
  landingState.quote = 0;
  landingState.finale = 0;
  landingState.page = 0;
  landingState.pointer.x = 0;
  landingState.pointer.y = 0;
  landingState.object.visible = 0;
};

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite smoothstep of `v` across `range`. */
export const phase = (v: number, range: PhaseRange): number => {
  const t = clamp01((v - range[0]) / (range[1] - range[0]));
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential damping factor. */
export const dampFactor = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** 0 at both ends, 1 in the middle – used to bend lines and return them straight. */
export const bell = (t: number): number => Math.sin(Math.PI * clamp01(t));
