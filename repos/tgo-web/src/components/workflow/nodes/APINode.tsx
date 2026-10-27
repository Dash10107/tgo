/**
 * API Node Component
 * Calls an external HTTP API
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { APINodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const APINode: React.FC<NodeProps<APINodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.api.label', 'API Call');

  return (
    <NodeShell
      id={id}
      type="api"
      label={data.label || defaultLabel}
      icon={Globe}
      selected={selected}
      subtitle={
        <>
          <NodeChip type="api">{data.method || 'GET'}</NodeChip>
          <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
            {data.url || 'https://api.example.com'}
          </span>
        </>
      }
    />
  );
};

export default memo(APINode);
