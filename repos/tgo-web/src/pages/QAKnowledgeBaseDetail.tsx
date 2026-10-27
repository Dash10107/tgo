import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Pencil,
  PencilLine,
  Trash2,
  Upload,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Folder,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Modal, Field, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import {
  PageShell, PageLoader, DetailHeader, InkButton, GhostButton, RefreshButton, SectionHeader, SearchField,
  FilterPills, EmptyPanel, ErrorPanel, StatTile, type FilterOption,
} from '@/components/ui/PageKit';
import { useToast } from '@/hooks/useToast';
import { KnowledgeBaseApiService, type QAPairResponse, type QAPairListResponse, type QACategoryListResponse } from '@/services/knowledgeBaseApi';
import { transformCollectionToKnowledgeBase } from '@/utils/knowledgeBaseTransforms';
import type { KnowledgeBase } from '@/types';

/**
 * QA Knowledge Base Detail Page Component
 * Displays QA pairs with CRUD operations
 */
const QAKnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // State
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [qaPairs, setQaPairs] = useState<QAPairResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPairs, setIsLoadingPairs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(10);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<QAPairResponse | null>(null);

  // Form state
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import state
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Delete state
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<QAPairResponse | null>(null);

  // Statistics
  const stats = {
    total,

    pending: qaPairs.filter(p => p.status === 'pending').length,
    processing: qaPairs.filter(p => p.status === 'processing').length,
    processed: qaPairs.filter(p => p.status === 'processed').length,
    failed: qaPairs.filter(p => p.status === 'failed').length,
  };

  // Load knowledge base
  const loadKnowledgeBase = useCallback(async () => {
    if (!id) return;
    try {
      const collection = await KnowledgeBaseApiService.getCollection(id);
      const kb = transformCollectionToKnowledgeBase(collection);
      setKnowledgeBase(kb);
      if (collection.collection_type !== 'qa') {
        if (collection.collection_type === 'website') {
          navigate(`/knowledge/website/${id}`, { replace: true });
        } else {
          navigate(`/knowledge/${id}`, { replace: true });
        }
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
      setError(err instanceof Error ? err.message : t('knowledge.qa.loadFailed'));
    }
  }, [id, navigate, t]);

  // Load QA pairs
  const loadQAPairs = useCallback(async () => {
    if (!id) return;
    setIsLoadingPairs(true);
    try {
      const response: QAPairListResponse = await KnowledgeBaseApiService.getQAPairs(id, {
        limit,
        offset,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      });
      setQaPairs(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (err) {
      console.error('Failed to load QA pairs:', err);
      showToast('error', t('knowledge.qa.loadPairsFailed'));
    } finally {
      setIsLoadingPairs(false);
    }
  }, [id, limit, offset, categoryFilter, statusFilter, showToast, t]);

  // Load categories
  const loadCategories = useCallback(async () => {
    if (!id) return;
    try {
      const response: QACategoryListResponse = await KnowledgeBaseApiService.getQACategories(id);
      setCategories(response.categories ?? []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Don't show toast for category loading failure, it's not critical
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadKnowledgeBase();
      setIsLoading(false);
    };
    init();
  }, [loadKnowledgeBase]);

  // Load pairs and categories when knowledge base is loaded
  useEffect(() => {
    if (knowledgeBase) {
      loadQAPairs();
      loadCategories();
    }
  }, [knowledgeBase, loadQAPairs, loadCategories]);

  // Reset form
  const resetForm = () => {
    setFormQuestion('');
    setFormAnswer('');
    setFormCategory('');
    setFormTags('');
  };

  // Handle add QA pair
  const handleAddPair = async () => {
    if (!id || !formQuestion.trim() || !formAnswer.trim()) return;
    setIsSubmitting(true);
    try {
      await KnowledgeBaseApiService.createQAPair(id, {
        question: formQuestion.trim(),
        answer: formAnswer.trim(),
        category: formCategory.trim() || null,
        tags: formTags.trim() ? formTags.split(',').map(t => t.trim()) : null,
      });
      showToast('success', t('knowledge.qa.addSuccess'));
      setIsAddDialogOpen(false);
      resetForm();
      loadQAPairs();
      loadCategories(); // Refresh categories in case a new one was added
    } catch (err) {
      console.error('Failed to add QA pair:', err);
      showToast('error', t('knowledge.qa.addFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit QA pair
  const handleEditPair = async () => {
    if (!editingPair || !formQuestion.trim() || !formAnswer.trim()) return;
    setIsSubmitting(true);
    try {
      await KnowledgeBaseApiService.updateQAPair(editingPair.id, {
        question: formQuestion.trim(),
        answer: formAnswer.trim(),
        category: formCategory.trim() || null,
        tags: formTags.trim() ? formTags.split(',').map(t => t.trim()) : null,
      });
      showToast('success', t('knowledge.qa.editSuccess'));
      setIsEditDialogOpen(false);
      setEditingPair(null);
      resetForm();
      loadQAPairs();
      loadCategories(); // Refresh categories in case category was changed
    } catch (err) {
      console.error('Failed to update QA pair:', err);
      showToast('error', t('knowledge.qa.editFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete QA pair
  const handleDeletePair = async (pairId: string) => {
    if (deletingIds.has(pairId)) return;
    setDeletingIds(prev => new Set(prev).add(pairId));
    try {
      await KnowledgeBaseApiService.deleteQAPair(pairId);
      showToast('success', t('knowledge.qa.deleteSuccess'));
      loadQAPairs();
    } catch (err) {
      console.error('Failed to delete QA pair:', err);
      showToast('error', t('knowledge.qa.deleteFailed'));
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(pairId);
        return next;
      });
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!id || !importData.trim()) return;
    setIsImporting(true);
    try {
      const response = await KnowledgeBaseApiService.importQAPairs(id, {
        format: importFormat,
        data: importData,
      });
      showToast(
        'success',
        t('knowledge.qa.importSuccess', { count: response.created_count })
      );
      setIsImportDialogOpen(false);
      setImportData('');
      loadQAPairs();
      loadCategories(); // Refresh categories in case new ones were imported
    } catch (err) {
      console.error('Failed to import QA pairs:', err);
      showToast('error', t('knowledge.qa.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (pair: QAPairResponse) => {
    setEditingPair(pair);
    setFormQuestion(pair.question);
    setFormAnswer(pair.answer);
    setFormCategory(pair.category || '');
    setFormTags(pair.tags?.join(', ') || '');
    setIsEditDialogOpen(true);
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const goToPage = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const STATUS_META: Record<QAPairResponse['status'], { dot: string; chip: string; icon: React.ReactNode }> = {
    processed: { dot: 'bg-acid-500', chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300', icon: <CheckCircle2 className="h-3 w-3" /> },
    pending: { dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <Clock className="h-3 w-3" /> },
    processing: { dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    failed: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
  };

  // Filter QA pairs by search term (client-side)
  const filteredPairs = qaPairs.filter(pair => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return pair.question.toLowerCase().includes(term) || pair.answer.toLowerCase().includes(term);
  });

  const closePairDialog = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingPair(null);
    resetForm();
  };

  const closeImportDialog = () => {
    setIsImportDialogOpen(false);
    setImportData('');
  };

  if (isLoading) {
    return <PageLoader label={t('knowledge.qa.loading')} />;
  }

  if (error || !knowledgeBase) {
    return (
      <PageShell>
        <ErrorPanel message={error || t('knowledge.qa.loadFailed')} />
        <div className="flex justify-center">
          <GhostButton onClick={() => navigate('/knowledge')}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </GhostButton>
        </div>
      </PageShell>
    );
  }

  const statusOptions: FilterOption<string>[] = [
    { value: '', label: t('knowledge.qa.allStatuses') },
    { value: 'pending', label: t('knowledge.qa.status.pending'), dot: STATUS_META.pending.dot },
    { value: 'processing', label: t('knowledge.qa.status.processing'), dot: STATUS_META.processing.dot },
    { value: 'processed', label: t('knowledge.qa.status.processed'), dot: STATUS_META.processed.dot },
    { value: 'failed', label: t('knowledge.qa.status.failed'), dot: STATUS_META.failed.dot },
  ];

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  return (
    <PageShell
      after={
        <>
          {/* Add / edit pair */}
          <Modal
            isOpen={isAddDialogOpen || isEditDialogOpen}
            onClose={closePairDialog}
            preventClose={isSubmitting}
            size="lg"
            icon={isEditDialogOpen ? PencilLine : Plus}
            title={isEditDialogOpen ? t('knowledge.qa.editTitle') : t('knowledge.qa.addTitle')}
            subtitle={knowledgeBase.name}
            footer={
              <>
                <SecondaryButton onClick={closePairDialog} disabled={isSubmitting}>
                  {t('common.cancel')}
                </SecondaryButton>
                <PrimaryButton
                  onClick={isEditDialogOpen ? handleEditPair : handleAddPair}
                  loading={isSubmitting}
                  disabled={!formQuestion.trim() || !formAnswer.trim()}
                >
                  {isEditDialogOpen ? t('common.save') : t('common.add')}
                </PrimaryButton>
              </>
            }
          >
            <Field label={t('knowledge.qa.form.question')} htmlFor="qa-question" required>
              <textarea
                id="qa-question"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                rows={3}
                className="tgo-input"
                placeholder={t('knowledge.qa.form.questionPlaceholder')}
                autoFocus
              />
            </Field>
            <Field label={t('knowledge.qa.form.answer')} htmlFor="qa-answer" required>
              <textarea
                id="qa-answer"
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                rows={5}
                className="tgo-input"
                placeholder={t('knowledge.qa.form.answerPlaceholder')}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('knowledge.qa.form.category')} htmlFor="qa-category">
                <input
                  id="qa-category"
                  type="text"
                  list="qa-category-options"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="tgo-input"
                  placeholder={t('knowledge.qa.form.categoryPlaceholder')}
                />
                <datalist id="qa-category-options">
                  {categories.map(category => <option key={category} value={category} />)}
                </datalist>
              </Field>
              <Field label={t('knowledge.qa.form.tags')} htmlFor="qa-tags" hint={t('knowledge.qa.form.tagsHint')}>
                <input
                  id="qa-tags"
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="tgo-input"
                  placeholder={t('knowledge.qa.form.tagsPlaceholder')}
                />
              </Field>
            </div>
          </Modal>

          {/* Import */}
          <Modal
            isOpen={isImportDialogOpen}
            onClose={closeImportDialog}
            preventClose={isImporting}
            size="lg"
            icon={Upload}
            title={t('knowledge.qa.importTitle')}
            subtitle={knowledgeBase.name}
            footer={
              <>
                <SecondaryButton onClick={closeImportDialog} disabled={isImporting}>
                  {t('common.cancel')}
                </SecondaryButton>
                <PrimaryButton onClick={handleImport} loading={isImporting} disabled={!importData.trim()}>
                  {t('knowledge.qa.importButton')}
                </PrimaryButton>
              </>
            }
          >
            <Field label={t('knowledge.qa.importFormat')}>
              <div className="tgo-tabs" role="radiogroup">
                {(['json', 'csv'] as const).map(format => (
                  <button
                    key={format}
                    type="button"
                    role="radio"
                    aria-checked={importFormat === format}
                    data-active={importFormat === format}
                    onClick={() => setImportFormat(format)}
                    className="tgo-tab px-5 uppercase"
                  >
                    {format}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('knowledge.qa.importData')} htmlFor="qa-import-data" required>
              <textarea
                id="qa-import-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={9}
                className="tgo-input font-mono text-[13px]"
                placeholder={importFormat === 'json' ? t('knowledge.qa.importJsonPlaceholder') : t('knowledge.qa.importCsvPlaceholder')}
              />
            </Field>
            <div className="overflow-hidden rounded-2xl bg-ink-900">
              <p className="border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                {importFormat === 'json' ? t('knowledge.qa.importJsonFormat') : t('knowledge.qa.importCsvFormat')}
              </p>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-acid-300">
                {importFormat === 'json'
                  ? '[\n  {"question": "Question 1", "answer": "Answer 1"},\n  {"question": "Question 2", "answer": "Answer 2"}\n]'
                  : 'question,answer\nQuestion 1,Answer 1\nQuestion 2,Answer 2'}
              </pre>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={t('knowledge.qa.deleteTitle', 'Delete QA Pair')}
            message={t('knowledge.qa.deleteConfirm', { question: deleteTarget?.question, defaultValue: 'Delete "{{question}}"? This action cannot be undone.' })}
            confirmText={t('common.delete', 'Delete')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            onConfirm={() => {
              if (deleteTarget) handleDeletePair(deleteTarget.id);
              setDeleteTarget(null);
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      }
    >
      <DetailHeader
        title={knowledgeBase.name}
        description={knowledgeBase.description}
        eyebrow={t('knowledge.typeQA', 'QA Pairs')}
        icon={MessageSquare}
        onBack={() => navigate('/knowledge')}
        backLabel={t('knowledge.detail.backToList', 'Back')}
        actions={
          <>
            <GhostButton onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              {t('knowledge.qa.import')}
            </GhostButton>
            <InkButton onClick={openAddDialog} icon={<Plus className="h-4 w-4" />}>
              {t('knowledge.qa.add')}
            </InkButton>
          </>
        }
      />

      {/* Statistics */}
      <div className="tgo-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t('knowledge.qa.stats.total')} value={stats.total} icon={MessageSquare} tone="bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900" />
        <StatTile label={t('knowledge.qa.stats.pending')} value={stats.pending} icon={Clock} tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
        <StatTile label={t('knowledge.qa.stats.processed')} value={stats.processed} icon={CheckCircle2} tone="bg-acid-300 text-ink-900" />
        <StatTile label={t('knowledge.qa.stats.failed')} value={stats.failed} icon={AlertCircle} tone="bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400" />
      </div>

      <section className="space-y-5">
        <SectionHeader title={t('knowledge.qa.results', 'Q&A Pairs')} count={total} countLabel={t('knowledge.qa.countLabel', 'pairs')}>
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder={t('knowledge.qa.searchPlaceholder')} wide />
          <RefreshButton onClick={loadQAPairs} spinning={isLoadingPairs} disabled={isLoadingPairs} />
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setOffset(0);
              }}
              aria-label={t('knowledge.qa.allCategories')}
              className="tgo-input !h-9 !min-h-0 w-auto !rounded-full !bg-white !py-0 pl-4 text-[13px] dark:!bg-gray-900"
            >
              <option value="">{t('knowledge.qa.allCategories')}</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
        </SectionHeader>
        <FilterPills
          options={statusOptions}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setOffset(0);
          }}
        />

        {isLoadingPairs && qaPairs.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="tgo-skeleton h-32 rounded-[28px]" style={{ opacity: 1 - i * 0.2 }} />)}
          </div>
        ) : filteredPairs.length === 0 ? (
          <EmptyPanel
            icon={MessageSquare}
            title={t('knowledge.qa.noPairs')}
            action={
              searchTerm || statusFilter || categoryFilter ? undefined : (
                <InkButton onClick={openAddDialog} icon={<Plus className="h-4 w-4" />}>
                  {t('knowledge.qa.add')}
                </InkButton>
              )
            }
          />
        ) : (
          <div className={`tgo-stagger grid grid-cols-1 gap-4 xl:grid-cols-2 ${isLoadingPairs ? 'opacity-60 transition-opacity' : ''}`}>
            {filteredPairs.map(pair => {
              const status = STATUS_META[pair.status] ?? STATUS_META.pending;
              const isDeleting = deletingIds.has(pair.id);
              return (
                <article key={pair.id} className={`tgo-surface group flex flex-col p-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-acid-400 dark:bg-acid-400 dark:text-ink-900">Q</span>
                    <h3 className="min-w-0 flex-1 pt-1 text-[15px] font-medium leading-snug text-gray-900 dark:text-white">{pair.question}</h3>
                    <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <button onClick={() => openEditDialog(pair)} className="tgo-icon-btn h-8 w-8" aria-label={t('common.edit', 'Edit')} title={t('common.edit', 'Edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pair)}
                        disabled={isDeleting}
                        className="tgo-icon-btn h-8 w-8 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
                        aria-label={t('common.delete', 'Delete')}
                        title={t('common.delete', 'Delete')}
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acid-200 text-xs font-semibold text-ink-900 dark:bg-acid-400/20 dark:text-acid-300">A</span>
                    <p className="line-clamp-4 min-w-0 flex-1 pt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{pair.answer}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
                    <span className={`tgo-chip ${status.chip}`}>
                      {status.icon}
                      {t(`knowledge.qa.status.${pair.status}`)}
                    </span>
                    {pair.category && (
                      <span className="tgo-chip"><Folder className="h-3 w-3" />{pair.category}</span>
                    )}
                    {pair.tags?.map(tag => (
                      <span key={tag} className="tgo-chip bg-transparent shadow-[inset_0_0_0_1px_var(--color-gray-200)] dark:bg-transparent dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)]">#{tag}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="tgo-icon-btn h-10 w-10" aria-label={t('common.previous', 'Previous')}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tgo-chip h-10 px-4 text-sm tabular-nums">
              {t('knowledge.qa.pagination', { current: currentPage, total: totalPages })}
            </span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="tgo-icon-btn h-10 w-10" aria-label={t('common.next', 'Next')}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default QAKnowledgeBaseDetail;
