import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, Search, ArrowUpDown, FolderOpen, Clock, Eye, Pencil, Trash2, FileText, Globe, MessageSquare, Loader2, AlertCircle, Settings } from 'lucide-react';
import { useKnowledgeStore, knowledgeSelectors } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { showKnowledgeBaseSuccess, showKnowledgeBaseError } from '@/utils/toastHelpers';
import { CreateKnowledgeBaseModal, type CreateKnowledgeBaseData } from '@/components/knowledge/CreateKnowledgeBaseModal';
import { EditKnowledgeBaseModal } from '@/components/knowledge/EditKnowledgeBaseModal';
import { formatKnowledgeBaseUpdatedTime } from '@/utils/timeFormatting';
import { getIconComponent, getIconColor } from '@/components/knowledge/IconPicker';
import { getTagClasses } from '@/utils/tagColors';
import type { KnowledgeBaseItem } from '@/types';
import { useTranslation } from 'react-i18next';
import ProjectConfigApiService from '@/services/projectConfigApi';
import { useAuthStore } from '@/stores/authStore';



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

  // Fetch the knowledge base data on init
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchKnowledgeBases();
      } catch (error) {
        console.error('Failed to load knowledge bases:', error);
        // Error is already handled in the store
      }
    };

    loadData();
  }, [fetchKnowledgeBases]);

  // Re-fetch the data when the search changes
  useEffect(() => {
    const loadFilteredData = async () => {
      try {
        const params: any = {};
        if (searchQuery) params.search = searchQuery;

        await fetchKnowledgeBases(params);
      } catch (error) {
        console.error('Failed to load filtered knowledge bases:', error);
        // Error is already handled in the store
      }
    };

    loadFilteredData();
  }, [searchQuery, fetchKnowledgeBases]);

  // Compute filtering and sorting in the component (pagination and status filtering removed)
  const filteredKnowledgeBases = React.useMemo(() => {
    let filtered = knowledgeBases;

    // Search filtering
    if (searchQuery.trim()) {
      filtered = filtered.filter((kb: KnowledgeBaseItem) =>
        kb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kb.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sorting - descending by most recent update time
    filtered.sort((a: KnowledgeBaseItem, b: KnowledgeBaseItem) => {
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);

      // Handle invalid dates by putting them at the end
      if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
      if (isNaN(aDate.getTime())) return 1;
      if (isNaN(bDate.getTime())) return -1;

      return bDate.getTime() - aDate.getTime();
    });

    return filtered;
  }, [knowledgeBases, searchQuery]);

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
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      showKnowledgeBaseError(showToast, 'create', error, data.name);
      throw error; // Re-throw to let modal handle the error
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

      // Check if embedding model is configured
      if (!aiConfig.default_embedding_provider_id || !aiConfig.default_embedding_model) {
        setShowEmbeddingWarning(true);
        return;
      }

      // Embedding model is configured, open the create modal
      setIsCreateModalOpen(true);
    } catch (error) {
      console.error('Failed to check AI config:', error);
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

  const handleCloseCreateModal = (): void => {
    setIsCreateModalOpen(false);
  };

  // Close embedding warning modal
  const handleCloseEmbeddingWarning = (): void => {
    setShowEmbeddingWarning(false);
  };

  // Navigate to AI configuration page
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
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
      showKnowledgeBaseError(showToast, 'update', error, data.name);
      throw error; // Re-throw to let modal handle the error
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
      clearError(); // Clear any existing errors
      await refreshKnowledgeBases();
    } catch (error) {
      console.error('Failed to refresh knowledge bases:', error);
      // Error is already handled in the store
    }
  };

  const handleKnowledgeBaseAction = async (actionType: string, knowledgeBase: KnowledgeBaseItem): Promise<void> => {
    switch (actionType) {
      case 'edit':
        handleOpenEditModal(knowledgeBase);
        break;
      case 'delete':
        if (confirm(t('knowledge.confirmDelete.message', { name: knowledgeBase.title, defaultValue: `Are you sure you want to delete knowledge base "{{name}}"? This action cannot be undone.` }))) {
          try {
            await deleteKnowledgeBase(knowledgeBase.id);
            showKnowledgeBaseSuccess(showToast, 'delete', knowledgeBase.title);
          } catch (error) {
            console.error('Failed to delete knowledge base:', error);
            showKnowledgeBaseError(showToast, 'delete', error, knowledgeBase.title);
          }
        }
        break;
      default:
        console.log('Unknown action:', actionType);
    }
  };

  const handleSearchChange = (query: string): void => {
    setSearchQuery(query);
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

  return (
    <main className="flex-grow flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 sticky top-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg z-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('knowledge.manage', 'Manage Knowledge Base')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('knowledge.subtitle', 'Manage knowledge sources available to agents.')}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-md transition-colors duration-200"
              title={t('knowledge.detail.refresh', 'Refresh')}
              onClick={handleRefresh}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              className="flex items-center px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white text-sm rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleOpenCreateModal}
              disabled={isCheckingEmbedding}
            >
              {isCheckingEmbedding ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              <span>{t('knowledge.create', 'Create Knowledge Base')}</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-grow max-w-xs">
            <input
              type="text"
              placeholder={t('knowledge.selectModal.searchPlaceholder', 'Search knowledge bases...')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300/70 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white/80 dark:bg-gray-700/80 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          </div>

        </div>


      </header>

      {/* Content Area: Knowledge Base List */}
      <div className="flex-grow overflow-y-auto p-6" style={{ height: 0 }}>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(0,_3fr)_80px_1fr_1fr_auto] gap-4 px-4 py-2 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
              {t('knowledge.list.columns.name', 'Name')} <ArrowUpDown className="w-3 h-3 ml-1" />
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
              {t('knowledge.list.columns.type', 'Type')}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
              {t('knowledge.list.columns.documents', 'Documents')} <ArrowUpDown className="w-3 h-3 ml-1" />
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
              {t('knowledge.list.columns.lastUpdated', 'Last Updated')} <ArrowUpDown className="w-3 h-3 ml-1" />
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right pr-2">
              {t('knowledge.list.columns.actions', 'Actions')}
            </div>
          </div>

          {/* Table Body */}
          <div>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500 dark:text-blue-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</span>
                </div>
              </div>
            ) : hasError ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">{t('common.loadFailed', 'Load Failed')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{error || t('knowledge.list.loadFailedDesc', 'An error occurred while fetching knowledge bases')}</p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={retry}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('common.retry', 'Retry')}
                  </button>
                  <button
                    onClick={clearError}
                    className="inline-flex items-center px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('knowledge.error.clear', 'Clear Error')}
                  </button>
                </div>
              </div>
            ) : filteredKnowledgeBases.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">{t('knowledge.empty.title', 'No Knowledge Bases')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{t('knowledge.empty.description', 'Create your first knowledge base to get started')}</p>
                <button
                  onClick={handleOpenCreateModal}
                  disabled={isCheckingEmbedding}
                  className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingEmbedding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {t('knowledge.create', 'Create Knowledge Base')}
                </button>
              </div>
            ) : (
              filteredKnowledgeBases.map((kb: KnowledgeBaseItem, index: number) => {
                const isWebsite = kb.type === 'website';
                const isQA = kb.type === 'qa';

                return (
                  <div
                    key={kb.id}
                    className={`grid grid-cols-[minmax(0,_3fr)_80px_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-gray-50/30 dark:hover:bg-gray-700/30 transition-colors ${
                      index < filteredKnowledgeBases.length - 1 ? 'border-b border-gray-200/60 dark:border-gray-700/60' : ''
                    }`}
                  >
                    <div
                      className="flex items-start space-x-3 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/30 -mx-2 px-2 py-1 rounded transition-all duration-200 group"
                      onClick={() => handleKnowledgeBaseClick(kb)}
                    >
                      {(() => {
                        const IconComponent = getIconComponent(kb.icon);
                        const iconColor = getIconColor(kb.icon);
                        return (
                          <IconComponent
                            className={`w-5 h-5 flex-shrink-0 mt-0.5 transition-colors duration-200 ${iconColor} hover:opacity-80`}
                          />
                        );
                      })()}
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">{kb.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{kb.content}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {kb.tags.map((tag: any, tagIndex: number) => {
                            const tagName = typeof tag === 'string' ? tag : tag.name;
                            return (
                              <span
                                key={tagIndex}
                                className={getTagClasses(tagName, {
                                  size: 'sm',
                                  includeHover: false,
                                  includeBorder: false,
                                  rounded: true
                                })}
                                style={{ fontSize: '10px' }}
                              >
                                {tagName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Type Column */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        {isWebsite ? (
                          <>
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">{t('knowledge.typeWebsite', 'Website')}</span>
                          </>
                        ) : isQA ? (
                          <>
                            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">{t('knowledge.typeQA', 'QA Pairs')}</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">{t('knowledge.typeFile', 'File')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('knowledge.filesCount', { count: kb.fileCount, defaultValue: `{{count}} files` })}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-gray-400 dark:text-gray-500" />
                      {formatKnowledgeBaseUpdatedTime(kb.updatedAt)}
                    </div>

                    <div className="flex justify-end space-x-2">
                      <button
                        className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={t('common.details', 'Details')}
                        onClick={() => handleKnowledgeBaseClick(kb)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={t('common.edit', 'Edit')}
                        onClick={() => handleKnowledgeBaseAction('edit', kb)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title={t('common.delete', 'Delete')}
                        onClick={() => handleKnowledgeBaseAction('delete', kb)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </div>

      {/* Create Knowledge Base Modal */}
      <CreateKnowledgeBaseModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSubmit={handleCreateKnowledgeBase}
        isLoading={isLoading}
      />

      {/* Edit Knowledge Base Modal */}
      <EditKnowledgeBaseModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSubmit={handleEditKnowledgeBase}
        knowledgeBase={editingKnowledgeBase}
        isLoading={isLoading}
      />

      {/* Embedding Model Warning Modal */}
      {showEmbeddingWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70"
            onClick={handleCloseEmbeddingWarning}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100 dark:border-amber-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('knowledge.embedding.requiredTitle', 'Embedding Model Required')}
                  </h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('knowledge.embedding.requiredDesc', 'Creating a knowledge base requires a default embedding model to be configured. The embedding model is used to convert document content into vectors for semantic search.')}
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('knowledge.embedding.configPath', 'Configuration Path')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('knowledge.embedding.configPathDesc', 'Settings → Model Providers → Set Default Embedding Model')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={handleCloseEmbeddingWarning}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleGoToAIConfig}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {t('knowledge.embedding.goToConfig', 'Go to Configuration')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default KnowledgeBase;
