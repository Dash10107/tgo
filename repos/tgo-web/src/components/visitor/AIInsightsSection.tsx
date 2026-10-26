import React from 'react';
import { Star } from 'lucide-react';
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
      <div className="space-y-1.5 px-0.5">
        {hasSatisfaction && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-gray-400 dark:text-gray-500 text-[12px]">{t('visitor.aiInsights.satisfactionScore', 'Satisfaction Score')}</span>
            <div className="flex items-center space-x-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3 h-3 ${n <= satisfactionStars ? 'text-yellow-400 fill-current' : 'text-gray-200 dark:text-gray-700 fill-current'}`}
                />
              ))}
            </div>
          </div>
        )}

        {hasEmotion && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-gray-400 dark:text-gray-500 text-[12px]">{t('visitor.aiInsights.emotionScore', 'Emotion Score')}</span>
            <div className="flex items-center space-x-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3 h-3 ${n <= emotionStars ? 'text-blue-400 fill-current' : 'text-gray-200 dark:text-gray-700 fill-current'}`}
                />
              ))}
            </div>
          </div>
        )}

        {hasIntent && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-gray-400 dark:text-gray-500 text-[12px]">{t('visitor.aiInsights.intent', 'Intent')}</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium text-[12px] truncate max-w-[10rem] text-right" title={intent || ''}>{intent}</span>
          </div>
        )}

        {hasSummary && (
          <div className="flex flex-col pt-1.5 border-t border-gray-50 dark:border-gray-800 mt-1.5">
            <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium uppercase tracking-wider mb-1.5">{t('visitor.aiInsights.insightSummary', 'Insight Summary')}</span>
            <p className="text-gray-600 dark:text-gray-300 text-[12px] leading-relaxed bg-gray-50/50 dark:bg-gray-900/30 p-2 rounded-md italic">
              “{insightSummary}”
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AIInsightsSection;
