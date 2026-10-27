import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, ShaderMaterial, Vector3 } from 'three';
import { HERO_PHASES, LANDING_COLORS, SCENE } from '../config';
import { phase } from '../state';
import { particleFragmentShader, particleVertexShader } from './shaders';
import { sceneState } from './sceneState';
import { hexToVec3 } from './color';

/** Deterministic PRNG so the field is identical across mounts. */
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function createParticleGeometry(count: number): BufferGeometry {
  const { cell } = SCENE.grid;
  const { depth, width, accentRatio } = SCENE.particles;
  const rand = mulberry32(7);
  const columns = Math.floor(width / cell);
  const rows = Math.floor(depth / cell);

  const position = new Float32Array(count * 3);
  const lift = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const accent = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Snap the birth position to a grid intersection so the particle sits
    // exactly on the lines before it lifts off.
    position[i * 3] = (Math.floor(rand() * columns) - columns / 2) * cell;
    position[i * 3 + 1] = 0;
    position[i * 3 + 2] = -Math.floor(rand() * rows) * cell;

    lift[i * 3] = (rand() - 0.5) * 9;
    lift[i * 3 + 1] = 0.4 + Math.pow(rand(), 0.85) * 13;
    lift[i * 3 + 2] = (rand() - 0.5) * 3;

    seed[i * 4] = rand();
    seed[i * 4 + 1] = rand();
    seed[i * 4 + 2] = rand();
    seed[i * 4 + 3] = 0.55 + rand() * 0.9;

    accent[i] = rand() < accentRatio ? 1 : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aLift', new BufferAttribute(lift, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  geometry.setAttribute('aAccent', new BufferAttribute(accent, 1));
  return geometry;
}

/**
 * Sparse particle space. All motion – travel, lift-off, drift and twinkle –
 * happens in the vertex shader; the CPU only updates a handful of uniforms.
 */
export function ParticleField() {
  const points = useRef<Points>(null);
  const camera = useThree((s) => s.camera);
  const viewportWidth = useThree((s) => s.size.width);
  const dpr = useThree((s) => s.viewport.dpr);
  const count = viewportWidth < 768 ? SCENE.particles.countMobile : SCENE.particles.count;

  const geometry = useMemo(() => createParticleGeometry(count), [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uCurvature: { value: SCENE.grid.curvature },
          uCamPos: { value: new Vector3() },
          uTravel: { value: 0 },
          uDepth: { value: SCENE.particles.depth },
          uZNear: { value: SCENE.cameraZ + 2 },
          uFloorY: { value: SCENE.grid.floorY },
          uMorph: { value: 0 },
          uTime: { value: 0 },
          uSize: { value: 70 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0 },
          uQuiet: { value: 0 },
          uColor: { value: hexToVec3(LANDING_COLORS.paper) },
          uAccent: { value: hexToVec3(LANDING_COLORS.acid) },
        },
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const s = sceneState;
    const u = material.uniforms;
    const quiet = phase(s.finale, [0.15, 0.9]);
    const arrive = phase(s.hero, [HERO_PHASES.grid[0] + 0.06, 1]);
    const opacity = arrive * (1 - quiet * 0.55);
    u.uOpacity.value = opacity;
    u.uQuiet.value = quiet;
    u.uMorph.value = s.dissolve;
    u.uTravel.value = s.travel;
    u.uTime.value = s.time;
    u.uPixelRatio.value = dpr;
    (u.uCamPos.value as Vector3).copy(camera.position);
    if (points.current) points.current.visible = opacity > 0.001;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}
