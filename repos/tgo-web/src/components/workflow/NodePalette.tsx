/**
 * Node Palette Component
 * Sidebar for dragging new nodes into the workflow canvas
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Play,
  Square,
  Bot,
  Wrench,
  GitBranch,
  MessageSquare,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutGrid,
  Clock,
  Zap,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { NODE_TYPE_CONFIG, type WorkflowNodeType } from '@/types/workflow';
import { getNodeAccent } from './nodes/nodeTheme';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play,
  Square,
  Bot,
  Wrench,
  GitBranch,
  MessageSquare,
  GitMerge,
  Globe,
  LayoutGrid,
  Clock,
  Zap,
};

// LLM shares MessageSquare with Answer in the type config; give it the same icon as its canvas node
const PALETTE_ICON_OVERRIDES: Partial<Record<WorkflowNodeType, React.ComponentType<{ className?: string }>>> = {
  llm: Sparkles,
};

interface NodePaletteProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const CATEGORIES = [
  { id: 'trigger', label: 'workflow.categories.trigger', defaultLabel: 'Trigger Nodes' },
  { id: 'ai', label: 'workflow.categories.ai', defaultLabel: 'AI Capabilities' },
  { id: 'logic', label: 'workflow.categories.logic', defaultLabel: 'Logic Control' },
  { id: 'external', label: 'workflow.categories.external', defaultLabel: 'External Integrations' },
  { id: 'output', label: 'workflow.categories.output', defaultLabel: 'Output' },
] as const;

const NodePalette: React.FC<NodePaletteProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const nodeTypes: WorkflowNodeType[] = [
    'input',
    'timer',
    'webhook',
    'event',
    'agent',
    'llm',
    'condition',
    'parallel',
    'classifier',
    'tool',
    'api',
    'answer',
  ];

  const disabledNodeTypes: WorkflowNodeType[] = ['timer', 'webhook', 'event', 'tool'];

  const filteredNodeTypes = nodeTypes.filter((type) => {
    const config = NODE_TYPE_CONFIG[type];
    const label = t(`workflow.node_types.${type}.label`, config.label);
    const description = t(`workflow.node_types.${type}.description`, config.description);
    return (
      label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Group filtered nodes by category
  const groupedNodes = CATEGORIES.map(cat => ({
    ...cat,
    nodes: filteredNodeTypes.filter(type => NODE_TYPE_CONFIG[type].category === cat.id)
  })).filter(cat => cat.nodes.length > 0);

  const handleDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('text/plain', nodeType); // Fallback
    event.dataTransfer.effectAllowed = 'move';
  };

  const renderNodeItem = (type: WorkflowNodeType) => {
    const config = NODE_TYPE_CONFIG[type];
    const label = t(`workflow.node_types.${type}.label`, config.label);
    const description = t(`workflow.node_types.${type}.description`, config.description);
    const Icon = PALETTE_ICON_OVERRIDES[type] || iconMap[config.icon] || Play;
    const isDisabled = disabledNodeTypes.includes(type);
    const accent = getNodeAccent(type);

    return (
      <div
        key={type}
        draggable={!isDisabled}
        onDragStart={(e) => !isDisabled && handleDragStart(e, type)}
        className={`
          group relative flex items-center gap-3 rounded-[18px] transition-all duration-300
          ${isCollapsed ? 'justify-center p-1' : 'p-2 pr-3'}
          ${isDisabled
            ? 'cursor-not-allowed opacity-40 grayscale'
            : 'cursor-grab hover:bg-white hover:shadow-[0_10px_28px_-16px_rgba(15,16,18,0.45)] hover:ring-1 hover:ring-gray-200 active:scale-[0.97] active:cursor-grabbing dark:hover:bg-gray-800 dark:hover:ring-gray-700'
          }
        `}
        title={isCollapsed ? label : undefined}
        aria-label={label}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105 ${accent.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{label}</span>
              {isDisabled && (
                <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {t('workflow.palette.underDevelopment', 'Under Development')}
                </span>
              )}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500">
              {description}
            </div>
          </div>
        )}

        {!isCollapsed && !isDisabled && (
          <GripVertical className="h-4 w-4 shrink-0 text-gray-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-gray-600" />
        )}
      </div>
    );
  };

  return (
    <aside
      className={`tgo-surface relative z-20 flex shrink-0 flex-col overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsed ? 'w-[76px]' : 'w-[300px]'
      }`}
    >
      {/* Header */}
      <div className={`shrink-0 ${isCollapsed ? 'flex justify-center px-2 pb-2 pt-4' : 'px-5 pb-4 pt-5'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="tgo-eyebrow">{t('workflow.palette.title', 'Components')}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('workflow.palette.dragHint', 'Drag onto the canvas')}</p>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="tgo-icon-btn"
            aria-label={isCollapsed ? t('workflow.palette.expand', 'Expand components') : t('workflow.palette.collapse', 'Collapse components')}
            title={isCollapsed ? t('workflow.palette.expand', 'Expand components') : t('workflow.palette.collapse', 'Collapse components')}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <label className="group relative mt-4 block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-ink-900 dark:group-focus-within:text-white" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('workflow.palette.search', 'Search components...')}
              className="h-10 w-full rounded-full bg-gray-100 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
            />
          </label>
        )}
      </div>

      {/* Node List with Categories */}
      <div className={`flex-1 space-y-5 overflow-y-auto pb-5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {groupedNodes.map((cat) => (
          <div key={cat.id} className="space-y-1">
            {isCollapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-gray-200 dark:bg-gray-800" />
            ) : (
              <div className="flex items-center gap-2 px-2 pb-1">
                <span className="tgo-eyebrow">{t(cat.label, cat.defaultLabel)}</span>
                <span className="text-[10px] tabular-nums text-gray-300 dark:text-gray-600">{cat.nodes.length}</span>
              </div>
            )}
            <div className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
              {cat.nodes.map(type => renderNodeItem(type))}
            </div>
          </div>
        ))}

        {groupedNodes.length === 0 && (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-xs text-gray-400">
              {t('workflow.palette.noMatch', 'No components found')}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NodePalette;
