import React from 'react';
import { Sparkles, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CollapsibleSection from '../ui/CollapsibleSection';

interface AIInsightsSectionProps {
  satisfactionScore?: number | null; // Shown when > 0
  emotionScore?: number | null; // Shown when !== 0
  intent?: string | null; // Shown when non-empty
  insightSummary?: string | null; // Shown when non-empty
  className?: string;
  draggable?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/** A 0-5 score shown as a big number over a segmented lime meter */
const ScoreTile: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div className="tgo-vtile">
    <div className="tgo-vtile-label line-clamp-2 leading-tight">{label}</div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">{score}</span>
      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">/ 5</span>
    </div>
    <div className="mt-2 flex gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 flex-1 rounded-full ${n <= score ? 'bg-acid-500 dark:bg-acid-400' : 'bg-gray-200 dark:bg-gray-800'}`}
        />
      ))}
    </div>
  </div>
);

/**
 * AI insights module component (shows fields on demand based on valid values; renders nothing if all fields are invalid)
 */
const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({
  satisfactionScore,
  emotionScore,
  intent,
  insightSummary,
  className = '',
  draggable,
  expanded,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const { t } = useTranslation();
  const hasSatisfaction = typeof satisfactionScore === 'number' && satisfactionScore > 0; // 0 means unknown
  const hasEmotion = typeof emotionScore === 'number' && emotionScore > 0; // 0 means unknown
  const hasIntent = typeof intent === 'string' && intent.trim().length > 0;
  const hasSummary = typeof insightSummary === 'string' && insightSummary.trim().length > 0;

  if (!hasSatisfaction && !hasEmotion && !hasIntent && !hasSummary) {
    return null;
  }

  const satisfactionStars = Math.max(0, Math.min(5, Math.round(satisfactionScore || 0)));
  const emotionStars = Math.max(0, Math.min(5, Math.round(emotionScore || 0)));

  return (
    <CollapsibleSection
      title={t('visitor.sections.aiInsights', 'AI Insights')}
      icon={<Sparkles size={14} />}
      className={className}
      defaultExpanded={true}
      expanded={expanded}
      onToggle={onToggle}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="space-y-2">
        {(hasSatisfaction || hasEmotion) && (
          <div className="grid grid-cols-2 gap-2">
            {hasSatisfaction && (
              <ScoreTile label={t('visitor.aiInsights.satisfactionScore', 'Satisfaction Score')} score={satisfactionStars} />
            )}
            {hasEmotion && (
              <ScoreTile label={t('visitor.aiInsights.emotionScore', 'Emotion Score')} score={emotionStars} />
            )}
          </div>
        )}

        {hasIntent && (
          <div className="tgo-vtile flex items-center gap-2.5">
            <span className="tgo-vtile-icon"><Target size={13} /></span>
            <div className="min-w-0 flex-1">
              <div className="tgo-vtile-label">{t('visitor.aiInsights.intent', 'Intent')}</div>
              <div className="tgo-vtile-value truncate" title={intent || ''}>{intent}</div>
            </div>
          </div>
        )}

        {hasSummary && (
          <div className="tgo-vsummary">
            <div className="tgo-vtile-label mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-acid-600 dark:text-acid-400" />
              {t('visitor.aiInsights.insightSummary', 'Insight Summary')}
            </div>
            <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">{insightSummary}</p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AIInsightsSection;
