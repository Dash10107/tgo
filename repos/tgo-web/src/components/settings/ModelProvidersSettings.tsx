import React, { useMemo, useState, useContext, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Settings, Zap, Cpu, MessageSquareText, Binary, Store } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import { useProvidersStore, type ModelProviderConfig } from '@/stores/providersStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { ToastContext } from '@/components/ui/ToastContainer';
import AIProvidersApiService from '@/services/aiProvidersApi';
import ProjectConfigApiService from '@/services/projectConfigApi';
import ModelStoreModal from '@/components/ai/ModelStoreModal';
import { ToolToastProvider } from '@/components/ai/ToolToastProvider';
import { InkButton, GhostButton, SectionHeader, EmptyPanel, SkeletonGrid } from '@/components/ui/PageKit';
import { PrimaryButton } from '@/components/ui/ModalKit';
import { SettingsPage, SettingsCard } from './SettingsKit';
import ProviderCard from './ProviderCard';
import ProviderConfigModal from './ProviderConfigModal';
import AddModelModal from './AddModelModal';

type ModelOption = { value: string; label: string };

const errorMessage = (err: unknown): string | undefined => (err instanceof Error ? err.message : undefined);

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
  const [chatOptions, setChatOptions] = useState<ModelOption[]>([]);
  const [embeddingOptions, setEmbeddingOptions] = useState<ModelOption[]>([]);
  const [llmSelection, setLlmSelection] = useState<string>('');
  const [embSelection, setEmbSelection] = useState<string>('');
  const [chatLoading, setChatLoading] = useState(false);
  const [embLoading, setEmbLoading] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);

  // Track initialization to avoid refetch loops
  const isInitialized = React.useRef(false);
  const loadingRef = React.useRef({ chat: false, embedding: false });

  const fetchModelOptions = useCallback(async (modelType: 'chat' | 'embedding') => {
    const key = modelType === 'chat' ? 'chat' : 'embedding';
    if (loadingRef.current[key]) return;
    loadingRef.current[key] = true;
    const setLoading = modelType === 'chat' ? setChatLoading : setEmbLoading;
    setLoading(true);
    try {
      const svc = new AIProvidersApiService();
      const res = await svc.listProjectModels({ model_type: modelType, is_active: true });
      const opts = (res.data || []).map(m => ({
        value: `${m.provider_id}:${m.model_id}`,
        label: `${m.model_name} · ${m.provider_name}`,
      }));
      (modelType === 'chat' ? setChatOptions : setEmbeddingOptions)(opts);
    } catch (err) {
      toast?.showToast('error', t('common.loadFailed', 'Load Failed'), errorMessage(err));
    } finally {
      loadingRef.current[key] = false;
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadProviders().catch(() => {});
  }, [loadProviders]);

  // Load project-level AI defaults
  useEffect(() => {
    if (!projectId || isInitialized.current) return;

    const fetchConfig = async () => {
      try {
        // Fetch options first so they are available when config is set
        await Promise.all([fetchModelOptions('chat'), fetchModelOptions('embedding')]);

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
      } catch (err) {
        toast?.showToast('error', t('common.loadFailed'), errorMessage(err));
      }
    };

    fetchConfig();
  }, [projectId, setDefaultLlmModel, setDefaultEmbeddingModel, toast, t, fetchModelOptions]);

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
    } catch (err) {
      toast?.showToast('error', t('common.saveFailed'), errorMessage(err));
    } finally {
      setIsSavingDefaults(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(null);
    try {
      await removeProvider(id);
      toast?.showToast('success', t('settings.providers.toast.deleted'));
    } catch (err) {
      toast?.showToast('error', t('common.deleteFailed'), errorMessage(err));
    }
  };

  const handleTest = async (p: ModelProviderConfig) => {
    setTestingId(p.id);
    try {
      const svc = new AIProvidersApiService();
      const res = await svc.testProvider(p.id);
      if (res.ok ?? res.success ?? true) {
        toast?.showToast('success', t('settings.providers.test.ok'));
      } else {
        toast?.showToast('error', t('settings.providers.test.failed'), res.message);
      }
    } catch (err) {
      toast?.showToast('error', t('settings.providers.test.failed'), errorMessage(err));
    } finally {
      setTestingId(null);
    }
  };

  const sortedProviders = useMemo(
    () => providers.slice().sort((a, b) => Number(b.enabled) - Number(a.enabled)),
    [providers]
  );

  const enabledCount = providers.filter(p => p.enabled).length;
  const modelCount = providers.reduce((sum, p) => sum + (p.models?.length ?? 0), 0);

  const openCustomConfig = () => {
    setEditingProvider(null);
    setShowConfigModal(true);
  };

  return (
    <ToolToastProvider>
      <SettingsPage
        wide
        title={t('settings.providers.title', 'Model Providers')}
        subtitle={t('settings.providers.subtitle', 'Manage access configs for AI providers: keys, secure proxy, model lists and defaults.')}
        actions={
          <>
            <GhostButton onClick={openCustomConfig}>
              <Settings className="h-4 w-4" />
              {t('settings.providers.addCustom', 'Custom Config')}
            </GhostButton>
            <InkButton onClick={() => setShowModelStore(true)} icon={<Sparkles className="h-4 w-4" />}>
              {t('settings.providers.fromStore', 'Get from Store')}
            </InkButton>
          </>
        }
      >
        {/* Global default models */}
        <section className="relative z-10 rounded-[28px] bg-acid-300 p-6 text-ink-900 md:p-8 dark:bg-acid-400">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25" />
            <span className="absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-white/15" />
          </div>
          <div className="relative space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-900/60">{t('settings.models.defaults.eyebrow', 'Workspace defaults')}</p>
                <h2 className="mt-1 text-2xl font-medium tracking-tight">{t('settings.models.defaults.title', 'Default Models')}</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-900/70">
                  {t('settings.models.defaults.description', 'Select the required global default models for LLM and Embedding.')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="rounded-3xl bg-white/70 p-4 backdrop-blur-sm dark:bg-white/80">
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-900/70">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  {t('settings.models.defaults.llmLabel', 'Default LLM')}
                </label>
                <Select
                  value={llmSelection}
                  onChange={setLlmSelection}
                  onOpen={() => fetchModelOptions('chat')}
                  isLoading={chatLoading}
                  options={[{ value: '', label: t('settings.models.defaults.none', 'Not Set') }, ...chatOptions]}
                  className="w-full"
                />
              </div>
              <div className="rounded-3xl bg-white/70 p-4 backdrop-blur-sm dark:bg-white/80">
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-900/70">
                  <Binary className="h-3.5 w-3.5" />
                  {t('settings.models.defaults.embeddingLabel', 'Default Embedding')}
                </label>
                <Select
                  value={embSelection}
                  onChange={setEmbSelection}
                  onOpen={() => fetchModelOptions('embedding')}
                  isLoading={embLoading}
                  options={[{ value: '', label: t('settings.models.defaults.none', 'Not Set') }, ...embeddingOptions]}
                  className="w-full"
                />
              </div>
              <PrimaryButton onClick={onSaveDefaults} loading={isSavingDefaults} className="!bg-ink-900 !text-white md:h-[84px] md:rounded-3xl md:px-8">
                {t('common.save', 'Save')}
              </PrimaryButton>
            </div>
          </div>
        </section>

        {/* Providers */}
        <section className="space-y-5">
          <SectionHeader
            title={t('settings.providers.listTitle', 'Connected providers')}
            count={providers.length}
            countLabel={t('settings.providers.countLabel', 'providers')}
          >
            <span className="tgo-chip h-8 px-3 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-acid-500" />
              {enabledCount} {t('common.enabled', 'Enabled').toLowerCase()}
            </span>
            <span className="tgo-chip h-8 px-3 text-xs">
              <Cpu className="h-3 w-3" />
              {modelCount} {t('settings.providers.modelsLabel', 'models')}
            </span>
          </SectionHeader>

          {isLoading && providers.length === 0 ? (
            <SkeletonGrid count={3} className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3" itemClassName="h-64" />
          ) : sortedProviders.length === 0 ? (
            <EmptyPanel
              icon={Cpu}
              title={t('settings.providers.emptyTitle', 'Start Your AI Journey')}
              description={t('settings.providers.empty', 'No providers configured yet. Click "Get from Store" or "Custom Config" to get started.')}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <InkButton onClick={() => setShowModelStore(true)} icon={<Store className="h-4 w-4" />}>
                    {t('settings.providers.fromStore', 'Get from Store')}
                  </InkButton>
                  <GhostButton onClick={openCustomConfig}>
                    <Settings className="h-4 w-4" />
                    {t('settings.providers.addCustom', 'Custom Config')}
                  </GhostButton>
                </div>
              }
            />
          ) : (
            <div className="tgo-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {sortedProviders.map(p => (
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
          )}
        </section>

        <SettingsCard
          icon={Store}
          title={t('settings.providers.storeHintTitle', 'Need more models?')}
          description={t('settings.providers.storeHintDesc', 'Browse the model store for ready-made provider configurations, or connect any OpenAI-compatible endpoint with a custom config.')}
          actions={
            <GhostButton onClick={() => setShowModelStore(true)}>
              <Sparkles className="h-4 w-4" />
              {t('settings.providers.fromStore', 'Get from Store')}
            </GhostButton>
          }
        />
      </SettingsPage>

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
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      <ModelStoreModal isOpen={showModelStore} onClose={() => setShowModelStore(false)} />
    </ToolToastProvider>
  );
};

export default ModelProvidersSettings;
