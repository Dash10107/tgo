import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Agent, AiTool, CreateAgentFormData, FormValidationErrors, AgentQueryParams, ToolSummary } from '@/types';
import { AIAgentsApiService, AIAgentsTransformUtils } from '@/services/aiAgentsApi';
import { useOnboardingStore } from './onboardingStore';
import i18n from '@/i18n';

interface AIState {
  // AI agent related
  agents: Agent[];
  selectedAgent: Agent | null;
  agentSearchQuery: string;
  agentFilter: 'all' | 'active' | 'inactive' | 'error';
  agentCurrentPage: number;
  agentPageSize: number;
  
  // Tool related
  tools: AiTool[];
  selectedTool: AiTool | null;
  toolSearchQuery: string;
  toolCategory: string;
  toolCurrentPage: number;
  toolPageSize: number;
  
  // Loading state
  isLoadingAgents: boolean;
  isLoadingTools: boolean;

  // Error state
  agentsError: string | null;
  toolsError: string | null;

  // AI agent creation related
  isCreatingAgent: boolean;
  createAgentFormData: CreateAgentFormData;
  createAgentErrors: FormValidationErrors;
  showCreateAgentModal: boolean;
  
  // Actions - AI agents
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setAgentSearchQuery: (query: string) => void;
  setAgentFilter: (filter: 'all' | 'active' | 'inactive' | 'error') => void;
  setAgentCurrentPage: (page: number) => void;
  createAgent: (agentData: CreateAgentFormData, availableTools?: ToolSummary[]) => Promise<void>;
  updateAgent: (agentId: string, updates: Partial<Agent>, availableTools?: import('@/types').ToolSummary[]) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  toggleAgentStatus: (agentId: string) => void;

  // API Actions - AI agents
  loadAgents: (params?: AgentQueryParams) => Promise<void>;
  loadAgentById: (id: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  setAgentsError: (error: string | null) => void;
  setToolsError: (error: string | null) => void;

  // AI agent creation related actions
  setShowCreateAgentModal: (show: boolean) => void;
  setCreateAgentFormData: (data: Partial<CreateAgentFormData>) => void;
  setCreateAgentErrors: (errors: FormValidationErrors) => void;
  resetCreateAgentForm: () => void;
  validateCreateAgentForm: () => boolean;
  
  // Actions - Tools
  setTools: (tools: AiTool[]) => void;
  setSelectedTool: (tool: AiTool | null) => void;
  setToolSearchQuery: (query: string) => void;
  setToolCategory: (category: string) => void;
  setToolCurrentPage: (page: number) => void;
  createTool: (toolData: Partial<AiTool>) => void;
  updateTool: (toolId: string, updates: Partial<AiTool>) => void;
  deleteTool: (toolId: string) => void;
  toggleToolStatus: (toolId: string) => void;
  
  // Computed properties
  getFilteredAgents: () => Agent[];
  getFilteredTools: () => AiTool[];
  getAgentsPaginated: () => { agents: Agent[]; totalPages: number };
  getToolsPaginated: () => { tools: AiTool[]; totalPages: number };
}

export const useAIStore = create<AIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        agents: [],
        selectedAgent: null,
        agentSearchQuery: '',
        agentFilter: 'all',
        agentCurrentPage: 1,
        agentPageSize: 9,

        tools: [],
        selectedTool: null,
        toolSearchQuery: '',
        toolCategory: 'all',
        toolCurrentPage: 1,
        toolPageSize: 9,
        
        isLoadingAgents: false,
        isLoadingTools: false,

        agentsError: null,
        toolsError: null,

        // Initial state for AI agent creation
        isCreatingAgent: false,
        showCreateAgentModal: false,
        createAgentFormData: {
          name: '',
          profession: '',
          description: '',
          llmModel: '',
          tools: [],
          toolConfigs: {},
          knowledgeBases: [],
          workflows: [],
          boundDeviceId: '',
          markdown: true,
          add_datetime_to_context: true,
          skills_enabled: true,
          tool_call_limit: 10,
          num_history_runs: 5,
        },
        createAgentErrors: {},

        // AI agent actions
        setAgents: (agents) => set({ agents }, false, 'setAgents'),
        setSelectedAgent: (agent) => set({ selectedAgent: agent }, false, 'setSelectedAgent'),
        setAgentSearchQuery: (query) => set({ 
          agentSearchQuery: query, 
          agentCurrentPage: 1 
        }, false, 'setAgentSearchQuery'),
        setAgentFilter: (filter) => set({
          agentFilter: filter,
          agentCurrentPage: 1
        }, false, 'setAgentFilter'),
        setAgentCurrentPage: (page) => set({ agentCurrentPage: page }, false, 'setAgentCurrentPage'),

