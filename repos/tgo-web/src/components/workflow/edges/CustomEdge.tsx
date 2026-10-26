/**
 * Custom Edge Component
 * Styled edge with optional labels for conditional branches and debug-run animation
 */

import React from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import type { EdgeRunState } from '../overlays/runState';

export interface CustomEdgeData {
  label?: string;
  runState?: EdgeRunState;
}

const STROKE: Record<EdgeRunState, string> = {
  idle: '#a5b4c8',
  active: '#3b82f6',
  traversed: '#10b981',
  inactive: '#cbd5e1',
};

const CustomEdge: React.FC<EdgeProps<CustomEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const getLabelColor = () => {
    if (data?.label === 'true' || data?.label === 'yes' || data?.label === '是') { // '是' is the legacy Chinese "yes" label
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    }
    if (data?.label === 'false' || data?.label === 'no' || data?.label === '否') { // '否' is the legacy Chinese "no" label
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
    }
    return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
  };

  const runState: EdgeRunState = data?.runState ?? 'idle';
  const isActive = runState === 'active';
  const isHighlighted = isActive || runState === 'traversed';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected || isHighlighted ? 2.5 : 1.75,
          stroke: selected ? '#6366f1' : STROKE[runState],
          opacity: runState === 'inactive' ? 0.45 : 1,
          transition: 'stroke 0.4s, stroke-width 0.4s, opacity 0.4s',
        }}
      />

      {/* Soft glow under the taken path */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={STROKE[runState]}
          strokeWidth={8}
          strokeOpacity={0.15}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Data flowing into the node that is running right now */}
      {isActive && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="#93c5fd"
            strokeWidth={2.5}
            className="wf-edge-flow"
            pointerEvents="none"
          />
          <circle r={4.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} pointerEvents="none">
            <animateMotion dur="1.1s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}

      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`
              px-2 py-0.5 text-xs font-medium rounded border
              ${getLabelColor()}
            `}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
