/**
 * Workflow Editor Page
 * Standalone page for editing workflows via route - Minimal Clean Redesign
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Settings,
  Loader2,
  ChevronRight,
  Info,
  GitBranch,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useToast } from '@/hooks/useToast';
import { WorkflowEditor, WorkflowToolbar } from '@/components/workflow';
import NodePalette from '@/components/workflow/NodePalette';
import NodeConfigPanel from '@/components/workflow/panels/NodeConfigPanel';
import DebugPanel from '@/components/workflow/panels/DebugPanel';

const WorkflowEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  const {
    currentWorkflow,
    isLoadingCurrentWorkflow,
    isDirty,
    loadWorkflow,
    createWorkflow,
    updateWorkflowMeta,
    resetEditor,
    selectedNodeId,
    setSelectedNode,
    isDebugPanelOpen,
    setDebugPanelOpen,
  } = useWorkflowStore();

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return currentWorkflow?.definition.nodes.find(n => n.id === selectedNodeId) || null;
  }, [currentWorkflow, selectedNodeId]);

  const creatingRef = React.useRef(false);

  // Load or create workflow based on ID
  useEffect(() => {
    if (id && id !== 'new') {
      loadWorkflow(id);
    } else if (id === 'new' && !creatingRef.current) {
      creatingRef.current = true;
      createWorkflow().then(newWorkflow => {
        // Once created, navigate to the edit route with the real ID
        // to prevent re-creation on refresh/remount
        navigate(`/ai/workflows/${newWorkflow.id}/edit`, { replace: true });
      }).catch(error => {
        creatingRef.current = false;
        console.error('Failed to create workflow:', error);
        showToast('error', t('workflow.messages.createFailed', 'Create Failed'), '');
      });
    }
    
    return () => {
      resetEditor();
      creatingRef.current = false;
    };
  }, [id, navigate, loadWorkflow, createWorkflow, resetEditor, showToast, t]);

  const handleBack = () => {
    if (isDirty) {
      const confirmed = window.confirm(t('workflow.messages.unsavedChanges', 'You have unsaved changes. Are you sure you want to close?'));
      if (!confirmed) return;
    }
    navigate('/ai/workflows');
  };

  const settingsLabelClass = 'tgo-eyebrow flex items-center gap-2';
  const settingsInputClass = 'w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-hidden bg-gray-50 p-3 dark:bg-gray-950">
      {/* Header */}
      <header className="tgo-surface relative z-30 flex shrink-0 items-center justify-between gap-4 rounded-[24px] py-2.5 pl-2.5 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleBack}
            className="tgo-icon-btn h-10 w-10"
            aria-label={t('common.back', 'Back')}
            title={t('common.back', 'Back')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {isLoadingCurrentWorkflow ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin text-acid-600" />
              <span className="text-sm">{t('common.loading', 'Loading...')}</span>
            </div>
          ) : currentWorkflow ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                <GitBranch className="h-[18px] w-[18px]" />
              </span>
              <div className="flex min-w-0 flex-col">
                <input
                  type="text"
                  value={currentWorkflow.name}
                  onChange={(e) => updateWorkflowMeta({ name: e.target.value })}
                  aria-label={t('workflow.fields.name', 'Name')}
                  className="-ml-2 h-7 min-w-[220px] rounded-xl border-none bg-transparent px-2 text-[17px] font-semibold tracking-tight text-gray-900 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:ring-0 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
                  placeholder={t('workflow.namePlaceholder', 'Workflow name')}
                />
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    currentWorkflow.status === 'active'
                      ? 'bg-acid-200 text-acid-900 dark:bg-acid-400/15 dark:text-acid-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${currentWorkflow.status === 'active' ? 'bg-acid-600' : 'bg-amber-500'}`} />
                    {currentWorkflow.status === 'active' ? t('workflow.status.active', 'Active') : t('workflow.status.draft', 'Draft')}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-400">v{currentWorkflow.version}</span>
                  {isDirty && (
                    <span className="tgo-fade-in flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      {t('common.unsaved_changes', 'Unsaved Changes')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Action Toolbar (Undo, Redo, Validate, Save) */}
          <WorkflowToolbar />

          {/* Settings Toggle */}
          <button
            onClick={() => {
              if (!showSettings) {
                setDebugPanelOpen(false);
                setSelectedNode(null);
              }
              setShowSettings(!showSettings);
            }}
            data-active={showSettings}
            className="tgo-pill h-10 px-4"
            aria-label={t('workflow.settings', 'Settings')}
            title={t('workflow.settings', 'Settings')}
          >
            <Settings className={`h-4 w-4 transition-transform duration-500 ${showSettings ? 'rotate-90' : ''}`} />
            <span className="hidden xl:inline">{t('common.settings', 'Settings')}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Left Side: Node Palette */}
        <NodePalette
          isCollapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
        />

        {/* Center: Editor */}
        <div className="relative z-10 min-w-0 flex-1 overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-30px_rgba(15,16,18,0.22)] ring-1 ring-black/[0.06] dark:bg-[#0a0b0d] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] dark:ring-white/[0.06]">
          {isLoadingCurrentWorkflow ? (
            <div className="wf-space flex items-center justify-center">
              <div className="relative text-center">
                <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
                  <span className="absolute inset-0 animate-spin rounded-full border-2 border-gray-200 border-t-acid-500 dark:border-white/10 dark:border-t-acid-400" />
                  <GitBranch className="h-5 w-5 text-acid-600 dark:text-acid-400" />
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-white/50">
                  {t('workflow.loading', 'Loading workflow...')}
                </p>
              </div>
            </div>
          ) : (
            <WorkflowEditor />
          )}
        </div>

        {/* Right Side: Panels */}
        {isDebugPanelOpen ? (
          <DebugPanel />
        ) : selectedNode ? (
          <NodeConfigPanel node={selectedNode} />
        ) : showSettings && currentWorkflow ? (
          <div className="tgo-surface wf-slide-in-right z-30 flex w-80 shrink-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                  <Settings className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="tgo-eyebrow">{t('workflow.panel.workflow', 'Workflow')}</p>
                  <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    {t('workflow.settings', 'Settings')}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="tgo-icon-btn"
                aria-label={t('common.close', 'Close')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6">
              {/* Name */}
              <div className="space-y-2">
                <label className={settingsLabelClass}>{t('workflow.fields.name', 'Name')}</label>
                <input
                  type="text"
                  value={currentWorkflow.name}
                  onChange={(e) => updateWorkflowMeta({ name: e.target.value })}
                  className={`${settingsInputClass} font-medium`}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className={settingsLabelClass}>{t('workflow.fields.description', 'Description')}</label>
                <textarea
                  value={currentWorkflow.description || ''}
                  onChange={(e) => updateWorkflowMeta({ description: e.target.value })}
                  rows={4}
                  className={`${settingsInputClass} resize-none leading-relaxed`}
                  placeholder={t('workflow.fields.description_placeholder', 'Describe what this workflow does...')}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className={settingsLabelClass}>{t('workflow.fields.status', 'Status')}</label>
                <div className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                  {(['draft', 'active', 'archived'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateWorkflowMeta({ status })}
                      className={`rounded-full py-2 text-xs font-medium transition-all duration-300 ${
                        currentWorkflow.status === status
                          ? 'bg-ink-900 text-white shadow-sm dark:bg-acid-400 dark:text-ink-900'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                      }`}
                    >
                      {status === 'active' ? t('workflow.status.active', 'Active') :
                       status === 'draft' ? t('workflow.status.draft', 'Draft') :
                       t('workflow.status.archived', 'Archived')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className={settingsLabelClass}>{t('workflow.fields.tags', 'Tags')}</label>
                <input
                  type="text"
                  value={currentWorkflow.tags.join(', ')}
                  onChange={(e) => updateWorkflowMeta({
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  placeholder={t('workflow.tagsPlaceholder', 'Separate with commas')}
                  className={settingsInputClass}
                />
              </div>

              {/* Info Box */}
              <div className="rounded-[22px] bg-ink-900 p-5 text-white dark:bg-black">
                <div className="mb-4 flex items-center gap-2">
                  <Info className="h-4 w-4 text-acid-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{t('workflow.fields.workflow_info', 'Workflow Info')}</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">{t('workflow.fields.version', 'Version')}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">v{currentWorkflow.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">{t('workflow.fields.total_nodes', 'Total Nodes')}</span>
                    <span className="rounded-full bg-acid-400 px-2 py-0.5 font-mono font-semibold text-ink-900">{currentWorkflow.definition.nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">{t('common.tableCreated', 'Created')}</span>
                    <span className="font-mono text-white/80">{new Date(currentWorkflow.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default WorkflowEditorPage;
