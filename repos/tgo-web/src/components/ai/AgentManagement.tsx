import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AgentCard from './AgentCard';
import CreateAgentModal from './CreateAgentModal';
import EditAgentModal from './EditAgentModal';
import AgentStoreModal from './AgentStoreModal';
import ToolToastProvider from './ToolToastProvider';
// import AiToolDetailModal from '@/components/ui/AiToolDetailModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAIStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { Bot, ChevronLeft, ChevronRight, MessageCircle, Plus, Store } from 'lucide-react';
import {
  PageShell, PageHeader, InkButton, GhostButton, SectionHeader, SearchField, RefreshButton,
  FilterPills, FeatureBanner, EmptyPanel, ErrorPanel, SkeletonGrid, CardGrid, type FilterOption,
} from '@/components/ui/PageKit';
import type { Agent, AgentToolResponse, AgentWithDetailsResponse } from '@/types';
import { AIAgentsApiService } from '@/services/aiAgentsApi';

/**
 * Agent management page component
 */
// Stable selectors to prevent unnecessary re-renders
const selectAgents = (state: any) => state.agents;
const selectCurrentPage = (state: any) => state.agentCurrentPage;
const selectPageSize = (state: any) => state.agentPageSize;
const selectIsLoadingAgents = (state: any) => state.isLoadingAgents;
const selectAgentsError = (state: any) => state.agentsError;
const selectSetCurrentPage = (state: any) => state.setAgentCurrentPage;
const selectCreateAgent = (state: any) => state.createAgent;
const selectUpdateAgent = (state: any) => state.updateAgent;
const selectDeleteAgent = (state: any) => state.deleteAgent;
const selectSetShowCreateAgentModal = (state: any) => state.setShowCreateAgentModal;
const selectLoadAgents = (state: any) => state.loadAgents;

type AgentStatusFilter = 'all' | 'active' | 'inactive';

