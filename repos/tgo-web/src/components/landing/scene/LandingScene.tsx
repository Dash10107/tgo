import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LANDING_COLORS, SCENE } from '../config';
import { CameraRig } from './CameraRig';
import { Centerpiece } from './Centerpiece';
import { ParticleField } from './ParticleField';
import { PerspectiveGrid } from './PerspectiveGrid';
import { resetSceneState, SceneDriver } from './sceneState';

/** Procedural studio reflections – no HDR download required. */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.background = new Color(LANDING_COLORS.void);
    return () => {
      scene.environment = null;
      env.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

/**
 * Drops the pixel ratio when frames are consistently slow, and restores it
 * when there is headroom again. Measured over ~1.5s windows.
 */
function AdaptiveResolution({ max }: { max: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const acc = useRef({ time: 0, frames: 0, dpr: max });

  useFrame((_, dt) => {
    const a = acc.current;
    a.time += dt;
    a.frames += 1;
    if (a.time < 1.5) return;
    const fps = a.frames / a.time;
    a.time = 0;
    a.frames = 0;
    let next = a.dpr;
    if (fps < 42) next = Math.max(1, a.dpr - 0.25);
    else if (fps > 57) next = Math.min(max, a.dpr + 0.25);
    if (next !== a.dpr) {
      a.dpr = next;
      setDpr(next);
    }
  });

  return null;
}

export default function LandingScene() {
  useEffect(() => resetSceneState, []);

  const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxDpr = Math.min(
    typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    isSmall ? SCENE.maxDprMobile : SCENE.maxDpr,
  );

  return (
    <Canvas
      style={{ pointerEvents: 'none' }}
      dpr={maxDpr}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
      camera={{ fov: SCENE.fov, position: [0, 0, SCENE.cameraZ], near: 0.1, far: 160 }}
      aria-hidden="true"
    >
      <SceneDriver />
      <StudioEnvironment />
      <AdaptiveResolution max={Math.max(1, maxDpr)} />
      <CameraRig />
      <ambientLight intensity={0.03} />
      <PerspectiveGrid />
      <ParticleField />
      <Centerpiece />
    </Canvas>
  );
}