        createAgent: async (agentData, availableTools) => {
          set({ isCreatingAgent: true, agentsError: null }, false, 'createAgent:start');

          try {
            // Transform form data to API request format with available tools for proper tool name formatting
            const createRequest = AIAgentsTransformUtils.transformFormDataToCreateRequest(
              agentData,
              availableTools,
            );

            // Call the real API
            const apiResponse = await AIAgentsApiService.createAgent(createRequest);

            // Enrich tools with title/short_no from availableTools when missing
            let enrichedResponse: any = apiResponse as any;
            if ((apiResponse as any)?.tools && Array.isArray((apiResponse as any).tools) && availableTools && availableTools.length > 0) {
              const toolMap = new Map(availableTools.map(t => [t.id, t] as const));
              const enrichedTools = (apiResponse as any).tools.map((t: any) => {
                const summary = toolMap.get(t.id);
                if (summary) {
                  return {
                    ...t,
                    title: t.title || summary.title || summary.name,
                    name: t.name || summary.name,
                    tool_server: t.tool_server || (summary.short_no ? { short_no: summary.short_no } : undefined),
                  };
                }
                return t;
              });
              enrichedResponse = { ...(apiResponse as any), tools: enrichedTools };
            }

            // Transform API response to UI format
            const newAgent = AIAgentsTransformUtils.transformApiAgentToAgent(enrichedResponse);

            set(
              (state) => ({
                agents: [newAgent, ...state.agents],
                isCreatingAgent: false,
                showCreateAgentModal: false,
                agentsError: null
              }),
              false,
              'createAgent:success'
            );

            // Mark onboarding task as completed
            try {
              useOnboardingStore.getState().markTaskCompleted('agentCreated');
            } catch (error) {
              console.error('Failed to mark onboarding task completed:', error);
            }

            // Reset the form
            get().resetCreateAgentForm();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create agent';
            set({
              isCreatingAgent: false,
              agentsError: errorMessage
            }, false, 'createAgent:error');
            throw error;
          }
        },
        
        updateAgent: async (agentId, updates, availableTools) => {
          try {
            // Find the current agent
            const currentAgent = get().agents.find(agent => agent.id === agentId);
            if (!currentAgent) {
              throw new Error('Agent not found');
            }

            // Merge updates with current agent data
            const updatedAgent = { ...currentAgent, ...updates };

            // Transform to API request format
            const updateRequest = AIAgentsTransformUtils.transformAgentToUpdateRequest(updatedAgent, availableTools);

            // Call the real API
            const apiResponse = await AIAgentsApiService.updateAgent(agentId, updateRequest);

            // Enrich tools with title from availableTools when missing
            let enrichedResponse: any = apiResponse as any;
            if ((apiResponse as any)?.tools && Array.isArray((apiResponse as any).tools) && availableTools && availableTools.length > 0) {
              const toolMap = new Map(availableTools.map(t => [t.id, t] as const));
              const enrichedTools = (apiResponse as any).tools.map((t: any) => {
                const summary = toolMap.get(t.id);
                if (summary) {
                  return {
                    ...t,
                    title: t.title || summary.title || summary.name,
                    name: t.name || summary.name,
                    tool_server: t.tool_server || (summary.short_no ? { short_no: summary.short_no } : undefined),
                  };
                }
                return t;
              });
              enrichedResponse = { ...(apiResponse as any), tools: enrichedTools };
            }

            // Transform API response to UI format
            const newAgent = AIAgentsTransformUtils.transformApiAgentToAgent(enrichedResponse);

            // Update local state
            set(
              (state) => ({
                agents: state.agents.map(agent =>
                  agent.id === agentId ? newAgent : agent
                ),
                selectedAgent: state.selectedAgent?.id === agentId ? newAgent : state.selectedAgent
              }),
              false,
              'updateAgent:success'
            );
          } catch (error) {
            console.error('Failed to update agent:', error);
            throw error;
          }
        },
        
        deleteAgent: async (agentId) => {
          try {
            // Call the API to delete the agent
            await AIAgentsApiService.deleteAgent(agentId);

            // Update local state after successful API call
            set(
              (state) => ({
                agents: state.agents.filter(agent => agent.id !== agentId),
                selectedAgent: state.selectedAgent?.id === agentId ? null : state.selectedAgent
              }),
              false,
              'deleteAgent:success'
            );
          } catch (error) {
            console.error('Failed to delete agent:', error);
            throw error; // Re-throw to allow component to handle the error
          }
        },
        
