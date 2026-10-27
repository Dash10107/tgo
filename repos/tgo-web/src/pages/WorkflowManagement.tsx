/**
 * Workflow Management Page
 * List and manage AI Agent workflows
 */

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  ArrowUpRight,
  Headphones,
  Target,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useToast } from '@/hooks/useToast';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { WORKFLOW_TEMPLATES } from '@/utils/workflowTemplates';
import type { WorkflowSummary, WorkflowStatus, WorkflowTemplate, WorkflowTemplateId } from '@/types/workflow';

const TEMPLATE_ICONS: Record<WorkflowTemplateId, LucideIcon> = {
  support_triage: Headphones,
  lead_qualification: Target,
  agent_escalation: ShieldAlert,
};

type StatusFilter = WorkflowStatus | 'all';

const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'draft', 'archived'];

interface StatusStyle {
  dot: string;
  label: string;
}

const useStatusStyle = () => {
  const { t } = useTranslation();
  return (status: WorkflowStatus): StatusStyle => {
    switch (status) {
      case 'active':
        return { dot: 'bg-acid-500', label: t('workflow.status.active', 'Active') };
      case 'draft':
        return { dot: 'bg-amber-400', label: t('workflow.status.draft', 'Draft') };
      case 'inactive':
        return { dot: 'bg-gray-300', label: t('workflow.status.inactive', 'Inactive') };
      case 'archived':
        return { dot: 'bg-gray-400', label: t('workflow.status.archived', 'Archived') };
      default:
        return { dot: 'bg-gray-400', label: status };
    }
  };
};

/**
 * Workflow Template Card Component
 */
interface WorkflowTemplateCardProps {
  template: WorkflowTemplate;
  isFeatured: boolean;
  isCreating: boolean;
  disabled: boolean;
  onUse: (id: WorkflowTemplateId) => void;
}

