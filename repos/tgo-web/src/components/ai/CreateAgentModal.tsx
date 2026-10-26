import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Save, RotateCcw, Bot, Wrench, FolderOpen, XCircle, User, Briefcase, GitBranch, Sparkles, Layout, ChevronRight, Settings, ChevronDown, ChevronUp, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAIStore } from '@/stores';
import { useKnowledgeStore } from '@/stores';
import { useProjectToolsStore } from '@/stores/projectToolsStore';
import { useDeviceControlStore } from '@/stores/deviceControlStore';

import { useToast } from '@/hooks/useToast';
import { transformAiToolResponseList } from '@/utils/projectToolsTransform';
import Toggle from '@/components/ui/Toggle';
// import { generateDefaultAvatar } from '@/utils/avatarUtils';
import SectionHeader from '@/components/ui/SectionHeader';

import ToolSelectionModal from './ToolSelectionModal';
import KnowledgeBaseSelectionModal from './KnowledgeBaseSelectionModal';
import DeviceSelectionModal from './DeviceSelectionModal';
import { WorkflowSelectionModal } from '@/components/workflow';
import type { AiTool } from '@/types';
import type { WorkflowSummary } from '@/types/workflow';
import AgentToolsSection from '@/components/ui/AgentToolsSection';
import AgentKnowledgeBasesSection from '@/components/ui/AgentKnowledgeBasesSection';
import AgentWorkflowsSection from '@/components/ui/AgentWorkflowsSection';
import AgentDeviceSection from '@/components/ui/AgentDeviceSection';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAgentForm } from '@/hooks/useAgentForm';
import AIProvidersApiService from '@/services/aiProvidersApi';
import ProjectConfigApiService from '@/services/projectConfigApi';
import { useAuthStore } from '@/stores/authStore';


/**
 * AI agent creation modal component
 */
