/**
 * Event Node Component
 * Custom event trigger for workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EventNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const EventNode: React.FC<NodeProps<EventNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.event.label', 'Event Trigger');

  return (
    <NodeShell
      id={id}
      type="event"
      label={data.label || defaultLabel}
      icon={Zap}
      selected={selected}
      width={248}
      hasTarget={false}
      subtitle={
        <NodeChip type="event">{data.event_type || t('workflow.node_display.custom_event', 'Custom Event')}</NodeChip>
      }
    />
  );
};

export default memo(EventNode);
