import type { ElementType } from 'react';

interface RevealLinesProps {
  lines: string[];
  as?: ElementType;
  id?: string;
  className?: string;
  /** Optional per-line class names, e.g. to indent alternate lines. */
  lineClassNames?: (string | undefined)[];
  /** Index of a line that gets a wiping highlight block (`--wipe`: 0 → 1). */
  markedLine?: number;
}

/**
 * Oversized headline split into masked lines. Each `.lp-line-inner` is
 * animated by the owning section's scroll timeline; the outer span clips it.
 * Lines are real text joined by spaces, so screen readers read one sentence.
 */
export function RevealLines({ lines, as: Tag = 'h2', id, className, lineClassNames, markedLine }: RevealLinesProps) {
  return (
    <Tag id={id} className={className}>
      {lines.map((line, i) => (
        <span
          key={line}
          className={['lp-line', lineClassNames?.[i], i === markedLine ? 'lp-marked' : undefined].filter(Boolean).join(' ')}
        >
          <span className="lp-line-inner">
            {i === markedLine ? (
              <>
                <span className="lp-mark" aria-hidden="true" />
                <span className="lp-mark-base">{line}</span>
                {/* Ink copy, revealed in step with the block so each letter
                    flips colour exactly as the block's edge passes it. */}
                <span className="lp-mark-ink" aria-hidden="true">
                  {line}
                </span>
              </>
            ) : (
              line
            )}
          </span>
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
