import { useEffect, useRef } from 'react';
import { gsap } from '../motion';
import { GuideCurve } from './GuideCurve';

export interface GuideFrame {
  width: number;
  height: number;
  curves: GuideCurve[];
  /** Drawing progress (0 → 1) and opacity of strand `i`. */
  stroke: (i: number, draw: number, opacity?: number) => void;
  /** Place the tracer dot at normalised position `t` along strand `i`. */
  tracer: (i: number, t: number, opacity: number) => void;
}

interface GuideLineProps {
  className?: string;
  strands?: number;
  /** Pixels per sample point – lower is smoother. */
  density?: number;
  withTracer?: boolean;
  /** Called every frame while the line is on screen. Must not allocate. */
  onFrame: (frame: GuideFrame) => void;
}

/**
 * Thin, scroll-driven SVG line. The geometry is recomputed from scroll state
 * each frame (via the shared GSAP ticker) instead of swapping static shapes,
 * so a single stroke can bend, loop or branch and settle back to straight.
 */
export function GuideLine({ className, strands = 1, density = 4, withTracer = false, onFrame }: GuideLineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRef = useRef<SVGCircleElement>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    let width = 0;
    let height = 0;
    let active = false;
    let curves: GuideCurve[] = [];
    const lastD: string[] = [];
    const lastDraw: number[] = [];
    const lastOpacity: number[] = [];
    const dotPoint = { x: 0, y: 0 };

    const resize = () => {
      const rect = svg.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      svg.setAttribute('viewBox', `0 0 ${width.toFixed(0)} ${height.toFixed(0)}`);
      const count = Math.min(2400, Math.max(120, Math.round(width / density)));
      if (!curves.length || curves[0].count !== count) {
        curves = Array.from({ length: strands }, () => new GuideCurve(count));
        lastD.length = 0;
      }
    };

    const frame: GuideFrame = {
      width: 0,
      height: 0,
      curves,
      stroke: (i, draw, opacity = 1) => {
        const path = pathRefs.current[i];
        if (!path) return;
        const d = Math.round(draw * 1000) / 1000;
        if (d !== lastDraw[i]) {
          path.style.strokeDashoffset = String(1 - d);
          lastDraw[i] = d;
        }
        const o = Math.round(opacity * 1000) / 1000;
        if (o !== lastOpacity[i]) {
          path.style.opacity = String(o);
          lastOpacity[i] = o;
        }
      },
      tracer: (i, t, opacity) => {
        const dot = dotRef.current;
        const curve = curves[i];
        if (!dot || !curve) return;
        curve.pointAt(t, dotPoint);
        dot.setAttribute('cx', dotPoint.x.toFixed(1));
        dot.setAttribute('cy', dotPoint.y.toFixed(1));
        dot.style.opacity = opacity.toFixed(3);
      },
    };

    const tick = () => {
      if (!active) return;
      frame.width = width;
      frame.height = height;
      frame.curves = curves;
      onFrameRef.current(frame);
      for (let i = 0; i < curves.length; i++) {
        const d = curves[i].toPath();
        if (d !== lastD[i]) {
          pathRefs.current[i]?.setAttribute('d', d);
          lastD[i] = d;
        }
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(svg);
    const io = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
      },
      { rootMargin: '20% 0px' },
    );
    io.observe(svg);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      io.disconnect();
    };
  }, [strands, density]);

  return (
    <svg ref={svgRef} className={className} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      {Array.from({ length: strands }, (_, i) => (
        <path
          key={i}
          ref={(el) => {
            pathRefs.current[i] = el;
          }}
          className="lp-guide-path"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1}
          fill="none"
        />
      ))}
      {withTracer && <circle ref={dotRef} className="lp-guide-tracer" r={3} cx={-10} cy={-10} />}
    </svg>
  );
}
