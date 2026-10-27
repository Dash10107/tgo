import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { HERO_PHASES, LANDING_ROUTES, SECTION_LENGTH } from '../config';
import { GuideLine, type GuideFrame } from '../lines/GuideLine';
import { gsap, ScrollTrigger, trackProgress, useScrollScene } from '../motion';
import { landingState, phase } from '../state';
import { RevealLines } from '../typography/RevealLines';

/** Space kept between the guide line and the top of the headline block, in px. */
const LINE_GAP = 36;
/** The loop never rises above this distance from the top of the viewport (clears the nav). */
const NAV_CLEARANCE = 104;
/** Hero progress at which the RESOLVED. highlight wipes in – just after the word lands. */
const WIPE_AT = 0.32;

/**
 * Opening scene: a black screen where the sculpture emerges, then a scroll
 * timeline that brings in the headline, supporting copy and CTAs beside the
 * sculpture before it disintegrates into particles.
 */
export function HeroSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  /** Top of the headline block within the sticky viewport (layout px, unaffected by transforms). */
  const copyTop = useRef(0);

  useEffect(() => {
    const copy = copyRef.current;
    if (!copy) return undefined;
    const measure = () => {
      copyTop.current = copy.offsetTop;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(copy);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /**
   * The line runs just above the headline – never through it – and, while the
   * sculpture is whole, rises into a loop that wraps around it. It straightens
   * as the surface starts to break up and leaves with the copy.
   */
  const drawHeroLine = (f: GuideFrame) => {
    const h = landingState.hero;
    const o = landingState.object;
    const baseline = Math.max(NAV_CLEARANCE + 40, (copyTop.current || f.height * 0.55) - LINE_GAP);
    const hasObject = o.radius > 1;
    const cx = hasObject ? o.x : f.width * 0.7;
    const cy = hasObject ? o.y : f.height * 0.3;
    const r = hasObject ? o.radius : f.width * 0.12;

    // Loop height is 1.7 × its radius; size it so the top wraps the upper
    // part of the sculpture but stays clear of the navigation.
    const loopTop = Math.max(NAV_CLEARANCE, cy - r * 0.5);
    const radius = Math.min(r * 0.9, Math.max(0, (baseline - loopTop) / 1.7));
    const open = phase(h, [0.1, 0.3]) * (1 - phase(h, [0.46, 0.6]));

    f.curves[0].reset(0, f.width, baseline).loop({ center: cx, radius, amount: open });
    f.stroke(0, phase(h, [0.04, 0.2]), 0.32 * (1 - phase(h, HERO_PHASES.exit)));
  };

  useScrollScene(ref, ({ reduced }) => {
    const el = ref.current;
    if (!el) return;
    trackProgress(el, 'hero');
    if (reduced) return;

    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
    const [h0] = HERO_PHASES.headline;
    const [d0] = HERO_PHASES.details;
    const [x0, x1] = HERO_PHASES.exit;

    tl.to(q('.lp-hint-wrap'), { autoAlpha: 0, y: 12, duration: 0.05 }, 0.02)
      .fromTo(q('.lp-kicker'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.07 }, h0 - 0.02)
      .fromTo(
        q('.lp-line-inner'),
        { yPercent: 118, rotate: 1.5 },
        { yPercent: 0, rotate: 0, duration: 0.14, stagger: 0.09, ease: 'power3.out' },
        h0,
      )
      .fromTo(q('.lp-hero-details'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, d0)
      .to(q('.lp-hero-copy'), { yPercent: -14, autoAlpha: 0, duration: x1 - x0, ease: 'power2.in' }, x0)
      .set({}, {}, 1);

    // Once RESOLVED. has risen into place, a lime block wipes across it and
    // the letters flip to ink as the edge passes. Timed rather than scrubbed
    // so it always reads as a deliberate gesture; reverses on the way back up.
    const marked = q('.lp-marked .lp-line-inner');
    gsap.set(marked, { '--wipe': 0 });
    const wipe = gsap.to(marked, { '--wipe': 1, duration: 0.9, ease: 'power3.inOut', paused: true });
    ScrollTrigger.create({
      trigger: el,
      start: () => `top+=${Math.round((el.offsetHeight - window.innerHeight) * WIPE_AT)} top`,
      invalidateOnRefresh: true,
      onEnter: () => wipe.play(),
      onLeaveBack: () => wipe.reverse(),
    });
  });

  return (
    <section
      ref={ref}
      className="lp-section lp-hero"
      style={{ height: `${SECTION_LENGTH.hero * 100}svh` }}
      aria-labelledby="lp-hero-title"
    >
      <div className="lp-sticky">
        <GuideLine className="lp-guide lp-guide--full" onFrame={drawHeroLine} density={3} />

        <div ref={copyRef} className="lp-hero-copy lp-container">
          <p className="lp-kicker">
            <span className="lp-kicker-mark" aria-hidden="true" />
            {t('landing.hero.kicker')}
          </p>
          <RevealLines
            as="h1"
            id="lp-hero-title"
            className="lp-display lp-display--hero"
            lines={[t('landing.hero.titleLine1'), t('landing.hero.titleLine2')]}
            lineClassNames={[undefined, 'lp-indent']}
            markedLine={1}
          />
          <div className="lp-hero-details">
            <p className="lp-lede">{t('landing.hero.description')}</p>
            <div className="lp-ctas">
              <Link to={LANDING_ROUTES.primary} className="lp-btn lp-btn--primary">
                {t('landing.cta.primary')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to={LANDING_ROUTES.secondary} className="lp-btn lp-btn--ghost">
                {t('landing.cta.secondary')}
              </Link>
            </div>
          </div>
        </div>

        <div className="lp-hint-wrap">
          <p className="lp-hint">
            <span>{t('landing.hero.scrollHint')}</span>
            <span className="lp-hint-rule" aria-hidden="true" />
          </p>
        </div>
      </div>
    </section>
  );
}
