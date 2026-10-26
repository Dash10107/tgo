import React, { useMemo, useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCpu, FiLoader } from 'react-icons/fi';
import { Sparkles, Settings, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import SectionCard from '@/components/ui/SectionCard';
import { useProvidersStore, type ModelProviderConfig } from '@/stores/providersStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { ToastContext } from '@/components/ui/ToastContainer';
import AIProvidersApiService from '@/services/aiProvidersApi';
import ProjectConfigApiService from '@/services/projectConfigApi';
import ModelStoreModal from '@/components/ai/ModelStoreModal';
import { ToolToastProvider } from '@/components/ai/ToolToastProvider';
import ProviderCard from './ProviderCard';
import ProviderConfigModal from './ProviderConfigModal';
import AddModelModal from './AddModelModal';

const ModelProvidersSettings: React.FC = () => {
  const { t } = useTranslation();
  const toast = useContext(ToastContext);
  const { providers, isLoading, loadProviders, removeProvider } = useProvidersStore();
  const projectId = useAuthStore(s => s.user?.project_id);
  const { setDefaultLlmModel, setDefaultEmbeddingModel } = useAppSettingsStore();

  const [showModelStore, setShowModelStore] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProviderConfig | null>(null);
  const [addingModelToProvider, setAddingModelToProvider] = useState<ModelProviderConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Global default models UI state
  const [chatOptions, setChatOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [embeddingOptions, setEmbeddingOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [llmSelection, setLlmSelection] = useState<string>('');
  const [embSelection, setEmbSelection] = useState<string>('');
  const [chatLoading, setChatLoading] = useState(false);
  const [embLoading, setEmbLoading] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);

  // Track initialization to avoid infinite loops
  const isInitialized = React.useRef(false);

  const ensureFetchChatOptions = async () => {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const svc = new AIProvidersApiService();
      const res = await svc.listProjectModels({ model_type: 'chat', is_active: true });
      const opts = (res.data || []).map((m: any) => ({ 
        value: `${m.provider_id}:${m.model_id}`, 
        label: `${m.model_name} · ${m.provider_name}` 
      }));
      setChatOptions(opts);
    } catch (err: any) {
      toast?.showToast('error', t('common.loadFailed', 'Load Failed'), err?.message);
    } finally {
      setChatLoading(false);
    }
  };

  const ensureFetchEmbeddingOptions = async () => {
    if (embLoading) return;
    setEmbLoading(true);
    try {
      const svc = new AIProvidersApiService();
      const res = await svc.listProjectModels({ model_type: 'embedding', is_active: true });
      const opts = (res.data || []).map((m: any) => ({ 
        value: `${m.provider_id}:${m.model_id}`, 
        label: `${m.model_name} · ${m.provider_name}` 
      }));
      setEmbeddingOptions(opts);
    } catch (err: any) {
      toast?.showToast('error', t('common.loadFailed', 'Load Failed'), err?.message);
    } finally {
      setEmbLoading(false);
    }
  };

  useEffect(() => {
    loadProviders().catch(() => {});
  }, [loadProviders]);

  // Load project-level AI defaults
  useEffect(() => {
    if (!projectId || isInitialized.current) return;
    
    const fetchConfig = async () => {
      try {
        // Fetch options first so they are available when config is set
        await Promise.all([
          ensureFetchChatOptions(),
          ensureFetchEmbeddingOptions()
        ]);

        const svc = new ProjectConfigApiService();
        const conf = await svc.getAIConfig(projectId);
        const llm = conf.default_chat_provider_id && conf.default_chat_model
          ? `${conf.default_chat_provider_id}:${conf.default_chat_model}`
          : '';
        const emb = conf.default_embedding_provider_id && conf.default_embedding_model
          ? `${conf.default_embedding_provider_id}:${conf.default_embedding_model}`
          : '';
        
        setLlmSelection(llm);
        setEmbSelection(emb);
        setDefaultLlmModel(llm || null);
        setDefaultEmbeddingModel(emb || null);
        isInitialized.current = true;
      } catch (err: any) {
        toast?.showToast('error', t('common.loadFailed'), err?.message);
      }
    };

    fetchConfig();
  }, [projectId, setDefaultLlmModel, setDefaultEmbeddingModel, toast, t]); // Kept dependencies but added Ref guard

  const onSaveDefaults = async () => {
    if (!projectId) return;
    setIsSavingDefaults(true);
    try {
    const parse = (v: string) => {
      const i = v.indexOf(':');
        if (i <= 0) return { providerId: null, model: null };
        return { providerId: v.slice(0, i), model: v.slice(i + 1) };
      };
      const chat = parse(llmSelection);
      const emb = parse(embSelection);
      const svc = new ProjectConfigApiService();
      await svc.upsertAIConfig(projectId, {
        default_chat_provider_id: chat.providerId,
        default_chat_model: chat.model,
        default_embedding_provider_id: emb.providerId,
        default_embedding_model: emb.model,
      });
      setDefaultLlmModel(llmSelection || null);
      setDefaultEmbeddingModel(embSelection || null);
      toast?.showToast('success', t('settings.models.toast.saved'));
    } catch (err: any) {
      toast?.showToast('error', t('common.saveFailed'), err?.message);
    } finally {
      setIsSavingDefaults(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(null);
    try {
      await removeProvider(id);
      toast?.showToast('success', t('settings.providers.toast.deleted'));
    } catch (e: any) {
      toast?.showToast('error', t('common.deleteFailed'), e?.message);
    }
  };

  const handleTest = async (p: ModelProviderConfig) => {
    setTestingId(p.id);
    try {
      const svc = new AIProvidersApiService();
      const res = await svc.testProvider(p.id);
      if ((res as any).ok ?? (res as any).success ?? true) {
        toast?.showToast('success', t('settings.providers.test.ok'));
      } else {
        toast?.showToast('error', t('settings.providers.test.failed'));
      }
    } catch (err: any) {
      toast?.showToast('error', t('settings.providers.test.failed'), err?.message);
    } finally {
      setTestingId(null);
    }
  };

  const sortedProviders = useMemo(() => 
    providers.slice().sort((a, b) => Number(b.enabled) - Number(a.enabled)), 
    [providers]
  );

    return (
    <ToolToastProvider>
      <div className="p-10 space-y-12 max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200 dark:shadow-none">
                <FiCpu className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {t('settings.providers.title', 'Model Providers')}
              </h2>
            </div>
            <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl leading-relaxed">
              {t('settings.providers.subtitle', 'Manage access configs for AI providers: keys, secure proxy, model lists and defaults.')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isLoading && <FiLoader className="animate-spin text-blue-600" />}
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={() => { setEditingProvider(null); setShowConfigModal(true); }}
              className="rounded-2xl font-black px-8 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 transition-all active:scale-95"
            >
              <Settings className="mr-2 w-5 h-5" />
              {t('settings.providers.addCustom', 'Custom Config')}
            </Button>
            <Button 
              variant="primary" 
              size="lg" 
              onClick={() => setShowModelStore(true)}
              className="rounded-2xl font-black px-8 py-4 shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-95"
            >
              <Sparkles className="mr-2 w-5 h-5" />
              {t('settings.providers.fromStore', 'Get from Store')}
          </Button>
        </div>
      </div>

      {/* Global Default Models Card */}
        <SectionCard className="border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/5">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
            <div className="flex-1 space-y-6 w-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Zap className="w-4 h-4" />
        </div>
          <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    {t('settings.models.defaults.title', 'Default Models')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                    {t('settings.models.defaults.description', 'Select the required global default models for LLM and Embedding.')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
              {t('settings.models.defaults.llmLabel', 'Default LLM')}
            </label>
            <Select
              value={llmSelection}
              onChange={setLlmSelection}
                    onOpen={ensureFetchChatOptions}
                    isLoading={chatLoading}
              options={[
                { value: '', label: t('settings.models.defaults.none', 'Not Set') },
                      ...chatOptions,
                    ]}
                    className="w-full"
            />
          </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                {t('settings.models.defaults.embeddingLabel', 'Default Embedding')}
              </label>
            <Select
              value={embSelection}
              onChange={setEmbSelection}
                    onOpen={ensureFetchEmbeddingOptions}
                    isLoading={embLoading}
              options={[
                { value: '', label: t('settings.models.defaults.none', 'Not Set') },
                      ...embeddingOptions,
                    ]}
                    className="w-full"
            />
          </div>
        </div>
            </div>
            <div className="w-full md:w-auto">
              <Button 
                variant="primary" 
                size="md" 
                onClick={onSaveDefaults} 
                disabled={isSavingDefaults}
                className="w-full md:w-auto rounded-xl font-black px-8 shadow-lg shadow-blue-200 dark:shadow-none"
              >
                {isSavingDefaults ? <FiLoader className="animate-spin mr-2" /> : null}
                {t('common.save', 'Save')}
              </Button>
            </div>
        </div>
        </SectionCard>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
          {sortedProviders.length === 0 && !isLoading && (
            <div className="col-span-full py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] border-4 border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 rounded-[2rem] bg-white dark:bg-gray-800 flex items-center justify-center text-gray-200 dark:text-gray-700 shadow-sm">
                <FiCpu className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">
                  {t('settings.providers.emptyTitle', 'Start Your AI Journey')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {t('settings.providers.empty', 'No providers configured yet. Click "Get from Store" or "Custom Config" to get started.')}
                </p>
            </div>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={() => setShowModelStore(true)}
                className="rounded-2xl font-black px-10 py-4 shadow-xl shadow-blue-200 dark:shadow-none"
              >
                {t('settings.providers.fromStore', 'Get from Store')}
              </Button>
          </div>
        )}

        {sortedProviders.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onEdit={(prov) => { setEditingProvider(prov); setShowConfigModal(true); }}
              onDelete={(id) => setDeletingId(id)}
              onAddModel={(prov) => { setAddingModelToProvider(prov); setShowAddModelModal(true); }}
              onTest={handleTest}
              isTesting={testingId === p.id}
            />
        ))}
      </div>

        {/* Modals */}
        <ProviderConfigModal
          isOpen={showConfigModal}
          onClose={() => { setShowConfigModal(false); setEditingProvider(null); }}
          editingProvider={editingProvider}
        />

        <AddModelModal
          isOpen={showAddModelModal}
          onClose={() => { setShowAddModelModal(false); setAddingModelToProvider(null); }}
          provider={addingModelToProvider}
        />

      <ConfirmDialog
          isOpen={!!deletingId}
        title={t('settings.providers.confirmDeleteTitle', 'Delete Provider')}
        message={t('settings.providers.confirmDeleteMsg', 'Are you sure you want to delete this provider configuration? This action cannot be undone.')}
        confirmText={t('common.delete', 'Delete')!}
        cancelText={t('common.cancel', 'Cancel')!}
        confirmVariant="danger"
          onConfirm={() => deletingId && handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />

        <ModelStoreModal 
          isOpen={showModelStore} 
          onClose={() => setShowModelStore(false)} 
      />
    </div>
    </ToolToastProvider>
  );
};

export default ModelProvidersSettings;
