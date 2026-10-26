/**
 * Run Status Bar Component
 * Floating pill on the canvas that tells the user which node is executing right now
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { formatDuration, useElapsed } from './runState';

const RunStatusBar: React.FC = () => {
  const { t } = useTranslation();
  const isExecuting = useWorkflowStore(state => state.isExecuting);
  const currentExecution = useWorkflowStore(state => state.currentExecution);
  const executionError = useWorkflowStore(state => state.executionError);
  const nodeExecutionMap = useWorkflowStore(state => state.nodeExecutionMap);
  const nodes = useWorkflowStore(state => state.currentWorkflow?.definition.nodes);

  const steps = useMemo(
    () => Object.values(nodeExecutionMap).sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    ),
    [nodeExecutionMap]
  );
  const runningStep = steps.find(s => s.status === 'running' || s.status === 'pending');
  const failedStep = steps.find(s => s.status === 'failed');
  const elapsed = useElapsed(currentExecution?.started_at, isExecuting);

  const labelOf = (nodeId: string, nodeType: string) =>
    nodes?.find(n => n.id === nodeId)?.data.label || nodeType;

  if (!isExecuting && !currentExecution && !executionError) return null;

  let tone = 'bg-white/95 dark:bg-gray-900/95 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700';
  let icon = <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  let text: string;
  let meta: string | null = null;

  if (isExecuting) {
    text = runningStep
      ? t('workflow.debug.running_node', 'Running {{name}}', { name: labelOf(runningStep.node_id, runningStep.node_type) })
      : t('workflow.debug.starting', 'Starting...');
    meta = `${t('workflow.debug.step', 'Step {{count}}', { count: Math.max(1, steps.length) })} · ${formatDuration(elapsed)}`;
  } else if (currentExecution?.status === 'completed') {
    tone = 'bg-emerald-50/95 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    text = t('workflow.debug.completed_steps', 'Completed {{count}} steps', { count: steps.length });
    meta = currentExecution.duration !== undefined && currentExecution.duration !== null
      ? formatDuration(currentExecution.duration)
      : null;
  } else if (currentExecution?.status === 'cancelled') {
    icon = <XCircle className="w-4 h-4 text-gray-400" />;
    text = t('workflow.debug.cancelled', 'Cancelled');
  } else {
    tone = 'bg-red-50/95 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
    icon = <XCircle className="w-4 h-4 text-red-500" />;
    text = failedStep
      ? t('workflow.debug.failed_at', 'Failed at {{name}}', { name: labelOf(failedStep.node_id, failedStep.node_type) })
      : t('workflow.debug.failed', 'Failed');
  }

  return (
    <div
      className={`wf-fade-in relative overflow-hidden flex items-center gap-2.5 pl-3 pr-4 h-10 rounded-full border shadow-lg backdrop-blur ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center">{icon}</span>
      <span key={text} className="wf-fade-in text-sm font-semibold max-w-[260px] truncate">{text}</span>
      {meta && <span className="text-xs font-mono tabular-nums opacity-70">{meta}</span>}
      {isExecuting && (
        <span className="absolute left-0 right-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
          <span className="wf-shimmer block h-full w-2/5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        </span>
      )}
    </div>
  );
};

export default RunStatusBar;
