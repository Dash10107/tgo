/**
 * Node Execution Overlay Component
 * A shared overlay for all nodes to display execution status and data
 */

import React, { useState } from 'react';
import NodeExecutionBadge from './NodeExecutionBadge';
import ExecutionDataPopover from './ExecutionDataPopover';
import { useNodeRunState } from './runState';

interface NodeExecutionOverlayProps {
  nodeId: string;
  label: string;
}

const FRAME_CLASS: Record<string, string> = {
  running: 'wf-run-frame wf-run-frame--running',
  completed: 'wf-run-frame wf-run-frame--completed',
  failed: 'wf-run-frame wf-run-frame--failed',
};

const NodeExecutionOverlay: React.FC<NodeExecutionOverlayProps> = ({ nodeId, label }) => {
  const [showPopover, setShowPopover] = useState(false);
  const { state, execution } = useNodeRunState(nodeId);

  if (state === 'idle') return null;

  return (
    <>
      {FRAME_CLASS[state] && <div className={FRAME_CLASS[state]} aria-hidden="true" />}

      {(state === 'pending' || state === 'skipped') && (
        <div
          className={`wf-run-veil ${state === 'skipped' ? 'wf-run-veil--skipped' : ''}`}
          aria-hidden="true"
        />
      )}

      {execution && (
        <NodeExecutionBadge
          execution={execution}
          onClick={() => setShowPopover(!showPopover)}
        />
      )}

      {execution && showPopover && (
        <ExecutionDataPopover
          execution={execution}
          nodeLabel={label}
          onClose={() => setShowPopover(false)}
        />
      )}
    </>
  );
};

export default NodeExecutionOverlay;
