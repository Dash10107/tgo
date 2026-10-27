import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { HERO_PHASES, SCENE } from '../config';
import { dampFactor, lerp, phase } from '../state';
import { sceneState } from './sceneState';

const target = new Vector3();
const look = new Vector3();
const lookTarget = new Vector3();

/**
 * Camera choreography: a gentle push-in during the hero, then a rise and
 * downward tilt so the floor grid reads as a landscape, then a slow lift as
 * the grid dissolves into open particle space. Pointer adds damped parallax.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = sceneState;
    const approach = phase(s.hero, HERO_PHASES.approach);
    const handoff = phase(s.hero, HERO_PHASES.grid);
    const lift = s.dissolve;
    const settle = phase(s.finale, [0.2, 0.85]);

    target.set(
      s.pointerX * 0.32,
      s.pointerY * 0.18 + handoff * 0.6 + lift * 0.5 - settle * 0.6,
      SCENE.cameraZ - approach * 0.9 - handoff * 0.3,
    );
    lookTarget.set(s.pointerX * 0.08, lerp(lerp(0, -0.95, handoff), 0.1, lift), 0);

    const k = dampFactor(SCENE.damping.camera, dt);
    camera.position.lerp(target, k);
    look.lerp(lookTarget, k);
    camera.lookAt(look);
  });

  return null;
}
