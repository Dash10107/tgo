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
import { getEdgePalette, type EdgeRunState } from '../overlays/runState';

export interface CustomEdgeData {
  label?: string;
  runState?: EdgeRunState;
  /** Canvas theme, so strokes and sparks stay visible on both backgrounds */
  isDark?: boolean;
}

// Three sparks travel along an active edge, evenly spaced in time
const SPARK_OFFSETS = ['0s', '-0.4s', '-0.8s'];

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
    borderRadius: 18,
  });

  const getLabelColor = () => {
    if (data?.label === 'true' || data?.label === 'yes' || data?.label === '是') { // '是' is the legacy Chinese "yes" label
      return 'bg-acid-400 text-ink-900';
    }
    if (data?.label === 'false' || data?.label === 'no' || data?.label === '否') { // '否' is the legacy Chinese "no" label
      return 'bg-rose-500 text-white';
    }
    return 'bg-ink-700 text-gray-200 ring-1 ring-white/10';
  };

  const runState: EdgeRunState = data?.runState ?? 'idle';
  const isActive = runState === 'active';
  const isHighlighted = isActive || runState === 'traversed';
  const palette = getEdgePalette(data?.isDark ?? true);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2.5 : 1.75,
          stroke: selected ? palette.selected : palette.stroke[runState === 'traversed' || isActive ? 'idle' : runState],
          opacity: runState === 'inactive' ? 0.5 : 1,
          transition: 'stroke 0.4s, stroke-width 0.4s, opacity 0.4s',
        }}
      />

      {/* Taken path: a soft halo plus a bright line that draws itself from source to target */}
      {isHighlighted && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={palette.stroke[runState]}
            strokeWidth={10}
            strokeOpacity={0.14}
            strokeLinecap="round"
            pointerEvents="none"
            className="wf-edge-halo"
          />
          <path
            d={edgePath}
            fill="none"
            stroke={palette.stroke[runState]}
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={1}
            pointerEvents="none"
            className="wf-edge-draw"
          />
        </>
      )}

      {/* Data flowing into the node that is running right now */}
      {isActive && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={palette.flow}
            strokeWidth={1.5}
            strokeOpacity={0.8}
            className="wf-edge-flow"
            pointerEvents="none"
          />
          {SPARK_OFFSETS.map(begin => (
            <g key={begin} pointerEvents="none">
              <circle r={7} fill={palette.sparkGlow} fillOpacity={0.22}>
                <animateMotion dur="1.2s" begin={begin} repeatCount="indefinite" path={edgePath} />
              </circle>
              <circle r={3} fill={palette.sparkCore}>
                <animateMotion dur="1.2s" begin={begin} repeatCount="indefinite" path={edgePath} />
              </circle>
            </g>
          ))}
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
            className={`nodrag nopan rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold shadow-lg ${getLabelColor()}`}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
