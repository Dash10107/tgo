import React from 'react';
import { GitBranch, ExternalLink } from 'lucide-react';

interface WorkflowTagProps {
  workflow: {
    id: string;
    name: string;
    status?: string;
    enabled?: boolean;
    [key: string]: any;
  };
  onClick?: (workflow: any) => void;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

/**
 * Workflow tag component
 * Shows the workflows linked to an AI agent
 */
const WorkflowTag: React.FC<WorkflowTagProps> = ({
  workflow,
  onClick,
  size = 'sm',
  showIcon = true,
  className = ''
}) => {
  // Determine the color theme from the workflow state
  const getColorTheme = (enabled: boolean = true) => {
    if (enabled) {
      return 'bg-ink-900 text-white border-ink-900 hover:bg-ink-700 dark:bg-gray-900 dark:border-gray-700';
    } else {
      return 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getIconColor = (enabled: boolean = true) => {
    if (enabled) {
      return 'text-acid-400';
    } else {
      return 'text-gray-400';
    }
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px]',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  };

  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3 h-3',
    md: 'w-4 h-4'
  };

  const isEnabled = workflow.enabled !== false && workflow.status !== 'inactive';
  const colorTheme = getColorTheme(isEnabled);
  const iconColor = getIconColor(isEnabled);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(workflow);
    }
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border transition-colors duration-200
        ${sizeClasses[size]}
        ${colorTheme}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${className}
      `}
      onClick={handleClick}
      title={`${workflow.name}${isEnabled ? ' (Enabled)' : ' (Disabled)'}`}
    >
      {showIcon && (
        <GitBranch className={`${iconSizeClasses[size]} mr-1 ${iconColor}`} />
      )}
      <span className="font-medium truncate max-w-[9rem]">
        {workflow.name}
      </span>
      {onClick && (
        <ExternalLink className={`${iconSizeClasses[size]} ml-1 opacity-60`} />
      )}
    </span>
  );
};

export default WorkflowTag;

