import { BufferAttribute, BufferGeometry, Curve, TubeGeometry, Vector3 } from 'three';

/**
 * Procedural geometry for the hero sculpture.
 *
 * - The ribbon: a twisted elliptical band swept along a (2,3) torus knot.
 * - The filament: a thin tube riding on the ribbon's flat face, so it follows
 *   every twist and contour of the surface.
 * - The debris: one particle per ribbon vertex, born exactly where the
 *   surface it belonged to dissolves.
 *
 * All three share a 3D noise "dissolve threshold" evaluated at the same local
 * positions, which is what makes the surface, the filament and the particles
 * break apart together.
 */

const TAU = Math.PI * 2;

export interface RibbonOptions {
  segments: number;
  radial: number;
  width: number;
  thickness: number;
  /** Number of half turns along the loop – must be an integer so the seam closes. */
  twists: number;
}

/** (2,3) torus knot centre line. */
const knotCurve = (t: number, out: Vector3): Vector3 => {
  const phi = t * TAU;
  const r = 1.02 + 0.44 * Math.cos(3 * phi);
  return out.set(r * Math.cos(2 * phi), r * Math.sin(2 * phi), 0.44 * Math.sin(3 * phi));
};

const WORLD_Z = new Vector3(0, 0, 1);
const ahead = new Vector3();
const behind = new Vector3();

/**
 * Centre point and cross-section frame at parameter t. The frame comes from
 * world Z projected onto the plane normal to the tangent: the knot always
 * travels around Z, so it never degenerates and is perfectly periodic.
 */
function frameAt(t: number, p: Vector3, n: Vector3, b: Vector3, segments: number): void {
  const delta = 1 / (segments * 8);
  knotCurve(t, p);
  knotCurve((t + delta) % 1, ahead);
  knotCurve((t - delta + 1) % 1, behind);
  const tangent = ahead.sub(behind).normalize();
  n.copy(WORLD_Z).addScaledVector(tangent, -tangent.dot(WORLD_Z)).normalize();
  b.crossVectors(tangent, n).normalize();
}

/* ───────────── Dissolve field ───────────── */

const fract = (v: number) => v - Math.floor(v);
const hash3 = (x: number, y: number, z: number) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const w = smooth(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/**
 * Raw dissolve value at a local position: two octaves of noise give organic,
 * eroding patches, and a gentle diagonal bias makes the break-up sweep across
 * the sculpture instead of starting everywhere at once.
 */
const rawDissolve = (p: Vector3): number => {
  const n = valueNoise(p.x * 1.6 + 3.1, p.y * 1.6 - 1.7, p.z * 1.6 + 0.4) * 0.65
    + valueNoise(p.x * 4.1, p.y * 4.1, p.z * 4.1) * 0.35;
  const sweep = (p.x * 0.55 - p.y * 0.3 + 1.8) / 3.6;
  return n * 0.6 + sweep * 0.4;
};

interface FieldRange {
  min: number;
  max: number;
}

const normalise = (v: number, r: FieldRange) => Math.min(Math.max((v - r.min) / (r.max - r.min), 0), 1);

/* ───────────── Ribbon ───────────── */

export interface Sculpture {
  ribbon: BufferGeometry;
  /** Narrow bright core of the energy stream. */
  filament: BufferGeometry;
  /** Wider, faint halo around the same path. */
  glow: BufferGeometry;
  debris: BufferGeometry;
}

function buildRibbon(opts: RibbonOptions): { geometry: BufferGeometry; range: FieldRange } {
  const { segments, radial, width, thickness, twists } = opts;
  const count = segments * radial;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const raw = new Float32Array(count);

  const p = new Vector3();
  const frameN = new Vector3();
  const frameB = new Vector3();
  const offset = new Vector3();
  const normal = new Vector3();
  const vertex = new Vector3();
  const halfW = width / 2;
  const halfT = thickness / 2;
  const range: FieldRange = { min: Infinity, max: -Infinity };

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    frameAt(t, p, frameN, frameB, segments);
    const twist = twists * Math.PI * t;
    const cosT = Math.cos(twist);
    const sinT = Math.sin(twist);

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Elliptical cross-section rotated by the twist angle.
      const lx = ca * halfW;
      const ly = sa * halfT;
      const rx = lx * cosT - ly * sinT;
      const ry = lx * sinT + ly * cosT;
      // Analytic ellipse normal, rotated the same way.
      const nx0 = ca / halfW;
      const ny0 = sa / halfT;
      const nx = nx0 * cosT - ny0 * sinT;
      const ny = nx0 * sinT + ny0 * cosT;

      offset.copy(frameN).multiplyScalar(rx).addScaledVector(frameB, ry);
      normal.copy(frameN).multiplyScalar(nx).addScaledVector(frameB, ny).normalize();
      vertex.copy(p).add(offset);

      const k = i * radial + j;
      positions[k * 3] = vertex.x;
      positions[k * 3 + 1] = vertex.y;
      positions[k * 3 + 2] = vertex.z;
      normals[k * 3] = normal.x;
      normals[k * 3 + 1] = normal.y;
      normals[k * 3 + 2] = normal.z;
      const d = rawDissolve(vertex);
      raw[k] = d;
      if (d < range.min) range.min = d;
      if (d > range.max) range.max = d;
    }
  }

  const dissolve = new Float32Array(count);
  for (let k = 0; k < count; k++) dissolve[k] = normalise(raw[k], range);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('aDissolve', new BufferAttribute(dissolve, 1));
  geometry.setIndex(new BufferAttribute(buildIndex(segments, radial, positions, normals), 1));
  geometry.computeBoundingSphere();
  return { geometry, range };
}

