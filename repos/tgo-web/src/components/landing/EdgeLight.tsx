import { useRef } from 'react';
import { useTicker } from './motion';
import { landingState, phase } from './state';

/**
 * Soft lime light blooming up from the bottom-left and bottom-right corners.
 * Driven solely by the final section's progress, so it never shows in the
 * hero, the grid or the story – it rises with the closing headline and
 * settles by the footer.
 */
export function EdgeLight() {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ glow: -1, reach: -1 });

  useTicker(() => {
    const el = ref.current;
    if (!el) return;
    const f = landingState.finale;
    const glow = Math.round(phase(f, [0.15, 0.7]) * 1000) / 1000;
    const reach = Math.round(phase(f, [0.15, 0.9]) * 1000) / 1000;
    const l = last.current;
    if (glow !== l.glow) {
      l.glow = glow;
      el.style.setProperty('--glow', String(glow));
      el.style.visibility = glow > 0 ? 'visible' : 'hidden';
    }
    if (reach !== l.reach) {
      l.reach = reach;
      el.style.setProperty('--reach', String(reach));
    }
  });

  return (
    <div ref={ref} className="lp-edge-light" aria-hidden="true" style={{ visibility: 'hidden' }}>
      <span className="lp-edge-light-side lp-edge-light-side--left" />
      <span className="lp-edge-light-side lp-edge-light-side--right" />
    </div>
  );
}
