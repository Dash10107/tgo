/**
 * Run state helpers
 * Derives how each node and edge should look while a debug run is in progress or after it ends
 */

import { useEffect, useState } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { NodeExecution } from '@/types/workflow';

export type NodeRunState = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type EdgeRunState = 'idle' | 'active' | 'traversed' | 'inactive';

export interface EdgePalette {
  /** Edge stroke per run state */
  stroke: Record<EdgeRunState, string>;
  selected: string;
  /** Dashed overlay on the edge feeding the running node */
  flow: string;
  /** Soft glow and bright core of the sparks travelling along an active edge */
  sparkGlow: string;
  sparkCore: string;
  /** Line drawn while the user drags out a new connection */
  connection: string;
}

/** Edge colors for each canvas theme */
export const EDGE_PALETTES: Record<'light' | 'dark', EdgePalette> = {
  light: {
    stroke: {
      idle: '#b4b4bc',
      active: '#8fb31e',
      traversed: '#8fb31e',
      inactive: '#e4e4e7',
    },
    selected: '#0f1012',
    flow: '#ffffff',
    sparkGlow: '#b6db34',
    sparkCore: '#1f2024',
    connection: '#8fb31e',
  },
  dark: {
    stroke: {
      idle: '#5d6068',
      active: '#cdee55',
      traversed: '#b6db34',
      inactive: '#3a3c42',
    },
    selected: '#f4f4f5',
    flow: '#f4fbd6',
    sparkGlow: '#cdee55',
    sparkCore: '#f7fde0',
    connection: '#cdee55',
  },
};

export const getEdgePalette = (isDark: boolean): EdgePalette => EDGE_PALETTES[isDark ? 'dark' : 'light'];

/** Whether there is a run to visualize (in progress, finished, or failed to start) */
export const useHasRun = (): boolean =>
  useWorkflowStore(state =>
    state.isExecuting || state.currentExecution !== null || Object.keys(state.nodeExecutionMap).length > 0
  );

export const getNodeRunState = (
  execution: NodeExecution | undefined,
  isExecuting: boolean,
  hasRun: boolean,
): NodeRunState => {
  if (execution) {
    if (execution.status === 'running' || execution.status === 'pending') return 'running';
    if (execution.status === 'completed') return 'completed';
    return 'failed';
  }
  if (isExecuting) return 'pending';
  return hasRun ? 'skipped' : 'idle';
};

export const useNodeRunState = (nodeId: string): { state: NodeRunState; execution?: NodeExecution } => {
  const execution = useWorkflowStore(state => state.nodeExecutionMap[nodeId]);
  const isExecuting = useWorkflowStore(state => state.isExecuting);
  const hasRun = useHasRun();
  return { state: getNodeRunState(execution, isExecuting, hasRun), execution };
};

export const getEdgeRunState = (
  source: NodeExecution | undefined,
  target: NodeExecution | undefined,
  isExecuting: boolean,
  hasRun: boolean,
): EdgeRunState => {
  if (!hasRun) return 'idle';
  if (source?.status === 'completed' && target) {
    return target.status === 'running' || target.status === 'pending' ? 'active' : 'traversed';
  }
  // While running, edges ahead of the current node stay neutral; once done, untaken branches fade
  return isExecuting ? 'idle' : 'inactive';
};

/** Milliseconds elapsed since `startedAt`, ticking while `active` */
export const useElapsed = (startedAt: string | undefined, active: boolean): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!startedAt) return 0;
  return Math.max(0, now - new Date(startedAt).getTime());
};

export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
