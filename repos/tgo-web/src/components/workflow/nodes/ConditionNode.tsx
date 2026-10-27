/**
 * Condition Node Component
 * Branching logic in the workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConditionNodeData } from '@/types/workflow';
import NodeShell, { NodePreview, type NodeBranch } from './NodeShell';

const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasCondition = Boolean(data.expression || data.variable || data.llm_prompt);
  const defaultLabel = t('workflow.node_types.condition.label', 'Condition');

  const getConditionSummary = () => {
    if (data.condition_type === 'expression' && data.expression) {
      return data.expression.length > 60
        ? `${data.expression.slice(0, 60)}...`
        : data.expression;
    }
    if (data.condition_type === 'variable' && data.variable) {
      return `${data.variable} ${data.operator || '=='} ${data.compare_value || ''}`;
    }
    if (data.condition_type === 'llm') {
      return t('workflow.node_display.llm_evaluation', 'LLM Evaluation');
    }
    return t('workflow.node_display.not_configured_condition', 'Condition Not Configured');
  };

  const branches: NodeBranch[] = [
    { id: 'true', label: t('common.yes', 'Yes'), tone: 'yes' },
    { id: 'false', label: t('common.no', 'No'), tone: 'no' },
  ];

  return (
    <NodeShell
      id={id}
      type="condition"
      label={data.label || defaultLabel}
      icon={GitBranch}
      selected={selected}
      required={!hasCondition}
      branches={branches}
    >
      <NodePreview title={t('workflow.node_types.condition.label', 'Condition')} mono={data.condition_type !== 'llm'}>
        {getConditionSummary()}
      </NodePreview>
    </NodeShell>
  );
};

export default memo(ConditionNode);
