/**
 * Input Node Component
 * User input trigger for workflow
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InputNodeData } from '@/types/workflow';
import NodeShell, { NodeChip } from './NodeShell';

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const defaultLabel = t('workflow.node_types.input.label', 'User Input');
  const inputCount = data.input_variables?.length ?? 0;

  return (
    <NodeShell
      id={id}
      type="input"
      label={data.label || defaultLabel}
      icon={Play}
      selected={selected}
      width={248}
      hasTarget={false}
      subtitle={
        <>
          <NodeChip type="input">{t('workflow.node_display.input_trigger_label', 'User Input Trigger')}</NodeChip>
          {inputCount > 0 && (
            <span className="text-[10.5px] font-medium text-gray-500 dark:text-gray-400">
              {t('workflow.node_display.inputs_defined', `${inputCount} Inputs defined`, { count: inputCount })}
            </span>
          )}
        </>
      }
    />
  );
};

export default memo(InputNode);
