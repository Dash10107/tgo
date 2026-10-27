import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GuideLine, type GuideFrame } from '../lines/GuideLine';
import { gsap, ScrollTrigger, trackProgress, useScrollScene, useTicker } from '../motion';
import { landingState } from '../state';
import { RevealLines } from '../typography/RevealLines';

const STAGES = ['arrive', 'understand', 'coordinate', 'execute', 'resolve'] as const;
type StageKey = (typeof STAGES)[number];

const STRAND_SIGN = [0, -1, 1] as const;

interface Layout {
  horizontal: boolean;
  centers: number[];
  widths: number[];
  focus: number[];
  trackX: number;
}

const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/**
 * One deformation per stage, each fading back to a straight baseline between
 * stages: many threads arrive (waves), intent is understood (a loop), agents
 * branch out and rejoin, workflows step through, and the line comes to rest.
 */
const shapeStrand = (f: GuideFrame, i: number, layout: Layout, base: number) => {
  const c = f.curves[i].reset(0, f.width, base);
  const unit = Math.min(f.height * 0.1, 92);
  const [arrive, understand, coordinate, execute] = layout.focus;
  const [cA, cU, cC, cE] = layout.centers;
  const [wA, wU, wC, wE] = layout.widths;

  if (arrive > 0.001) {
    c.wave({ from: cA - wA * 0.55, to: cA + wA * 0.55, amount: unit * 0.45 * arrive, cycles: 2.5 + i * 0.5, phase: i * 2.1 });
  }
  if (understand > 0.001) {
    c.loop({ center: cU - wU * 0.18, radius: unit * 0.85, amount: understand });
  }
  if (coordinate > 0.001 && STRAND_SIGN[i] !== 0) {
    c.bump({ center: cC, spread: wC * 0.16, amount: STRAND_SIGN[i] * unit * 0.95 * coordinate });
  }
  if (execute > 0.001) {
    c.stepsUp({ from: cE - wE * 0.42, to: cE + wE * 0.42, steps: 3, rise: unit * 0.32, amount: execute });
  }
};

export function StorySection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<(HTMLElement | null)[]>([]);
  const layout = useRef<Layout>({
    horizontal: false,
    centers: STAGES.map(() => 0),
    widths: STAGES.map(() => 1),
    focus: STAGES.map(() => 0),
    trackX: 0,
  });

  useScrollScene(ref, ({ reduced, desktop }) => {
    const section = ref.current;
    const track = trackRef.current;
    if (!section || !track) return undefined;
    const L = layout.current;
    L.horizontal = desktop && !reduced;

    if (!L.horizontal) {
      section.style.height = '';
      L.focus.fill(1);
      stageRefs.current.forEach((s) => s?.style.setProperty('--f', '1'));
      trackProgress(section, 'story', { start: 'top bottom', end: 'bottom top' });
      return undefined;
    }

    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const measure = () => {
      section.style.height = `${distance() + window.innerHeight}px`;
      stageRefs.current.forEach((s, i) => {
        if (!s) return;
        L.centers[i] = s.offsetLeft + s.offsetWidth * 0.5;
        L.widths[i] = s.offsetWidth;
      });
    };
    measure();
    ScrollTrigger.addEventListener('refreshInit', measure);

    trackProgress(section, 'story');
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
    });

    const q = gsap.utils.selector(section);
    gsap.fromTo(
      q('.lp-story-intro .lp-line-inner'),
      { yPercent: 118 },
      {
        yPercent: 0,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 15%', scrub: 0.6 },
      },
    );

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', measure);
      section.style.height = '';
    };
  });

  // Stage focus: how close each stage's centre is to the viewport centre.
  useTicker(() => {
    const L = layout.current;
    const track = trackRef.current;
    if (!L.horizontal || !track) return;
    L.trackX = gsap.getProperty(track, 'x') as number;
    const viewCenter = window.innerWidth * 0.5 - L.trackX;
    for (let i = 0; i < STAGES.length; i++) {
      const d = Math.abs(L.centers[i] - viewCenter) / (L.widths[i] * 0.72);
      const f = smooth(1 - d);
      if (Math.abs(f - L.focus[i]) > 0.001) {
        L.focus[i] = f;
        stageRefs.current[i]?.style.setProperty('--f', f.toFixed(3));
      }
    }
  });

  const drawStoryLine = (f: GuideFrame) => {
    const L = layout.current;
    const base = f.height * 0.55;
    for (let i = 0; i < 3; i++) {
      shapeStrand(f, i, L, base);
      f.stroke(i, 1, i === 0 ? 0.55 : 0.3);
    }
    const viewCenter = (window.innerWidth * 0.5 - L.trackX) / Math.max(1, f.width);
    f.tracer(0, viewCenter, landingState.story > 0.01 && landingState.story < 0.995 ? 1 : 0);
  };

  return (
    <section ref={ref} className="lp-section lp-story" aria-labelledby="lp-story-title">
      <div className="lp-story-sticky">
        <div ref={trackRef} className="lp-story-track">
          <GuideLine className="lp-guide lp-story-guide" strands={3} withTracer density={5} onFrame={drawStoryLine} />

          <header className="lp-story-intro">
            <p className="lp-kicker">
              <span className="lp-kicker-index">02</span>
              {t('landing.story.kicker')}
            </p>
            <RevealLines
              id="lp-story-title"
              className="lp-display lp-display--story"
              lines={[t('landing.story.titleLine1'), t('landing.story.titleLine2')]}
            />
          </header>

          <ol className="lp-stages">
            {STAGES.map((key: StageKey, i) => (
              <li
                key={key}
                ref={(el) => {
                  stageRefs.current[i] = el;
                }}
                className="lp-stage"
              >
                <span className="lp-stage-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="lp-stage-text">
                  <p className="lp-stage-label">{t(`landing.story.stages.${key}.label`)}</p>
                  <h3 className="lp-stage-title">{t(`landing.story.stages.${key}.title`)}</h3>
                  <p className="lp-stage-body">{t(`landing.story.stages.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
