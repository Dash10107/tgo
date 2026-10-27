/**
 * Node Configuration Panel
 * Right-side panel for configuring selected node properties
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Trash2,
  Play,
  Bot,
  Wrench,
  GitBranch,
  MessageSquare,
  GitMerge,
  Clock,
  PlusCircle,
  Globe,
  Settings,
  Database,
  Check,
  LayoutGrid,
  Zap,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { getNodeAccent } from '../nodes/nodeTheme';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAIStore, useKnowledgeStore } from '@/stores';
import { useProjectToolsStore } from '@/stores/projectToolsStore';
import AIProvidersApiService from '@/services/aiProvidersApi';
import { VariableInput } from '..';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from '@/types/workflow';

interface NodeConfigPanelProps {
  node: WorkflowNode;
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  input: Play,
  timer: Clock,
  webhook: Globe,
  event: Zap,
  answer: MessageSquare,
  agent: Bot,
  tool: Wrench,
  condition: GitBranch,
  llm: Sparkles,
  parallel: GitMerge,
  api: Globe,
  classifier: LayoutGrid,
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node }) => {
  const { t } = useTranslation();
  const { updateNode, deleteNode, setSelectedNode, currentWorkflow } = useWorkflowStore();
  const { agents, loadAgents } = useAIStore();
  const { aiTools, loadTools } = useProjectToolsStore();
  const { knowledgeBases, fetchKnowledgeBases } = useKnowledgeStore();

  // Model loading logic similar to EditAgentModal
  const [llmOptions, setLlmOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [t]);

  const nodes = currentWorkflow?.definition?.nodes || [];
  const edges = currentWorkflow?.definition?.edges || [];

  // Using any here because the node data type changes based on node type
  const [localData, setLocalData] = useState<any>(node.data);

  // Load necessary data
  useEffect(() => {
    if (agents.length === 0) loadAgents().catch(() => {});
    if (aiTools.length === 0) loadTools(false).catch(() => {});
    if (knowledgeBases.length === 0) fetchKnowledgeBases().catch(() => {});
  }, [
    agents.length, loadAgents, 
    aiTools.length, loadTools, 
    knowledgeBases.length, fetchKnowledgeBases,
  ]);

  // Sync local data when node changes
  useEffect(() => {
    setLocalData(node.data);
  }, [node.id, node.data]);

  // Update node data
  const handleUpdate = (updates: Record<string, any>) => {
    const newData = { ...localData, ...updates };
    setLocalData(newData);
    updateNode(node.id, updates as Partial<WorkflowNodeData>);
  };

  // Delete node
  const handleDelete = () => {
    deleteNode(node.id);
  };

  // Close panel
  const handleClose = () => {
    setSelectedNode(null);
  };

  const nodeType = node.type as string;
  const Icon = iconMap[nodeType] || Play;

  const accent = getNodeAccent(nodeType);

  return (
    <div className="tgo-surface wf-slide-in-right z-20 flex w-[23rem] shrink-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${accent.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="tgo-eyebrow">{t('workflow.panel.nodeConfig', 'Node Configuration')}</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {t(`workflow.node_types.${nodeType}.label`, nodeType)}
              </h3>
              {localData.reference_key && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold ${accent.chip}`}>
                  {localData.reference_key}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="tgo-icon-btn"
          aria-label={t('common.close', 'Close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="wf-form flex-1 space-y-8 overflow-y-auto px-5 pb-6 pt-1">
        {/* Common Fields Section */}
        <div className="space-y-4">
          <div className="space-y-2.5">
            <label className="tgo-eyebrow flex items-center gap-2">
              {t('workflow.fields.label', 'Node Name')}
            </label>
            <input
              type="text"
              value={localData.label || ''}
              onChange={(e) => handleUpdate({ label: e.target.value })}
              className="w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition-all duration-200 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
            />
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Type-specific fields Section */}
        <div className="space-y-8">
          <h4 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-900 dark:text-gray-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-acid-300 text-ink-900">
              <Settings className="h-3.5 w-3.5" />
            </span>
            {t('workflow.panel.properties', 'Properties')}
          </h4>
          
          {node.type === 'input' && (
            <InputNodeConfig data={localData as any} onUpdate={handleUpdate} />
          )}

          {node.type === 'timer' && (
            <TimerNodeConfig data={localData as any} onUpdate={handleUpdate} />
          )}

          {node.type === 'webhook' && (
            <WebhookNodeConfig data={localData as any} onUpdate={handleUpdate} />
          )}

          {node.type === 'event' && (
            <EventNodeConfig data={localData as any} onUpdate={handleUpdate} />
          )}

          {node.type === 'answer' && (
            <AnswerNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
            />
          )}

          {node.type === 'agent' && (
            <AgentNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              agents={agents} 
            />
          )}

          {node.type === 'tool' && (
            <ToolNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              availableTools={aiTools} 
            />
          )}

          {node.type === 'condition' && (
            <ConditionNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
              llmOptions={llmOptions}
              llmLoading={llmLoading}
              llmError={llmError}
            />
          )}

          {node.type === 'llm' && (
            <LLMNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
              llmOptions={llmOptions}
              llmLoading={llmLoading}
              llmError={llmError}
              availableTools={aiTools}
              availableKnowledgeBases={knowledgeBases}
            />
          )}

          {node.type === 'parallel' && (
            <ParallelNodeConfig data={localData as any} onUpdate={handleUpdate} />
          )}

          {node.type === 'api' && (
            <APINodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
            />
          )}

          {node.type === 'classifier' && (
            <ClassifierNodeConfig 
              data={localData as any} 
              onUpdate={handleUpdate} 
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
              llmOptions={llmOptions}
              llmLoading={llmLoading}
              llmError={llmError}
            />
          )}
        </div>
      </div>

      {/* Footer - Delete Button */}
      {/* Trigger nodes cannot be deleted, a label is required, but the node itself can be deleted unless it is the only entry point of the whole flow?
          Deletion is allowed uniformly here, except that one manual trigger may need to be kept.*/}
      <div className="border-t border-gray-100 p-4 dark:border-gray-800">
        <button
          onClick={handleDelete}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rose-50 text-sm font-medium text-rose-600 transition-all duration-200 hover:bg-rose-500 hover:text-white active:scale-[0.98] dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500 dark:hover:text-white"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t('workflow.actions.deleteNode', 'Delete Node')}</span>
        </button>
      </div>
    </div>
  );
};

