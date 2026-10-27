import { useFrame } from '@react-three/fiber';
import { SCENE, SPACE_PHASES } from '../config';
import { dampFactor, landingState, phase } from '../state';

/**
 * Smoothed view of the scroll state, shared by every object in the scene.
 * Updated once per frame by <SceneDriver />, which is mounted first so all
 * other frame callbacks read values from the same frame.
 */
export const sceneState = {
  time: 0,
  hero: 0,
  converge: 0,
  story: 0,
  quote: 0,
  finale: 0,
  pointerX: 0,
  pointerY: 0,
  /** Distance travelled through the grid/particle space, in world units. */
  travel: 0,
  /** Grid → particle dissolve, 0 → 1. */
  dissolve: 0,
};

export function SceneDriver() {
  useFrame((_, rawDt) => {
    // Clamp dt so a stalled or backgrounded tab does not produce a jump.
    const dt = Math.min(rawDt, 0.1);
    const s = landingState;
    const k = dampFactor(SCENE.damping.object, dt);
    const kp = dampFactor(SCENE.damping.pointer, dt);

    sceneState.time += dt;
    sceneState.hero += (s.hero - sceneState.hero) * k;
    sceneState.converge += (s.converge - sceneState.converge) * k;
    sceneState.story += (s.story - sceneState.story) * k;
    sceneState.quote += (s.quote - sceneState.quote) * k;
    sceneState.finale += (s.finale - sceneState.finale) * k;
    sceneState.pointerX += (s.pointer.x - sceneState.pointerX) * kp;
    sceneState.pointerY += (s.pointer.y - sceneState.pointerY) * kp;

    const scrolled =
      sceneState.converge * 0.42 + sceneState.story * 0.38 + sceneState.quote * 0.12 + sceneState.finale * 0.08;
    // Scroll drives travel; a slow idle drift keeps the space alive, calming at the end.
    const idle = s.reducedMotion ? 0 : dt * 0.22 * (1 - phase(sceneState.finale, [0.2, 0.9]) * 0.85);
    idleTravel += idle;
    sceneState.travel = SCENE.grid.travel * scrolled + idleTravel;

    sceneState.dissolve = phase(sceneState.converge, SPACE_PHASES.dissolve);
  });
  return null;
}

let idleTravel = 0;

export const resetSceneState = (): void => {
  sceneState.time = 0;
  sceneState.hero = 0;
  sceneState.converge = 0;
  sceneState.story = 0;
  sceneState.quote = 0;
  sceneState.finale = 0;
  sceneState.pointerX = 0;
  sceneState.pointerY = 0;
  sceneState.travel = 0;
  sceneState.dissolve = 0;
  idleTravel = 0;
};
