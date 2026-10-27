/**
 * Debug Panel Component
 * Right-side panel for workflow online running and debugging
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Info,
  FlaskConical,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Braces,
  Sparkles,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { NodeExecution, WorkflowNode } from '@/types/workflow';
import { formatDuration, useElapsed } from '../overlays/runState';
import { getNodeAccent } from '../nodes/nodeTheme';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface InputVariable {
  name: string;
  type: string;
  description?: string;
  nodeId: string;
}

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => setCopied(false));
      }}
      className="p-1.5 rounded-full text-gray-400 hover:text-ink-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-acid-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const JsonBlock: React.FC<{ value: unknown; tone: 'input' | 'output' }> = ({ value, tone }) => (
  <pre className={`p-3 bg-gray-950 rounded-xl text-[11px] leading-relaxed overflow-x-auto font-mono max-h-56 custom-scrollbar ${tone === 'input' ? 'text-sky-300' : 'text-acid-300'}`}>
    {JSON.stringify(value, null, 2)}
  </pre>
);

/** One row of the run timeline */
const TimelineStep: React.FC<{
  execution: NodeExecution;
  node?: WorkflowNode;
  index: number;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}> = ({ execution, node, index, isLast, expanded, onToggle }) => {
  const { t } = useTranslation();
  const isRunning = execution.status === 'running' || execution.status === 'pending';
  const isCompleted = execution.status === 'completed';
  const elapsed = useElapsed(execution.started_at, isRunning);
  const duration = isRunning ? elapsed : execution.duration;
  const hasDetails = Boolean(execution.input || execution.output || execution.error);

  return (
    <li className="wf-fade-in relative pl-10" style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}>
      {/* Connector to the next step */}
      {!isLast && (
        <span
          className={`absolute left-[13px] top-8 -bottom-1 w-0.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-acid-400 dark:bg-acid-600' : 'bg-gray-200 dark:bg-gray-700'}`}
          aria-hidden="true"
        />
      )}

      {/* Status marker */}
      <span className="absolute left-0 top-1 flex items-center justify-center w-7 h-7">
        {isRunning && <span className="absolute inset-0 rounded-full bg-acid-400/40 animate-ping" aria-hidden="true" />}
        <span
          className={`relative flex items-center justify-center w-7 h-7 rounded-full border-2 bg-white dark:bg-gray-900 ${
            isRunning ? 'border-ink-900 text-ink-900 dark:border-acid-400 dark:text-acid-400' : isCompleted ? 'border-acid-500 bg-acid-400 !text-ink-900 dark:!bg-acid-400' : 'border-rose-500 text-rose-500'
          }`}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isCompleted ? (
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          ) : (
            <X className="w-3.5 h-3.5" strokeWidth={3} />
          )}
        </span>
      </span>

      <div className={`rounded-xl border transition-colors ${expanded ? 'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40' : 'border-transparent'}`}>
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasDetails}
          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getNodeAccent(execution.node_type).hex }} />
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-semibold truncate ${isRunning ? 'text-ink-900 dark:text-acid-300' : 'text-gray-800 dark:text-gray-100'}`}>
              {node?.data.label || execution.node_type}
            </span>
            <span className="block text-[11px] text-gray-400 capitalize">
              {isRunning ? t('workflow.debug.node_running', 'Running') : execution.node_type}
            </span>
          </span>
          {duration !== undefined && duration !== null && (
            <span className="text-[11px] font-mono tabular-nums text-gray-400">{formatDuration(duration)}</span>
          )}
          {hasDetails && (
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          )}
        </button>

        {expanded && hasDetails && (
          <div className="wf-fade-in px-3 pb-3 pt-1 space-y-3">
            {execution.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-mono break-words">
                {execution.error}
              </div>
            )}
            {execution.input && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t('workflow.debug.input', 'Input')}</span>
                  <CopyButton text={JSON.stringify(execution.input, null, 2)} label={t('workflow.debug.copy_json', 'Copy JSON')} />
                </div>
                <JsonBlock value={execution.input} tone="input" />
              </div>
            )}
            {execution.output && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t('workflow.debug.output', 'Output')}</span>
                  <CopyButton text={JSON.stringify(execution.output, null, 2)} label={t('workflow.debug.copy_json', 'Copy JSON')} />
                </div>
                <JsonBlock value={execution.output} tone="output" />
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

/** Final workflow output, shown as readable fields with a raw JSON fallback */
const FinalOutput: React.FC<{ output: Record<string, JsonValue> }> = ({ output }) => {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const json = JSON.stringify(output, null, 2);
  const entries = Object.entries(output);
  const sectionRef = useRef<HTMLElement>(null);

  // Bring the result into view as soon as the run finishes
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <section ref={sectionRef} className="wf-fade-in space-y-3 scroll-mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-acid-600 dark:text-acid-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('workflow.debug.final_output', 'Final Output')}</h4>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className={`p-1.5 rounded-lg transition-colors ${showRaw ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title={t('workflow.debug.raw_json', 'Raw JSON')}
            aria-label={t('workflow.debug.raw_json', 'Raw JSON')}
            aria-pressed={showRaw}
          >
            <Braces className="w-3.5 h-3.5" />
          </button>
          <CopyButton text={json} label={t('workflow.debug.copy_json', 'Copy JSON')} />
        </div>
      </div>

      {showRaw || entries.length === 0 ? (
        <JsonBlock value={output} tone="output" />
      ) : (
        <div className="rounded-2xl border border-acid-200 dark:border-acid-400/20 bg-acid-50 dark:bg-acid-400/5 divide-y divide-acid-200/70 dark:divide-acid-400/15">
          {entries.map(([key, value]) => (
            <div key={key} className="px-4 py-3 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-acid-800/70 dark:text-acid-300/70">{key}</div>
              {typeof value === 'string' ? (
                <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">{value}</p>
              ) : (
                <pre className="text-xs text-gray-700 dark:text-gray-200 font-mono whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const DebugPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    currentWorkflow,
    isExecuting,
    executionError,
    currentExecution,
    nodeExecutionMap,
    setDebugPanelOpen,
    startExecution,
    cancelExecution,
    clearExecution,
    debugInput,
    setDebugInput,
  } = useWorkflowStore();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const runElapsed = useElapsed(currentExecution?.started_at, isExecuting);

  const nodes = useMemo(() => currentWorkflow?.definition?.nodes || [], [currentWorkflow]);

  const inputVariables = useMemo(() => {
    const vars: InputVariable[] = [];
    nodes.filter(n => n.type === 'input').forEach(node => {
      const variables = (node.data as { input_variables?: Omit<InputVariable, 'nodeId'>[] }).input_variables;
      if (Array.isArray(variables)) {
        variables.forEach(v => vars.push({ ...v, nodeId: node.id }));
      }
    });
    return vars;
  }, [nodes]);

  const handleInputChange = (name: string, value: string, type: string) => {
    let typedValue: string | number | boolean = value;
    if (type === 'number') {
      typedValue = value === '' ? '' : Number(value);
    } else if (type === 'boolean') {
      typedValue = value === 'true';
    }
    setDebugInput({ ...debugInput, [name]: typedValue });
  };

  const handleRun = () => {
    setExpandedNodes({});
    startExecution(debugInput);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isExecuting) {
      e.preventDefault();
      handleRun();
    }
  };

  // Live updates come from the stream map; fall back to the stored executions for history
  const executedNodes = useMemo(() => {
    const list = Object.keys(nodeExecutionMap).length > 0
      ? Object.values(nodeExecutionMap)
      : currentExecution?.node_executions ?? [];
    return [...list].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  }, [currentExecution, nodeExecutionMap]);

  const hasRun = Boolean(currentExecution || isExecuting || executionError);
  const status = isExecuting ? 'running' : currentExecution?.status ?? (executionError ? 'failed' : 'pending');
  const totalDuration = isExecuting ? runElapsed : currentExecution?.duration;

  const statusChip: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    running: {
      label: t('workflow.debug.running', 'Running...'),
      className: 'bg-ink-900 text-acid-300 border-ink-900 dark:bg-acid-400/15 dark:text-acid-300 dark:border-acid-400/30',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
    completed: {
      label: t('workflow.debug.success', 'Success'),
      className: 'bg-acid-300 text-ink-900 border-acid-400 dark:bg-acid-400 dark:text-ink-900 dark:border-acid-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    failed: {
      label: t('workflow.debug.failed', 'Failed'),
      className: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: t('workflow.debug.cancelled', 'Cancelled'),
      className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    pending: {
      label: t('workflow.debug.pending', 'Pending'),
      className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      icon: <Loader2 className="w-3.5 h-3.5" />,
    },
  };
  const chip = statusChip[status] ?? statusChip.pending;

  return (
    <aside className="tgo-surface wf-slide-in-right z-20 flex w-[26rem] max-w-[90vw] flex-shrink-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">{t('workflow.debug.title', 'Online Debug')}</h3>
            <p className="mt-0.5 truncate text-xs text-gray-400">{t('workflow.debug.subtitle', 'Run the workflow with test input')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDebugPanelOpen(false)}
          className="tgo-icon-btn"
          aria-label={t('common.close', 'Close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 px-5 pb-6 pt-1">
          {/* Input Variables Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('workflow.debug.input_variables', 'Input Variables')}</h4>
              {inputVariables.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDebugInput({})}
                  disabled={isExecuting}
                  className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-ink-900 dark:hover:text-white transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('workflow.debug.reset', 'Reset')}</span>
                </button>
              )}
            </div>

            {inputVariables.length > 0 ? (
              <div className="space-y-5">
                {inputVariables.map((v) => {
                  const fieldId = `debug-input-${v.nodeId}-${v.name}`;
                  const fieldClass = 'w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900';
                  return (
                    <div key={`${v.nodeId}-${v.name}`} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={fieldId} className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {v.name}
                        </label>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{v.type}</span>
                      </div>
                      {v.description && (
                        <p className="text-xs text-gray-400 leading-relaxed">{v.description}</p>
                      )}
                      {v.type === 'boolean' ? (
                        <select
                          id={fieldId}
                          value={String(debugInput[v.name] ?? 'false')}
                          onChange={(e) => handleInputChange(v.name, e.target.value, v.type)}
                          className={`${fieldClass} cursor-pointer`}
                          disabled={isExecuting}
                        >
                          <option value="true">{t('common.true', 'True')}</option>
                          <option value="false">{t('common.false', 'False')}</option>
                        </select>
                      ) : v.type === 'number' ? (
                        <input
                          id={fieldId}
                          type="number"
                          value={debugInput[v.name] ?? ''}
                          onChange={(e) => handleInputChange(v.name, e.target.value, v.type)}
                          onKeyDown={handleInputKeyDown}
                          className={fieldClass}
                          placeholder={`${t('common.please_input', 'Please input')} ${v.name}...`}
                          disabled={isExecuting}
                        />
                      ) : (
                        <textarea
                          id={fieldId}
                          rows={3}
                          value={debugInput[v.name] ?? ''}
                          onChange={(e) => handleInputChange(v.name, e.target.value, v.type)}
                          onKeyDown={handleInputKeyDown}
                          className={`${fieldClass} resize-y min-h-[80px] leading-relaxed`}
                          placeholder={`${t('common.please_input', 'Please input')} ${v.name}...`}
                          disabled={isExecuting}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
                <p className="text-sm text-gray-400">{t('workflow.debug.no_input_variables', 'No input variables')}</p>
              </div>
            )}

            {/* Run / Stop are separate keyed buttons so React swaps them whole */}
            {!isExecuting ? (
              <button
                key="run"
                type="button"
                onClick={handleRun}
                className="group flex h-12 w-full items-center justify-between rounded-full bg-ink-900 pl-1.5 pr-5 text-sm font-medium text-white shadow-[0_14px_30px_-14px_rgba(15,16,18,0.8)] transition-all duration-300 hover:-translate-y-px active:scale-[0.99] dark:bg-acid-400 dark:text-ink-900"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acid-400 text-ink-900 transition-transform duration-300 group-hover:scale-110 dark:bg-ink-900 dark:text-acid-400">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
                <span>{t('workflow.debug.run', 'Run Workflow')}</span>
                <kbd className="hidden rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-medium sm:inline dark:bg-ink-900/10">⌘/Ctrl ↵</kbd>
              </button>
            ) : (
              <button
                key="stop"
                type="button"
                onClick={() => cancelExecution()}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-rose-50 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t('workflow.debug.stop', 'Stop')}</span>
              </button>
            )}
          </section>

          {/* Execution Status Section */}
          {hasRun && (
            <section className="wf-fade-in space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('workflow.debug.execution_status', 'Execution Status')}</h4>
                {!isExecuting && (
                  <button
                    type="button"
                    onClick={() => clearExecution()}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                    title={t('workflow.debug.clear', 'Clear Result')}
                    aria-label={t('workflow.debug.clear', 'Clear Result')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden">
                <div className="relative px-4 py-3 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/40">
                  <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-semibold ${chip.className}`}>
                    {chip.icon}
                    <span>{chip.label}</span>
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>{t('workflow.debug.steps_count', '{{count}} steps', { count: executedNodes.length })}</span>
                    {totalDuration !== undefined && totalDuration !== null && (
                      <span className="font-mono tabular-nums text-gray-700 dark:text-gray-200">{formatDuration(totalDuration)}</span>
                    )}
                  </span>
                  {isExecuting && (
                    <span className="absolute left-0 right-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
                      <span className="wf-shimmer block h-full w-2/5 bg-gradient-to-r from-transparent via-acid-500 to-transparent" />
                    </span>
                  )}
                </div>

                {executionError && (
                  <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    <p className="font-semibold mb-1 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t('workflow.debug.error', 'Execution Error')}</span>
                    </p>
                    <p className="break-words">{executionError}</p>
                  </div>
                )}

                {currentExecution?.error && !executionError && (
                  <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 leading-relaxed break-words">
                    {currentExecution.error}
                  </div>
                )}

                {/* Timeline */}
                <div className="p-4">
                  {executedNodes.length > 0 ? (
                    <ol className="space-y-2">
                      {executedNodes.map((ne, i) => (
                        <TimelineStep
                          key={ne.node_id}
                          execution={ne}
                          node={nodes.find(n => n.id === ne.node_id)}
                          index={i}
                          isLast={i === executedNodes.length - 1}
                          expanded={Boolean(expandedNodes[ne.node_id])}
                          onToggle={() => setExpandedNodes(prev => ({ ...prev, [ne.node_id]: !prev[ne.node_id] }))}
                        />
                      ))}
                    </ol>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                      {isExecuting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{t('workflow.debug.waiting', 'Waiting for execution...')}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Final Output Section */}
          {currentExecution?.output && !isExecuting && (
            <FinalOutput output={currentExecution.output as Record<string, JsonValue>} />
          )}
        </div>
      </div>

      {/* Persistence Note */}
      <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {t('workflow.debug.persistence_note', 'Execution results in debug mode are for preview only and will not affect the online workflow version.')}
        </p>
      </div>
    </aside>
  );
};

export default DebugPanel;
