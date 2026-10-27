/**
 * Landing page tuning knobs.
 *
 * Every timing, colour and density value used by the landing experience lives
 * here so the motion can be tuned without hunting through components.
 * Scroll ranges are expressed as [start, end] fractions of a section's own
 * scroll progress (0 → 1).
 */

export const LANDING_COLORS = {
  void: '#050506',
  ink: '#08090a',
  paper: '#ece8df',
  acid: '#cdee55',
  acidDeep: '#8fb31e',
} as const;

export const LANDING_ROUTES = {
  primary: '/register',
  secondary: '/login',
} as const;

/** Section scroll lengths, in viewport heights. */
export const SECTION_LENGTH = {
  hero: 4,
  converge: 3,
  quote: 1.6,
} as const;

/** Sub-phases of the opening hero, as fractions of hero progress. */
export const HERO_PHASES = {
  /** Object settles in and the camera starts gliding forward. */
  approach: [0, 0.18],
  /** The sculpture slides aside to make room for the headline. */
  shift: [0.03, 0.24],
  /** Headline lines reveal beside the sculpture. */
  headline: [0.1, 0.34],
  /** Supporting copy and CTAs. */
  details: [0.28, 0.42],
  /** The filament flares briefly just before the surface breaks up. */
  surge: [0.4, 0.56],
  /** The torus surface disintegrates into particles. */
  dissolve: [0.48, 0.86],
  /** Hero copy leaves. */
  exit: [0.66, 0.8],
  /** The grid emerges – only once the torus has lost its form. */
  grid: [0.8, 1],
} as const;

/** Sub-phases of the "converge" section (grid travel → particle space). */
export const SPACE_PHASES = {
  gridIn: [0, 0.25],
  dissolve: [0.5, 0.92],
} as const;

export const SCENE = {
  /** Upper bound for device pixel ratio – keeps fill-rate sane on retina. */
  maxDpr: 1.75,
  maxDprMobile: 1.4,
  fov: 38,
  cameraZ: 7.2,
  /** Exponential damping rates (higher = snappier). */
  damping: {
    pointer: 3.2,
    camera: 2.6,
    object: 3.4,
  },
  intro: {
    /** Seconds for the object to emerge from darkness on load. */
    duration: 3.2,
    delay: 0.35,
  },
  ribbon: {
    segments: 520,
    radial: 28,
    width: 0.34,
    thickness: 0.085,
    twists: 6,
    scale: 1.05,
  },
  filament: {
    /** Loops per second travelled by the head of the energy stream. */
    speed: 0.055,
    /** Tail length as a fraction of the full path. */
    length: 0.26,
    radius: 0.0075,
    glowRadius: 0.034,
    /** Distance the filament floats above the ribbon face. */
    lift: 0.012,
  },
  debris: {
    /** Dissolve uniform range: thresholds span 0 → 1, plus each particle's flight time. */
    max: 1.35,
    size: 12,
  },
  grid: {
    floorY: -1.55,
    cell: 1.2,
    size: 96,
    /** World units travelled per unit of scroll progress across the page. */
    travel: 60,
    curvature: 0.0024,
  },
  particles: {
    count: 2400,
    countMobile: 1100,
    /** Depth range the field wraps through (multiple of grid.cell). */
    depth: 96,
    width: 64,
    accentRatio: 0.035,
  },
} as const;

export const CURSOR = {
  dotDuration: 0.12,
  ringDuration: 0.5,
} as const;

export type PhaseRange = readonly [number, number];
