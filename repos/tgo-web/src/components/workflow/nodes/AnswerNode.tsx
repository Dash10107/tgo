/**
 * Answer Node Component
 * Final reply / output of the workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AnswerNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const AnswerNode: React.FC<NodeProps<AnswerNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.answer.label', 'Answer');

  const getOutputSummary = () => {
    switch (data.output_type) {
      case 'variable':
        return data.output_variable ? `REF: ${data.output_variable}` : t('workflow.node_display.not_configured_variable', 'Variable Not Configured');
      case 'template':
        return t('workflow.node_display.template_output', 'Text Template');
      case 'structured':
        return t('workflow.node_display.fields_count', `{{count}} Fields`, { count: data.output_structure?.length || 0 });
      default:
        return 'Workflow Output';
    }
  };

  return (
    <NodeShell
      id={id}
      type="answer"
      label={data.label || defaultLabel}
      icon={MessageSquare}
      selected={selected}
      width={256}
      hasSource={false}
      subtitle={<NodeChip type="answer" mono={data.output_type === 'variable'}>{getOutputSummary()}</NodeChip>}
    />
  );
};

export default memo(AnswerNode);
