import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, FileText, Globe, MessageSquare, Loader2, Settings, ArrowUpRight,
  MoreHorizontal, BookOpen, Clock, Sparkles, type LucideIcon,
} from 'lucide-react';
import { useKnowledgeStore, knowledgeSelectors } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { showKnowledgeBaseSuccess, showKnowledgeBaseError } from '@/utils/toastHelpers';
import { CreateKnowledgeBaseModal, type CreateKnowledgeBaseData } from '@/components/knowledge/CreateKnowledgeBaseModal';
import { EditKnowledgeBaseModal } from '@/components/knowledge/EditKnowledgeBaseModal';
import { formatKnowledgeBaseUpdatedTime } from '@/utils/timeFormatting';
import { getIconComponent } from '@/components/knowledge/IconPicker';
import type { KnowledgeBaseItem, KnowledgeBaseType } from '@/types';
import { useTranslation } from 'react-i18next';
import ProjectConfigApiService from '@/services/projectConfigApi';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Modal, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import {
  PageShell, PageHeader, InkButton, SectionHeader, SearchField, RefreshButton, FilterPills,
  EmptyPanel, ErrorPanel, SkeletonGrid, CardGrid, NotchCard, MenuPanel, MenuItem, type FilterOption,
} from '@/components/ui/PageKit';

type TypeFilter = KnowledgeBaseType | 'all';

const TYPE_META: Record<KnowledgeBaseType, { icon: LucideIcon; dot: string }> = {
  file: { icon: FileText, dot: 'bg-acid-500' },
  website: { icon: Globe, dot: 'bg-sky-400' },
  qa: { icon: MessageSquare, dot: 'bg-violet-400' },
};

const getTagName = (tag: KnowledgeBaseItem['tags'][number]): string => (typeof tag === 'string' ? tag : tag.name);

/**
 * Knowledge base card, same anatomy as the workflow card
 */
interface KnowledgeCardProps {
  kb: KnowledgeBaseItem;
  typeLabel: string;
  onOpen: (kb: KnowledgeBaseItem) => void;
  onEdit: (kb: KnowledgeBaseItem) => void;
  onDelete: (kb: KnowledgeBaseItem) => void;
}

const KnowledgeCard: React.FC<KnowledgeCardProps> = ({ kb, typeLabel, onOpen, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const type = kb.type ?? 'file';
  const meta = TYPE_META[type];
  const KbIcon = getIconComponent(kb.icon);
  const tags = kb.tags.map(getTagName).filter(Boolean);

  return (
    <NotchCard
      raised={showMenu}
      corner={
        <button
          onClick={() => onOpen(kb)}
          aria-label={t('common.details', 'Details')}
          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex items-center gap-3 pr-10">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400">
          <KbIcon className="h-5 w-5" />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800 ${meta.dot}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{typeLabel}</p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            {formatKnowledgeBaseUpdatedTime(kb.updatedAt)}
          </p>
        </div>
      </div>

      <button onClick={() => onOpen(kb)} className="mt-5 text-left">
        <h3 className="line-clamp-1 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100" title={kb.title}>
          {kb.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {kb.content || t('workflow.noDescription', 'No description')}
        </p>
      </button>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {tag}
            </span>
          ))}
          {tags.length > 3 && <span className="self-center text-[11px] font-medium text-gray-400">+{tags.length - 3}</span>}
        </div>
      )}

      <div className="mt-auto pt-5">
        <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('knowledge.list.columns.documents', 'Documents')}</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-sm text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
            <span className="truncate">{t('knowledge.filesCount', { count: kb.fileCount ?? 0, defaultValue: '{{count}} files' })}</span>
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
              <MenuPanel placement="top">
                <MenuItem onClick={() => { onOpen(kb); setShowMenu(false); }}>
                  <BookOpen className="h-4 w-4" /> {t('common.details', 'Details')}
                </MenuItem>
                <MenuItem onClick={() => { onEdit(kb); setShowMenu(false); }}>
                  <Pencil className="h-4 w-4" /> {t('common.edit', 'Edit')}
                </MenuItem>
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                <MenuItem danger onClick={() => { onDelete(kb); setShowMenu(false); }}>
                  <Trash2 className="h-4 w-4" /> {t('common.delete', 'Delete')}
                </MenuItem>
              </MenuPanel>
            )}
          </div>

          <button
            onClick={() => onEdit(kb)}
            aria-label={t('common.edit', 'Edit')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NotchCard>
  );
};

