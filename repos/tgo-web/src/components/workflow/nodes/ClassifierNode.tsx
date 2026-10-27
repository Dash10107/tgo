/**
 * Classifier Node Component
 * Routes the conversation to one labeled output per category
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassifierNodeData } from '@/types/workflow';
import NodeShell, { NodeChip, type NodeBranch } from './NodeShell';

const ClassifierNode: React.FC<NodeProps<ClassifierNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasInput = Boolean(data.input_variable);
  const categories = data.categories || [];
  const defaultLabel = t('workflow.node_types.classifier.label', 'Question Classifier');
  // Give every category its own labeled output port
  const width = Math.max(300, categories.length * 112 + 32);

  const branches: NodeBranch[] = categories.map(cat => ({
    id: cat.id,
    label: cat.name,
    title: cat.description ? `${cat.name}: ${cat.description}` : cat.name,
    tone: 'accent',
  }));

  return (
    <NodeShell
      id={id}
      type="classifier"
      label={data.label || defaultLabel}
      icon={LayoutGrid}
      selected={selected}
      width={width}
      required={!hasInput}
      branches={branches}
      subtitle={
        <>
          <NodeChip type="classifier">
            {t('workflow.node_display.classifier_categories_count', `{{count}} Categories`, { count: categories.length })}
          </NodeChip>
          <span className={`min-w-0 flex-1 truncate font-mono text-[10.5px] ${hasInput ? 'text-gray-500 dark:text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {hasInput ? `${t('workflow.node_display.input_label', 'In')}: ${data.input_variable}` : t('workflow.node_display.input_required', 'Input Required')}
          </span>
        </>
      }
    />
  );
};

export default memo(ClassifierNode);
