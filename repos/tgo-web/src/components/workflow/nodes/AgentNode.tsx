/**
 * Agent Node Component
 * Hands the conversation to an AI agent
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const AgentNode: React.FC<NodeProps<AgentNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasAgent = Boolean(data.agent_id);
  const defaultLabel = t('workflow.node_types.agent.label', 'AI Agent');

  return (
    <NodeShell
      id={id}
      type="agent"
      label={data.label || defaultLabel}
      icon={Bot}
      selected={selected}
      required={!hasAgent}
      subtitle={
        hasAgent ? (
          <NodeChip type="agent">{data.agent_name || data.agent_id}</NodeChip>
        ) : (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {t('workflow.node_display.not_configured_agent', 'Agent Not Configured')}
          </span>
        )
      }
    />
  );
};

export default memo(AgentNode);
