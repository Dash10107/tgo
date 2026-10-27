import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, ExternalLink, Plus, Loader2, CheckCircle2,
  ChevronRight, Trash2, RotateCw, ArrowDownRight
} from 'lucide-react';
import { KnowledgeBaseApiService, type WebsitePageResponse, type CrawlProgressSchema } from '@/services/knowledgeBaseApi';
import { transformCollectionToKnowledgeBase } from '@/utils/knowledgeBaseTransforms';
import { useToast } from '@/hooks/useToast';
import type { KnowledgeBase } from '@/types';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Modal, Field, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import {
  PageShell, PageLoader, DetailHeader, InkButton, GhostButton, RefreshButton, SectionHeader, EmptyPanel, ErrorPanel,
} from '@/components/ui/PageKit';

// Tree node interface for hierarchical page display
interface PageTreeNode extends WebsitePageResponse {
  children: PageTreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
}

// Convert API response to tree node (recursive to handle children)
const pageToTreeNode = (page: WebsitePageResponse, defaultExpanded: boolean = false): PageTreeNode => {
  // Recursively convert children if present
  const childNodes: PageTreeNode[] = page.children
    ? page.children.map(child => pageToTreeNode(child, false)) // Children are not expanded by default
    : [];

  return {
    ...page,
    children: childNodes,
    isExpanded: defaultExpanded && childNodes.length > 0, // Only expand if has loaded children
    isLoading: false,
    // Use API's has_children field, fallback to checking children array length
    hasChildren: page.has_children ?? childNodes.length > 0,
  };
};

/**
 * Website Knowledge Base Detail Page Component
 * Displays crawled pages in a tree structure with crawl progress
 */
const WebsiteKnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // State
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgressSchema | null>(null);
  const [rootPages, setRootPages] = useState<PageTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add page dialog state
  const [isAddPageDialogOpen, setIsAddPageDialogOpen] = useState(false);
  const [newPageUrl, setNewPageUrl] = useState('');
  const [newPageMaxDepth, setNewPageMaxDepth] = useState(0);
  const [newPageParentId, setNewPageParentId] = useState<string | null>(null);
  const [isAddingPage, setIsAddingPage] = useState(false);

  // Page operations state
  const [deletingPages, setDeletingPages] = useState<Set<string>>(new Set());
  const [recrawlingPages, setRecrawlingPages] = useState<Set<string>>(new Set());
  const [crawlingDeeperPages, setCrawlingDeeperPages] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<PageTreeNode | null>(null);

  // Flatten tree to list for parent page selector
  const flattenTree = useCallback((nodes: PageTreeNode[], prefix: string = ''): Array<{ id: string; label: string; depth: number }> => {
    const result: Array<{ id: string; label: string; depth: number }> = [];
    for (const node of nodes) {
      let pathname = '';
      try {
        pathname = new URL(node.url).pathname;
      } catch {
        // Fall back to the raw URL below
      }
      const label = prefix + (node.title || pathname || node.url);

      result.push({ id: node.id, label, depth: node.depth });
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children, '  '.repeat(node.depth + 1)));
      }
    }
    return result;
  }, []);

  // Load knowledge base data
  const loadKnowledgeBase = useCallback(async () => {
    if (!id) return;

    try {
      const collection = await KnowledgeBaseApiService.getCollection(id);
      const kb = transformCollectionToKnowledgeBase(collection);
      setKnowledgeBase(kb);

      // Check if it's a website type, if not redirect
      if (collection.collection_type !== 'website') {
        navigate(`/knowledge/${id}`, { replace: true });
        return;
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
      setError(err instanceof Error ? err.message : t('knowledge.website.loadFailed'));
    }
  }, [id, navigate, t]);

  // Load crawl progress
  const loadCrawlProgress = useCallback(async () => {
    if (!id) return;
    try {
      const progress = await KnowledgeBaseApiService.getWebsiteCrawlProgress(id);
      setCrawlProgress(progress);
    } catch (err) {
      console.error('Failed to load crawl progress:', err);
    }
  }, [id]);

  // Load children of a page (for lazy loading deeper levels)
  const loadChildPages = useCallback(async (parentId: string): Promise<PageTreeNode[]> => {
    if (!id) return [];

    try {
      const response = await KnowledgeBaseApiService.getWebsitePages(id, {
        parent_page_id: parentId,
        limit: 100,
      });
      return response.data.map(page => pageToTreeNode(page, false));
    } catch (err) {
      console.error('Failed to load child pages:', err);
      return [];
    }
  }, [id]);

  // Load root pages with default expansion to level 2
  const loadRootPages = useCallback(async () => {
    if (!id) return;

    setIsLoadingPages(true);
    try {
      // Get root pages (depth=0) with their direct children (tree_depth=1)
      // This allows default expansion to show 2 levels
      const response = await KnowledgeBaseApiService.getWebsitePages(id, {
        depth: 0,
        tree_depth: 2, // Include direct children in response
        limit: 100,
      });

      // Convert root pages to tree nodes with isExpanded=true
      // pageToTreeNode will recursively convert children if present
      const rootNodes = response.data.map(page => pageToTreeNode(page, true));

      setRootPages(rootNodes);
    } catch (err) {
      console.error('Failed to load pages:', err);
      showToast('error', t('knowledge.website.loadPagesFailed'));
    } finally {
      setIsLoadingPages(false);
    }
  }, [id, showToast, t]);

  // Toggle expand/collapse of a tree node
  const toggleNodeExpand = useCallback(async (nodeId: string) => {
    // Find the node first to check its current state
    const findNode = (nodes: PageTreeNode[]): PageTreeNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(rootPages);
    if (!node) return;

    // If already expanded, just collapse
    if (node.isExpanded) {
      const updateNodes = (nodes: PageTreeNode[]): PageTreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isExpanded: false };
          }
          if (n.children.length > 0) {
            return { ...n, children: updateNodes(n.children) };
          }
          return n;
        });
      };
      setRootPages(prev => updateNodes(prev));
      return;
    }

    // If not expanded and has no loaded children but hasChildren=true, need to load
    if (node.children.length === 0 && node.hasChildren) {
      // Set loading state
      const setLoading = (nodes: PageTreeNode[]): PageTreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isLoading: true };
          }
          if (n.children.length > 0) {
            return { ...n, children: setLoading(n.children) };
          }
          return n;
        });
      };
      setRootPages(prev => setLoading(prev));

      // Load children
      const children = await loadChildPages(nodeId);

      const updateWithChildren = (nodes: PageTreeNode[]): PageTreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              children,
              isExpanded: children.length > 0,
              isLoading: false,
              hasChildren: children.length > 0
            };
          }
          if (n.children.length > 0) {
            return { ...n, children: updateWithChildren(n.children) };
          }
          return n;
        });
      };
      setRootPages(prev => updateWithChildren(prev));
    } else if (node.children.length > 0) {
      // Has loaded children, just expand
      const updateNodes = (nodes: PageTreeNode[]): PageTreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isExpanded: true };
          }
          if (n.children.length > 0) {
            return { ...n, children: updateNodes(n.children) };
          }
          return n;
        });
      };
      setRootPages(prev => updateNodes(prev));
    }
  }, [rootPages, loadChildPages]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await loadKnowledgeBase();
      setIsLoading(false);
    };
    initialize();
  }, [loadKnowledgeBase]);

  // Load pages and progress when knowledge base is loaded
  useEffect(() => {
    if (knowledgeBase) {
      loadRootPages();
      loadCrawlProgress();
    }
  }, [knowledgeBase, loadRootPages, loadCrawlProgress]);

  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([loadRootPages(), loadCrawlProgress()]);
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/knowledge');
  };

  // Reset add page dialog state
  const resetAddPageDialog = () => {
    setNewPageUrl('');
    setNewPageMaxDepth(0);
    setNewPageParentId(null);
    setIsAddPageDialogOpen(false);
  };

  // Add page to collection
  const handleAddPage = async () => {
    if (!id || !newPageUrl.trim()) return;

    // Validate URL
    try {
      new URL(newPageUrl.trim());
    } catch {
      showToast('error', t('knowledge.validation.urlInvalid'));
      return;
    }

    setIsAddingPage(true);
    try {
      const response = await KnowledgeBaseApiService.addWebsitePage(id, {
        url: newPageUrl.trim(),
        parent_page_id: newPageParentId,
        max_depth: newPageMaxDepth,
      });
      if (response.success) {
        showToast('success', t('knowledge.website.addPage.success'), response.message);
        resetAddPageDialog();
        await Promise.all([loadRootPages(), loadCrawlProgress()]);
      } else {
        showToast('warning', t('knowledge.website.addPage.skipped'), response.message);
      }
    } catch (err) {
      console.error('Failed to add page:', err);
      showToast('error', t('knowledge.website.addPage.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setIsAddingPage(false);
    }
  };

  // Delete a page
  const handleDeletePage = async (pageId: string) => {
    setDeletingPages(prev => new Set(prev).add(pageId));
    try {
      await KnowledgeBaseApiService.deleteWebsitePage(pageId);
      showToast('success', t('knowledge.website.deletePage.success'));
      await Promise.all([loadRootPages(), loadCrawlProgress()]);
    } catch (err) {
      console.error('Failed to delete page:', err);
      showToast('error', t('knowledge.website.deletePage.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingPages(prev => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  };

  // Update a single node's status while preserving tree state
  const updateNodeStatus = useCallback((nodeId: string, newStatus: PageTreeNode['status']) => {
    const updateNode = (nodes: PageTreeNode[]): PageTreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, status: newStatus };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setRootPages(prev => updateNode(prev));
  }, []);

  // Recrawl a page
  const handleRecrawlPage = async (pageId: string) => {
    setRecrawlingPages(prev => new Set(prev).add(pageId));
    try {
      const response = await KnowledgeBaseApiService.recrawlWebsitePage(pageId);
      if (response.success) {
        showToast('success', t('knowledge.website.recrawlPage.success'));
        // Update the node status to 'pending' and refresh crawl progress
        updateNodeStatus(pageId, 'pending');
        await loadCrawlProgress();
      } else {
        showToast('warning', t('knowledge.website.recrawlPage.skipped'), response.message);
      }
    } catch (err) {
      console.error('Failed to recrawl page:', err);
      showToast('error', t('knowledge.website.recrawlPage.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setRecrawlingPages(prev => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  };

  // Refresh a specific node's children while preserving tree state
  const refreshNodeChildren = useCallback(async (nodeId: string) => {
    if (!id) return;

    try {
      // Load children for the specific node
      const children = await loadChildPages(nodeId);

      // Update the tree, keeping all other nodes' expand state
      const updateNodeChildren = (nodes: PageTreeNode[]): PageTreeNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              children,
              hasChildren: children.length > 0,
              isExpanded: true, // Auto-expand to show new children
              isLoading: false,
            };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNodeChildren(node.children) };
          }
          return node;
        });
      };

      setRootPages(prev => updateNodeChildren(prev));
    } catch (err) {
      console.error('Failed to refresh node children:', err);
    }
  }, [id, loadChildPages]);

  // Crawl deeper from a page
  const handleCrawlDeeper = async (pageId: string) => {
    setCrawlingDeeperPages(prev => new Set(prev).add(pageId));
    try {
      const response = await KnowledgeBaseApiService.crawlDeeperFromPage(pageId, { max_depth: 1 });
      if (response.success) {
        showToast('success', t('knowledge.website.crawlDeeper.success'),
          t('knowledge.website.crawlDeeper.successDesc', {
            added: response.pages_added,
            found: response.links_found
          })
        );
        // Refresh only the affected node's children instead of reloading entire tree
        await Promise.all([refreshNodeChildren(pageId), loadCrawlProgress()]);
      } else {
        showToast('warning', t('knowledge.website.crawlDeeper.noNewPages'), response.message);
      }
    } catch (err) {
      console.error('Failed to crawl deeper:', err);
      showToast('error', t('knowledge.website.crawlDeeper.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setCrawlingDeeperPages(prev => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  };

  // Status chip for a page
  const getPageStatusBadge = (status: string) => {
    const statusConfig: Record<string, { chip: string; dot: string; label: string }> = {
      pending: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-400', label: t('knowledge.website.pageStatus.pending') },
      crawling: { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', dot: 'bg-sky-400 animate-pulse', label: t('knowledge.website.pageStatus.crawling') },
      fetched: { chip: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300', dot: 'bg-cyan-400', label: t('knowledge.website.pageStatus.fetched') },
      extracted: { chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', dot: 'bg-indigo-400', label: t('knowledge.website.pageStatus.extracted') },
      processing: { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-400 animate-pulse', label: t('knowledge.website.pageStatus.processing') },
      processed: { chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300', dot: 'bg-acid-500', label: t('knowledge.website.pageStatus.processed') },
      failed: { chip: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400', dot: 'bg-red-500', label: t('knowledge.website.pageStatus.failed') },
      skipped: { chip: '', dot: 'bg-gray-400', label: t('knowledge.website.pageStatus.skipped') },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`tgo-chip ${config.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  };

  // Render a tree node recursively
  const renderTreeNode = (node: PageTreeNode, level: number = 0): React.ReactNode => {
    const isDeleting = deletingPages.has(node.id);
    const isRecrawling = recrawlingPages.has(node.id);
    const isCrawlingDeeper = crawlingDeeperPages.has(node.id);
    const canCrawlDeeper = node.status === 'processed';
    const canRecrawl = ['processed', 'failed', 'skipped'].includes(node.status);
    let path = node.url;
    try {
      path = new URL(node.url).pathname;
    } catch {
      // Keep the raw URL when it cannot be parsed
    }

    return (
      <div key={node.id}>
        <div
          className={`group relative flex items-center gap-3 rounded-2xl py-2.5 pr-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${isDeleting ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${level * 28 + 12}px` }}
        >
          {level > 0 && (
            <span aria-hidden="true" className="absolute top-0 h-full w-px bg-gray-200 dark:bg-gray-700" style={{ left: `${level * 28 - 2}px` }} />
          )}

          <button
            onClick={() => toggleNodeExpand(node.id)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/70 dark:hover:bg-gray-700 ${!node.hasChildren ? 'invisible' : ''}`}
            disabled={node.isLoading}
            aria-label={node.isExpanded ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
          >
            {node.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${node.isExpanded ? 'rotate-90' : ''}`} />
            )}
          </button>

          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${level === 0 ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}>
            <Globe className="h-3.5 w-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-900 hover:underline hover:underline-offset-4 dark:text-gray-100"
              title={node.url}
            >
              <span className="truncate">{node.title || node.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            {node.title && <p className="truncate font-mono text-[11px] text-gray-400">{path}</p>}
          </div>

          <div className="hidden shrink-0 sm:block">{getPageStatusBadge(node.status)}</div>

          <span className="hidden w-10 shrink-0 text-center font-mono text-[11px] text-gray-400 md:block">D{node.depth}</span>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => handleRecrawlPage(node.id)}
              disabled={isRecrawling || !canRecrawl}
              className="tgo-icon-btn h-8 w-8"
              title={t('knowledge.website.recrawlPage.button')}
              aria-label={t('knowledge.website.recrawlPage.button')}
            >
              {isRecrawling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => handleCrawlDeeper(node.id)}
              disabled={isCrawlingDeeper || !canCrawlDeeper}
              className="tgo-icon-btn h-8 w-8"
              title={canCrawlDeeper ? t('knowledge.website.crawlDeeper.button') : t('knowledge.website.crawlDeeper.notReady')}
              aria-label={t('knowledge.website.crawlDeeper.button')}
            >
              {isCrawlingDeeper ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setDeleteTarget(node)}
              disabled={isDeleting}
              className="tgo-icon-btn h-8 w-8 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
              title={t('knowledge.website.deletePage.button')}
              aria-label={t('knowledge.website.deletePage.button')}
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {node.isExpanded && node.children.length > 0 && (
          <div>{node.children.map(child => renderTreeNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <PageLoader label={t('knowledge.website.loading')} />;
  }

  if (error || !knowledgeBase) {
    return (
      <PageShell>
        <ErrorPanel message={error || t('knowledge.website.loadFailed')} />
        <div className="flex justify-center">
          <GhostButton onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            {t('knowledge.detail.backToList')}
          </GhostButton>
        </div>
      </PageShell>
    );
  }

  const hasActiveProgress = crawlProgress && (crawlProgress.pages_pending > 0 || crawlProgress.pages_processing > 0 || crawlProgress.progress_percent < 100);
  const progressPercent = crawlProgress ? Math.round(crawlProgress.progress_percent) : 0;
  const parentOptions = flattenTree(rootPages);

  return (
    <PageShell
      after={
        <>
          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={t('knowledge.website.deletePage.title', 'Delete Page')}
            message={t('knowledge.website.deletePage.confirm', { name: deleteTarget?.title || deleteTarget?.url, defaultValue: 'Remove "{{name}}" from this knowledge base?' })}
            confirmText={t('common.delete', 'Delete')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            onConfirm={() => {
              if (deleteTarget) handleDeletePage(deleteTarget.id);
              setDeleteTarget(null);
            }}
            onCancel={() => setDeleteTarget(null)}
          />

          <Modal
            isOpen={isAddPageDialogOpen}
            onClose={resetAddPageDialog}
            preventClose={isAddingPage}
            icon={Plus}
            title={t('knowledge.website.addPage.title')}
            subtitle={knowledgeBase.name}
            footer={
              <>
                <SecondaryButton onClick={resetAddPageDialog} disabled={isAddingPage}>
                  {t('common.cancel')}
                </SecondaryButton>
                <PrimaryButton onClick={handleAddPage} loading={isAddingPage} disabled={!newPageUrl.trim()}>
                  {t('knowledge.website.addPage.submit')}
                </PrimaryButton>
              </>
            }
          >
            <Field label={t('knowledge.website.addPage.urlLabel')} htmlFor="add-page-url" required>
              <input
                id="add-page-url"
                type="url"
                value={newPageUrl}
                onChange={(e) => setNewPageUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newPageUrl.trim()) handleAddPage(); }}
                placeholder={t('knowledge.website.addPage.urlPlaceholder')}
                className="tgo-input"
                autoFocus
              />
            </Field>
            <Field label={t('knowledge.website.addPage.parentPageLabel')} htmlFor="add-page-parent" hint={t('knowledge.website.addPage.parentPageHint')}>
              <select
                id="add-page-parent"
                value={newPageParentId || ''}
                onChange={(e) => setNewPageParentId(e.target.value || null)}
                className="tgo-input"
              >
                <option value="">{t('knowledge.website.addPage.noParent')}</option>
                {parentOptions.map(page => (
                  <option key={page.id} value={page.id}>
                    {'─'.repeat(page.depth)} {page.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('knowledge.website.addPage.maxDepthLabel')} hint={t('knowledge.website.addPage.hint')}>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {[0, 1, 2, 3, 5, 10].map(depth => (
                  <button
                    key={depth}
                    type="button"
                    role="radio"
                    aria-checked={newPageMaxDepth === depth}
                    data-active={newPageMaxDepth === depth}
                    onClick={() => setNewPageMaxDepth(depth)}
                    className="tgo-pill h-9"
                    title={t(`knowledge.website.addPage.depthOption${depth}`)}
                  >
                    {t(`knowledge.website.addPage.depthOption${depth}`)}
                  </button>
                ))}
              </div>
            </Field>
          </Modal>
        </>
      }
    >
      <DetailHeader
        title={knowledgeBase.name}
        description={knowledgeBase.description}
        eyebrow={t('knowledge.typeWebsite', 'Website')}
        icon={Globe}
        onBack={handleBack}
        backLabel={t('knowledge.detail.backToList')}
        actions={
          <>
            <RefreshButton onClick={handleRefresh} spinning={isLoadingPages} disabled={isLoadingPages} />
            <InkButton onClick={() => setIsAddPageDialogOpen(true)} icon={<Plus className="h-4 w-4" />}>
              {t('knowledge.website.addPage.button')}
            </InkButton>
          </>
        }
      />

      {/* Crawl progress */}
      {crawlProgress && (
        <section className="tgo-surface tgo-fade-up overflow-hidden p-6 md:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${hasActiveProgress ? 'tgo-pulse-ring bg-acid-300 text-ink-900' : 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900'}`}>
                {hasActiveProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              </span>
              <div>
                <p className="tgo-eyebrow">{t('knowledge.website.progress.title')}</p>
                <p className="mt-1 text-lg font-medium tracking-tight text-gray-900 dark:text-white">
                  {hasActiveProgress ? t('knowledge.website.progress.crawling') : t('knowledge.website.progress.completed')}
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="tgo-display text-[52px] tabular-nums text-gray-900 dark:text-white">{progressPercent}</span>
              <span className="mb-2 text-lg text-gray-400">%</span>
            </div>
          </div>

          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-acid-500 transition-[width] duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { label: t('knowledge.website.progress.total'), value: crawlProgress.total_pages, dot: 'bg-gray-400' },
              { label: t('knowledge.website.progress.pending'), value: crawlProgress.pages_pending, dot: 'bg-amber-400' },
              { label: t('knowledge.website.progress.crawled'), value: crawlProgress.pages_crawled, dot: 'bg-sky-400' },
              ...(crawlProgress.pages_processing > 0 ? [{ label: t('knowledge.website.progress.processing'), value: crawlProgress.pages_processing, dot: 'bg-violet-400' }] : []),
              { label: t('knowledge.website.progress.processed'), value: crawlProgress.pages_processed, dot: 'bg-acid-500' },
              ...(crawlProgress.pages_failed > 0 ? [{ label: t('knowledge.website.progress.failed'), value: crawlProgress.pages_failed, dot: 'bg-red-500' }] : []),
            ].map(item => (
              <span key={item.label} className="tgo-chip h-8 px-3 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                {item.label}
                <b className="tabular-nums text-gray-900 dark:text-white">{item.value}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Page tree */}
      <section className="space-y-5">
        <SectionHeader
          title={t('knowledge.website.tabs.pages')}
          count={crawlProgress?.total_pages || rootPages.length}
          countLabel={t('knowledge.website.pagesLabel', 'pages')}
        />

        {isLoadingPages && rootPages.length === 0 ? (
          <div className="tgo-surface space-y-2 p-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="tgo-skeleton h-12 rounded-2xl" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : rootPages.length === 0 ? (
          <EmptyPanel
            icon={Globe}
            title={t('knowledge.website.noPages')}
            action={
              <InkButton onClick={() => setIsAddPageDialogOpen(true)} icon={<Plus className="h-4 w-4" />}>
                {t('knowledge.website.addPage.button')}
              </InkButton>
            }
          />
        ) : (
          <div className="tgo-surface p-2">
            <div className="flex items-center gap-3 px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              <span className="flex-1 pl-[72px]">{t('knowledge.website.columns.url')}</span>
              <span className="hidden w-24 sm:block">{t('knowledge.website.columns.status')}</span>
              <span className="hidden w-10 text-center md:block">{t('knowledge.website.columns.depth')}</span>
              <span className="w-[108px] text-right">{t('knowledge.website.columns.actions')}</span>
            </div>
            {rootPages.map(node => renderTreeNode(node, 0))}
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default WebsiteKnowledgeBaseDetail;
