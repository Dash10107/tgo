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
import { AgentsGridSkeleton, AgentsErrorState, AgentsEmptyState } from '@/components/ui/AgentsSkeleton';
import { useAIStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { LuPlus, LuChevronLeft, LuChevronRight, LuSearch, LuRefreshCw, LuStore } from 'react-icons/lu';
import { Bot } from 'lucide-react';
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
    const filtered = agents.filter((a: Agent) => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const total = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);
    return { paginatedAgents: paginated, totalPages: total };
  }, [agents, currentPage, pageSize, searchQuery]);

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

  return (
    <main className="flex-grow flex flex-col bg-[#f8fafc] dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-600" />
            {t('agents.title', 'Agent Team Management')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('agents.subtitle', 'Manage your AI agents')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden sm:block">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder={t('common.search', 'Search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-64 bg-gray-100/50 dark:bg-gray-800/50 border-transparent focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl text-sm transition-all outline-none"
            />
          </div>
          
          <div className="h-8 w-px bg-gray-200 dark:border-gray-800 mx-1 hidden sm:block"></div>
          
          <div className="flex items-center gap-2">
            <button
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
              onClick={() => handleRefresh()}
              disabled={isRefreshing}
              title={t('common.refresh', 'Refresh')}
            >
              <LuRefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-bold rounded-xl transition-all active:scale-95 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50 dark:text-indigo-400"
              onClick={() => setShowAgentStore(true)}
            >
              <LuStore className="w-4 h-4" />
              <span className="hidden sm:inline">{t('agents.actions.store', 'Hire Agents')}</span>
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              onClick={handleCreateAgent}
            >
              <LuPlus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('agents.actions.create', 'Create Agent')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">
          
          {/* Quick Actions / Default Agent */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Bot className="w-6 h-6" />
                {defaultAgent?.name || t('agents.defaultAgent.defaultName', 'Default AI Agent')}
              </h3>
              <p className="text-blue-100 text-sm mt-1 opacity-90 max-w-xl">
                {defaultAgent?.instruction || t('agents.defaultAgent.description', 'The project\'s default AI agent handles AI conversations when no target is explicitly specified.')}
              </p>
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <button
                onClick={handleChatWithDefaultAgent}
                disabled={!defaultAgent || isLoadingDefaultAgent}
                className="px-5 py-2.5 bg-white text-blue-600 hover:bg-blue-50 text-sm font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('agents.actions.defaultAgentChat', 'Chat with the default AI agent')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('agents.listTitle', 'Agent List')}</h3>
            </div>

            {agentsError ? (
              <AgentsErrorState error={agentsError} onRetry={handleRetry} />
            ) : isLoadingAgents ? (
              <AgentsGridSkeleton count={9} />
            ) : paginatedAgents.length === 0 ? (
              <AgentsEmptyState
                title={searchQuery ? t('agents.empty.noResults', 'No matching AI agents found') : t('agents.empty.title', 'No Agents')}
                description={searchQuery ? t('agents.empty.noResultsDesc', 'Try different search keywords') : t('agents.empty.description', 'Click the "Create Agent" button to start creating your first agent')}
                actionButton={!searchQuery && (
                  <button
                    onClick={handleCreateAgent}
                    className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                  >
                    <LuPlus className="w-4 h-4 mr-2" />
                    {t('agents.actions.create', 'Create Agent')}
                  </button>
                )}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {paginatedAgents.map((agent: Agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onAction={handleAgentAction}
                    onToolClick={handleToolClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-4 pb-12">
              <nav className="flex items-center gap-1 p-1.5 bg-white dark:bg-gray-900 border border-gray-200/50 dark:border-gray-800 rounded-2xl shadow-sm">
                <button
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <LuChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`min-w-[36px] h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                        page === currentPage
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-105'
                          : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <LuChevronRight className="w-5 h-5" />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>

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
    </main>
  );
};

export default AgentManagement;