const AgentManagement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const agents = useAIStore(selectAgents);
  const currentPage = useAIStore(selectCurrentPage);
  const pageSize = useAIStore(selectPageSize);
  const isLoadingAgents = useAIStore(selectIsLoadingAgents);
  const agentsError = useAIStore(selectAgentsError);
  const setCurrentPage = useAIStore(selectSetCurrentPage);
  const createAgent = useAIStore(selectCreateAgent);
  const updateAgent = useAIStore(selectUpdateAgent);
  const deleteAgent = useAIStore(selectDeleteAgent);
  const setShowCreateAgentModal = useAIStore(selectSetShowCreateAgentModal);
  const loadAgents = useAIStore(selectLoadAgents);

  const { showSuccess, showError } = useToast();

  // Modal state
  // const [selectedTool, setSelectedTool] = useState<AgentToolResponse | null>(null);
  // const [showToolDetail, setShowToolDetail] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [showAgentStore, setShowAgentStore] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Default agent state
  const [defaultAgent, setDefaultAgent] = useState<AgentWithDetailsResponse | null>(null);
  const [isLoadingDefaultAgent, setIsLoadingDefaultAgent] = useState(false);

  // Track if agents have been loaded to prevent multiple API calls
  const hasLoadedAgents = useRef(false);
  const hasLoadedDefaultAgent = useRef(false);

  // Load default agent info
  const loadDefaultAgent = useCallback(async () => {
    if (hasLoadedDefaultAgent.current) return;
    setIsLoadingDefaultAgent(true);
    try {
      hasLoadedDefaultAgent.current = true;
      const response = await AIAgentsApiService.getDefaultAgents({ limit: 1, offset: 0 });
      setDefaultAgent(response.data[0] ?? null);
    } catch (error) {
      hasLoadedDefaultAgent.current = false;
      console.error('Failed to load default agent:', error);
    } finally {
      setIsLoadingDefaultAgent(false);
    }
  }, []);

  // Load agents and default agent on component mount
  useEffect(() => {
    if (hasLoadedAgents.current) {
      return;
    }

    const loadInitialAgents = async () => {
      try {
        hasLoadedAgents.current = true;
        await loadAgents();
      } catch (error) {
        hasLoadedAgents.current = false;
        console.error('Failed to load agents on mount:', error);
        showError(
          t('agents.messages.loadFailed', 'Load Failed'),
          t('agents.messages.loadFailedDesc', 'Unable to load agent list, please try again later')
        );
      }
    };

    void loadInitialAgents();
    void loadDefaultAgent();
  }, [loadAgents, loadDefaultAgent, showError, t]);

  const handleRefresh = async (silent = false) => {
    setIsRefreshing(true);
    try {
      await loadAgents();
      if (!silent) {
        showSuccess(t('agents.messages.refreshSuccess', 'Refresh Successful'), t('agents.messages.refreshSuccessDesc', 'Agent list has been updated'));
      }
    } catch {
      if (!silent) {
        showError(t('agents.messages.refreshFailed', 'Refresh Failed'), t('agents.messages.refreshFailedDesc', 'Unable to refresh agent list, please try again later'));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute pagination and filtering in the component
  const { paginatedAgents, totalPages } = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = agents.filter((a: Agent) =>
      (statusFilter === 'all' || (statusFilter === 'active' ? a.status === 'active' : a.status !== 'active')) && (
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.role?.toLowerCase().includes(query)
      )
    );
    const total = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);
    return { paginatedAgents: paginated, totalPages: total };
  }, [agents, currentPage, pageSize, searchQuery, statusFilter]);

  const statusCounts = React.useMemo(() => {
    const active = agents.filter((a: Agent) => a.status === 'active').length;
    return { all: agents.length, active, inactive: agents.length - active };
  }, [agents]);

  // Reset to the first page whenever the visible set changes shape
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, setCurrentPage]);

  const handleCreateAgent = (): void => {
    setShowCreateAgentModal(true);
  };

  const handleChatWithDefaultAgent = (): void => {
    if (!defaultAgent) {
      showError(
        t('agents.messages.noDefaultAgent', 'Default AI agent not loaded'),
        t('agents.messages.noDefaultAgentDesc', 'Please try again later')
      );
      return;
    }
    const channelId = `${defaultAgent.id}-agent`;
    navigate(`/chat/1/${channelId}`, {
      state: {
        agentName: defaultAgent.name || t('agents.defaultAgent.defaultName', 'Default AI Agent'),
        platform: 'agent'
      }
    });
  };

  // Handle retry on error
  const handleRetry = useCallback(async (): Promise<void> => {
    try {
      await loadAgents();
    } catch (error) {
      console.error('Failed to retry loading agents:', error);
      showError(
        t('agents.messages.retryFailed', 'Retry Failed'),
        t('agents.messages.retryFailedDesc', 'Unable to load agent list, please try again later')
      );
    }
  }, [loadAgents, showError, t]);

  const handleAgentAction = (actionType: string, agent: Agent): void => {
    setSelectedAgent(agent);

    switch (actionType) {
      case 'view':
      case 'edit':
        setShowEditAgent(true);
        break;
      case 'delete':
        setShowDeleteConfirm(true);
        break;
      case 'deleted':
        // Agent was successfully deleted by the card component
        // No additional action needed as the store will update automatically
        console.log('Agent deleted:', agent.name);
        break;
      case 'copy':
        handleCopyAgent(agent);
        break;
      case 'refresh':
        handleRefreshAgent(agent);
        break;
      default:
        console.log('Unknown action:', actionType);
    }
  };

  const handleCopyAgent = async (agent: Agent): Promise<void> => {
    try {
      await createAgent({
        name: `${agent.name}${t('agents.copy.suffix', ' (Copy)')}`,
        profession: agent.role || t('agents.copy.defaultProfession', 'Expert'),
        description: agent.description,
        llmModel: agent.llmModel || 'gemini-1.5-pro',
        tools: agent.tools,
        toolConfigs: {},
        knowledgeBases: agent.knowledgeBases
      });
      showSuccess(
        t('agents.messages.copySuccess', 'Copy Successful'),
        t('agents.messages.copySuccessDesc', `Agent "{{name}}" has been successfully copied`, { name: agent.name })
      );
    } catch {
      showError(
        t('agents.messages.copyFailed', 'Copy Failed'),
        t('agents.messages.copyFailedDesc', 'An error occurred while copying the agent')
      );
    }
  };

  const handleRefreshAgent = async (agent: Agent): Promise<void> => {
    try {
      await updateAgent(agent.id, {
        status: agent.status === 'active' ? 'inactive' : 'active'
      });
      showSuccess(
        t('agents.messages.statusUpdateSuccess', 'Refresh Successful'),
        t('agents.messages.statusUpdateSuccessDesc', `Agent "{{name}}" status has been updated`, { name: agent.name })
      );
    } catch (error) {
      console.error('Failed to refresh agent:', error);
      showError(
        t('agents.messages.statusUpdateFailed', 'Refresh Failed'),
        t('agents.messages.statusUpdateFailedDesc', 'An error occurred while updating agent status')
      );
    }
  };

  const handleDeleteAgent = async (): Promise<void> => {
    if (!selectedAgent) return;

    setIsDeleting(true);
    try {
      await deleteAgent(selectedAgent.id);
      showSuccess(
        t('agents.messages.deleteSuccess', 'Delete Successful'),
        t('agents.messages.deleteSuccessDesc', `Agent "{{name}}" has been deleted`, { name: selectedAgent.name })
      );
      setShowDeleteConfirm(false);
      setSelectedAgent(null);
    } catch {
      showError(
        t('agents.messages.deleteFailed', 'Delete Failed'),
        t('agents.messages.deleteFailedDesc', 'An error occurred while deleting the agent')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToolClick = (tool: AgentToolResponse): void => {
    // TODO: Create AgentToolDetailModal for AgentToolResponse objects
    console.log('Tool clicked:', tool);
    // setSelectedTool(tool);
    // setShowToolDetail(true);
  };



  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  const filterOptions: FilterOption<AgentStatusFilter>[] = [
    { value: 'all', label: t('common.all', 'All'), count: statusCounts.all },
    { value: 'active', label: t('agents.card.status.active', 'Active'), count: statusCounts.active, dot: 'bg-acid-500' },
    { value: 'inactive', label: t('agents.card.status.inactive', 'Inactive'), count: statusCounts.inactive, dot: 'bg-gray-400' },
  ];

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <PageShell
      after={
        <>
      {/* Modals */}
      <CreateAgentModal />
      <EditAgentModal agentId={selectedAgent?.id || null} isOpen={showEditAgent} onClose={() => setShowEditAgent(false)} />
      
      <ToolToastProvider>
        <AgentStoreModal 
          isOpen={showAgentStore} 
          onClose={() => setShowAgentStore(false)}
          onInstalled={() => handleRefresh(true)}
        />
      </ToolToastProvider>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('agents.modal.delete.title', 'Delete Agent')}
        message={t('agents.modal.delete.message', `Are you sure you want to delete agent "{{name}}"? This action cannot be undone.`, { name: selectedAgent?.name })}
        confirmText={t('agents.modal.delete.confirm', 'Delete')}
        cancelText={t('agents.modal.delete.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDeleteAgent}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />
        </>
      }
    >
      {/* Header */}
      <PageHeader
        title={t('agents.titleShort', 'Agents')}
        total={statusCounts.all}
        stats={[
          { key: 'total', value: statusCounts.all, label: t('agents.headerStats.total', 'total'), badge: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900', badgeText: t('agents.headerStats.team', 'team') },
          { key: 'active', value: statusCounts.active, label: t('agents.headerStats.active', 'active'), badge: 'bg-acid-300 text-ink-900' },
          { key: 'inactive', value: statusCounts.inactive, label: t('agents.headerStats.inactive', 'inactive'), badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
        ]}
        actions={
          <>
            <InkButton onClick={handleCreateAgent} icon={<Plus className="h-4 w-4" />}>
              {t('agents.actions.create', 'Create Agent')}
            </InkButton>
            <GhostButton onClick={() => setShowAgentStore(true)}>
              <Store className="h-4 w-4" />
              {t('agents.actions.store', 'Hire Agents')}
            </GhostButton>
          </>
        }
      />

      {/* Default agent */}
      <FeatureBanner
        icon={Bot}
        eyebrow={t('agents.defaultAgent.eyebrow', 'Default agent')}
        title={defaultAgent?.name || t('agents.defaultAgent.defaultName', 'Default AI Agent')}
        description={defaultAgent?.instruction || t('agents.defaultAgent.description', 'The project\'s default AI agent handles AI conversations when no target is explicitly specified.')}
        action={
          <button
            onClick={handleChatWithDefaultAgent}
            disabled={!defaultAgent || isLoadingDefaultAgent}
            className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-ink-900 pl-1.5 pr-5 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgb(15_16_18/0.7)] transition-all duration-200 hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acid-400 text-ink-900 transition-transform duration-300 group-hover:translate-x-0.5">
              <MessageCircle className="h-4 w-4" />
            </span>
            {t('agents.actions.defaultAgentChat', 'Chat with the default AI agent')}
          </button>
        }
      />

      {/* Agent list */}
      <section className="space-y-5">
        <SectionHeader title={t('agents.listTitle', 'Agent List')} count={paginatedAgents.length} countLabel={t('agents.countLabel', 'agents')}>
          <SearchField value={searchQuery} onChange={setSearchQuery} />
          <RefreshButton onClick={() => handleRefresh()} spinning={isRefreshing} disabled={isRefreshing} />
          <FilterPills options={filterOptions} value={statusFilter} onChange={setStatusFilter} />
        </SectionHeader>

        {agentsError ? (
          <ErrorPanel message={agentsError} onRetry={handleRetry} />
        ) : isLoadingAgents ? (
          <SkeletonGrid count={8} />
        ) : paginatedAgents.length === 0 ? (
          <EmptyPanel
            icon={Bot}
            title={hasActiveFilters ? t('agents.empty.noResults', 'No matching AI agents found') : t('agents.empty.title', 'No Agents')}
            description={hasActiveFilters ? t('agents.empty.noResultsDesc', 'Try different search keywords') : t('agents.empty.description', 'Click the "Create Agent" button to start creating your first agent')}
            action={!hasActiveFilters && (
              <InkButton onClick={handleCreateAgent} icon={<Plus className="h-4 w-4" />}>
                {t('agents.actions.create', 'Create Agent')}
              </InkButton>
            )}
          />
        ) : (
          <CardGrid>
            {paginatedAgents.map((agent: Agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onAction={handleAgentAction}
                onToolClick={handleToolClick}
              />
            ))}
          </CardGrid>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-4" aria-label={t('common.pagination', 'Pagination')}>
            <button
              className="tgo-icon-btn"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label={t('common.previous', 'Previous')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                data-active={page === currentPage}
                className="tgo-pill min-w-9 justify-center px-3 tabular-nums"
              >
                {page}
              </button>
            ))}
            <button
              className="tgo-icon-btn"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              aria-label={t('common.next', 'Next')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </section>
    </PageShell>
  );
};

export default AgentManagement;
