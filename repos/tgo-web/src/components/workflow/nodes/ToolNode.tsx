/**
 * Tool Node Component
 * Calls a configured tool
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ToolNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const ToolNode: React.FC<NodeProps<ToolNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const hasTool = Boolean(data.tool_id);
  const defaultLabel = t('workflow.node_types.tool.label', 'Tool');

  return (
    <NodeShell
      id={id}
      type="tool"
      label={data.label || defaultLabel}
      icon={Wrench}
      selected={selected}
      required={!hasTool}
      subtitle={
        hasTool ? (
          <NodeChip type="tool">{data.tool_name || data.tool_id}</NodeChip>
        ) : (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {t('workflow.node_display.not_configured_tool', 'Tool Not Configured')}
          </span>
        )
      }
    />
  );
};

export default memo(ToolNode);
