import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANDING_ROUTES } from './config';
import { useTicker } from './motion';
import { landingState, phase } from './state';

const CHAPTERS = ['intro', 'workspace', 'resolution', 'principle', 'begin'] as const;

const currentChapter = (): number => {
  const s = landingState;
  if (s.finale > 0.3) return 4;
  if (s.quote > 0) return 3;
  if (s.story > 0) return 2;
  if (s.converge > 0) return 1;
  return 0;
};

/**
 * Header and bottom HUD. Both stay hidden on the black opening frame and
 * fade in once the visitor starts scrolling. Updated imperatively from the
 * shared ticker – no React renders while scrolling.
 */
export function LandingChrome() {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const indexRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const last = useRef({ visible: -1, chapter: -1, percent: -1 });
  const labels = CHAPTERS.map((c) => t(`landing.chapters.${c}`));

  useTicker(() => {
    const l = last.current;
    const visible = Math.round(phase(landingState.hero, [0.05, 0.12]) * 100) / 100;
    if (visible !== l.visible) {
      l.visible = visible;
      headerRef.current?.style.setProperty('--chrome', String(visible));
      hudRef.current?.style.setProperty('--chrome', String(visible));
      headerRef.current?.toggleAttribute('data-hidden', visible < 0.05);
    }
    const chapter = currentChapter();
    if (chapter !== l.chapter && chapterRef.current && indexRef.current) {
      l.chapter = chapter;
      chapterRef.current.textContent = labels[chapter];
      indexRef.current.textContent = String(chapter).padStart(2, '0');
    }
    const percent = Math.round(landingState.page * 100);
    if (percent !== l.percent && counterRef.current && barRef.current) {
      l.percent = percent;
      counterRef.current.textContent = String(percent).padStart(2, '0');
      barRef.current.style.transform = `scaleX(${landingState.page.toFixed(4)})`;
    }
  });

  return (
    <>
      <header ref={headerRef} className="lp-header" data-hidden="">
        <a href="#lp-top" className="lp-brand" aria-label={t('landing.header.home')}>
          <img src="/logo.svg" alt="" width={40} height={40} />
          <span className="lp-wordmark">Pelatis</span>
        </a>
        <nav className="lp-header-nav" aria-label={t('landing.header.navLabel')}>
          <Link to={LANDING_ROUTES.secondary} className="lp-header-link">
            {t('landing.cta.secondary')}
          </Link>
          <Link to={LANDING_ROUTES.primary} className="lp-btn lp-btn--primary lp-btn--small">
            {t('landing.cta.primary')}
          </Link>
        </nav>
      </header>

      <div ref={hudRef} className="lp-hud" aria-hidden="true">
        <span className="lp-hud-chapter">
          <span ref={indexRef} className="lp-hud-index">
            00
          </span>
          <span ref={chapterRef}>{labels[0]}</span>
        </span>
        <span className="lp-hud-counter">
          <span ref={counterRef}>00</span> / 100
        </span>
        <span className="lp-hud-track">
          <span ref={barRef} className="lp-hud-bar" />
        </span>
      </div>
    </>
  );
}
