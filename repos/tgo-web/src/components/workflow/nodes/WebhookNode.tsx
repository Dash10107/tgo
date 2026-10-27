/**
 * Webhook Node Component
 * HTTP webhook trigger for workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WebhookNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const WebhookNode: React.FC<NodeProps<WebhookNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.webhook.label', 'Webhook');

  return (
    <NodeShell
      id={id}
      type="webhook"
      label={data.label || defaultLabel}
      icon={Globe}
      selected={selected}
      width={248}
      hasTarget={false}
      subtitle={
        <>
          <NodeChip type="webhook">{data.method || 'POST'}</NodeChip>
          <span className="min-w-0 truncate font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
            {data.path ? `/${data.path}` : '/'}
          </span>
        </>
      }
    />
  );
};

export default memo(WebhookNode);
