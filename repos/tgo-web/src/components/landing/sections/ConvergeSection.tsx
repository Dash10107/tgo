import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTION_LENGTH } from '../config';
import { GuideLine, type GuideFrame } from '../lines/GuideLine';
import { gsap, trackProgress, useScrollScene } from '../motion';
import { landingState, phase } from '../state';
import { RevealLines } from '../typography/RevealLines';

const STRAND_SPREAD = [-1, 0, 1] as const;
const STRAND_PHASE = [0.4, 2.1, 4.2] as const;

/** 1 on the left, easing to 0 by ~80% across: separate threads become one. */
const converge = (t: number) => {
  const c = Math.min(Math.max((t - 0.18) / 0.62, 0), 1);
  return 1 - c * c * (3 - 2 * c);
};

const drawStrands = (f: GuideFrame) => {
  const p = landingState.converge;
  const draw = phase(p, [0.04, 0.3]);
  const spread = Math.min(f.height * 0.11, 120) * (1 - phase(p, [0.42, 0.62]) * 0.85);
  const exit = phase(p, [0.6, 0.74]);
  const base = f.height * 0.5;
  for (let i = 0; i < 3; i++) {
    f.curves[i]
      .reset(0, f.width, base)
      .offset(STRAND_SPREAD[i] * spread, converge)
      .wave({
        from: 0,
        to: f.width * 0.82,
        amount: spread * 0.32,
        cycles: 1.6,
        phase: STRAND_PHASE[i] + p * 6,
      });
    f.stroke(i, draw, (i === 1 ? 0.6 : 0.36) * (1 - exit));
  }
  f.tracer(1, 0.08 + phase(p, [0.12, 0.6]) * 0.9, (1 - exit) * phase(p, [0.1, 0.16]));
};

/**
 * "Every conversation. One intelligence." – the grid arrives, three threads
 * converge into one, then the grid dissolves into open particle space.
 */
export function ConvergeSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);

  useScrollScene(ref, ({ reduced }) => {
    const el = ref.current;
    if (!el) return;
    trackProgress(el, 'converge');
    if (reduced) return;

    const q = gsap.utils.selector(el);
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      })
      .fromTo(q('.lp-kicker'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.04)
      .fromTo(
        q('.lp-line-inner'),
        { yPercent: 118 },
        { yPercent: 0, duration: 0.14, stagger: 0.1, ease: 'power3.out' },
        0.08,
      )
      .fromTo(q('.lp-converge-note'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.3)
      .to(q('.lp-converge-copy'), { autoAlpha: 0, y: -40, duration: 0.12, ease: 'power2.in' }, 0.6)
      .fromTo(q('.lp-converge-after'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.78)
      .to(q('.lp-converge-after'), { autoAlpha: 0, duration: 0.06 }, 0.94)
      .set({}, {}, 1);
  });

  return (
    <section
      ref={ref}
      className="lp-section lp-converge"
      style={{ height: `${SECTION_LENGTH.converge * 100}svh` }}
      aria-labelledby="lp-converge-title"
    >
      <div className="lp-sticky">
        <GuideLine className="lp-guide lp-guide--full" strands={3} withTracer onFrame={drawStrands} />
        <div className="lp-converge-copy lp-container">
          <p className="lp-kicker">
            <span className="lp-kicker-index">01</span>
            {t('landing.converge.kicker')}
          </p>
          <RevealLines
            id="lp-converge-title"
            className="lp-display lp-display--split"
            lines={[t('landing.converge.titleLine1'), t('landing.converge.titleLine2')]}
            lineClassNames={['lp-split-a', 'lp-split-b']}
          />
          <p className="lp-converge-note">{t('landing.converge.description')}</p>
        </div>
        <p className="lp-converge-after lp-caption" aria-hidden="true">
          {t('landing.converge.after')}
        </p>
      </div>
    </section>
  );
}