        toggleAgentStatus: (agentId) => set(
          (state) => ({
            agents: state.agents.map(agent =>
              agent.id === agentId
                ? { ...agent, status: agent.status === 'active' ? 'inactive' : 'active' }
                : agent
            )
          }),
          false,
          'toggleAgentStatus'
        ),

        // AI agent creation actions
        setShowCreateAgentModal: (show) => set({ showCreateAgentModal: show }, false, 'setShowCreateAgentModal'),

        setCreateAgentFormData: (data) => set(
          (state) => ({
            createAgentFormData: { ...state.createAgentFormData, ...data }
          }),
          false,
          'setCreateAgentFormData'
        ),

        setCreateAgentErrors: (errors) => set({ createAgentErrors: errors }, false, 'setCreateAgentErrors'),

        resetCreateAgentForm: () => set({
          createAgentFormData: {
            name: '',
            profession: '',
            description: '',
            llmModel: '',
            tools: [],
            toolConfigs: {},
            knowledgeBases: [],
            workflows: [],
            boundDeviceId: '',
            markdown: true,
            add_datetime_to_context: true,
            skills_enabled: true,
            tool_call_limit: 10,
            num_history_runs: 5,
          },
          createAgentErrors: {}
        }, false, 'resetCreateAgentForm'),

        validateCreateAgentForm: () => {
          const { createAgentFormData } = get();
          const errors: FormValidationErrors = {};

          if (!createAgentFormData.name.trim()) {
            errors.name = i18n.t('agents.validation.nameRequired', 'Agent name is required');
          }

          if (!createAgentFormData.profession.trim()) {
            errors.profession = i18n.t('agents.validation.professionRequired', 'Profession/Role is required');
          }

          if (!createAgentFormData.description.trim()) {
            errors.description = i18n.t('agents.validation.descriptionRequired', 'Agent description is required');
          }

          if (!createAgentFormData.llmModel) {
            errors.llmModel = i18n.t('agents.validation.modelRequired', 'Please select an LLM model');
          }

          set({ createAgentErrors: errors }, false, 'validateCreateAgentForm');

          return Object.keys(errors).length === 0;
        },

        // Tool actions
        setTools: (tools) => set({ tools: tools }, false, 'setTools'),
        setSelectedTool: (tool) => set({ selectedTool: tool }, false, 'setSelectedTool'),
        setToolSearchQuery: (query) => set({ 
          toolSearchQuery: query, 
          toolCurrentPage: 1 
        }, false, 'setToolSearchQuery'),
        setToolCategory: (category) => set({ 
          toolCategory: category, 
          toolCurrentPage: 1 
        }, false, 'setToolCategory'),
        setToolCurrentPage: (page) => set({ toolCurrentPage: page }, false, 'setToolCurrentPage'),
        
        createTool: (toolData) => {
          const newTool: AiTool = {
            id: Date.now().toString(),
            name: toolData.name || i18n.t('tools.newTool', 'New Tool'),
            description: toolData.description || '',
            category: toolData.category || 'productivity',
            status: 'inactive',
            version: toolData.version || 'v1.0.0',
            endpoint: toolData.endpoint || 'localhost:3000',
            author: toolData.author || i18n.t('common.unknown', 'Unknown'),
            lastUpdated: new Date().toISOString().split('T')[0],
            usageCount: 0,
            rating: 0,
            tags: toolData.tags || []
          };
          
          set(
            (state) => ({ tools: [newTool, ...state.tools] }),
            false,
            'createTool'
          );
        },
        
        updateTool: (toolId, updates) => set(
          (state) => ({
            tools: state.tools.map(tool =>
              tool.id === toolId ? { ...tool, ...updates } : tool
            )
          }),
          false,
          'updateTool'
        ),
        
        deleteTool: (toolId) => set(
          (state) => ({
            tools: state.tools.filter(tool => tool.id !== toolId),
            selectedTool: state.selectedTool?.id === toolId ? null : state.selectedTool
          }),
          false,
          'deleteTool'
        ),
        
        toggleToolStatus: (toolId) => set(
          (state) => ({
            tools: state.tools.map(tool =>
              tool.id === toolId 
                ? { ...tool, status: tool.status === 'active' ? 'inactive' : 'active' }
                : tool
            )
          }),
          false,
          'toggleToolStatus'
        ),

