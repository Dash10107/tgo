/**
 * LLM Node Component
 * Direct LLM call in the workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LLMNodeData } from '@/types/workflow';
import NodeShell, { NodeChip, NodePreview } from './NodeShell';

const LLMNode: React.FC<NodeProps<LLMNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasPrompt = Boolean(data.user_prompt);
  const defaultLabel = t('workflow.node_types.llm.label', 'LLM Call');

  const getPromptPreview = () => {
    if (!data.user_prompt) return t('workflow.node_display.not_configured_prompt', 'Prompt Not Configured');
    return data.user_prompt.length > 80
      ? `${data.user_prompt.slice(0, 80)}...`
      : data.user_prompt;
  };

  return (
    <NodeShell
      id={id}
      type="llm"
      label={data.label || defaultLabel}
      icon={Sparkles}
      selected={selected}
      width={288}
      required={!hasPrompt}
      subtitle={data.model_name ? <NodeChip type="llm">{data.model_name}</NodeChip> : undefined}
    >
      <NodePreview title={t('workflow.node_display.prompt_preview', 'Prompt Preview')}>
        {getPromptPreview()}
      </NodePreview>
    </NodeShell>
  );
};

export default memo(LLMNode);
