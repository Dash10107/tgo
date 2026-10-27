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
import { getEdgeRunState, getEdgePalette } from './overlays/runState';
import { computeLayeredLayout } from './utils/autoLayout';
import { getNodeAccent } from './nodes/nodeTheme';
import { useIsDarkTheme } from '@/hooks/useIsDarkTheme';

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

interface WorkflowEditorProps {
  readOnly?: boolean;
}

const WorkflowEditorInner: React.FC<WorkflowEditorProps> = ({ readOnly = false }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getNode, getViewport, setCenter, fitView } = useReactFlow();
  const [isArranging, setIsArranging] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const isDark = useIsDarkTheme();
  const edgePalette = getEdgePalette(isDark);
  const connectionLineStyle = useMemo(() => ({ stroke: edgePalette.connection, strokeWidth: 2 }), [edgePalette]);

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
  const isRunComplete = !isExecuting && currentExecution?.status === 'completed';

  // Display-only edges: rendered by CustomEdge so the run can be animated along the path taken
  const edges = useMemo(() => {
    return rawEdges.map(edge => {
      const runState = getEdgeRunState(nodeExecutionMap[edge.source], nodeExecutionMap[edge.target], isExecuting, hasRun);
      return {
        ...edge,
        type: 'custom',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: edgePalette.stroke[runState] },
        data: {
          ...edge.data,
          runState,
          isDark,
        }
      };
    });
  }, [rawEdges, nodeExecutionMap, isExecuting, hasRun, edgePalette, isDark]);

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
  const nodeColor = useCallback((node: { type?: string }) => getNodeAccent(node.type).hex, []);

  if (!currentWorkflow) {
    return (
      <div className="wf-space flex h-full items-center justify-center">
        <p className="relative text-sm text-gray-400 dark:text-white/50">{t('workflow.selectModal.searchPlaceholder', 'Search workflows...')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Canvas */}
        <div ref={reactFlowWrapper} className={`wf-canvas flex-1 w-full h-full relative ${isArranging ? 'wf-animate-layout' : ''} ${isExecuting ? 'wf-canvas--running' : ''} ${isRunComplete ? 'wf-canvas--done' : ''}`}>
          {/* Deep-space backdrop: nebula glow, slowly drifting starfield and the odd shooting star */}
          <div className="wf-space" aria-hidden="true">
            <div className="wf-space-stars" />
            <div className="wf-space-stars wf-space-stars--far" />
            <div className="wf-shooting-star" />
            <div className="wf-shooting-star wf-shooting-star--late" />
          </div>

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
            connectionLineStyle={connectionLineStyle}
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
            className="!bg-transparent"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.3}
              color={isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 16, 18, 0.18)'}
            />
            <Controls
              className="wf-controls"
              showZoom
              showFitView
              showInteractive={!readOnly}
            />
            <MiniMap
              nodeColor={nodeColor}
              nodeBorderRadius={8}
              maskColor={isDark ? 'rgba(8, 9, 10, 0.55)' : 'rgba(239, 239, 241, 0.6)'}
              className="wf-minimap"
              style={{ height: 104, width: 156 }}
              zoomable
              pannable
            />

            {/* Live run status */}
            <Panel position="top-left">
              <RunStatusBar />
            </Panel>

            {!readOnly && (
              <Panel position="top-right">
                <button
                  type="button"
                  onClick={handleAutoArrange}
                  disabled={isExecuting}
                  className="group flex h-10 items-center gap-2 rounded-full bg-white/90 pl-1.5 pr-4 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-black/[0.08] backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-ink-900 dark:bg-white/10 dark:text-white/80 dark:shadow-none dark:ring-white/10 dark:hover:bg-white/15 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title={t('workflow.actions.auto_arrange_hint', 'Arrange nodes neatly from top to bottom')}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-acid-400 text-ink-900 transition-transform duration-500 group-hover:rotate-[20deg]">
                    <Wand2 className="h-3.5 w-3.5" />
                  </span>
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
      <div className="tgo-pop max-w-md rounded-[20px] bg-ink-900/90 p-4 text-white shadow-2xl ring-1 ring-rose-400/40 backdrop-blur-md">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-semibold tabular-nums">
            {validationErrors.length}
          </span>
          {t('workflow.messages.validateFailed', 'Validation Failed')}
        </h4>
        <ul className="space-y-1 pl-8">
          {validationErrors.slice(0, 3).map((error, index) => (
            <li key={index} className="text-xs text-white/70">
              {error.message}
            </li>
          ))}
          {validationErrors.length > 3 && (
            <li className="text-xs text-white/50">
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
