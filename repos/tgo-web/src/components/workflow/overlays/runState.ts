/**
 * Run state helpers
 * Derives how each node and edge should look while a debug run is in progress or after it ends
 */

import { useEffect, useState } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { NodeExecution } from '@/types/workflow';

export type NodeRunState = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type EdgeRunState = 'idle' | 'active' | 'traversed' | 'inactive';

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