        // Computed properties
        getFilteredAgents: () => {
          const { agents, agentSearchQuery, agentFilter } = get();
          let filtered = agents;
          
          // Search filtering
          if (agentSearchQuery.trim()) {
            filtered = filtered.filter(agent =>
              agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
              agent.description.toLowerCase().includes(agentSearchQuery.toLowerCase())
            );
          }
          
          // Status filtering
          if (agentFilter !== 'all') {
            filtered = filtered.filter(agent => agent.status === agentFilter);
          }
          
          return filtered;
        },
        
        getFilteredTools: () => {
          const { tools, toolSearchQuery, toolCategory } = get();
          let filtered = tools;
          
          // Search filtering
          if (toolSearchQuery.trim()) {
            filtered = filtered.filter(tool =>
              tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
              tool.description.toLowerCase().includes(toolSearchQuery.toLowerCase())
            );
          }
          
          // Category filtering
          if (toolCategory !== 'all') {
            filtered = filtered.filter(tool => tool.category === toolCategory);
          }
          
          return filtered;
        },
        
        getAgentsPaginated: () => {
          const { agentCurrentPage, agentPageSize } = get();
          const filtered = get().getFilteredAgents();
          const totalPages = Math.ceil(filtered.length / agentPageSize);
          const startIndex = (agentCurrentPage - 1) * agentPageSize;
          const agents = filtered.slice(startIndex, startIndex + agentPageSize);
          
          return { agents, totalPages };
        },
        
        getToolsPaginated: () => {
          const { toolCurrentPage, toolPageSize } = get();
          const filtered = get().getFilteredTools();
          const totalPages = Math.ceil(filtered.length / toolPageSize);
          const startIndex = (toolCurrentPage - 1) * toolPageSize;
          const tools = filtered.slice(startIndex, startIndex + toolPageSize);

          return { tools, totalPages };
        },

        // API Actions - AI agents
        loadAgents: async (params) => {
          // Prevent multiple concurrent API calls
          const currentState = get();
          if (currentState.isLoadingAgents) {
            console.log('loadAgents: Already loading, skipping duplicate call');
            return;
          }

          set({ isLoadingAgents: true, agentsError: null }, false, 'loadAgents:start');

          try {
            const response = await AIAgentsApiService.getAgents(params);
            const agents = response.data.map(AIAgentsTransformUtils.transformApiAgentToAgent);

            set({
              agents,
              isLoadingAgents: false,
              agentsError: null
            }, false, 'loadAgents:success');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : i18n.t('agents.messages.loadFailedDesc', 'Unable to load agent list, please try again later');
            set({
              isLoadingAgents: false,
              agentsError: errorMessage
            }, false, 'loadAgents:error');
            console.error('Failed to load agents:', error);
          }
        },

        loadAgentById: async (id) => {
          set({ isLoadingAgents: true, agentsError: null }, false, 'loadAgentById:start');

          try {
            const apiResponse = await AIAgentsApiService.getAgent(id);
            const agent = AIAgentsTransformUtils.transformApiAgentToAgent(apiResponse);

            set({
              selectedAgent: agent,
              isLoadingAgents: false,
              agentsError: null
            }, false, 'loadAgentById:success');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load agent';
            set({
              isLoadingAgents: false,
              agentsError: errorMessage
            }, false, 'loadAgentById:error');
            console.error(`Failed to load agent ${id}:`, error);
          }
        },

        refreshAgents: async () => {
          // Prevent multiple concurrent refresh calls
          const currentState = get();
          if (currentState.isLoadingAgents) {
            console.log('refreshAgents: Already loading, skipping duplicate call');
            return;
          }

          const { agentFilter } = get();
          const params: AgentQueryParams = {};

          // Add filters if needed
          if (agentFilter !== 'all') {
            // Map UI filter to API parameters if needed
            // Note: The API doesn't have status filters, so we'll filter client-side
          }

          await get().loadAgents(params);
        },

        setAgentsError: (error) => set({ agentsError: error }, false, 'setAgentsError'),
        setToolsError: (error) => set({ toolsError: error }, false, 'setToolsError'),
      }),
      {
        name: 'ai-store',
        partialize: (state) => ({
          // Persist user preferences
          agentSearchQuery: state.agentSearchQuery,
          agentFilter: state.agentFilter,
          toolSearchQuery: state.toolSearchQuery,
          toolCategory: state.toolCategory
        })
      }
    ),
    { name: 'ai-store' }
  )
);
