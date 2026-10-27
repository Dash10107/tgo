/**
 * Node Shell
 * Shared card chrome for every workflow node: header, handles, run overlay and branch outputs
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { NODE_TYPE_CONFIG, type WorkflowNodeType } from '@/types/workflow';
import NodeExecutionOverlay from '../overlays/NodeExecutionOverlay';
import { getNodeAccent } from './nodeTheme';

const KICKER_DEFAULTS: Record<string, string> = {
  trigger: 'Trigger',
  ai: 'AI',
  logic: 'Logic',
  external: 'Integration',
  output: 'Output',
};

export interface NodeBranch {
  /** Handle id used by edges (must stay stable) */
  id: string;
  label: string;
  title?: string;
  tone?: 'yes' | 'no' | 'accent';
}

interface NodeShellProps {
  id: string;
  type: WorkflowNodeType;
  label: string;
  icon: LucideIcon;
  selected: boolean;
  /** Fixed card width in px (defaults to 272) */
  width?: number;
  /** Render the incoming handle on top */
  hasTarget?: boolean;
  /** Render a single outgoing handle at the bottom (ignored when branches are given) */
  hasSource?: boolean;
  /** Labeled outputs, one handle each, laid out along the bottom edge */
  branches?: NodeBranch[];
  /** Shows a "Required" marker when the node still needs configuration */
  required?: boolean;
  /** One-line summary shown under the title */
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

const BRANCH_TONE: Record<NonNullable<NodeBranch['tone']>, { chip: string; handle: string }> = {
  yes: { chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300', handle: 'wf-handle--yes' },
  no: { chip: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300', handle: 'wf-handle--no' },
  accent: { chip: '', handle: '' },
};

/** Small tinted pill used inside node bodies */
export const NodeChip: React.FC<{ type: WorkflowNodeType; mono?: boolean; className?: string; children: React.ReactNode }> = ({
  type,
  mono,
  className,
  children,
}) => (
  <span className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${mono ? 'font-mono' : ''} ${getNodeAccent(type).chip} ${className ?? ''}`}>
    {children}
  </span>
);

/** Muted preview block (prompt text, expressions, URLs) */
export const NodePreview: React.FC<{ title: string; children: React.ReactNode; mono?: boolean }> = ({ title, children, mono }) => (
  <div className="rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/70">
    <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">{title}</div>
    <div className={`line-clamp-2 break-words text-[11.5px] leading-relaxed text-gray-600 dark:text-gray-300 ${mono ? 'font-mono' : ''}`}>
      {children}
    </div>
  </div>
);

const NodeShell: React.FC<NodeShellProps> = ({
  id,
  type,
  label,
  icon: Icon,
  selected,
  width = 272,
  hasTarget = true,
  hasSource = true,
  branches,
  required = false,
  subtitle,
  children,
}) => {
  const { t } = useTranslation();
  const accent = getNodeAccent(type);
  const category = NODE_TYPE_CONFIG[type]?.category ?? 'logic';
  const kicker = t(`workflow.kicker.${category}`, KICKER_DEFAULTS[category] ?? category);
  const columns = branches && branches.length > 0
    ? { gridTemplateColumns: `repeat(${branches.length}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div
      className={`wf-node group relative rounded-[22px] bg-white p-4 dark:bg-gray-900 ${selected ? 'wf-node--selected' : ''}`}
      style={{ width }}
    >
      <NodeExecutionOverlay nodeId={id} label={label} />

      {hasTarget && <Handle type="target" position={Position.Top} className="wf-handle" />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`wf-node-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">{kicker}</div>
          <div className="truncate text-[14px] font-semibold tracking-tight text-gray-900 dark:text-gray-100" title={label}>
            {label}
          </div>
        </div>
        {required && (
          <span
            className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-4 ring-amber-400/20"
            title={t('common.required', 'Required')}
            aria-label={t('common.required', 'Required')}
          />
        )}
      </div>

      {subtitle && <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">{subtitle}</div>}

      {children && <div className="mt-3 space-y-2">{children}</div>}

      {/* Branch outputs: label chips with a handle right below each one */}
      {branches && branches.length > 0 && (
        <>
          <div className="mt-3 grid gap-1.5" style={columns}>
            {branches.map(branch => (
              <div
                key={branch.id}
                title={branch.title ?? branch.label}
                className={`line-clamp-2 min-h-[28px] break-words rounded-xl px-1.5 py-1.5 text-center text-[10.5px] font-semibold leading-tight ${
                  branch.tone && branch.tone !== 'accent' ? BRANCH_TONE[branch.tone].chip : accent.chip
                }`}
              >
                {branch.label}
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-0 left-4 right-4 grid h-0 gap-1.5" style={columns}>
            {branches.map(branch => (
              <div key={branch.id} className="relative h-0">
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={branch.id}
                  className={`wf-handle pointer-events-auto ${branch.tone ? BRANCH_TONE[branch.tone].handle : ''}`}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {hasSource && !branches && <Handle type="source" position={Position.Bottom} className="wf-handle" />}
    </div>
  );
};

export default NodeShell;
