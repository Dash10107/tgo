/**
 * Workflow Editor Component
 * Main visual workflow editor using React Flow
 */

import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Connection,
  Panel,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTranslation } from 'react-i18next';
import { Wand2 } from 'lucide-react';

import { useWorkflowStore } from '@/stores/workflowStore';
import { useToast } from '@/hooks/useToast';
import { nodeTypes as importedNodeTypes } from './nodes';
import { edgeTypes as importedEdgeTypes } from './edges';
import type { WorkflowNodeType } from '@/types/workflow';
import RunStatusBar from './overlays/RunStatusBar';
import { getEdgeRunState, type EdgeRunState } from './overlays/runState';
import { computeLayeredLayout } from './utils/autoLayout';

// Define stable objects outside the component to prevent unnecessary re-renders
// and React Flow warnings about unstable references.
const NODE_TYPES = importedNodeTypes;
const EDGE_TYPES = importedEdgeTypes;
const SNAP_GRID: [number, number] = [15, 15];
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: false,
};
const FIT_VIEW_OPTIONS = { padding: 0.18, maxZoom: 1 };
const LAYOUT_ANIMATION_MS = 550;

const EDGE_MARKER_COLORS: Record<EdgeRunState, string> = {
  idle: '#a5b4c8',
  active: '#3b82f6',
  traversed: '#10b981',
  inactive: '#cbd5e1',
};

interface WorkflowEditorProps {
  readOnly?: boolean;
}

