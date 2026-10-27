import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTION_LENGTH } from '../config';
import { GuideLine, type GuideFrame } from '../lines/GuideLine';
import { gsap, trackProgress, useScrollScene } from '../motion';
import { bell, landingState, phase } from '../state';

const drawQuoteLine = (f: GuideFrame) => {
  const p = landingState.quote;
  const bend = bell(phase(p, [0.15, 0.95]));
  f.curves[0]
    .reset(0, f.width, f.height * 0.5)
    .bump({ center: f.width * 0.62, spread: f.width * 0.16, amount: -f.height * 0.32 * bend })
    .wave({ from: f.width * 0.1, to: f.width * 0.9, amount: f.height * 0.06 * bend, cycles: 2, phase: p * 4 });
  f.stroke(0, phase(p, [0.02, 0.4]), 0.45);
};

/** A single brand statement, revealed word by word under a gently bending line. */
export function QuoteSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const lines = [t('landing.quote.line1'), t('landing.quote.line2')];

  useScrollScene(ref, ({ reduced }) => {
    const el = ref.current;
    if (!el) return;
    trackProgress(el, 'quote');
    if (reduced) return;
    const q = gsap.utils.selector(el);
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top 70%', end: 'bottom bottom', scrub: 0.5 },
      })
      .fromTo(q('.lp-kicker'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0)
      .fromTo(q('.lp-word'), { opacity: 0.1 }, { opacity: 1, duration: 0.12, stagger: 0.05 }, 0.08)
      .set({}, {}, 1);
  });

  return (
    <section
      ref={ref}
      className="lp-section lp-quote"
      style={{ height: `${SECTION_LENGTH.quote * 100}svh` }}
      aria-labelledby="lp-quote-text"
    >
      <div className="lp-sticky lp-quote-sticky">
        <div className="lp-quote-guide-wrap">
          <GuideLine className="lp-guide lp-guide--quote" onFrame={drawQuoteLine} />
        </div>
        <figure className="lp-container lp-quote-figure">
          <p className="lp-kicker">
            <span className="lp-kicker-index">03</span>
            {t('landing.quote.kicker')}
          </p>
          <blockquote id="lp-quote-text" className="lp-quote-text">
            {lines.map((line, li) => (
              <span key={line} className={li === 1 ? 'lp-quote-line lp-quote-line--accent' : 'lp-quote-line'}>
                {line.split(' ').map((word, wi) => (
                  <span key={`${word}-${wi}`} className="lp-word">
                    {word}{' '}
                  </span>
                ))}
              </span>
            ))}
          </blockquote>
        </figure>
      </div>
    </section>
  );
}
