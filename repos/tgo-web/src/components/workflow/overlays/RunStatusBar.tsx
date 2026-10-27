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

  let tone = 'bg-ink-900/85 text-white ring-white/10';
  let icon = (
    <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-acid-400 text-ink-900">
      <span className="absolute inset-0 animate-ping rounded-full bg-acid-400/50" />
      <Loader2 className="relative w-3.5 h-3.5 animate-spin" />
    </span>
  );
  let text: string;
  let meta: string | null = null;

  if (isExecuting) {
    text = runningStep
      ? t('workflow.debug.running_node', 'Running {{name}}', { name: labelOf(runningStep.node_id, runningStep.node_type) })
      : t('workflow.debug.starting', 'Starting...');
    meta = `${t('workflow.debug.step', 'Step {{count}}', { count: Math.max(1, steps.length) })} · ${formatDuration(elapsed)}`;
  } else if (currentExecution?.status === 'completed') {
    tone = 'bg-ink-900/85 text-white ring-acid-400/40';
    icon = (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-acid-400 text-ink-900">
        <CheckCircle2 className="w-3.5 h-3.5" />
      </span>
    );
    text = t('workflow.debug.completed_steps', 'Completed {{count}} steps', { count: steps.length });
    meta = currentExecution.duration !== undefined && currentExecution.duration !== null
      ? formatDuration(currentExecution.duration)
      : null;
  } else if (currentExecution?.status === 'cancelled') {
    icon = (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white/70">
        <XCircle className="w-3.5 h-3.5" />
      </span>
    );
    text = t('workflow.debug.cancelled', 'Cancelled');
  } else {
    tone = 'bg-ink-900/85 text-white ring-rose-400/50';
    icon = (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white">
        <XCircle className="w-3.5 h-3.5" />
      </span>
    );
    text = failedStep
      ? t('workflow.debug.failed_at', 'Failed at {{name}}', { name: labelOf(failedStep.node_id, failedStep.node_type) })
      : t('workflow.debug.failed', 'Failed');
  }

  return (
    <div
      className={`wf-status-in relative overflow-hidden flex items-center gap-2.5 pl-2 pr-4 h-10 rounded-full ring-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center">{icon}</span>
      <span key={text} className="wf-fade-in text-sm font-semibold max-w-[260px] truncate">{text}</span>
      {meta && <span className="text-xs font-mono tabular-nums text-white/50">{meta}</span>}
      {isExecuting && (
        <span className="absolute left-0 right-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
          <span className="wf-shimmer block h-full w-2/5 bg-gradient-to-r from-transparent via-acid-400 to-transparent" />
        </span>
      )}
    </div>
  );
};

export default RunStatusBar;