// Input Node Config
const InputNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
}> = ({ data, onUpdate }) => {
  const { t } = useTranslation();

  const handleAddInput = () => {
    const inputs = [...(data.input_variables || [])];
    inputs.push({ name: `input_${inputs.length + 1}`, type: 'string', description: '' });
    onUpdate({ input_variables: inputs });
  };

  const handleRemoveInput = (index: number) => {
    const inputs = [...(data.input_variables || [])];
    inputs.splice(index, 1);
    onUpdate({ input_variables: inputs });
  };

  const handleUpdateInput = (index: number, updates: any) => {
    const inputs = [...(data.input_variables || [])];
    inputs[index] = { ...inputs[index], ...updates };
    onUpdate({ input_variables: inputs });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
            {t('workflow.fields.input_variables', 'Input Parameters')}
          </label>
          <button
            onClick={handleAddInput}
            className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t('common.add', 'Add')}
          </button>
        </div>

        <div className="space-y-3">
          {(data.input_variables || []).map((input: any, index: number) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 relative group">
              <button
                onClick={() => handleRemoveInput(index)}
                className="absolute right-3 top-3 p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400">{t('workflow.placeholders.input_name', 'Name')}</label>
                  <input
                    type="text"
                    value={input.name}
                    onChange={(e) => handleUpdateInput(index, { name: e.target.value })}
                    className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400">{t('workflow.placeholders.input_type', 'Type')}</label>
                  <select
                    value={input.type}
                    onChange={(e) => handleUpdateInput(index, { type: e.target.value })}
                    className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-gray-400">{t('workflow.placeholders.input_description', 'Description')}</label>
                <input
                  type="text"
                  value={input.description || ''}
                  onChange={(e) => handleUpdateInput(index, { description: e.target.value })}
                  placeholder={t('workflow.placeholders.input_placeholder', 'What is this input for?')}
                  className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}

          {(data.input_variables || []).length === 0 && (
            <div className="text-center py-6 px-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
                {t('workflow.debug.no_input_variables', 'No input variables')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Timer Node Config
const TimerNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
}> = ({ data, onUpdate }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.cron_expression', 'Cron Expression')}
        </label>
        <input
          type="text"
          value={data.cron_expression || ''}
          onChange={(e) => onUpdate({ cron_expression: e.target.value })}
          placeholder={t('workflow.placeholders.cron_hint', '0 * * * * (Hourly)')}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 font-mono"
        />
        <p className="text-[10px] text-gray-400 italic">
          {t('workflow.fields.cron_description', 'Use standard Cron format to set an automatic execution schedule.')}
        </p>
      </div>
    </div>
  );
};

// Webhook Node Config
const WebhookNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
}> = ({ data, onUpdate }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.path_suffix', 'Path Suffix')}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">/webhook/</span>
          <input
            type="text"
            value={data.path || ''}
            onChange={(e) => onUpdate({ path: e.target.value })}
            placeholder={t('workflow.placeholders.custom_path', 'custom-path')}
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 font-mono"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.method', 'Method')}
        </label>
        <select
          value={data.method || 'POST'}
          onChange={(e) => onUpdate({ method: e.target.value })}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl outline-none text-sm"
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
      </div>
    </div>
  );
};

// Event Node Config
const EventNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
}> = ({ data, onUpdate }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.event_type', 'Event Type')}
        </label>
        <input
          type="text"
          value={data.event_type || ''}
          onChange={(e) => onUpdate({ event_type: e.target.value })}
          placeholder={t('workflow.placeholders.event_hint', 'e.g. user_registered')}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 font-mono"
        />
      </div>
    </div>
  );
};

