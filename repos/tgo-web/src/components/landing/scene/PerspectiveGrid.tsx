import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { HERO_PHASES, LANDING_COLORS, SCENE, SPACE_PHASES } from '../config';
import { phase } from '../state';
import { gridFragmentShader, gridVertexShader } from './shaders';
import { sceneState } from './sceneState';
import { hexToVec3 } from './color';

/** Point on the horizon the grid grows outward from. */
const REVEAL_ORIGIN = new Vector2(0, -18);

/**
 * Procedural floor grid. Lines are computed per-pixel from world position,
 * so they stay one device pixel thin at any distance and can scroll past the
 * camera without any geometry updates.
 */
export function PerspectiveGrid() {
  const mesh = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const { size, cell, floorY, curvature } = SCENE.grid;

  const { geometry, material } = useMemo(() => {
    const geo = new PlaneGeometry(size, size, 192, 192);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, floorY, -size / 2 + 22);
    const mat = new ShaderMaterial({
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCurvature: { value: curvature },
        uFloorY: { value: floorY },
        uCamPos: { value: new Vector3() },
        uTravel: { value: 0 },
        uCell: { value: cell },
        uOpacity: { value: 0 },
        uDissolve: { value: 0 },
        uReveal: { value: 0 },
        uRevealOrigin: { value: REVEAL_ORIGIN },
        uTime: { value: 0 },
        uLineColor: { value: hexToVec3(LANDING_COLORS.paper) },
        uAccent: { value: hexToVec3(LANDING_COLORS.acid) },
      },
    });
    return { geometry: geo, material: mat };
  }, [size, cell, floorY, curvature]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const s = sceneState;
    const arrive = phase(s.hero, HERO_PHASES.grid);
    const settle = phase(s.converge, SPACE_PHASES.gridIn);
    const opacity = arrive * (0.65 + 0.35 * settle);
    const u = material.uniforms;
    u.uOpacity.value = opacity;
    u.uReveal.value = Math.max(arrive, settle);
    u.uDissolve.value = s.dissolve;
    u.uTravel.value = s.travel;
    u.uTime.value = s.time;
    (u.uCamPos.value as Vector3).copy(camera.position);
    if (mesh.current) mesh.current.visible = opacity > 0.001 && s.dissolve < 0.999;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
