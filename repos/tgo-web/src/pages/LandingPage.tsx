import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomCursor } from '@/components/landing/CustomCursor';
import { EdgeLight } from '@/components/landing/EdgeLight';
import { LandingChrome } from '@/components/landing/LandingChrome';
import { ScrollTrigger, useSmoothScroll } from '@/components/landing/motion';
import { ConvergeSection } from '@/components/landing/sections/ConvergeSection';
import { FinaleSection } from '@/components/landing/sections/FinaleSection';
import { HeroSection } from '@/components/landing/sections/HeroSection';
import { QuoteSection } from '@/components/landing/sections/QuoteSection';
import { StorySection } from '@/components/landing/sections/StorySection';
import { StaticBackdrop, supportsWebGL2 } from '@/components/landing/StaticBackdrop';
import { landingState, resetLandingState } from '@/components/landing/state';
import '@/components/landing/landing.css';

const LandingScene = lazy(() => import('@/components/landing/scene/LandingScene'));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Page-level document effects: dark canvas, title, scroll position. */
function useLandingDocument(title: string) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previousTitle = document.title;
    const previousRestoration = history.scrollRestoration;
    html.classList.add('lp-document');
    document.title = title;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    return () => {
      html.classList.remove('lp-document');
      document.title = previousTitle;
      history.scrollRestoration = previousRestoration;
    };
  }, [title]);
}

/** Normalised pointer position for the 3D parallax; touch drags count too. */
function usePointerTracking() {
  useEffect(() => {
    const set = (x: number, y: number) => {
      landingState.pointer.x = (x / window.innerWidth) * 2 - 1;
      landingState.pointer.y = -((y / window.innerHeight) * 2 - 1);
    };
    const onPointer = (e: PointerEvent) => set(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) set(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => {
      landingState.pointer.x = 0;
      landingState.pointer.y = 0;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
}

/**
 * Public marketing landing page.
 *
 * A fixed WebGL stage (sculpture, grid, particles) sits behind a stack of
 * scroll sections. Each section owns its GSAP timeline and writes progress
 * into the shared `landingState`, which the 3D scene, guide lines and HUD
 * read every frame – one scroll source keeps everything in sync.
 */
const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [webgl] = useState(supportsWebGL2);

  useLandingDocument(t('landing.meta.title'));
  useSmoothScroll(!reduced);
  usePointerTracking();

  useLayoutEffect(() => {
    landingState.reducedMotion = reduced;
    landingState.isTouch = window.matchMedia('(pointer: coarse)').matches;
    const root = rootRef.current;
    if (!root) return undefined;

    const page = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        landingState.page = self.progress;
      },
    });

    // Re-measure once web fonts settle – headline widths drive the layout.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      page.kill();
      resetLandingState();
    };
  }, [reduced]);

  return (
    <div ref={rootRef} id="lp-top" className={reduced ? 'landing-root lp-reduced' : 'landing-root'}>
      <a href="#lp-main" className="lp-skip">
        {t('landing.skip')}
      </a>

      {webgl ? (
        <div className="lp-webgl" aria-hidden="true">
          <Suspense fallback={null}>
            <LandingScene />
          </Suspense>
        </div>
      ) : (
        <StaticBackdrop />
      )}

      <EdgeLight />

      <LandingChrome />

      <main id="lp-main" className="lp-main">
        <HeroSection />
        <ConvergeSection />
        <StorySection />
        <QuoteSection />
        <FinaleSection />
      </main>

      <CustomCursor root={rootRef} />
    </div>
  );
};

export default LandingPage;