/**
 * Knowledge Base management page component
 */
const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBaseItem | null>(null);
  const [isCheckingEmbedding, setIsCheckingEmbedding] = useState(false);
  const [showEmbeddingWarning, setShowEmbeddingWarning] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get current project ID from auth store (via user object)
  const currentProjectId = useAuthStore(state => state.user?.project_id);

  const knowledgeBases = useKnowledgeStore(knowledgeSelectors.knowledgeBases);
  const searchQuery = useKnowledgeStore(knowledgeSelectors.searchQuery);
  const isLoading = useKnowledgeStore(state => state.isLoading);
  const error = useKnowledgeStore(state => state.error);
  const hasError = useKnowledgeStore(state => state.hasError);

  const setSearchQuery = useKnowledgeStore(state => state.setSearchQuery);
  const createKnowledgeBase = useKnowledgeStore(state => state.createKnowledgeBase);
  const updateKnowledgeBase = useKnowledgeStore(state => state.updateKnowledgeBase);
  const deleteKnowledgeBase = useKnowledgeStore(state => state.deleteKnowledgeBase);
  const fetchKnowledgeBases = useKnowledgeStore(state => state.fetchKnowledgeBases);
  const refreshKnowledgeBases = useKnowledgeStore(state => state.refreshKnowledgeBases);
  const clearError = useKnowledgeStore(state => state.clearError);
  const retry = useKnowledgeStore(state => state.retry);

  // Fetch (and re-fetch on search change) the knowledge base data
  useEffect(() => {
    fetchKnowledgeBases(searchQuery ? { search: searchQuery } : undefined).catch((err: unknown) => {
      // Error state is already handled in the store
      console.error('Failed to load knowledge bases:', err);
    });
  }, [searchQuery, fetchKnowledgeBases]);

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = { all: knowledgeBases.length, file: 0, website: 0, qa: 0 };
    knowledgeBases.forEach((kb: KnowledgeBaseItem) => {
      counts[kb.type ?? 'file'] += 1;
    });
    return counts;
  }, [knowledgeBases]);

  // Search, type filter and sort (most recently updated first)
  const filteredKnowledgeBases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = knowledgeBases.filter((kb: KnowledgeBaseItem) => {
      if (typeFilter !== 'all' && (kb.type ?? 'file') !== typeFilter) return false;
      if (!query) return true;
      return kb.title.toLowerCase().includes(query) || kb.content.toLowerCase().includes(query);
    });

    const time = (value: string) => {
      const ms = new Date(value).getTime();
      return Number.isNaN(ms) ? -Infinity : ms;
    };
    return [...filtered].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
  }, [knowledgeBases, searchQuery, typeFilter]);

  const typeLabel = (type: KnowledgeBaseType): string => {
    switch (type) {
      case 'website': return t('knowledge.typeWebsite', 'Website');
      case 'qa': return t('knowledge.typeQA', 'QA Pairs');
      default: return t('knowledge.typeFile', 'File');
    }
  };

  const handleCreateKnowledgeBase = async (data: CreateKnowledgeBaseData): Promise<void> => {
    try {
      await createKnowledgeBase({
        title: data.name,
        content: data.description,
        category: 'general',
        icon: data.icon,
        tags: data.tags,
        type: data.type,
        crawlConfig: data.crawlConfig
      });
      showKnowledgeBaseSuccess(showToast, 'create', data.name);

      // For website type, the backend will automatically start crawling based on crawl_config
      if (data.type === 'website' && data.crawlConfig) {
        showToast(
          'info',
          t('knowledge.crawl.started', 'Crawl Started'),
          t('knowledge.crawl.startedDesc', 'Website crawl job has been started')
        );
      }
    } catch (err) {
      console.error('Failed to create knowledge base:', err);
      showKnowledgeBaseError(showToast, 'create', err, data.name);
      throw err; // Re-throw to let modal handle the error
    }
  };

  // Check if embedding model is configured before opening create modal
  const handleOpenCreateModal = useCallback(async (): Promise<void> => {
    if (!currentProjectId) {
      showToast('error', t('knowledge.embedding.error', 'Error'), t('knowledge.embedding.noProject', 'Current project not found'));
      return;
    }

    setIsCheckingEmbedding(true);

    try {
      const projectConfigService = new ProjectConfigApiService();
      const aiConfig = await projectConfigService.getAIConfig(currentProjectId);

      if (!aiConfig.default_embedding_provider_id || !aiConfig.default_embedding_model) {
        setShowEmbeddingWarning(true);
        return;
      }

      setIsCreateModalOpen(true);
    } catch (err) {
      console.error('Failed to check AI config:', err);
      // If API call fails, show error toast but still allow creating (fail-open)
      showToast(
        'warning',
        t('knowledge.embedding.checkFailed', 'Check Failed'),
        t('knowledge.embedding.checkFailedDesc', 'Unable to verify embedding model configuration. Please ensure an embedding model is configured.')
      );
      setIsCreateModalOpen(true);
    } finally {
      setIsCheckingEmbedding(false);
    }
  }, [currentProjectId, showToast, t]);

  const handleGoToAIConfig = (): void => {
    setShowEmbeddingWarning(false);
    navigate('/settings/providers');
  };

  const handleEditKnowledgeBase = async (id: string, data: { name: string; description: string; icon: string; tags: string[] }): Promise<void> => {
    try {
      await updateKnowledgeBase(id, {
        title: data.name,
        content: data.description,
        icon: data.icon,
        tags: data.tags
      });
      showKnowledgeBaseSuccess(showToast, 'update', data.name);
    } catch (err) {
      console.error('Failed to update knowledge base:', err);
      showKnowledgeBaseError(showToast, 'update', err, data.name);
      throw err; // Re-throw to let modal handle the error
    }
  };

  const handleOpenEditModal = (knowledgeBase: KnowledgeBaseItem): void => {
    setEditingKnowledgeBase(knowledgeBase);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = (): void => {
    setIsEditModalOpen(false);
    setEditingKnowledgeBase(null);
  };

  const handleRefresh = async (): Promise<void> => {
    try {
      clearError();
      await refreshKnowledgeBases();
    } catch (err) {
      console.error('Failed to refresh knowledge bases:', err);
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteKnowledgeBase(deleteTarget.id);
      showKnowledgeBaseSuccess(showToast, 'delete', deleteTarget.title);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete knowledge base:', err);
      showKnowledgeBaseError(showToast, 'delete', err, deleteTarget.title);
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate to knowledge base detail view
  const handleKnowledgeBaseClick = (knowledgeBase: KnowledgeBaseItem): void => {
    if (knowledgeBase.type === 'website') {
      navigate(`/knowledge/website/${knowledgeBase.id}`);
    } else if (knowledgeBase.type === 'qa') {
      navigate(`/knowledge/qa/${knowledgeBase.id}`);
    } else {
      navigate(`/knowledge/${knowledgeBase.id}`);
    }
  };

  const filterOptions: FilterOption<TypeFilter>[] = [
    { value: 'all', label: t('common.all', 'All'), count: typeCounts.all },
    { value: 'file', label: typeLabel('file'), count: typeCounts.file, dot: TYPE_META.file.dot },
    { value: 'website', label: typeLabel('website'), count: typeCounts.website, dot: TYPE_META.website.dot },
    { value: 'qa', label: typeLabel('qa'), count: typeCounts.qa, dot: TYPE_META.qa.dot },
  ];

  const hasActiveFilters = Boolean(searchQuery.trim()) || typeFilter !== 'all';

  const createButton = (
    <InkButton
      onClick={handleOpenCreateModal}
      disabled={isCheckingEmbedding}
      icon={isCheckingEmbedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
    >
      {t('knowledge.create', 'Create Knowledge Base')}
    </InkButton>
  );

  return (
    <PageShell
      after={
        <>
          <CreateKnowledgeBaseModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSubmit={handleCreateKnowledgeBase}
            isLoading={isLoading}
          />

          <EditKnowledgeBaseModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            onSubmit={handleEditKnowledgeBase}
            knowledgeBase={editingKnowledgeBase}
            isLoading={isLoading}
          />

          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={t('knowledge.confirmDelete.title', 'Delete Knowledge Base')}
            message={t('knowledge.confirmDelete.message', { name: deleteTarget?.title, defaultValue: 'Are you sure you want to delete knowledge base "{{name}}"? This action cannot be undone.' })}
            confirmText={t('common.delete', 'Delete')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            isLoading={isDeleting}
          />

          {/* Embedding model required */}
          <Modal
            isOpen={showEmbeddingWarning}
            onClose={() => setShowEmbeddingWarning(false)}
            icon={Sparkles}
            tone="warning"
            size="sm"
            title={t('knowledge.embedding.requiredTitle', 'Embedding Model Required')}
            footer={
              <>
                <SecondaryButton onClick={() => setShowEmbeddingWarning(false)}>
                  {t('common.cancel', 'Cancel')}
                </SecondaryButton>
                <PrimaryButton onClick={handleGoToAIConfig} icon={<Settings className="h-4 w-4" />}>
                  {t('knowledge.embedding.goToConfig', 'Go to Configuration')}
                </PrimaryButton>
              </>
            }
          >
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {t('knowledge.embedding.requiredDesc', 'Creating a knowledge base requires a default embedding model to be configured. The embedding model is used to convert document content into vectors for semantic search.')}
            </p>
            <div className="tgo-well flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                <Settings className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {t('knowledge.embedding.configPath', 'Configuration Path')}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {t('knowledge.embedding.configPathDesc', 'Settings → Model Providers → Set Default Embedding Model')}
                </p>
              </div>
            </div>
          </Modal>
        </>
      }
    >
      <PageHeader
        title={t('knowledge.titleShort', 'Knowledge')}
        total={typeCounts.all}
        actions={createButton}
        stats={[
          { key: 'file', value: typeCounts.file, label: typeLabel('file').toLowerCase(), badge: 'bg-acid-300 text-ink-900' },
          { key: 'website', value: typeCounts.website, label: typeLabel('website').toLowerCase(), badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
          { key: 'qa', value: typeCounts.qa, label: typeLabel('qa').toLowerCase(), badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
        ]}
      />

      <section className="space-y-5">
        <SectionHeader
          title={t('knowledge.listTitle', 'Knowledge Bases')}
          count={filteredKnowledgeBases.length}
          countLabel={t('knowledge.countLabel', 'sources')}
        >
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('knowledge.selectModal.searchPlaceholder', 'Search knowledge bases...')}
            wide
          />
          <RefreshButton onClick={handleRefresh} spinning={isLoading} disabled={isLoading} />
          <FilterPills options={filterOptions} value={typeFilter} onChange={setTypeFilter} />
        </SectionHeader>
        <p className="-mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          {t('knowledge.subtitle', 'Manage knowledge sources available to agents.')}
        </p>

        {hasError ? (
          <div className="space-y-3">
            <ErrorPanel
              message={error || t('knowledge.list.loadFailedDesc', 'An error occurred while fetching knowledge bases')}
              onRetry={retry}
            />
            <div className="text-center">
              <button onClick={clearError} className="text-xs font-medium text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:hover:text-white">
                {t('knowledge.error.clear', 'Clear Error')}
              </button>
            </div>
          </div>
        ) : isLoading && knowledgeBases.length === 0 ? (
          <SkeletonGrid />
        ) : filteredKnowledgeBases.length === 0 ? (
          <EmptyPanel
            icon={BookOpen}
            title={hasActiveFilters ? t('knowledge.empty.noResults', 'No matching knowledge bases') : t('knowledge.empty.title', 'No Knowledge Bases')}
            description={hasActiveFilters ? t('workflow.empty.noResultsDesc', 'Try adjusting your search keywords or filters') : t('knowledge.empty.description', 'Create your first knowledge base to get started')}
            action={hasActiveFilters ? undefined : createButton}
          />
        ) : (
          <CardGrid>
            {filteredKnowledgeBases.map((kb: KnowledgeBaseItem) => (
              <KnowledgeCard
                key={kb.id}
                kb={kb}
                typeLabel={typeLabel(kb.type ?? 'file')}
                onOpen={handleKnowledgeBaseClick}
                onEdit={handleOpenEditModal}
                onDelete={setDeleteTarget}
              />
            ))}
          </CardGrid>
        )}
      </section>
    </PageShell>
  );
};

export default KnowledgeBase;
