/**
 * Workflow Toolbar Component
 * Contains simplified workflow actions for the top bar
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Undo2,
  Redo2,
  CheckCircle,
  Loader2,
  Bug,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useToast } from '@/hooks/useToast';

/**
 * Workflow Toolbar Component
 */
const WorkflowToolbar: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const {
    currentWorkflow,
    isDirty,
    history,
    historyIndex,
    saveWorkflow,
    undo,
    redo,
    validate,
    isDebugPanelOpen,
    setDebugPanelOpen,
    isExecuting,
  } = useWorkflowStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleSave = async () => {
    if (!currentWorkflow || isSaving) return;

    setIsSaving(true);
    try {
      await saveWorkflow();
      showToast('success', t('workflow.messages.saveSuccess', 'Saved'), t('workflow.messages.saveSuccessDesc', 'Workflow saved successfully'));
    } catch {
      showToast('error', t('workflow.messages.saveFailed', 'Save Failed'), t('workflow.messages.saveFailedDesc', 'An error occurred while saving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!currentWorkflow || isValidating) return;

    setIsValidating(true);
    try {
      const isValid = await validate();
      if (isValid) {
        showToast('success', t('workflow.messages.validateSuccess', 'Validation Passed'), t('workflow.messages.validateSuccessDesc', 'Workflow configuration is valid'));
      } else {
        showToast('warning', t('workflow.messages.validateFailed', 'Validation Failed'), t('workflow.messages.validateFailedDesc', 'Please check workflow configuration'));
      }
    } finally {
      setIsValidating(false);
    }
  };

  if (!currentWorkflow) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Undo/Redo Group */}
      <div className="flex items-center rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-all duration-200 hover:bg-white hover:text-ink-900 hover:shadow-sm active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          title={t('workflow.actions.undo', 'Undo')}
          aria-label={t('workflow.actions.undo', 'Undo')}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-all duration-200 hover:bg-white hover:text-ink-900 hover:shadow-sm active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          title={t('workflow.actions.redo', 'Redo')}
          aria-label={t('workflow.actions.redo', 'Redo')}
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Validate */}
      <button
        onClick={handleValidate}
        disabled={isValidating}
        className="tgo-pill h-10 px-4 disabled:opacity-50"
        title={t('workflow.actions.validate', 'Validate')}
      >
        {isValidating ? (
          <Loader2 className="h-4 w-4 animate-spin text-acid-600" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        <span className="hidden lg:inline">{t('workflow.actions.validate', 'Validate')}</span>
      </button>

      {/* Debug run */}
      <button
        onClick={() => setDebugPanelOpen(!isDebugPanelOpen)}
        className={`inline-flex h-10 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-medium transition-all duration-300 active:scale-95 ${
          isDebugPanelOpen
            ? 'bg-acid-400 text-ink-900 shadow-[0_10px_24px_-12px_rgba(143,179,30,0.9)]'
            : 'bg-acid-300 text-ink-900 hover:bg-acid-400'
        }`}
        title={t('workflow.actions.debug', 'Debug')}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-acid-400">
          {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
        </span>
        <span className="hidden lg:inline">{t('workflow.actions.debug', 'Debug')}</span>
      </button>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!isDirty || isSaving}
        className="tgo-btn-ink h-10 pl-1.5 pr-4"
        data-icon-motion="nudge"
      >
        <span className="tgo-btn-icon h-7 w-7">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </span>
        <span>{t('workflow.actions.save', 'Save')}</span>
        {isDirty && !isSaving && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-acid-400" />
          </span>
        )}
      </button>
    </div>
  );
};

export default WorkflowToolbar;
