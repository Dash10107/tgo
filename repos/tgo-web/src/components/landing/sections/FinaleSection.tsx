import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { LANDING_ROUTES } from '../config';
import { GuideLine, type GuideFrame } from '../lines/GuideLine';
import { gsap, trackProgress, useScrollScene } from '../motion';
import { landingState, phase } from '../state';
import { RevealLines } from '../typography/RevealLines';

/** The line arrives with a last, small ripple and settles into the footer rule. */
const drawSettlingLine = (f: GuideFrame) => {
  const p = landingState.finale;
  const settle = 1 - phase(p, [0.45, 0.95]);
  f.curves[0]
    .reset(0, f.width, f.height * 0.5)
    .wave({ from: 0, to: f.width, amount: f.height * 0.3 * settle, cycles: 1.5, phase: p * 3 });
  f.stroke(0, phase(p, [0.3, 0.8]), 0.32 + 0.18 * (1 - settle));
};

export function FinaleSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const year = new Date().getFullYear();

  useScrollScene(ref, ({ reduced }) => {
    const el = ref.current;
    if (!el) return;
    trackProgress(el, 'finale', { start: 'top bottom', end: 'bottom bottom' });
    if (reduced) return;
    const q = gsap.utils.selector(el);
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
      })
      .fromTo(q('.lp-kicker'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.22)
      .fromTo(
        q('.lp-line-inner'),
        { yPercent: 118 },
        { yPercent: 0, duration: 0.2, stagger: 0.08, ease: 'power3.out' },
        0.26,
      )
      .fromTo(q('.lp-finale-details'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.14 }, 0.5)
      .fromTo(q('.lp-footer-inner'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.14 }, 0.72)
      .set({}, {}, 1);
  });

  return (
    <section ref={ref} className="lp-section lp-finale" aria-labelledby="lp-finale-title">
      <div className="lp-container lp-finale-main">
        <p className="lp-kicker">
          <span className="lp-kicker-index">04</span>
          {t('landing.finale.kicker')}
        </p>
        <RevealLines
          id="lp-finale-title"
          className="lp-display lp-display--finale"
          lines={[t('landing.finale.titleLine1'), t('landing.finale.titleLine2')]}
        />
        <div className="lp-finale-details">
          <p className="lp-lede">{t('landing.finale.description')}</p>
          <div className="lp-ctas">
            <Link to={LANDING_ROUTES.primary} className="lp-btn lp-btn--primary">
              {t('landing.finale.primary')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to={LANDING_ROUTES.secondary} className="lp-btn lp-btn--ghost">
              {t('landing.cta.secondary')}
            </Link>
          </div>
        </div>
      </div>

      <footer className="lp-footer">
        <GuideLine className="lp-guide lp-guide--footer" onFrame={drawSettlingLine} />
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <img src="/logo.svg" alt="" width={22} height={22} />
            <span className="lp-wordmark">Pelatis</span>
            <span className="lp-footer-tag">{t('landing.footer.tagline')}</span>
          </div>
          <nav className="lp-footer-nav" aria-label={t('landing.footer.navLabel')}>
            <Link to={LANDING_ROUTES.secondary}>{t('landing.cta.secondary')}</Link>
            <Link to={LANDING_ROUTES.primary}>{t('landing.footer.createAccount')}</Link>
          </nav>
          <p className="lp-footer-copy">{t('landing.footer.copyright', { year })}</p>
        </div>
      </footer>
    </section>
  );
}
