/**
 * Timer Node Component
 * Scheduled trigger for workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimerNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const TimerNode: React.FC<NodeProps<TimerNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.timer.label', 'Timer Trigger');

  return (
    <NodeShell
      id={id}
      type="timer"
      label={data.label || defaultLabel}
      icon={Clock}
      selected={selected}
      width={248}
      hasTarget={false}
      subtitle={
        <NodeChip type="timer" mono={Boolean(data.cron_expression)}>
          {data.cron_expression || t('workflow.node_display.scheduled', 'Scheduled')}
        </NodeChip>
      }
    />
  );
};

export default memo(TimerNode);
