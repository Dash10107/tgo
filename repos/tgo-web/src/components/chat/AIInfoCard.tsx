import React from 'react';
import type { MessageAIInfo } from '@/types';

import { useTranslation } from 'react-i18next';
interface AIInfoCardProps {
  aiInfo?: MessageAIInfo;
}

/**
 * AI Information Card component for displaying order info, suggestions, etc.
 */
const AIInfoCard: React.FC<AIInfoCardProps> = ({ aiInfo }) => {
  const { t } = useTranslation();
  if (!aiInfo) return null;

  const getDetailLabel = (key: string): string => {
    switch (key) {
      case 'status':
        return t('aiInfoCard.status', 'Status') + ': ';
      case 'product':
        return t('aiInfoCard.product', 'Product') + ': ';
      case 'tracking':
        return t('aiInfoCard.tracking', 'Tracking') + ': ';
      default:
        return '';
    }
  };

  const getDetailValueClass = (key: string): string => {
    return key === 'status' ? 'text-acid-700 dark:text-acid-400' : 'text-gray-800 dark:text-gray-200';
  };

  return (
    <div className="mt-2">
      <div className="tgo-surface max-w-md rounded-3xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{aiInfo.title}</h4>
          <span className="rounded-full bg-acid-300 px-2 py-0.5 text-[11px] font-semibold text-ink-900">
            {aiInfo.status}
          </span>
        </div>
        
        {aiInfo.details && (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
            {Object.entries(aiInfo.details).map(([key, value]) => (
              <p key={key}>
                {getDetailLabel(key)}
                <span className={`font-medium ${getDetailValueClass(key)}`}>
                  {String(value)}
                </span>
              </p>
            ))}
          </div>
        )}
        
        {aiInfo.actions && aiInfo.actions.length > 0 && (
          <div className="flex gap-2">
            {aiInfo.actions.map((action, index) => (
              <button
                key={index}
                className={`h-8 rounded-full px-3.5 text-xs font-medium transition-all active:scale-95 ${
                  action.type === 'primary'
                    ? 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-acid-400 dark:text-ink-900'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-acid-300 hover:text-ink-900 hover:ring-transparent dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInfoCard;
