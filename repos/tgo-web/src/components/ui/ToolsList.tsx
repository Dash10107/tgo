import React from 'react';
import { Wrench } from 'lucide-react';
import ToolTag from './ToolTag';
import type { AiTool } from '@/types';

import { useTranslation } from 'react-i18next';
interface ToolsListProps {
  toolIds: string[];
  toolsMap?: Record<string, AiTool>;
  tools?: AiTool[];
  onToolClick?: (tool: AiTool) => void;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  maxDisplay?: number;
  className?: string; // extra classes applied to wrapper
  emptyText?: string;
  showLabel?: boolean;
}

/**
 * Tools list component
 * Shows the list of tools linked to an AI agent
 */
const ToolsList: React.FC<ToolsListProps> = ({
  toolIds,
  toolsMap,
  tools,
  onToolClick,
  size = 'xs',
  showIcon = true,
  maxDisplay,
  className = '',
  emptyText = 'No tools linked',
  showLabel = false
}) => {
  const { t } = useTranslation();
  // If there are no linked tools, show the empty state
  if (!toolIds || toolIds.length === 0) {
    return (
      <div className={`flex items-center text-gray-500 ${className}`}>
        <Wrench className="w-4 h-4 mr-2 opacity-50" />
        <span className="text-sm">{emptyText}</span>
      </div>
    );
  }

  // Handle the display count limit
  const displayToolIds = maxDisplay ? toolIds.slice(0, maxDisplay) : toolIds;
  const remainingCount = maxDisplay && toolIds.length > maxDisplay 
    ? toolIds.length - maxDisplay 
    : 0;

  return (
    <div className={`${className}`}>
      {showLabel && (
        <div className="flex items-center text-[13px] font-medium text-gray-700 mb-1.5">
          <Wrench className="w-3.5 h-3.5 mr-1.5" />
          {t('toolsList.linkedTools', 'Linked tools')} ({toolIds.length})
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {displayToolIds.map((toolId) => (
          <ToolTag
            key={toolId}
            toolId={toolId}
            toolsMap={toolsMap}
            tools={tools}
            onClick={onToolClick}
            size={size}
            showIcon={showIcon}
          />
        ))}

        {remainingCount > 0 && (
          <span className={`
            inline-flex items-center rounded-md border bg-gray-100 text-gray-600 border-gray-200
            ${size === 'xs' ? 'px-1.5 py-0.5 text-[11px]' : size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
          `}>
            +{remainingCount} {t('toolsList.more', 'more')}
          </span>
        )}
      </div>
    </div>
  );
};

export default ToolsList;
