import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  type DirectionalLight,
  type Group,
  Mesh,
  MeshPhysicalMaterial,
  type PointLight,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { HERO_PHASES, LANDING_COLORS, SCENE } from '../config';
import { bell, dampFactor, landingState, lerp, phase } from '../state';
import { hexToVec3 } from './color';
import { createSculpture } from './ribbonGeometry';
import { sceneState } from './sceneState';
import { debrisFragmentShader, debrisVertexShader, filamentFragmentShader, filamentVertexShader } from './shaders';

/** Key / fill / rim balance: a warm key reveals the curves, lime only on the rim. */
const LIGHT = { key: 1.9, fill: 0.35, rim: 6, env: 0.2 } as const;

const anchorWorld = new Vector3();
const edgeWorld = new Vector3();
const cameraRight = new Vector3();
const projected = new Vector3();

interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  scale: number;
}

const heroPose = (h: number, intro: number, wide: boolean, fit: number, reduced: boolean, out: Pose): Pose => {
  const approach = phase(h, HERO_PHASES.approach);
  // The sculpture clears space slightly ahead of the type rising into it.
  // With reduced motion the copy is visible from the start, so it begins aside.
  const headline = reduced ? 1 : phase(h, HERO_PHASES.shift);
  const dissolve = phase(h, HERO_PHASES.dissolve);
  const surge = bell(phase(h, HERO_PHASES.surge));

  // Beside the headline on wide screens, above it on narrow ones; a small
  // shift as the filament flares and the surface starts to break.
  out.x = lerp(0, wide ? 1.8 : 0, headline) - (wide ? 0.35 : 0) * dissolve;
  out.y = lerp(0, wide ? 0.62 : 0.98, headline) + 0.06 * surge + 0.12 * dissolve;
  out.z = approach * 0.6 - headline * 1.1;
  out.rx = lerp(0.32, 0.5, headline) + 0.18 * dissolve;
  out.ry = lerp(-0.25, 0.28, headline) - 0.1 * surge;
  out.scale = fit * (0.86 + 0.14 * intro) * lerp(1, wide ? 0.82 : 0.8, headline);
  return out;
};

/**
 * Smoked-graphite material with a scroll-driven dissolve. Fragments whose
 * noise threshold falls below `uDissolve` are discarded, and a thin lime
 * edge burns along the boundary – exactly where the debris particles are born.
 */
function createSculptureMaterial(dissolve: { value: number }): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: new Color('#16181a'),
    roughness: 0.34,
    metalness: 0.08,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new Color(LANDING_COLORS.acidDeep),
    specularIntensity: 0.6,
    envMapIntensity: 0,
  });
  const edgeColor = { value: new Color(LANDING_COLORS.acid) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = dissolve;
    shader.uniforms.uEdgeColor = edgeColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDissolve;\nvarying float vDissolve;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDissolve = aDissolve;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uDissolve;\nuniform vec3 uEdgeColor;\nvarying float vDissolve;',
      )
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vDissolve < uDissolve) discard;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uDissolve > 0.0) {
          totalEmissiveRadiance += uEdgeColor * (1.0 - smoothstep(0.0, 0.018, vDissolve - uDissolve)) * 1.1;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'lp-sculpture-dissolve';
  return material;
}

const createFilamentMaterial = (glow: boolean) =>
  new ShaderMaterial({
    vertexShader: filamentVertexShader,
    fragmentShader: filamentFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uHead: { value: 0 },
      uLength: { value: SCENE.filament.length },
      uIntensity: { value: 0 },
      uDissolve: { value: 0 },
      uGlow: { value: glow ? 1 : 0 },
      uColor: { value: hexToVec3(LANDING_COLORS.acid) },
    },
  });

/**
 * The hero sculpture: a dark interlocking ribbon knot with a lime energy
 * filament travelling over its surface. As the visitor scrolls past the
 * headline, the surface erodes and every fragment flies off as a particle,
 * clearing the stage for the grid.
 */