function buildIndex(segments: number, radial: number, positions: Float32Array, normals: Float32Array): Uint32Array {
  const index = new Uint32Array(segments * radial * 6);
  let n = 0;
  for (let i = 0; i < segments; i++) {
    const i1 = (i + 1) % segments;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i1 * radial + j;
      const c = i1 * radial + j1;
      const d = i * radial + j1;
      index[n++] = a; index[n++] = b; index[n++] = d;
      index[n++] = b; index[n++] = c; index[n++] = d;
    }
  }

  // Make sure triangle winding agrees with the outward normals so front-face
  // culling works; flip every triangle if it does not.
  const v = (idx: number) => new Vector3(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);
  const a = v(index[0]);
  const faceNormal = new Vector3().crossVectors(v(index[1]).sub(a), v(index[2]).sub(a));
  const vertexNormal = new Vector3(normals[index[0] * 3], normals[index[0] * 3 + 1], normals[index[0] * 3 + 2]);
  if (faceNormal.dot(vertexNormal) < 0) {
    for (let k = 0; k < index.length; k += 3) {
      const tmp = index[k + 1];
      index[k + 1] = index[k + 2];
      index[k + 2] = tmp;
    }
  }
  return index;
}

/* ───────────── Filament ───────────── */

/** Closed path along the centre of the ribbon's flat face, slightly lifted. */
class FaceCurve extends Curve<Vector3> {
  private readonly p = new Vector3();
  private readonly n = new Vector3();
  private readonly b = new Vector3();

  constructor(
    private readonly opts: RibbonOptions,
    private readonly lift: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const u = ((t % 1) + 1) % 1;
    frameAt(u, this.p, this.n, this.b, this.opts.segments);
    const twist = this.opts.twists * Math.PI * u;
    // Cross-section angle π/2 is the middle of the flat face.
    const ly = this.opts.thickness / 2 + this.lift;
    const rx = -ly * Math.sin(twist);
    const ry = ly * Math.cos(twist);
    return target.copy(this.p).addScaledVector(this.n, rx).addScaledVector(this.b, ry);
  }
}

function buildFilament(opts: RibbonOptions, lift: number, radius: number, range: FieldRange): BufferGeometry {
  const tubular = 1600;
  const radialSegments = 8;
  const curve = new FaceCurve(opts, lift);
  const geometry = new TubeGeometry(curve, tubular, radius, radialSegments, true);
  const dissolve = new Float32Array((tubular + 1) * (radialSegments + 1));
  const point = new Vector3();
  for (let i = 0; i <= tubular; i++) {
    const d = normalise(rawDissolve(curve.getPoint(i / tubular, point)), range);
    for (let j = 0; j <= radialSegments; j++) dissolve[i * (radialSegments + 1) + j] = d;
  }
  geometry.setAttribute('aDissolve', new BufferAttribute(dissolve, 1));
  return geometry;
}

/* ───────────── Debris ───────────── */

/** Deterministic PRNG so the break-up is identical on every visit. */
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function buildDebris(ribbon: BufferGeometry): BufferGeometry {
  const pos = ribbon.getAttribute('position') as BufferAttribute;
  const nrm = ribbon.getAttribute('normal') as BufferAttribute;
  const dis = ribbon.getAttribute('aDissolve') as BufferAttribute;
  const count = pos.count;
  const rand = mulberry32(11);

  const position = new Float32Array(pos.array as Float32Array);
  const threshold = new Float32Array(dis.array as Float32Array);
  const dir = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const d = new Vector3();
  const radialOut = new Vector3();
  const jitter = new Vector3();

  for (let i = 0; i < count; i++) {
    // Outward flight: the surface normal, pushed away from the knot's axis,
    // with a little randomness so the cloud has depth and variation.
    radialOut.set(position[i * 3], position[i * 3 + 1], 0).normalize();
    d.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i))
      .multiplyScalar(0.8)
      .addScaledVector(radialOut, 0.7)
      .addScaledVector(jitter.set(rand() - 0.5, rand() - 0.5, rand() - 0.5), 0.9)
      .normalize();
    dir[i * 3] = d.x;
    dir[i * 3 + 1] = d.y;
    dir[i * 3 + 2] = d.z;
    seed[i * 4] = 0.35 + rand() * 1.25; // flight distance
    seed[i * 4 + 1] = rand(); // recession depth
    seed[i * 4 + 2] = rand() < 0.35 ? 1 : 0; // lime or warm white
    seed[i * 4 + 3] = 0.6 + rand() * 0.8; // size
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aDir', new BufferAttribute(dir, 3));
  geometry.setAttribute('aThreshold', new BufferAttribute(threshold, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 2;
  return geometry;
}

export function createSculpture(
  opts: RibbonOptions,
  filament: { lift: number; radius: number; glowRadius: number },
): Sculpture {
  const { geometry: ribbon, range } = buildRibbon(opts);
  return {
    ribbon,
    filament: buildFilament(opts, filament.lift, filament.radius, range),
    glow: buildFilament(opts, filament.lift, filament.glowRadius, range),
    debris: buildDebris(ribbon),
  };
}