// Answer Node Config
const AnswerNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  nodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}> = ({ data, onUpdate, nodeId, nodes, edges }) => {
  const { t } = useTranslation();
  const output_types = [
    { id: 'variable', label: t('workflow.output_types.variable', 'Variable Reference'), desc: t('workflow.output_types.variable_desc', 'Reference an output variable from upstream') },
    { id: 'template', label: t('workflow.output_types.template', 'Text Template'), desc: t('workflow.output_types.template_desc', 'Combine custom text and variables') },
    { id: 'structured', label: t('workflow.output_types.structured', 'Structured Data'), desc: t('workflow.output_types.structured_desc', 'Return Key-Value object') },
  ];

  const handleAddField = () => {
    const list = [...(data.output_structure || [])];
    list.push({ key: '', value: '' });
    onUpdate({ output_structure: list });
  };

  const handleRemoveField = (index: number) => {
    const list = [...(data.output_structure || [])];
    list.splice(index, 1);
    onUpdate({ output_structure: list });
  };

  const handleUpdateField = (index: number, updates: any) => {
    const list = [...(data.output_structure || [])];
    list[index] = { ...list[index], ...updates };
    onUpdate({ output_structure: list });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.output_mode', 'Output Mode')}</label>
        <div className="grid grid-cols-1 gap-2">
          {output_types.map((type) => (
            <button
              key={type.id}
              onClick={() => onUpdate({ output_type: type.id })}
              className={`
                px-4 py-3 text-left rounded-xl border transition-all flex flex-col gap-1
                ${data.output_type === type.id
                  ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200'
                }
              `}
            >
              <div className={`text-xs font-bold ${data.output_type === type.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {type.label}
              </div>
              <div className="text-[10px] text-gray-400 font-medium">
                {type.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="h-[1px] bg-gray-50 dark:bg-gray-800" />

      {data.output_type === 'variable' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.select_variable', 'Select Variable')}</label>
          <VariableInput
            value={data.output_variable || ''}
            onChange={(val) => onUpdate({ output_variable: val })}
            nodeId={nodeId}
            nodes={nodes}
            edges={edges}
            placeholder={t('workflow.placeholders.variable_hint', 'final_response')}
            inputClassName="font-mono"
          />
        </div>
      )}

      {data.output_type === 'template' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.reply_template', 'Reply Template')}</label>
          <VariableInput
            multiline
            rows={6}
            value={data.output_template || ''}
            onChange={(val) => onUpdate({ output_template: val })}
            nodeId={nodeId}
            nodes={nodes}
            edges={edges}
            placeholder={t('workflow.placeholders.template_hint', 'Hello, the result is: {{api_1.body}}')}
            inputClassName="text-sm leading-relaxed"
          />
        </div>
      )}

      {data.output_type === 'structured' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.field_definition', 'Field Definition (JSON)')}</label>
            <button
              onClick={handleAddField}
              className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              + {t('common.add', 'Add')}
            </button>
          </div>
          <div className="space-y-2">
            {(data.output_structure || []).map((field: any, i: number) => (
              <div key={i} className="flex gap-2 items-center group">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => handleUpdateField(i, { key: e.target.value })}
                  placeholder="Key"
                  className="w-24 shrink-0 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono h-9"
                />
                <div className="flex-1 h-9">
                  <VariableInput
                    value={field.value}
                    onChange={(val) => handleUpdateField(i, { value: val })}
                    nodeId={nodeId}
                    nodes={nodes}
                    edges={edges}
                    placeholder="Value"
                    className="h-full"
                    inputClassName="!rounded-xl text-xs"
                  />
                </div>
                <button
                  onClick={() => handleRemoveField(i)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Shared LLM Model Selector component (to match Agent Form logic)
const LLMModelSelector: React.FC<{
  providerId?: string;
  modelId?: string;
  onUpdate: (updates: any) => void;
  llmOptions: Array<{ value: string; label: string }>;
  llmLoading: boolean;
  llmError: string | null;
}> = ({ providerId, modelId, onUpdate, llmOptions, llmLoading, llmError }) => {
  const { t } = useTranslation();

  // Value in node data is stored as provider_id and model_id separately
  // But we want to match the Agent Form's "providerId:modelName" UI pattern
  const currentUiValue = providerId && modelId ? `${providerId}:${modelId}` : '';

  const handleChange = (newVal: string) => {
    if (!newVal) {
      onUpdate({ provider_id: '', model_id: '', model_name: '' });
      return;
    }
    const [pId, ...mParts] = newVal.split(':');
    const mId = mParts.join(':');
    const option = llmOptions.find(o => o.value === newVal);
    const mName = option ? option.label.split(' · ')[0] : mId;
    onUpdate({ 
      provider_id: pId, 
      model_id: mId,
      model_name: mName
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
        {t('agents.form.llmModel', 'LLM Model')}
      </label>
      <div className="relative">
        <select
          value={currentUiValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 appearance-none cursor-pointer pr-10"
          disabled={llmLoading}
        >
          {llmLoading ? (
            <option value="">{t('agents.create.models.loading', 'Loading models...')}</option>
          ) : llmError ? (
            <option value="">{t('agents.create.models.error', 'Failed to load models')}</option>
          ) : llmOptions.length === 0 ? (
            <option value="">{t('agents.create.models.empty', 'No models available')}</option>
          ) : (
            <>
              {!currentUiValue && (
                <option value="">{t('agents.create.models.selectPlaceholder', 'Please select a model')}</option>
              )}
              {/* Fallback option in case current value is not in options */}
              {currentUiValue && !llmOptions.some(o => o.value === currentUiValue) && (
                <option value={currentUiValue}>
                  {modelId} · {providerId}
                </option>
              )}
              {llmOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </>
          )}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <Settings className="w-4 h-4" />
        </div>
      </div>
      {llmError && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center space-x-1">
          <XCircle className="w-3.5 h-3.5" />
          <span>{llmError}</span>
        </p>
      )}
    </div>
  );
};

// Agent Node Config
const AgentNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  agents: any[];
}> = ({ data, onUpdate, agents }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.selectAgent', 'Select AI Agent')}
        </label>
        <div className="relative">
          <select
            value={data.agent_id || ''}
            onChange={(e) => {
              const agent = agents.find(a => a.id === e.target.value);
              onUpdate({
                agent_id: e.target.value,
                agent_name: agent?.name || '',
              });
            }}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 appearance-none cursor-pointer pr-10"
          >
            <option value="">{t('workflow.placeholders.selectAgent', 'Please select an AI Agent')}</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <Bot className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Tool Node Config
const ToolNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  availableTools: any[];
}> = ({ data, onUpdate, availableTools }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.selectTool', 'Select Tool')}
        </label>
        <div className="relative">
          <select
            value={data.tool_id || ''}
            onChange={(e) => {
              const tool = availableTools.find(t => t.id === e.target.value);
              onUpdate({
                tool_id: e.target.value,
                tool_name: tool?.name || '',
              });
            }}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 appearance-none cursor-pointer pr-10"
          >
            <option value="">{t('workflow.placeholders.selectTool', 'Please select an Tool')}</option>
            {availableTools.map(tool => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <Wrench className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Condition Node Config
const ConditionNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  nodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  llmOptions: Array<{ value: string; label: string }>;
  llmLoading: boolean;
  llmError: string | null;
}> = ({ data, onUpdate, nodeId, nodes, edges, llmOptions, llmLoading, llmError }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.condition_type', 'Condition Type')}
        </label>
        <div className="grid grid-cols-1 gap-2">
          {[
            { id: 'expression', label: t('workflow.condition_types.expression', 'Expression') },
            { id: 'variable', label: t('workflow.condition_types.variable', 'Variable Comparison') },
            { id: 'llm', label: t('workflow.condition_types.llm', 'LLM Evaluation') },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => onUpdate({ condition_type: type.id })}
              className={`
                px-4 py-2 text-left text-xs font-semibold rounded-xl border transition-all
                ${data.condition_type === type.id
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200 dark:hover:border-gray-600'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {data.condition_type === 'expression' && (
        <div className="space-y-2">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
            {t('workflow.fields.expression', 'Expression')}
          </label>
          <VariableInput
            value={data.expression || ''}
            onChange={(val) => onUpdate({ expression: val })}
            nodeId={nodeId}
            nodes={nodes}
            edges={edges}
            placeholder="'{{variable}}' == 'value'"
            inputClassName="font-mono"
          />
        </div>
      )}

      {data.condition_type === 'variable' && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
              {t('workflow.fields.variable', 'Variable Name')}
            </label>
            <VariableInput
              value={data.variable || ''}
              onChange={(val) => onUpdate({ variable: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              inputClassName="font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
              {t('workflow.fields.operator', 'Operator')}
            </label>
            <div className="relative">
              <select
                value={data.operator || 'equals'}
                onChange={(e) => onUpdate({ operator: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100 appearance-none cursor-pointer pr-10"
              >
                <option value="equals">{t('workflow.operators.equals', 'Equals (==)')}</option>
                <option value="notEquals">{t('workflow.operators.notEquals', 'Not Equals (!=)')}</option>
                <option value="contains">{t('workflow.operators.contains', 'Contains')}</option>
                <option value="greaterThan">{t('workflow.operators.greaterThan', 'Greater Than (>)')}</option>
                <option value="lessThan">{t('workflow.operators.lessThan', 'Less Than (<)')}</option>
                <option value="isEmpty">{t('workflow.operators.isEmpty', 'Is Empty (null/empty)')}</option>
                <option value="isNotEmpty">{t('workflow.operators.isNotEmpty', 'Is Not Empty')}</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <GitBranch className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
              {t('workflow.fields.compare_value', 'Compare Value')}
            </label>
            <VariableInput
              value={data.compare_value || ''}
              onChange={(val) => onUpdate({ compare_value: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
            />
          </div>
        </div>
      )}

      {data.condition_type === 'llm' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
              {t('workflow.fields.llm_prompt', 'LLM Prompt')}
            </label>
            <VariableInput
              multiline
              rows={4}
              value={data.llm_prompt || ''}
              onChange={(val) => onUpdate({ llm_prompt: val })}
              nodeId={nodeId}
            nodes={nodes}
            edges={edges}
            placeholder={t('workflow.placeholders.llm_condition_hint', "Describe the semantic conditions that satisfy the 'Yes' branch...")}
          />
          </div>

          <div className="h-[1px] bg-gray-50 dark:bg-gray-800 my-2" />

          <LLMModelSelector 
            providerId={data.provider_id}
            modelId={data.model_id}
            onUpdate={onUpdate}
            llmOptions={llmOptions}
            llmLoading={llmLoading}
            llmError={llmError}
          />
        </div>
      )}
    </div>
  );
};

// LLM Node Config
const LLMNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  nodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  llmOptions: Array<{ value: string; label: string }>;
  llmLoading: boolean;
  llmError: string | null;
  availableTools: any[];
  availableKnowledgeBases: any[];
}> = ({ data, onUpdate, nodeId, nodes, edges, llmOptions, llmLoading, llmError, availableTools, availableKnowledgeBases }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'prompt' | 'model' | 'capabilities'>('prompt');

  const toggleItem = (field: 'tool_ids' | 'collection_ids', id: string) => {
    const list = [...(data[field] || [])];
    const index = list.indexOf(id);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(id);
    }
    onUpdate({ [field]: list });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        {[
          { id: 'prompt', label: t('workflow.tabs.prompt', 'Prompt'), icon: MessageSquare },
          { id: 'model', label: t('workflow.tabs.model', 'Model'), icon: Settings },
          { id: 'capabilities', label: t('workflow.tabs.capabilities', 'Capabilities'), icon: Database },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all
              ${activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-gray-100 dark:border-gray-600'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }
            `}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className={`space-y-5 ${activeTab === 'prompt' ? '' : 'hidden'}`}>
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.system_prompt', 'System Prompt')} (Optional)</label>
            <VariableInput
              multiline
              rows={3}
              value={data.system_prompt || ''}
              onChange={(val) => onUpdate({ system_prompt: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              placeholder="You are a helpful assistant..."
              inputClassName="text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.user_prompt', 'User Prompt')}</label>
            <VariableInput
              multiline
              rows={6}
              value={data.user_prompt || ''}
              onChange={(val) => onUpdate({ user_prompt: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              placeholder="Enter instructions for the LLM..."
              inputClassName="font-medium text-xs"
            />
          </div>
        </div>

        <div className={`space-y-5 ${activeTab === 'model' ? '' : 'hidden'}`}>
          <LLMModelSelector 
            providerId={data.provider_id}
            modelId={data.model_id}
            onUpdate={onUpdate}
            llmOptions={llmOptions}
            llmLoading={llmLoading}
            llmError={llmError}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.temperature', 'Temperature')}</label>
              <input
                type="number"
                value={data.temperature ?? 0.7}
                onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
                min={0}
                max={2}
                step={0.1}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.max_tokens', 'Max Tokens')}</label>
              <input
                type="number"
                value={data.max_tokens ?? 2000}
                onChange={(e) => onUpdate({ max_tokens: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl outline-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className={`space-y-6 ${activeTab === 'capabilities' ? '' : 'hidden'}`}>
          {/* Tools */}
          <div className="space-y-3">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-2">
              <Wrench className="w-3 h-3" /> {t('agents.create.sections.toolTools', 'Tools')}
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {availableTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => toggleItem('tool_ids', tool.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left
                    ${(data.tool_ids || []).includes(tool.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200'
                    }
                  `}
                >
                  <span className="text-xs font-medium truncate">{tool.name}</span>
                  {(data.tool_ids || []).includes(tool.id) && <Check className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Bases */}
          <div className="space-y-3">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-2">
              <Database className="w-3 h-3" /> {t('agents.form.knowledge_bases', 'Knowledge Bases')} (RAG)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {availableKnowledgeBases.map(kb => (
                <button
                  key={kb.id}
                  onClick={() => toggleItem('collection_ids', kb.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left
                    ${(data.collection_ids || []).includes(kb.id)
                      ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200'
                    }
                  `}
                >
                  <span className="text-xs font-medium truncate">{kb.title || kb.name || 'Untitled'}</span>
                  {(data.collection_ids || []).includes(kb.id) && <Check className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Parallel Node Config
const ParallelNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
}> = ({ data, onUpdate }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.branches', 'Parallel Branches')}
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            value={data.branches ?? 2}
            onChange={(e) => onUpdate({ branches: parseInt(e.target.value) })}
            min={2}
            max={10}
            className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-sm font-bold text-indigo-500 w-6">{data.branches ?? 2}</span>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <label htmlFor="wait_for_all" className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {t('workflow.fields.wait_for_all', 'Wait for All Branches')}
        </label>
        <input
          type="checkbox"
          id="wait_for_all"
          checked={data.wait_for_all ?? true}
          onChange={(e) => onUpdate({ wait_for_all: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500/20 transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
          {t('workflow.fields.timeout', 'Timeout (seconds)')}
        </label>
        <input
          type="number"
          value={data.timeout || ''}
          onChange={(e) => onUpdate({ timeout: e.target.value ? parseInt(e.target.value) : undefined })}
          min={1}
          placeholder={t('workflow.config.unlimited', '∞ Unlimited')}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm dark:text-gray-100"
        />
      </div>
    </div>
  );
};

// Classifier Node Config
const ClassifierNodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  nodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  llmOptions: Array<{ value: string; label: string }>;
  llmLoading: boolean;
  llmError: string | null;
}> = ({ data, onUpdate, nodeId, nodes, edges, llmOptions, llmLoading, llmError }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'config' | 'model'>('config');

  const handleAddCategory = () => {
    const categories = [...(data.categories || [])];
    const id = `cat_${Date.now()}`;
    categories.push({ 
      id, 
      name: t('workflow.placeholders.classifier_category_name', `Category {{index}}`, { index: categories.length + 1 }), 
      description: '' 
    });
    onUpdate({ categories });
  };

  const handleRemoveCategory = (index: number) => {
    const categories = [...(data.categories || [])];
    categories.splice(index, 1);
    onUpdate({ categories });
  };

  const handleUpdateCategory = (index: number, updates: any) => {
    const categories = [...(data.categories || [])];
    categories[index] = { ...categories[index], ...updates };
    onUpdate({ categories });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        {[
          { id: 'config', label: t('workflow.tabs.config', 'Config'), icon: LayoutGrid },
          { id: 'model', label: t('workflow.tabs.inference_model', 'Inference Model'), icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all
              ${activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-gray-100 dark:border-gray-600'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }
            `}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className={`space-y-6 ${activeTab === 'config' ? '' : 'hidden'}`}>
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.text_to_classify', 'Text to Classify')}</label>
            <VariableInput
              value={data.input_variable || ''}
              onChange={(val) => onUpdate({ input_variable: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              placeholder={t('workflow.placeholders.classifier_hint', 'Select upstream variable, e.g. {{input_1.query}}')}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.category_definition', 'Category Definition')}</label>
              <button
                onClick={handleAddCategory}
                className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <PlusCircle className="w-3 h-3" /> {t('common.add', 'Add')}
              </button>
            </div>

            <div className="space-y-3">
              {(data.categories || []).map((cat: any, i: number) => (
                <div key={cat.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 relative group">
                  <button
                    onClick={() => handleRemoveCategory(i)}
                    className="absolute right-3 top-3 p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-gray-400">{t('workflow.fields.name', 'Name')}</label>
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => handleUpdateCategory(i, { name: e.target.value })}
                      className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`space-y-5 ${activeTab === 'model' ? '' : 'hidden'}`}>
          <LLMModelSelector 
            providerId={data.provider_id}
            modelId={data.model_id}
            onUpdate={onUpdate}
            llmOptions={llmOptions}
            llmLoading={llmLoading}
            llmError={llmError}
          />
        </div>
      </div>
    </div>
  );
};

// API Node Config
const APINodeConfig: React.FC<{
  data: any;
  onUpdate: (updates: any) => void;
  nodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}> = ({ data, onUpdate, nodeId, nodes, edges }) => {
  const { t } = useTranslation();
  const handleAddField = (field: 'headers' | 'params' | 'form_data' | 'form_url_encoded') => {
    const list = [...(data[field] || [])];
    if (field === 'form_data') {
      list.push({ key: '', value: '', type: 'text' });
    } else {
      list.push({ key: '', value: '' });
    }
    onUpdate({ [field]: list });
  };

  const handleRemoveField = (field: 'headers' | 'params' | 'form_data' | 'form_url_encoded', index: number) => {
    const list = [...(data[field] || [])];
    list.splice(index, 1);
    onUpdate({ [field]: list });
  };

  const handleUpdateField = (field: 'headers' | 'params' | 'form_data' | 'form_url_encoded', index: number, updates: any) => {
    const list = [...(data[field] || [])];
    list[index] = { ...list[index], ...updates };
    onUpdate({ [field]: list });
  };

  const body_types = [
    { id: 'none', label: 'none' },
    { id: 'json', label: 'JSON' },
    { id: 'form-data', label: 'form-data' },
    { id: 'x-www-form-urlencoded', label: 'x-www-form' },
    { id: 'raw', label: 'raw' },
  ];

  return (
    <div className="space-y-6">
      {/* Method & URL */}
      <div className="space-y-3">
        <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.request_settings', 'Request Settings')}</label>
        <div className="flex gap-2">
          <select
            value={data.method || 'GET'}
            onChange={(e) => onUpdate({ method: e.target.value })}
            className="w-24 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
          >
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="flex-1">
            <VariableInput
              value={data.url || ''}
              onChange={(val) => onUpdate({ url: val })}
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              placeholder={t('workflow.placeholders.api_hint', 'https://api.example.com')}
              inputClassName="font-mono"
            />
          </div>
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.headers', 'Headers')}</label>
          <button
            onClick={() => handleAddField('headers')}
            className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            + {t('common.add', 'Add')}
          </button>
        </div>
        <div className="space-y-2">
          {(data.headers || []).map((h: any, i: number) => (
            <div key={i} className="flex gap-2 items-center group">
              <input
                type="text"
                value={h.key}
                onChange={(e) => handleUpdateField('headers', i, { key: e.target.value })}
                placeholder="Name"
                className="w-24 shrink-0 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono h-9"
              />
              <div className="flex-1 h-9">
                <VariableInput
                  value={h.value}
                  onChange={(val) => handleUpdateField('headers', i, { value: val })}
                  nodeId={nodeId}
                  nodes={nodes}
                  edges={edges}
                  placeholder="Value"
                  className="h-full"
                  inputClassName="!rounded-xl text-xs"
                />
              </div>
              <button
                onClick={() => handleRemoveField('headers', i)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Params */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.query_params', 'Query Params')}</label>
          <button
            onClick={() => handleAddField('params')}
            className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            + {t('common.add', 'Add')}
          </button>
        </div>
        <div className="space-y-2">
          {(data.params || []).map((p: any, i: number) => (
            <div key={i} className="flex gap-2 items-center group">
              <input
                type="text"
                value={p.key}
                onChange={(e) => handleUpdateField('params', i, { key: e.target.value })}
                placeholder="Key"
                className="w-24 shrink-0 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono h-9"
              />
              <div className="flex-1 h-9">
                <VariableInput
                  value={p.value}
                  onChange={(val) => handleUpdateField('params', i, { value: val })}
                  nodeId={nodeId}
                  nodes={nodes}
                  edges={edges}
                  placeholder="Value"
                  className="h-full"
                  inputClassName="!rounded-xl text-xs"
                />
              </div>
              <button
                onClick={() => handleRemoveField('params', i)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Body Section */}
      {['POST', 'PUT', 'PATCH', 'DELETE'].includes(data.method) && (
        <div className="space-y-4">
          <div className="h-[1px] bg-gray-50 dark:bg-gray-800" />
          <div className="space-y-3">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">{t('workflow.fields.body', 'Body')}</label>
            <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              {body_types.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => onUpdate({ body_type: bt.id })}
                  className={`
                    px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all
                    ${data.body_type === bt.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-gray-100 dark:border-gray-600'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }
                  `}
                >
                  {bt.label}
                </button>
              ))}
            </div>

            {/* JSON Editor */}
            {data.body_type === 'json' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <VariableInput
                  multiline
                  rows={6}
                  value={data.body || ''}
                  onChange={(val) => onUpdate({ body: val })}
                  nodeId={nodeId}
                  nodes={nodes}
                  edges={edges}
                  placeholder='{ "key": "{{variable}}" }'
                  inputClassName="font-mono text-[11px]"
                />
              </div>
            )}

            {/* Form Data */}
            {data.body_type === 'form-data' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAddField('form_data')}
                    className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600"
                  >
                    + {t('common.add', 'Add')}
                  </button>
                </div>
                <div className="space-y-2">
                  {(data.form_data || []).map((fd: any, i: number) => (
                    <div key={i} className="flex gap-2 items-center group">
                      <input
                        type="text"
                        value={fd.key}
                        onChange={(e) => handleUpdateField('form_data', i, { key: e.target.value })}
                        placeholder="Key"
                        className="w-24 shrink-0 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none h-9 font-mono"
                      />
                      <div className="flex-1 h-9">
                        <VariableInput
                          value={fd.value}
                          onChange={(val) => handleUpdateField('form_data', i, { value: val })}
                          nodeId={nodeId}
                          nodes={nodes}
                          edges={edges}
                          placeholder="Value"
                          className="h-full"
                          inputClassName="!rounded-xl text-xs"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveField('form_data', i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* x-www-form-urlencoded */}
            {data.body_type === 'x-www-form-urlencoded' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAddField('form_url_encoded')}
                    className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600"
                  >
                    + {t('common.add', 'Add')}
                  </button>
                </div>
                <div className="space-y-2">
                  {(data.form_url_encoded || []).map((fe: any, i: number) => (
                    <div key={i} className="flex gap-2 items-center group">
                      <input
                        type="text"
                        value={fe.key}
                        onChange={(e) => handleUpdateField('form_url_encoded', i, { key: e.target.value })}
                        placeholder="Key"
                        className="w-24 shrink-0 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none h-9 font-mono"
                      />
                      <div className="flex-1 h-9">
                        <VariableInput
                          value={fe.value}
                          onChange={(val) => handleUpdateField('form_url_encoded', i, { value: val })}
                          nodeId={nodeId}
                          nodes={nodes}
                          edges={edges}
                          placeholder="Value"
                          className="h-full"
                          inputClassName="!rounded-xl text-xs"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveField('form_url_encoded', i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Editor */}
            {data.body_type === 'raw' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex gap-2">
                  {['text', 'html', 'xml', 'javascript'].map((rt) => (
                    <button
                      key={rt}
                      onClick={() => onUpdate({ raw_type: rt })}
                      className={`
                        px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border transition-all
                        ${data.raw_type === rt || (!data.raw_type && rt === 'text')
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-white border-gray-100 text-gray-400'
                        }
                      `}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
                <VariableInput
                  multiline
                  rows={6}
                  value={data.body || ''}
                  onChange={(val) => onUpdate({ body: val })}
                  nodeId={nodeId}
                  nodes={nodes}
                  edges={edges}
                  placeholder={t('workflow.placeholders.raw_hint', 'Enter raw content...')}
                  inputClassName="font-mono text-[11px]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Output Info */}
      <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/30 space-y-2 mt-4">
        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{t('workflow.api.default_output', 'Default Output:')}</div>
        <div className="grid grid-cols-1 gap-1">
          {['body', 'status_code', 'headers'].map(field => (
            <div key={field} className="flex justify-between items-center group">
              <code className="text-[10px] text-blue-500 font-bold">.{field}</code>
              <span className="text-[9px] text-gray-400 italic">{t('workflow.api.available_variables', 'Available Variables')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodeConfigPanel;
