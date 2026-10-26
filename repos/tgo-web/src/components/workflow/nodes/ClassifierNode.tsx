/**
 * Classifier Node Component
 * Categorizes input using LLM - Minimal Clean Redesign
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassifierNodeData } from '@/types/workflow';
import NodeExecutionOverlay from '../overlays/NodeExecutionOverlay';

const ClassifierNode: React.FC<NodeProps<ClassifierNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasInput = Boolean(data.input_variable);
  const categories = data.categories || [];
  const defaultLabel = t('workflow.node_types.classifier.label', 'Question Classifier');
  // Give every category its own labeled output port
  const width = Math.max(300, categories.length * 112 + 40);
  const columns = { gridTemplateColumns: `repeat(${Math.max(1, categories.length)}, minmax(0, 1fr))` };
  
  return (
    <div
      style={{ width }}
      className={`
        px-5 pt-4 pb-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border
        flex flex-col gap-3 transition-all duration-200 relative
        ${selected 
          ? 'border-orange-500 ring-4 ring-orange-500/10' 
          : 'border-gray-100 dark:border-gray-700 hover:shadow-md'
        }
      `}
    >
      <NodeExecutionOverlay nodeId={id} label={data.label || defaultLabel} />
      {/* Colored Side Bar */}
      <div className="absolute left-0 top-4 bottom-4 w-1 bg-orange-500 rounded-r-full" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white dark:!border-gray-800 !shadow-sm"
      />
      
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
          <LayoutGrid className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {data.label || defaultLabel}
          </div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            {t('workflow.node_display.classifier_categories_count', `{{count}} Categories`, { count: categories.length })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100/50 dark:border-gray-700/50">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
          {hasInput ? `${t('workflow.node_display.input_label', 'In')}: ${data.input_variable}` : t('workflow.node_display.input_required', 'Input Required')}
        </span>
        {!hasInput && (
          <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
            {t('common.required', 'REQUIRED')}
          </span>
        )}
      </div>

      {/* One labeled output per category; the handle sits right below its label */}
      <div className="grid gap-2" style={columns}>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="min-h-[34px] px-1.5 py-1.5 text-center bg-orange-50/70 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 rounded-lg text-[10px] leading-tight font-semibold text-orange-700 dark:text-orange-300 line-clamp-2 break-words"
            title={cat.description ? `${cat.name}: ${cat.description}` : cat.name}
          >
            {cat.name}
          </div>
        ))}
      </div>

      <div className="absolute left-5 right-5 bottom-0 h-0 grid gap-2" style={columns}>
        {categories.map((cat) => (
          <div key={cat.id} className="relative h-0">
            <Handle
              type="source"
              position={Position.Bottom}
              id={cat.id}
              className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white dark:!border-gray-800 !shadow-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(ClassifierNode);