const WorkflowEditorInner: React.FC<WorkflowEditorProps> = ({ readOnly = false }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getNode, getViewport, setCenter, fitView } = useReactFlow();
  const [isArranging, setIsArranging] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const {
    currentWorkflow,
    selectedNodeId,
    selectedEdgeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    duplicateNode,
    copyNode,
    pasteNode,
    deleteEdge,
    setSelectedNode,
    undo,
    redo,
    pushHistory,
    nodeExecutionMap,
    isDebugPanelOpen,
    isExecuting,
    startExecution,
    cancelExecution,
    debugInput,
    saveWorkflow,
    isDirty,
    markDirty,
    currentExecution,
  } = useWorkflowStore();

  const nodes = currentWorkflow?.definition?.nodes || [];
  const rawEdges = useMemo(() => currentWorkflow?.definition?.edges || [], [currentWorkflow?.definition?.edges]);

  const hasRun = isExecuting || currentExecution !== null || Object.keys(nodeExecutionMap).length > 0;

  // Display-only edges: rendered by CustomEdge so the run can be animated along the path taken
  const edges = useMemo(() => {
    return rawEdges.map(edge => {
      const runState = getEdgeRunState(nodeExecutionMap[edge.source], nodeExecutionMap[edge.target], isExecuting, hasRun);
      return {
        ...edge,
        type: 'custom',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: EDGE_MARKER_COLORS[runState] },
        data: {
          ...edge.data,
          runState,
        }
      };
    });
  }, [rawEdges, nodeExecutionMap, isExecuting, hasRun]);

  // Show the whole graph when a run starts (the debug panel narrows the canvas)
  useEffect(() => {
    if (!isExecuting) return undefined;
    const timer = window.setTimeout(() => fitView({ ...FIT_VIEW_OPTIONS, duration: 400 }), 50);
    return () => window.clearTimeout(timer);
  }, [isExecuting, fitView]);

  // Keep the node that is currently running in view
  const runningNodeId = useMemo(
    () => Object.values(nodeExecutionMap).find(ne => ne.status === 'running')?.node_id,
    [nodeExecutionMap]
  );
  useEffect(() => {
    if (!runningNodeId || !reactFlowWrapper.current) return;
    const node = getNode(runningNodeId);
    if (!node?.width || !node.height) return;
    const { x, y, zoom } = getViewport();
    const { width, height } = reactFlowWrapper.current.getBoundingClientRect();
    const position = node.positionAbsolute ?? node.position;
    const left = position.x * zoom + x;
    const top = position.y * zoom + y;
    const margin = 40;
    const isVisible = left >= margin && top >= margin
      && left + node.width * zoom <= width - margin
      && top + node.height * zoom <= height - margin;
    if (!isVisible) {
      setCenter(position.x + node.width / 2, position.y + node.height / 2, { zoom, duration: 450 });
    }
  }, [runningNodeId, getNode, getViewport, setCenter]);

  // Arrange nodes top-to-bottom without overlaps, animating them into place
  const handleAutoArrange = useCallback(() => {
    const measured = getNodes();
    if (measured.length === 0) return;
    const positions = computeLayeredLayout(
      measured.map(n => ({
        id: n.id,
        width: n.width ?? 260,
        height: n.height ?? 120,
        x: n.position.x,
        handleOrder: n.type === 'classifier'
          ? ((n.data as { categories?: { id: string }[] }).categories ?? []).map(c => c.id)
          : undefined,
      })),
      rawEdges,
    );
    setIsArranging(true);
    onNodesChange(measured
      .filter(n => positions[n.id])
      .map(n => ({ type: 'position' as const, id: n.id, position: positions[n.id], dragging: false })));
    pushHistory();
    markDirty();
    window.setTimeout(() => fitView({ ...FIT_VIEW_OPTIONS, duration: 500 }), 50);
    window.setTimeout(() => setIsArranging(false), LAYOUT_ANIMATION_MS);
  }, [getNodes, rawEdges, onNodesChange, pushHistory, markDirty, fitView]);

  // Handle node drag stop (push to history and mark dirty)
  const handleNodeDragStop = useCallback(() => {
    pushHistory();
    markDirty();
  }, [pushHistory, markDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || 
                      activeElement?.tagName === 'TEXTAREA' || 
                      (activeElement as HTMLElement)?.isContentEditable;
      
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      // Undo: Cmd+Z
      if (cmdKey && !event.shiftKey && event.key === 'z') {
        event.preventDefault();
        undo();
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((cmdKey && event.shiftKey && event.key === 'z') || (cmdKey && event.key === 'y')) {
        event.preventDefault();
        redo();
      }

      // Copy: Cmd+C
      if (cmdKey && event.key === 'c') {
        if (selectedNodeId) {
          event.preventDefault();
          copyNode(selectedNodeId);
        }
      }

      // Paste: Cmd+V
      if (cmdKey && event.key === 'v') {
        event.preventDefault();
        pasteNode();
      }

      // Duplicate: Cmd+D
      if (cmdKey && event.key === 'd') {
        event.preventDefault();
        if (selectedNodeId) {
          duplicateNode(selectedNodeId);
        }
      }

      // Save: Cmd+S
      if (cmdKey && event.key === 's') {
        event.preventDefault();
        if (isDirty) {
          saveWorkflow().then(() => {
            showToast('success', t('workflow.messages.saveSuccess', 'Saved'), t('workflow.messages.saveSuccessDesc', 'Workflow saved successfully'));
          }).catch(() => {
            showToast('error', t('workflow.messages.saveFailed', 'Save Failed'), t('workflow.messages.saveFailedDesc', 'An error occurred while saving'));
          });
        }
      }

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeId) {
          event.preventDefault();
          deleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          event.preventDefault();
          deleteEdge(selectedEdgeId);
        }
      }

      // Run Workflow: Cmd+Enter (Mac) or Ctrl+Enter (Windows)
      if (cmdKey && event.key === 'Enter') {
        event.preventDefault();
        if (isDebugPanelOpen && !isExecuting) {
          startExecution(debugInput);
        }
      }

      // Cancel Execution: Escape
      if (event.key === 'Escape') {
        if (isExecuting) {
          event.preventDefault();
          cancelExecution();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, undo, redo, deleteNode, deleteEdge, duplicateNode, copyNode, pasteNode, saveWorkflow, isDirty, isDebugPanelOpen, isExecuting, startExecution, cancelExecution, debugInput, showToast, t]);

  // Handle node selection
  const handleNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Handle drag over for dropping new nodes
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop to add new node
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (readOnly) return;

      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!type) return;

      // Ensure we have a valid position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode, readOnly]
  );

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection);
    },
    [onConnect]
  );

  // MiniMap node color
  const nodeColor = useCallback((node: any) => {
    const colors: Record<string, string> = {
      input: '#22c55e',
      timer: '#22c55e',
      webhook: '#22c55e',
      event: '#22c55e',
      answer: '#3b82f6',
      agent: '#3b82f6',
      tool: '#f97316',
      condition: '#a855f7',
      llm: '#06b6d4',
      parallel: '#6366f1',
    };
    return colors[node.type] || '#64748b';
  }, []);

  if (!currentWorkflow) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workflow.selectModal.searchPlaceholder', 'Search workflows...')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Canvas */}
        <div ref={reactFlowWrapper} className={`flex-1 w-full h-full relative ${isArranging ? 'wf-animate-layout' : ''}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges as any}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={readOnly ? undefined : handleConnect}
            onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            snapToGrid
            snapGrid={SNAP_GRID}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={true}
            panOnScroll
            zoomOnScroll
            minZoom={0.1}
            maxZoom={1.5}
            className="bg-gray-50/50 dark:bg-gray-950/50"
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={24} 
              size={1.5} 
              color="#e2e8f0" 
              className="dark:!bg-gray-950" 
            />
            <Controls 
              className="!bg-white dark:!bg-gray-900 !border-gray-100 dark:!border-gray-800 !shadow-xl !rounded-xl !overflow-hidden !flex !flex-col !gap-0"
              showZoom
              showFitView
              showInteractive={!readOnly}
            />
            <MiniMap
              nodeColor={nodeColor}
              maskColor="rgba(0, 0, 0, 0.05)"
              className="!bg-white/80 dark:!bg-gray-900/80 !backdrop-blur-md !border-gray-100 dark:!border-gray-800 !rounded-2xl !shadow-2xl"
              style={{ height: 96, width: 144 }}
              zoomable
              pannable
            />

            {/* Live run status */}
            <Panel position="top-center">
              <RunStatusBar />
            </Panel>

            {!readOnly && (
              <Panel position="top-right">
                <button
                  type="button"
                  onClick={handleAutoArrange}
                  disabled={isExecuting}
                  className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-sm text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur"
                  title={t('workflow.actions.auto_arrange_hint', 'Arrange nodes neatly from top to bottom')}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{t('workflow.actions.auto_arrange', 'Auto-arrange')}</span>
                </button>
              </Panel>
            )}

            {/* Validation Errors Panel */}
            <ValidationErrorsPanel />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

/**
 * Validation Errors Panel
 */
const ValidationErrorsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { validationErrors } = useWorkflowStore();

  if (validationErrors.length === 0) return null;

  return (
    <Panel position="bottom-center">
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-md">
        <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
          {t('workflow.messages.validateFailed', 'Validation Failed')} ({validationErrors.length})
        </h4>
        <ul className="space-y-1">
          {validationErrors.slice(0, 3).map((error, index) => (
            <li key={index} className="text-xs text-red-600 dark:text-red-300">
              • {error.message}
            </li>
          ))}
          {validationErrors.length > 3 && (
            <li className="text-xs text-red-500 dark:text-red-400">
              ... {t('common.more_errors', `and {{count}} more errors`, { count: validationErrors.length - 3 })}
            </li>
          )}
        </ul>
      </div>
    </Panel>
  );
};

/**
 * Workflow Editor with React Flow Provider
 */
const WorkflowEditor: React.FC<WorkflowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;
