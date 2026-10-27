import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, ChevronDown, Settings2, Pencil, Plug, KeyRound, Activity } from 'lucide-react';
import Select from '@/components/ui/Select';
import { Modal, Field, FieldGroup, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import { useProvidersStore, type ModelProviderConfig, type ProviderKind } from '@/stores/providersStore';
import { ToastContext } from '@/components/ui/ToastContainer';
import AIProvidersApiService from '@/services/aiProvidersApi';

interface ProviderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProvider: ModelProviderConfig | null;
}

type Draft = Omit<ModelProviderConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const emptyDraft = (defaultLabel: string): Draft => ({
  kind: 'openai',
  name: defaultLabel,
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  models: [],
  defaultModel: '',
  enabled: true,
  params: { azure: { apiVersion: '2024-02-15-preview' } },
});

const ProviderConfigModal: React.FC<ProviderConfigModalProps> = ({ isOpen, onClose, editingProvider }) => {
  const { t } = useTranslation();
  const toast = useContext(ToastContext);
  const { addProvider, updateProvider } = useProvidersStore();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const providerOptions: Array<{ value: ProviderKind; label: string; hint?: string }> = useMemo(() => [
    { value: 'openai', label: t('settings.providers.provider.openai', 'OpenAI'), hint: 'https://api.openai.com/v1' },
    { value: 'azure', label: t('settings.providers.provider.azure', 'Azure OpenAI'), hint: 'https://{resource}.openai.azure.com' },
    { value: 'qwen', label: t('settings.providers.provider.qwen', 'Qwen (DashScope)'), hint: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { value: 'moonshot', label: t('settings.providers.provider.moonshot', 'Moonshot (Kimi)'), hint: 'https://api.moonshot.cn/v1' },
    { value: 'deepseek', label: t('settings.providers.provider.deepseek', 'DeepSeek'), hint: 'https://api.deepseek.com/v1' },
    { value: 'baichuan', label: t('settings.providers.provider.baichuan', 'Baichuan'), hint: 'https://api.baichuan-ai.com/v1' },
    { value: 'ollama', label: t('settings.providers.provider.ollama', 'Ollama'), hint: 'http://localhost:11434' },
    { value: 'custom', label: t('settings.providers.provider.custom', 'Custom'), hint: t('settings.providers.placeholders.baseUrl.custom', 'Custom Base URL') },
  ], [t]);

  useEffect(() => {
    if (isOpen) {
      if (editingProvider) {
        setDraft({ ...editingProvider });
      } else {
        const defaultKind = 'openai';
        const defaultLabel = providerOptions.find(o => o.value === defaultKind)?.label || 'OpenAI';
        setDraft(emptyDraft(defaultLabel));
      }
      setIsAdvancedOpen(false);
      setRevealKey(false);
    } else {
      setDraft(null);
    }
  }, [isOpen, editingProvider, providerOptions]);

  const providerLabel = (kind: ProviderKind) => providerOptions.find(o => o.value === kind)?.label || kind;

  const handleTest = async () => {
    if (!draft) return;
    setTesting(true);
    try {
      const service = new AIProvidersApiService();
      // If it's a new provider, we might need a temporary test or just save first
      // But for now, let's assume we can test with existing ID or by passing config
      if (draft.id) {
        const res = await service.testProvider(draft.id);
        if (res.ok ?? res.success ?? true) {
          toast?.showToast('success', t('settings.providers.test.ok', 'Connection succeeded'));
        } else {
          toast?.showToast('error', t('settings.providers.test.failed', 'Connection failed'));
        }
      } else {
        // For new providers, we'd need a backend endpoint that tests a config DTO
        // For now, let's show a message that they should save first or just skip
        toast?.showToast('info', t('settings.providers.test.saveFirst', 'Please save before testing'));
      }
    } catch (err) {
      toast?.showToast('error', t('settings.providers.test.failed', 'Connection failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.apiKey?.trim() && !draft.id) {
      toast?.showToast('warning', t('settings.providers.validate.apiKey', 'Please enter API Key'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        kind: draft.kind,
        name: draft.name?.trim() || providerLabel(draft.kind),
        apiKey: draft.apiKey.trim(),
        apiBaseUrl: draft.apiBaseUrl?.trim(),
        models: draft.models || [],
        defaultModel: draft.defaultModel || '',
        enabled: !!draft.enabled,
        params: draft.params,
      };

      if (draft.id) {
        await updateProvider(draft.id, data);
        toast?.showToast('success', t('settings.providers.toast.saved', 'Changes saved'));
      } else {
        const createdProvider = await addProvider(data);
        const modelCount = createdProvider.models?.length || 0;
        if (modelCount > 0) {
          toast?.showToast('success', t('settings.providers.toast.addedWithDefaults', { count: modelCount }));
        } else {
          toast?.showToast('success', t('settings.providers.toast.added', 'Provider added'));
        }
      }
      onClose();
    } catch (e) {
      toast?.showToast('error', t('common.saveFailed', 'Save failed'), e instanceof Error ? e.message : undefined);

    } finally {
      setSaving(false);
    }
  };

  if (!draft) return null;

  const setAzure = (key: 'deployment' | 'resource' | 'apiVersion', value: string) =>
    setDraft({ ...draft, params: { ...draft.params, azure: { ...(draft.params?.azure || {}), [key]: value } } });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      preventClose={saving}
      icon={editingProvider ? Pencil : Plug}
      title={editingProvider ? t('settings.providers.edit', 'Edit Provider') : t('settings.providers.add', 'Add Provider')}
      subtitle={t('settings.providers.modalSubtitle', 'Connect a model provider with its API key and endpoint.')}
      footer={
        <>
          <SecondaryButton onClick={handleTest} disabled={testing} className="sm:mr-auto">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {t('settings.providers.testButton')}
          </SecondaryButton>
          <SecondaryButton onClick={onClose} disabled={saving}>{t('common.cancel')}</SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={saving}>{t('common.save')}</PrimaryButton>
        </>
      }
    >
      <Field label={t('settings.providers.fields.kind', 'Provider')} required>
        <Select
          value={draft.kind}
          onChange={(val) => {
            const kind = val as ProviderKind;
            const opt = providerOptions.find(o => o.value === kind);
            setDraft({
              ...draft,
              kind,
              apiBaseUrl: opt?.hint || '',
              name: draft.name === providerLabel(draft.kind) ? providerLabel(kind) : draft.name
            });
          }}
          options={providerOptions.map(o => ({ value: o.value, label: o.label }))}
          className="[&>button]:h-11"
        />
      </Field>

      <Field label={t('settings.providers.fields.apiKey', 'API Key')} htmlFor="provider-api-key" required={!draft.id}>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="provider-api-key"
            type={revealKey ? 'text' : 'password'}
            className="tgo-input pl-11 pr-12 font-mono text-[13px]"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            autoComplete="off"
            placeholder={draft.apiKeyMasked
              ? t('settings.providers.placeholders.apiKeyMasked', { mask: draft.apiKeyMasked, defaultValue: 'Configured: {{mask}}, leave empty to keep' })
              : t('settings.providers.placeholders.apiKey', 'Paste API Key')}
          />
          <button
            type="button"
            onClick={() => setRevealKey(!revealKey)}
            aria-label={revealKey ? t('common.hide', 'Hide') : t('common.show', 'Show')}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            {revealKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <button
        type="button"
        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
        aria-expanded={isAdvancedOpen}
        className="tgo-pill"
      >
        <Settings2 className="h-4 w-4" />
        {t('common.advancedOptions', 'Advanced options')}
        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`} />
      </button>

      {isAdvancedOpen && (
        <FieldGroup className="tgo-fade-in">
          <Field label={t('settings.providers.fields.name')} htmlFor="provider-name">
            <input
              id="provider-name"
              className="tgo-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={providerLabel(draft.kind)}
            />
          </Field>

          <Field label={t('settings.providers.fields.baseUrl')} htmlFor="provider-base-url">
            <input
              id="provider-base-url"
              className="tgo-input font-mono text-[13px]"
              value={draft.apiBaseUrl || ''}
              onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          {draft.kind === 'azure' && (
            <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
              <p className="tgo-eyebrow">Azure</p>
              <Field label={t('settings.providers.fields.azure.deployment')} htmlFor="azure-deployment">
                <input id="azure-deployment" className="tgo-input" value={draft.params?.azure?.deployment || ''} onChange={(e) => setAzure('deployment', e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('settings.providers.fields.azure.resource')} htmlFor="azure-resource">
                  <input id="azure-resource" className="tgo-input" value={draft.params?.azure?.resource || ''} onChange={(e) => setAzure('resource', e.target.value)} />
                </Field>
                <Field label={t('settings.providers.fields.azure.apiVersion')} htmlFor="azure-api-version">
                  <input id="azure-api-version" className="tgo-input font-mono text-[13px]" value={draft.params?.azure?.apiVersion || ''} onChange={(e) => setAzure('apiVersion', e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </FieldGroup>
      )}
    </Modal>
  );
};

export default ProviderConfigModal;
