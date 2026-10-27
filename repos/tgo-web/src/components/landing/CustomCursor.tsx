import { type RefObject, useEffect, useRef } from 'react';
import { CURSOR } from './config';
import { gsap } from './motion';

const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, summary';

/**
 * Dot + trailing ring cursor for fine pointers. The dot tracks almost 1:1,
 * the ring follows with damped easing and opens up over interactive elements.
 * Inactive on touch and coarse pointers, where the native behaviour is kept.
 */
export function CustomCursor({ root }: { root: RefObject<HTMLElement | null> }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!host || !dot || !ring) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dotX = gsap.quickTo(dot, 'x', { duration: reduced ? 0 : CURSOR.dotDuration, ease: 'power3.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: reduced ? 0 : CURSOR.dotDuration, ease: 'power3.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: reduced ? 0 : CURSOR.ringDuration, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: reduced ? 0 : CURSOR.ringDuration, ease: 'power3.out' });

    host.classList.add('lp-has-cursor');
    let shown = false;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (!shown) {
        shown = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
        host.classList.add('lp-cursor-visible');
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };
    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      host.classList.toggle('lp-cursor-active', Boolean(target?.closest(INTERACTIVE)));
    };
    const onLeave = () => host.classList.remove('lp-cursor-visible');
    const onEnter = () => {
      if (shown) host.classList.add('lp-cursor-visible');
    };
    const onDown = () => host.classList.add('lp-cursor-down');
    const onUp = () => host.classList.remove('lp-cursor-down');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.documentElement.addEventListener('pointerenter', onEnter);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.removeEventListener('pointerenter', onEnter);
      host.classList.remove('lp-has-cursor', 'lp-cursor-visible', 'lp-cursor-active', 'lp-cursor-down');
      gsap.killTweensOf([dot, ring]);
    };
  }, [root]);

  return (
    <>
      <div ref={ringRef} className="lp-cursor-ring" aria-hidden="true">
        <span className="lp-cursor-ring-inner" />
      </div>
      <div ref={dotRef} className="lp-cursor-dot" aria-hidden="true" />
    </>
  );
}
