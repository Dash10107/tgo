import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { landingState } from './state';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const MEDIA = {
  // gsap.matchMedia only runs a setup when at least one condition matches,
  // so keep one that always does (otherwise phones without reduced motion
  // would get no scroll choreography at all).
  always: 'all',
  reduced: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 768px)',
} as const;

export interface SceneConditions {
  reduced: boolean;
  desktop: boolean;
}

/**
 * Builds a section's scroll choreography inside a gsap.matchMedia context.
 * Everything created in `setup` is reverted automatically on unmount and
 * whenever the reduced-motion or breakpoint conditions change.
 */
export function useScrollScene(
  scope: RefObject<HTMLElement | null>,
  setup: (conditions: SceneConditions) => void | (() => void),
): void {
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useLayoutEffect(() => {
    const el = scope.current;
    if (!el) return undefined;
    const mm = gsap.matchMedia(el);
    mm.add(MEDIA, (ctx) => {
      const { reduced, desktop } = ctx.conditions as unknown as SceneConditions;
      return setupRef.current({ reduced, desktop });
    });
    return () => mm.revert();
  }, [scope]);
}

/**
 * Lenis smooth scrolling, driven from the GSAP ticker so ScrollTrigger, the
 * guide lines and the scroll position all advance in the same frame.
 * Disabled for reduced-motion users; touch keeps native momentum scrolling.
 */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [enabled]);
}

/** Runs `fn` on every GSAP tick (one rAF shared with Lenis and ScrollTrigger). */
export function useTicker(fn: () => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const tick = () => fnRef.current();
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
}

/** Writes a section's scroll progress into the shared landing state. */
export const trackProgress = (
  trigger: Element,
  key: 'hero' | 'converge' | 'story' | 'quote' | 'finale',
  vars: ScrollTrigger.Vars = {},
): ScrollTrigger =>
  ScrollTrigger.create({
    trigger,
    start: 'top top',
    end: 'bottom bottom',
    ...vars,
    onUpdate: (self) => {
      landingState[key] = self.progress;
    },
    onRefresh: (self) => {
      landingState[key] = self.progress;
    },
  });
