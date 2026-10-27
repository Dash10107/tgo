import React from 'react';
import { LuWrench } from 'react-icons/lu';
import ToolCard from './ToolCard';

import { useTranslation } from 'react-i18next';
import type { AiTool, ToolCategory } from '@/types';

interface ToolsListProps {
  tools: AiTool[];
  selectedCategory: ToolCategory;
  onToolAction: (actionType: string, tool: AiTool) => void;
  onShowToast?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  className?: string;
}

/**
 * Tools list component
 */
const ToolsList: React.FC<ToolsListProps> = ({
  tools,
  selectedCategory,
  onToolAction,
  onShowToast,
  className = ''
}) => {
  const { t } = useTranslation();
  if (tools.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <LuWrench className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('tools.list.emptyTitle', 'No tools yet')}</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {selectedCategory === 'all'
            ? t('tools.list.emptyDescriptionAll', 'Click the "Add Tool" button to add your first tool')
            : t('tools.list.emptyDescriptionCategory', { category: t(`tools.categories.${selectedCategory}`, 'Unknown category') })
          }
        </p>
        <div className="mt-6">
          <button className="inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-sm font-medium text-white transition-transform active:scale-95 dark:bg-acid-400 dark:text-ink-900">
            {t('tools.list.emptyAction', 'Start adding tools')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tgo-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${className}`}>
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          onAction={onToolAction}
          onShowToast={onShowToast}
        />
      ))}
    </div>
  );
};

export default ToolsList;
