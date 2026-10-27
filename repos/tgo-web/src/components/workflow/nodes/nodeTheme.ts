/**
 * Node Theme
 * Shared accent colors for workflow node types (canvas nodes, palette, config panel, minimap)
 */

import type { WorkflowNodeType } from '@/types/workflow';

export interface NodeAccent {
  /** Classes for the solid icon disc in a node header */
  icon: string;
  /** Classes for small tinted chips (model names, methods, branch labels) */
  chip: string;
  /** Raw color used by the minimap and edge markers */
  hex: string;
}

const TRIGGER: NodeAccent = {
  icon: 'bg-acid-300 text-ink-900',
  chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300',
  hex: '#b6db34',
};

const SKY: NodeAccent = {
  icon: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  chip: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  hex: '#38bdf8',
};

const VIOLET: NodeAccent = {
  icon: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  chip: 'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  hex: '#8b5cf6',
};

const AMBER: NodeAccent = {
  icon: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  chip: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  hex: '#f59e0b',
};

const ORANGE: NodeAccent = {
  icon: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  chip: 'bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300',
  hex: '#f97316',
};

const ROSE: NodeAccent = {
  icon: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  chip: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  hex: '#f43f5e',
};

const TEAL: NodeAccent = {
  icon: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
  chip: 'bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300',
  hex: '#14b8a6',
};

const INK: NodeAccent = {
  icon: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
  chip: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  // Mid gray so output nodes stay visible on both light and dark minimaps
  hex: '#a1a1a9',
};

export const NODE_ACCENTS: Record<WorkflowNodeType, NodeAccent> = {
  input: TRIGGER,
  timer: TRIGGER,
  webhook: TRIGGER,
  event: TRIGGER,
  agent: SKY,
  llm: VIOLET,
  condition: AMBER,
  parallel: AMBER,
  classifier: ORANGE,
  tool: ROSE,
  api: TEAL,
  answer: INK,
};

export const getNodeAccent = (type: string | undefined): NodeAccent =>
  NODE_ACCENTS[type as WorkflowNodeType] ?? INK;
