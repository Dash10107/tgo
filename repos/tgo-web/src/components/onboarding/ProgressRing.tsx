import React from 'react';

interface ProgressRingProps {
  /** Progress from 0 to 100 */
  value: number;
  /** Outer diameter in px */
  size?: number;
  /** Stroke width in px */
  stroke?: number;
  /** Show the percentage label in the middle */
  showLabel?: boolean;
  className?: string;
}

/**
 * Circular progress indicator with an animated lime arc.
 */
const ProgressRing: React.FC<ProgressRingProps> = ({ value, size = 40, stroke = 3.5, showLabel = true, className }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-acid-400)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-[10px] font-semibold tabular-nums">{Math.round(clamped)}%</span>
      )}
    </span>
  );
};

export default ProgressRing;