const CreateAgentModal: React.FC = () => {
  const {
    showCreateAgentModal,
    createAgentFormData,
    createAgentErrors,
    isCreatingAgent,

    setShowCreateAgentModal,
    setCreateAgentFormData,
    resetCreateAgentForm,
    validateCreateAgentForm,
    createAgent,
    refreshAgents,
    setAgentsError
  } = useAIStore();

  const { knowledgeBases } = useKnowledgeStore();
  const { aiTools } = useProjectToolsStore();
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Refs for auto-scrolling to the first invalid field on validation failure
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const professionInputRef = useRef<HTMLInputElement | null>(null);
  const llmSelectRef = useRef<HTMLSelectElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [llmOptions, setLlmOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);


  const projectId = useAuthStore((s) => s.user?.project_id);

  // Fetch chat models from /v1/ai-models with model_type=chat
  useEffect(() => {
    if (!showCreateAgentModal) return;
    let cancelled = false;
    const fetchChatOptions = async () => {
      setLlmLoading(true);
      setLlmError(null);
      try {
        const svc = new AIProvidersApiService();
        const res = await svc.listProjectModels({ model_type: 'chat', is_active: true });
        const options = (res.data || []).map((m: any) => ({
          value: `${m.provider_id}:${m.model_id}`,
          label: `${m.model_name} · ${m.provider_name}`,
        }));
        if (!cancelled) {
          setLlmOptions(options);
        }
      } catch (e: any) {
        if (!cancelled) setLlmError(e?.message || t('agents.create.models.error', 'Failed to load models'));
      } finally {
        if (!cancelled) setLlmLoading(false);
      }
    };
    fetchChatOptions();
    return () => { cancelled = true; };
  }, [showCreateAgentModal, t]);

  // Preselect default model from project AI config if available (only when create modal is open)
  useEffect(() => {
    if (!showCreateAgentModal) return;
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      try {
        const svc = new ProjectConfigApiService();
        const conf = await svc.getAIConfig(projectId);
        if (cancelled) return;
        const uiValue = conf.default_chat_provider_id && conf.default_chat_model ? `${conf.default_chat_provider_id}:${conf.default_chat_model}` : '';
        if (uiValue && !createAgentFormData.llmModel) {
          // Only set when form has no value yet; ensure the option exists or still set for persistence
          setCreateAgentFormData({ llmModel: uiValue });
        }
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [showCreateAgentModal, projectId, createAgentFormData.llmModel, setCreateAgentFormData]);


  // Tool selection modal state
  const [showToolSelectionModal, setShowToolSelectionModal] = useState(false);

  // Knowledge base selection modal state
  const [showKnowledgeBaseSelectionModal, setShowKnowledgeBaseSelectionModal] = useState(false);

  // Workflow selection modal state
  const [showWorkflowSelectionModal, setShowWorkflowSelectionModal] = useState(false);

  // Device selection modal state
  const [showDeviceSelectionModal, setShowDeviceSelectionModal] = useState(false);

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Workflow store
  const { workflows, loadWorkflows } = useWorkflowStore();

  // Device store
  const { devices, loadDevices } = useDeviceControlStore();

  // Load devices when modal is open (for bound device display)
  useEffect(() => {
    if (showCreateAgentModal && devices.length === 0) {
      loadDevices().catch(() => {});
    }
  }, [showCreateAgentModal, devices.length, loadDevices]);

  // Load workflows when modal is open
  useEffect(() => {
    if (showCreateAgentModal && workflows.length === 0) {
      loadWorkflows().catch(() => {});
    }
  }, [showCreateAgentModal, workflows.length, loadWorkflows]);

  // Shared form logic (controlled by store formData)
  const {
    handleInputChange,
    removeTool,
    removeKnowledgeBase,
    removeDevice,
    removeWorkflow,
  } = useAgentForm({
    controlledFormData: createAgentFormData,
    onFormDataChange: setCreateAgentFormData,
  });

  // Compute bound device object for display
  const boundDevice = useMemo(() => {
    if (!createAgentFormData.boundDeviceId) return null;
    return devices.find(d => d.id === createAgentFormData.boundDeviceId) || null;
  }, [devices, createAgentFormData.boundDeviceId]);







  // List of added tools - shows all added tools (enabled and disabled)
  const addedAiTools = useMemo(() => {
    // Transform AI tools (from NEW /v1/ai/tools API) to AiTool format
    const tools = transformAiToolResponseList(aiTools);
    return tools.filter((tool: AiTool) => createAgentFormData.tools.includes(tool.id));
  }, [aiTools, createAgentFormData.tools]);

  // Knowledge base enabled state: the backend does not support enabling/disabling individually yet; selecting means linking

  // List of added knowledge bases - shows all added knowledge bases (enabled and disabled)
  const addedKnowledgeBases = useMemo(() => {
    return knowledgeBases.filter(kb => createAgentFormData.knowledgeBases.includes(kb.id));
  }, [knowledgeBases, createAgentFormData.knowledgeBases]);

  // List of added workflows
  const addedWorkflows = useMemo<WorkflowSummary[]>(() => {
    return workflows.filter(wf => createAgentFormData.workflows.includes(wf.id));
  }, [workflows, createAgentFormData.workflows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateCreateAgentForm();
    if (!isValid) {
      // Global feedback
      showToast(
        'error',
        t('agents.messages.validationFailed', 'Validation failed'),
        t('agents.messages.fillRequired', 'Please fill in all required fields')
      );

      // Scroll to the first invalid field and focus it
      const scrollAndFocus = (el: HTMLElement | null) => {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      };

      const trimmedName = createAgentFormData.name.trim();
      const trimmedProfession = createAgentFormData.profession.trim();
      const trimmedDescription = createAgentFormData.description.trim();
      const hasModel = !!createAgentFormData.llmModel;

      if (!trimmedName) {
        scrollAndFocus(nameInputRef.current);
      } else if (!trimmedProfession) {
        scrollAndFocus(professionInputRef.current);
      } else if (!hasModel) {
        scrollAndFocus(llmSelectRef.current);
      } else if (!trimmedDescription) {
        scrollAndFocus(descriptionTextareaRef.current);
      }

      return;
    }

    try {
      // Clear any previous errors
      setAgentsError(null);

      // Preflight: ensure every selected tool has name
      const byId = new Map(aiTools.map(ts => [ts.id, ts] as const));
      const missing = createAgentFormData.tools.filter(id => {
        const s = byId.get(id);
        return !s || !s.name;
      });
      if (missing.length > 0) {
        const names = missing.join(t('common.separator', '、'));
        showToast(
          'error',
          t('agents.create.tools.missingTitle', 'Tool information missing'),
          t('agents.create.tools.missingDesc', 'The following tools are missing names: {{names}}. Please reselect and try again', { names })
        );
        return;
      }

      // Validate selected model and keep UI value (providerId:modelName)
      const uiModel = createAgentFormData.llmModel;
      if (!uiModel || !uiModel.includes(':')) {
        showToast(
          'error',
          t('agents.create.models.selectPlaceholder', 'Please select a model'),
          t('agents.create.models.invalid', 'Please select a valid model (a provider is required)')
        );
        // Ensure the user sees the model field
        if (llmSelectRef.current) {
          llmSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          llmSelectRef.current.focus({ preventScroll: true });
        }
        return;
      }
      // Pass UI model value directly; transform will extract ai_provider_id and pure model name
      // Convert aiTools to ToolSummary format for compatibility with createAgent
      const toolSummaries = aiTools.map(aiTool => ({
        id: aiTool.id,
        name: aiTool.name,
        title: aiTool.name,
        description: aiTool.description || null,
        version: '1.0.0',
        category: null,
        tags: [],
        status: 'ACTIVE' as const,
        tool_source_type: 'Tool_SERVER' as const,
        execution_count: null,
        created_at: aiTool.created_at,
        tool_server_id: null,
        input_schema: {},
        output_schema: null,
        short_no: null,
        is_installed: undefined,
      }));
      await createAgent({ ...createAgentFormData, llmModel: uiModel }, toolSummaries);
      // Refresh list to ensure the just-created agent shows tools/collections immediately
      await refreshAgents();

      // Show success toast
      showToast(
        'success',
        t('agents.messages.createSuccess', 'Create Successful'),
        t('agents.messages.createSuccessDesc', 'Agent "{{name}}" has been successfully created', { name: createAgentFormData.name })
      );
    } catch (error) {
      console.error('Failed to create AI agent:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : t('agents.messages.createFailed', 'Create Failed');
      showToast('error', t('agents.messages.createFailed', 'Create Failed'), errorMessage);
    }
  };

  const handleClose = () => {
    setShowCreateAgentModal(false);
    resetCreateAgentForm();
  };

  // Handle tool removal
  const handleToolRemove = (toolId: string) => {
    removeTool(toolId);
  };

  // Handle knowledge base removal
  const handleKnowledgeBaseRemove = (kbId: string) => {
    removeKnowledgeBase(kbId);
  };

  // Handle workflow removal
  const handleWorkflowRemove = (workflowId: string) => {
    removeWorkflow(workflowId);
  };

  // Knowledge base icon colors are handled by the shared component

  if (!showCreateAgentModal) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('agents.modal.create.title', 'Create Agent')}</h2>
              <p className="text-blue-100 text-xs mt-0.5 opacity-80">{t('agents.modal.create.subtitle', 'Define a virtual digital agent with professional skills')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            disabled={isCreatingAgent}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-950">
            <div className="p-8 space-y-8">
              {/* Basic info section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight text-sm">
                    {t('agents.detail.basicInfo', 'Basic Info')}
                  </h3>
                </div>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* AI agent name */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                        {t('agents.form.name', 'Agent Name')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={createAgentFormData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none ${
                          createAgentErrors.name ? 'border-red-500 focus:border-red-500' : 'border-gray-100 dark:border-gray-700 focus:border-blue-500'
                        }`}
                        placeholder={t('agents.create.placeholders.name', 'Please enter agent name')}
                        disabled={isCreatingAgent}
                      />
                      {createAgentErrors.name && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                          <XCircle className="w-3 h-3" /> {createAgentErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Profession / role */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                        {t('agents.form.profession', 'Profession')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        ref={professionInputRef}
                        type="text"
                        value={createAgentFormData.profession}
                        onChange={(e) => handleInputChange('profession', e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all outline-none ${
                          createAgentErrors.profession ? 'border-red-500 focus:border-red-500' : 'border-gray-100 dark:border-gray-700 focus:border-blue-500'
                        }`}
                        placeholder={t('agents.create.placeholders.profession', 'e.g. Customer Support, Technical Support, Sales Consultant')}
                        disabled={isCreatingAgent}
                      />
                      {createAgentErrors.profession && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                          <XCircle className="w-3 h-3" /> {createAgentErrors.profession}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Model configuration section */}
              <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Layout className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight text-sm">
                      {t('agents.create.sections.modelConfig', 'Model Configuration')}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                        {t('agents.form.llmModel', 'LLM Model')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          ref={llmSelectRef}
                          value={createAgentFormData.llmModel}
                          onChange={(e) => handleInputChange('llmModel', e.target.value)}
                          className={`w-full appearance-none px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border rounded-2xl focus:ring-4 focus:ring-purple-500/10 transition-all outline-none ${
                            createAgentErrors.llmModel ? 'border-red-500 focus:border-red-500' : 'border-gray-100 dark:border-gray-700 focus:border-purple-500'
                          }`}
                          disabled={isCreatingAgent || llmLoading}
                        >
                          {llmLoading ? (
                            <option value="">{t('agents.create.models.loading', 'Loading models...')}</option>
                          ) : llmError ? (
                            <option value="">{t('agents.create.models.error', 'Failed to load models')}</option>
                          ) : llmOptions.length === 0 ? (
                            <option value="">{t('agents.create.models.empty', 'No models available')}</option>
                          ) : (
                            <>
                              {!createAgentFormData.llmModel && (
                                <option value="">{t('agents.create.models.selectPlaceholder', 'Please select a model')}</option>
                              )}
                              {llmOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                      {createAgentErrors.llmModel && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                          <XCircle className="w-3 h-3" /> {createAgentErrors.llmModel}
                        </p>
                      )}
                      {llmError && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                          <XCircle className="w-3 h-3" /> {t('agents.create.models.loadFailedInline', 'Model load failed: {{error}}', { error: llmError })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              {/* Capability description section */}
              <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Sparkles className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight text-sm">
                      {t('agents.create.sections.description', 'Capability Description')}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                        {t('agents.form.detailedDescription', 'Detailed Description')} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        ref={descriptionTextareaRef}
                        value={createAgentFormData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        rows={6}
                        className={`w-full px-4 py-4 bg-gray-50 dark:bg-gray-800/50 border rounded-2xl focus:ring-4 focus:ring-green-500/10 transition-all outline-none resize-none ${
                          createAgentErrors.description ? 'border-red-500 focus:border-red-500' : 'border-gray-100 dark:border-gray-700 focus:border-green-500'
                        }`}
                        placeholder={t('agents.create.placeholders.description', 'Please describe the agent’s functions, responsibilities and characteristics, e.g., handling customer inquiries, providing product information and technical support...')}
                        disabled={isCreatingAgent}
                      />
                      {createAgentErrors.description && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                          <XCircle className="w-3 h-3" /> {createAgentErrors.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              {/* Advanced Configuration Section */}
              <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="flex items-center justify-between w-full px-6 py-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 hover:border-blue-500/50 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className={`w-5 h-5 ${isAdvancedOpen ? 'text-blue-600' : 'text-gray-400'} transition-colors`} />
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight text-sm">
                        {t('agents.config.advanced', 'Advanced Configuration')}
                      </h3>
                    </div>
                    {isAdvancedOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {isAdvancedOpen && (
                    <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Markdown */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-50 dark:border-gray-700">
                          <div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('config.markdown', 'Markdown Format')}</p>
                            <p className="text-xs text-gray-500">{t('config.markdownDesc', 'Use Markdown to format output content')}</p>
                          </div>
                          <Toggle
                            checked={!!createAgentFormData.markdown}
                            onChange={(checked) => handleInputChange('markdown', checked)}
                          />
                        </div>

                        {/* Add Datetime */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-50 dark:border-gray-700">
                          <div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('config.addDatetime', 'Add Datetime')}</p>
                            <p className="text-xs text-gray-500">{t('config.addDatetimeDesc', 'Include current date and time in the context')}</p>
                          </div>
                          <Toggle
                            checked={!!createAgentFormData.add_datetime_to_context}
                            onChange={(checked) => handleInputChange('add_datetime_to_context', checked)}
                          />
                        </div>

                        {/* Skills Enabled */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-50 dark:border-gray-700">
                          <div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('config.skillsEnabled', 'Enable Skills')}</p>
                            <p className="text-xs text-gray-500">{t('config.skillsEnabledDesc', 'Allow AI agents to discover and use project skills')}</p>
                          </div>
                          <Toggle
                            checked={!!createAgentFormData.skills_enabled}
                            onChange={(checked) => handleInputChange('skills_enabled', checked)}
                          />
                        </div>

                        {/* History Runs */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                            {t('config.numHistoryRuns', 'History Session Runs')}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={createAgentFormData.num_history_runs}
                            onChange={(e) => handleInputChange('num_history_runs', parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        {/* Tool Call Limit */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase">
                            {t('config.toolCallLimit', 'Tool Call Limit')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={createAgentFormData.tool_call_limit}
                            onChange={(e) => handleInputChange('tool_call_limit', parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {/* Resource linking section */}
              <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Briefcase className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight text-sm">
                      {t('agents.create.sections.resources', 'Resource Association')}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Tools */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <SectionHeader icon={<Wrench className="w-4 h-4 text-orange-600" />} title={t('agents.create.sections.tools', 'Tools')} />
                      <AgentToolsSection
                        tools={addedAiTools}
                        toolConfigs={createAgentFormData.toolConfigs}
                        onAdd={() => setShowToolSelectionModal(true)}
                        onRemove={handleToolRemove}
                        disabled={isCreatingAgent}
                      />
                    </div>

                    {/* Knowledge bases */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <SectionHeader icon={<FolderOpen className="w-4 h-4 text-teal-600" />} title={t('agents.form.knowledge_bases', 'Knowledge Bases')} />
                      <AgentKnowledgeBasesSection
                        items={addedKnowledgeBases}
                        onAdd={() => setShowKnowledgeBaseSelectionModal(true)}
                        onRemove={handleKnowledgeBaseRemove}
                        disabled={isCreatingAgent}
                      />
                    </div>

                    {/* Workflows */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <SectionHeader icon={<GitBranch className="w-4 h-4 text-purple-600" />} title={t('workflow.title', 'Workflows')} />
                      <AgentWorkflowsSection
                        workflows={addedWorkflows}
                        onAdd={() => setShowWorkflowSelectionModal(true)}
                        onRemove={handleWorkflowRemove}
                        disabled={isCreatingAgent}
                      />
                    </div>

                    {/* Bound devices */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <SectionHeader icon={<Monitor className="w-4 h-4 text-purple-600" />} title={t('agents.deviceSection.title', 'Bound Device')} />
                      <AgentDeviceSection
                        device={boundDevice}
                        onAdd={() => setShowDeviceSelectionModal(true)}
                        onRemove={removeDevice}
                        disabled={isCreatingAgent}
                      />
                    </div>
                  </div>
                </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md flex items-center justify-end gap-3 rounded-b-[2rem]">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              disabled={isCreatingAgent}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={resetCreateAgentForm}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              disabled={isCreatingAgent}
            >
              <RotateCcw className="w-4 h-4" />
              {t('common.reset', 'Reset')}
            </button>
            <button
              type="submit"
              disabled={isCreatingAgent}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingAgent ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('common.create', 'Create')}
            </button>
          </div>
        </form>
      </div>

      {/* Tool Tool Selection Modal */}
      <ToolSelectionModal
        isOpen={showToolSelectionModal}
        onClose={() => setShowToolSelectionModal(false)}
        selectedTools={createAgentFormData.tools}
        toolConfigs={createAgentFormData.toolConfigs}
        onConfirm={(selectedToolIds, toolConfigs) => {
          setCreateAgentFormData({
            tools: selectedToolIds,
            toolConfigs: toolConfigs
          });
          setShowToolSelectionModal(false);
        }}
      />


      {/* Knowledge Base Selection Modal */}
      <KnowledgeBaseSelectionModal
        isOpen={showKnowledgeBaseSelectionModal}
        onClose={() => setShowKnowledgeBaseSelectionModal(false)}
        selectedKnowledgeBases={createAgentFormData.knowledgeBases}
        onConfirm={(selectedKnowledgeBaseIds) => {
          setCreateAgentFormData({ knowledgeBases: selectedKnowledgeBaseIds });
        }}
      />

      {/* Workflow Selection Modal */}
      <WorkflowSelectionModal
        isOpen={showWorkflowSelectionModal}
        onClose={() => setShowWorkflowSelectionModal(false)}
        selectedWorkflows={createAgentFormData.workflows}
        onConfirm={(selectedWorkflowIds) => {
          setCreateAgentFormData({ workflows: selectedWorkflowIds });
        }}
      />

      {/* Device Selection Modal */}
      <DeviceSelectionModal
        isOpen={showDeviceSelectionModal}
        onClose={() => setShowDeviceSelectionModal(false)}
        selectedDeviceId={createAgentFormData.boundDeviceId || null}
        onConfirm={(deviceId) => {
          setCreateAgentFormData({ boundDeviceId: deviceId || '' });
        }}
      />

    </div>
  );
};

export default CreateAgentModal;