const WorkflowTemplateCard: React.FC<WorkflowTemplateCardProps> = ({
  template,
  isFeatured,
  isCreating,
  disabled,
  onUse,
}) => {
  const { t } = useTranslation();
  const Icon = TEMPLATE_ICONS[template.id];

  return (
    <div className="group relative h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
      {/* Notched background layer (masked separately so content and popovers are never clipped) */}
      <div
        aria-hidden="true"
        className={`tgo-notch absolute inset-0 rounded-[28px] transition-shadow duration-500 ${
          isFeatured ? 'bg-acid-300 dark:bg-acid-400' : 'bg-white dark:bg-gray-800'
        }`}
      />
      <div
        className={`relative flex h-full flex-col justify-between p-6 ${
          isFeatured ? 'text-ink-900' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        <div>
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${
            isFeatured ? 'bg-ink-900 text-acid-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            <Icon className="h-5 w-5" />
          </span>
          <h4 className="mt-6 pr-6 text-xl font-medium tracking-tight" title={t(template.name)}>
            {t(template.name)}
          </h4>
          <p className={`mt-2 line-clamp-3 text-sm leading-relaxed ${isFeatured ? 'text-ink-900/70' : 'text-gray-500 dark:text-gray-400'}`}>
            {t(template.description)}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
            isFeatured ? 'bg-white/60 text-ink-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            <GitBranch className="h-3.5 w-3.5" />
            {t('workflow.templates.nodesCount', '{{count}} nodes', { count: template.nodes.length })}
          </span>
          <button
            onClick={() => onUse(template.id)}
            disabled={disabled}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${
              isFeatured
                ? 'bg-ink-900 text-white hover:bg-ink-700'
                : 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-acid-400 dark:text-ink-900'
            }`}
          >
            {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {isCreating ? t('workflow.templates.creating', 'Creating...') : t('workflow.templates.use', 'Use Template')}
          </button>
        </div>
      </div>

      {/* Button cradled in the card's notch */}
      <button
        onClick={() => onUse(template.id)}
        disabled={disabled}
        aria-label={t('workflow.templates.use', 'Use Template')}
        className="tgo-icon-btn absolute right-1 top-1 h-9 w-9 group-hover:rotate-45"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * Workflow Card Component
 */
interface WorkflowCardProps {
  workflow: WorkflowSummary;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const getStatusStyle = useStatusStyle();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const status = getStatusStyle(workflow.status);
  const updatedLabel = new Date(workflow.updated_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`group relative h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 ${showMenu ? 'z-20' : ''}`}>
      {/* Notched background layer */}
      <div aria-hidden="true" className="tgo-notch absolute inset-0 rounded-[28px] bg-white dark:bg-gray-800" />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center gap-3 pr-10">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400">
            <GitBranch className="h-5 w-5" />
            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800 ${status.dot}`} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              v{workflow.version}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {t('workflow.lastUpdated', 'Updated')} {updatedLabel}
            </p>
          </div>
        </div>

        <button onClick={() => onEdit(workflow.id)} className="mt-5 text-left">
          <h3 className="line-clamp-1 text-xl font-medium tracking-tight text-gray-900 transition-colors dark:text-gray-100" title={workflow.name}>
            {workflow.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {workflow.description || t('workflow.noDescription', 'No description')}
          </p>
        </button>

        {/* Tags */}
        {workflow.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {workflow.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {tag}
              </span>
            ))}
            {workflow.tags.length > 3 && (
              <span className="self-center text-[11px] font-medium text-gray-400">+{workflow.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-5">
          <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('workflow.statusLabel', 'Status')}</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 flex-1 items-center gap-2 rounded-full px-4 text-sm text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700">
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              {status.label}
            </span>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(v => !v)}
                aria-haspopup="menu"
                aria-expanded={showMenu}
                aria-label={t('common.more', 'More')}
                className="tgo-icon-btn h-10 w-10"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showMenu && (
                <div role="menu" className="animate-in fade-in zoom-in-95 slide-in-from-bottom-1 absolute bottom-full right-0 z-20 mb-2 w-44 rounded-2xl border border-gray-100 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                  <button role="menuitem" onClick={() => { onEdit(workflow.id); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                    <Pencil className="h-4 w-4" /> {t('common.edit', 'Edit')}
                  </button>
                  <button role="menuitem" onClick={() => { onDuplicate(workflow.id); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                    <Copy className="h-4 w-4" /> {t('common.duplicate', 'Duplicate')}
                  </button>
                  <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                  <button role="menuitem" onClick={() => { onDelete(workflow.id); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" /> {t('common.delete', 'Delete')}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onEdit(workflow.id)}
              aria-label={t('common.edit', 'Edit')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Open button cradled in the notch */}
      <button
        onClick={() => onEdit(workflow.id)}
        aria-label={t('workflow.viewWorkflow', 'View Workflow')}
        className="tgo-icon-btn absolute right-1 top-1 h-9 w-9 group-hover:rotate-45"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * Workflow Management Page Component
 */
const WorkflowManagement: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    workflows,
    isLoadingWorkflows,
    workflowsError,
    loadWorkflows,
    createWorkflow,
    createWorkflowFromTemplate,
    deleteWorkflow,
    duplicateWorkflow,
  } = useWorkflowStore();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  const [isCreating, setIsCreating] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<WorkflowTemplateId | null>(null);

  // Per-status counts for the header figures and filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: workflows.length, active: 0, draft: 0, inactive: 0, archived: 0 };
    workflows.forEach(wf => {
      if (wf.status in counts) counts[wf.status] += 1;
    });
    return counts;
  }, [workflows]);

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    let filtered = workflows;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(wf => wf.status === statusFilter);
    }

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(wf =>
        wf.name.toLowerCase().includes(query) ||
        (wf.description && wf.description.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [workflows, statusFilter, debouncedSearch]);

  // Handlers
  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newWorkflow = await createWorkflow();
      navigate(`/ai/workflows/${newWorkflow.id}/edit`);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      showToast('error', t('workflow.messages.createFailed', 'Create Failed'), '');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUseTemplate = async (templateId: WorkflowTemplateId) => {
    if (creatingTemplateId || isCreating) return;
    setCreatingTemplateId(templateId);
    try {
      const { workflow, modelAssigned } = await createWorkflowFromTemplate(templateId);
      if (modelAssigned) {
        showToast(
          'success',
          t('workflow.templates.created', 'Workflow created from template'),
          t('workflow.templates.createdDesc', 'Adjust anything you like, then publish it and bind it to an agent.')
        );
      } else {
        showToast(
          'warning',
          t('workflow.templates.noModelTitle', 'Select a model'),
          t('workflow.templates.noModelDesc', 'No active chat model was found. Add a model provider, then pick a model in each AI node.')
        );
      }
      navigate(`/ai/workflows/${workflow.id}/edit`);
    } catch (error) {
      console.error('Failed to create workflow from template:', error);
      showToast('error', t('workflow.messages.createFailed', 'Create Failed'), '');
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/ai/workflows/${id}/edit`);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateWorkflow(id);
      showToast('success', t('workflow.messages.duplicateSuccess', 'Duplicated'), '');
    } catch {
      showToast('error', t('workflow.messages.duplicateFailed', 'Duplicate Failed'), '');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteWorkflow(deleteTarget.id);
      showToast('success', t('workflow.messages.deleteSuccess', 'Deleted'), '');
      setDeleteTarget(null);
    } catch {
      showToast('error', t('workflow.messages.deleteFailed', 'Delete Failed'), '');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    loadWorkflows();
  };

  const filterLabel = (status: StatusFilter): string => {
    switch (status) {
      case 'all': return t('common.all', 'All');
      case 'active': return t('workflow.status.active', 'Active');
      case 'draft': return t('workflow.status.draft', 'Draft');
      default: return t('workflow.status.archived', 'Archived');
    }
  };

  const headerStats: { key: WorkflowStatus; badge: string }[] = [
    { key: 'active', badge: 'bg-acid-300 text-ink-900' },
    { key: 'draft', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    { key: 'archived', badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  ];

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <main className="flex min-w-0 flex-grow flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] space-y-12 px-6 py-8 md:px-10">

          {/* Header */}
          <header className="tgo-fade-up flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              <h2 className="tgo-display text-[44px] uppercase text-gray-900 md:text-[52px] dark:text-white">
                {t('workflow.management.titleShort', 'Workflows')}
              </h2>
              <button onClick={handleCreate} disabled={isCreating} className="tgo-btn-ink">
                <span className="tgo-btn-icon">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </span>
                {t('workflow.actions.create', 'Create Workflow')}
              </button>
            </div>

            <div className="flex items-end gap-8 md:gap-12">
              {headerStats.map(stat => (
                <div key={stat.key} className="flex items-end gap-2">
                  <span key={statusCounts[stat.key]} className="tgo-pop tgo-display text-[44px] tabular-nums text-gray-900 dark:text-white">
                    {statusCounts[stat.key]}
                  </span>
                  <span className="mb-1 flex flex-col items-start gap-1">
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${stat.badge}`}>
                      {statusCounts.all > 0 ? Math.round((statusCounts[stat.key] / statusCounts.all) * 100) : 0}%
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">{filterLabel(stat.key).toLowerCase()}</span>
                  </span>
                </div>
              ))}
            </div>
          </header>

          {/* Templates */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-2xl font-light tracking-tight text-gray-900 dark:text-gray-100">
                {t('workflow.templates.title', 'Start from a template')}
              </h3>
              <span className="tgo-count"><b>{WORKFLOW_TEMPLATES.length}</b>{t('workflow.templates.countLabel', 'templates')}</span>
            </div>
            <p className="-mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {t('workflow.templates.subtitle', 'Ready-to-run workflows. Create one, adjust the agent, model or prompts if you like, and it is ready to go.')}
            </p>
            <div className="tgo-stagger grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {WORKFLOW_TEMPLATES.map((template, index) => (
                <WorkflowTemplateCard
                  key={template.id}
                  template={template}
                  isFeatured={index === 0}
                  isCreating={creatingTemplateId === template.id}
                  disabled={creatingTemplateId !== null || isCreating}
                  onUse={handleUseTemplate}
                />
              ))}
            </div>
          </section>

          {/* Workflow list */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="mr-1 text-2xl font-light tracking-tight text-gray-900 dark:text-gray-100">
                {t('workflow.listTitle', 'Workflow List')}
              </h3>
              <span className="tgo-count mr-3"><b>{filteredWorkflows.length}</b>{t('workflow.countLabel', 'workflows')}</span>

              <label className="group relative flex h-9 items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-ink-900 dark:group-focus-within:text-white" />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search')}
                  aria-label={t('common.search', 'Search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-40 rounded-full bg-white pl-9 pr-4 text-sm text-gray-900 shadow-[inset_0_0_0_1px_var(--color-gray-200)] outline-none transition-all duration-300 placeholder:text-gray-400 focus:w-56 focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-900 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]"
                />
              </label>

              <button
                className="tgo-icon-btn"
                onClick={handleRefresh}
                disabled={isLoadingWorkflows}
                aria-label={t('common.refresh', 'Refresh')}
                title={t('common.refresh', 'Refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingWorkflows ? 'animate-spin' : ''}`} />
              </button>

              <div className="flex flex-wrap items-center gap-2" role="tablist">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    role="tab"
                    aria-selected={statusFilter === status}
                    data-active={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                    className="tgo-pill"
                  >
                    {status !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-acid-500' : status === 'draft' ? 'bg-amber-400' : 'bg-gray-400'}`} />}
                    {filterLabel(status)}
                    <span className="text-[11px] tabular-nums opacity-60">{statusCounts[status]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error State */}
            {workflowsError ? (
              <div className="tgo-surface flex flex-col items-center justify-center py-14 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">{t('common.error', 'Error')}</p>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{workflowsError}</p>
                <button onClick={handleRefresh} className="tgo-btn-ink" data-icon-motion="nudge">
                  <span className="tgo-btn-icon"><RefreshCw className="h-4 w-4" /></span>
                  {t('common.retry', 'Retry')}
                </button>
              </div>
            ) : isLoadingWorkflows && workflows.length === 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="tgo-skeleton h-72 rounded-[28px]" style={{ opacity: 1 - i * 0.08 }} />
                ))}
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="tgo-surface tgo-fade-up flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-acid-200/60 dark:bg-acid-400/10" />
                  <span className="absolute inset-4 rounded-full bg-acid-300/70 dark:bg-acid-400/20" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
                    <GitBranch className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
                  {hasActiveFilters ? t('workflow.empty.noResults', 'No matching workflows found') : t('workflow.empty.title', 'No Workflows')}
                </h3>
                <p className="mb-8 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                  {hasActiveFilters ? t('workflow.empty.noResultsDesc', 'Try adjusting your search keywords or filters') : t('workflow.empty.description', 'Click the "Create Workflow" button to build your first automated process')}
                </p>
                {!hasActiveFilters && (
                  <button onClick={handleCreate} disabled={isCreating} className="tgo-btn-ink">
                    <span className="tgo-btn-icon"><Plus className="h-4 w-4" /></span>
                    {t('workflow.actions.create', 'Create Workflow')}
                  </button>
                )}
              </div>
            ) : (
              <div className="tgo-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={(id) => setDeleteTarget(workflows.find(w => w.id === id) || null)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('workflow.modal.delete.title', 'Delete Workflow')}
        message={t('workflow.modal.delete.message', `Are you sure you want to delete workflow "{{name}}"? This action cannot be undone.`, { name: deleteTarget?.name })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </main>
  );
};

export default WorkflowManagement;
