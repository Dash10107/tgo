/**
 * Node Execution Badge Component
 * Displays execution status and duration on top of a node
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { NodeExecution } from '@/types/workflow';
import { formatDuration, useElapsed } from './runState';

interface NodeExecutionBadgeProps {
  execution?: NodeExecution;
  onClick?: () => void;
}

const NodeExecutionBadge: React.FC<NodeExecutionBadgeProps> = ({ execution, onClick }) => {
  const { t } = useTranslation();
  const isRunning = execution?.status === 'running' || execution?.status === 'pending';
  const elapsed = useElapsed(execution?.started_at, isRunning);

  if (!execution) return null;

  const isCompleted = execution.status === 'completed';
  const duration = isRunning ? elapsed : execution.duration;

  const tone = isRunning
    ? 'bg-ink-900 text-acid-300 ring-1 ring-acid-400/60 shadow-[0_6px_20px_-6px_rgba(205,238,85,0.7)]'
    : isCompleted
      ? 'bg-acid-400 text-ink-900 shadow-[0_6px_18px_-8px_rgba(143,179,30,0.9)]'
      : 'bg-rose-500 text-white shadow-[0_6px_18px_-8px_rgba(244,63,94,0.9)]';

  return (
    <button
      type="button"
      className={`wf-run-badge nodrag absolute -top-3 right-4 z-[100] flex items-center gap-1.5 h-6 pl-1.5 pr-2.5 rounded-full shadow-lg cursor-pointer hover:brightness-110 transition-[filter] ${tone}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={t('workflow.debug.view_details', 'View input & output')}
    >
      <span className="flex items-center">
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <XCircle className="w-3.5 h-3.5" />
        )}
      </span>
      <span className="text-[10px] font-semibold tracking-wide">
        {isRunning
          ? t('workflow.debug.node_running', 'Running')
          : isCompleted
            ? t('workflow.debug.node_done', 'Done')
            : t('workflow.debug.failed', 'Failed')}
      </span>
      {duration !== undefined && duration !== null && (
        <span className="text-[10px] font-mono tabular-nums opacity-80 border-l border-current/30 pl-1.5">
          {formatDuration(duration)}
        </span>
      )}
    </button>
  );
};

export default NodeExecutionBadge;
