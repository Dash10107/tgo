/**
 * Parallel Node Component
 * Fans out into several branches that run at the same time
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GitMerge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ParallelNodeData } from '@/types/workflow';
import NodeShell, { NodeChip, type NodeBranch } from './NodeShell';

const ParallelNode: React.FC<NodeProps<ParallelNodeData>> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const branchCount = data.branches || 2;
  const defaultLabel = t('workflow.node_types.parallel.label', 'Parallel');

  const branches: NodeBranch[] = Array.from({ length: Math.min(branchCount, 5) }, (_, index) => ({
    id: `branch-${index}`,
    label: `#${index + 1}`,
    tone: 'accent',
  }));

  return (
    <NodeShell
      id={id}
      type="parallel"
      label={data.label || defaultLabel}
      icon={GitMerge}
      selected={selected}
      branches={branches}
      subtitle={
        <>
          <NodeChip type="parallel">
            {t('workflow.node_display.branches_count', `${branchCount} Branches`, { count: branchCount })}
          </NodeChip>
          {data.wait_for_all && (
            <span className="text-[10.5px] font-medium text-gray-500 dark:text-gray-400">
              {t('workflow.node_display.wait_for_all', 'Wait for all')}
            </span>
          )}
        </>
      }
    />
  );
};

export default memo(ParallelNode);