export function Centerpiece() {
  const anchor = useRef<Group>(null);
  const orient = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const rim = useRef<PointLight>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const parts = useMemo(() => {
    const geo = createSculpture(SCENE.ribbon, SCENE.filament);
    const dissolve = { value: 0 };
    const surfaceMaterial = createSculptureMaterial(dissolve);
    const coreMaterial = createFilamentMaterial(false);
    const glowMaterial = createFilamentMaterial(true);
    const debrisMaterial = new ShaderMaterial({
      vertexShader: debrisVertexShader,
      fragmentShader: debrisFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uDissolve: dissolve,
        uTime: { value: 0 },
        uSize: { value: SCENE.debris.size },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 1 },
        uWarm: { value: hexToVec3(LANDING_COLORS.paper) },
        uLime: { value: hexToVec3(LANDING_COLORS.acid) },
      },
    });

    const surface = new Mesh(geo.ribbon, surfaceMaterial);
    const core = new Mesh(geo.filament, coreMaterial);
    const glow = new Mesh(geo.glow, glowMaterial);
    const debris = new Points(geo.debris, debrisMaterial);
    core.renderOrder = 2;
    glow.renderOrder = 3;
    debris.renderOrder = 4;
    debris.visible = false;

    return {
      dissolve,
      surface,
      surfaceMaterial,
      core,
      glow,
      debris,
      debrisMaterial,
      filamentMaterials: [coreMaterial, glowMaterial],
      dispose: () => {
        [geo.ribbon, geo.filament, geo.glow, geo.debris].forEach((g) => g.dispose());
        [surfaceMaterial, coreMaterial, glowMaterial, debrisMaterial].forEach((m) => m.dispose());
      },
    };
  }, []);

  useEffect(() => parts.dispose, [parts]);

  const state = useRef({
    pose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, scale: 1 } as Pose,
    current: { x: 0, y: 0, z: 0, rx: 0.32, ry: -0.25, scale: 0.86 } as Pose,
    spinX: 0,
    spinY: 0,
    head: 0,
  });

  useFrame((_, rawDt) => {
    const a = anchor.current;
    const o = orient.current;
    const sp = spin.current;
    if (!a || !o || !sp) return;

    const dt = Math.min(rawDt, 0.1);
    const st = state.current;
    const s = sceneState;
    const reduced = landingState.reducedMotion;
    const wide = size.width >= 768;
    // Portrait screens see far less width at the object's depth – shrink to fit.
    const fit = Math.min(1, size.width / size.height / 0.95);

    const introRaw = reduced ? 1 : (s.time - SCENE.intro.delay) / SCENE.intro.duration;
    const introT = Math.min(Math.max(introRaw, 0), 1);
    const intro = 1 - Math.pow(1 - introT, 3);

    const pose = heroPose(s.hero, intro, wide, fit, reduced, st.pose);
    const c = st.current;
    const k = dampFactor(SCENE.damping.object, dt);
    c.x += (pose.x - c.x) * k;
    c.y += (pose.y - c.y) * k;
    c.z += (pose.z - c.z) * k;
    c.rx += (pose.rx - c.rx) * k;
    c.ry += (pose.ry - c.ry) * k;
    c.scale += (pose.scale - c.scale) * k;

    const float = reduced ? 0 : Math.sin(s.time * 0.55) * 0.07;
    a.position.set(c.x + s.pointerX * 0.12, c.y + float + s.pointerY * 0.06, c.z);
    o.rotation.set(c.rx - s.pointerY * 0.22, c.ry + s.pointerX * 0.32, 0);
    o.scale.setScalar(c.scale * SCENE.ribbon.scale);

    if (!reduced) {
      st.spinY += dt * 0.17;
      st.spinX += dt * 0.045;
      st.head = (st.head + dt * SCENE.filament.speed) % 1;
    }
    sp.rotation.set(Math.sin(st.spinX) * 0.35, 0, st.spinY);

    // Disintegration: one value drives the surface, the filament and the debris.
    const dissolve = SCENE.debris.max * phase(s.hero, HERO_PHASES.dissolve);
    parts.dissolve.value = dissolve;
    parts.surface.visible = dissolve < 1;
    parts.debris.visible = dissolve > 0.001;
    const du = parts.debrisMaterial.uniforms;
    du.uTime.value = s.time;
    du.uPixelRatio.value = dpr;
    du.uOpacity.value = 1 - phase(s.hero, [0.84, 0.97]);

    // Filament: gentle breathing, a brief flare just before the break-up.
    const surge = bell(phase(s.hero, HERO_PHASES.surge));
    const breathe = reduced ? 1 : 0.86 + 0.1 * Math.sin(s.time * 1.7) + 0.06 * Math.sin(s.time * 3.3 + 1.2);
    const filamentIntensity = intro * breathe * (1.6 + 1.8 * surge);
    for (const m of parts.filamentMaterials) {
      m.uniforms.uHead.value = st.head;
      m.uniforms.uIntensity.value = filamentIntensity;
      m.uniforms.uDissolve.value = dissolve;
    }
    parts.core.visible = dissolve < 1;
    parts.glow.visible = dissolve < 1;

    const visible = intro > 0.003 && dissolve < SCENE.debris.max - 0.001;
    a.visible = visible;
    parts.surfaceMaterial.envMapIntensity = LIGHT.env * intro;
    if (key.current) key.current.intensity = LIGHT.key * intro;
    if (fill.current) fill.current.intensity = LIGHT.fill * intro;
    if (rim.current) rim.current.intensity = LIGHT.rim * intro;

    // Publish the projected screen footprint for the DOM guide line.
    const obj = landingState.object;
    obj.visible = visible ? intro * (1 - phase(s.hero, HERO_PHASES.dissolve)) : 0;
    if (visible) {
      a.getWorldPosition(anchorWorld);
      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      edgeWorld.copy(anchorWorld).addScaledVector(cameraRight, 1.55 * c.scale * SCENE.ribbon.scale);
      projected.copy(anchorWorld).project(camera);
      obj.x = (projected.x * 0.5 + 0.5) * size.width;
      obj.y = (-projected.y * 0.5 + 0.5) * size.height;
      projected.copy(edgeWorld).project(camera);
      obj.radius = Math.abs((projected.x * 0.5 + 0.5) * size.width - obj.x);
    }
  });

  return (
    <group ref={anchor}>
      <directionalLight ref={key} position={[-3.5, 4.5, 5]} color="#f6f1e6" intensity={0} />
      <directionalLight ref={fill} position={[3, -2.5, 3]} color="#9fb0bd" intensity={0} />
      <pointLight ref={rim} position={[2.4, 1.4, -2.8]} color={LANDING_COLORS.acid} intensity={0} decay={2} />
      <group ref={orient}>
        <group ref={spin}>
          <primitive object={parts.surface} />
          <primitive object={parts.core} />
          <primitive object={parts.glow} />
          <primitive object={parts.debris} />
        </group>
      </group>
    </group>
  );
}
