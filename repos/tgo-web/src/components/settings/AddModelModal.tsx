import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Loader2, Check, Cpu, MessageSquareText, Binary, Sparkles } from 'lucide-react';
import { useProvidersStore, type ModelProviderConfig } from '@/stores/providersStore';
import { ToastContext } from '@/components/ui/ToastContainer';
import AIProvidersApiService from '@/services/aiProvidersApi';
import storeApi from '@/services/storeApi';
import { Modal, Field, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ModelProviderConfig | null;
}

type ModelType = 'chat' | 'embedding';

/** Normalised entry for both store models and remote provider models */
interface AvailableModel {
  id: string;
  name: string;
  title?: string;
  model_type?: string | null;
  is_installed?: boolean;
}

interface StoreModelItem {
  id: string;
  name: string;
  title_zh?: string;
  model_type?: string;
}

const errorMessage = (err: unknown): string | undefined => (err instanceof Error ? err.message : undefined);

const AddModelModal: React.FC<AddModelModalProps> = ({ isOpen, onClose, provider }) => {
  const { t } = useTranslation();
  const toast = useContext(ToastContext);
  const { addModelToProvider, loadProviders } = useProvidersStore();

  const [loading, setLoading] = useState(false);
  const [remoteModels, setRemoteModels] = useState<AvailableModel[]>([]);
  const [modelId, setModelId] = useState('');
  const [modelType, setModelType] = useState<ModelType>('chat');
  const [selectedModels, setSelectedModels] = useState<Array<{ id: string; type: ModelType }>>([]);
  const [saving, setSaving] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const isStore = Boolean(provider?.isFromStore);

  const fetchAvailableModels = useCallback(async (target: ModelProviderConfig) => {
    setLoading(true);
    try {
      if (target.isFromStore && target.storeResourceId) {
        const items = (await storeApi.getModelsByProvider(target.storeResourceId)) as StoreModelItem[];
        const currentModels = target.models || [];
        setRemoteModels(items.map(m => ({
          id: m.id,
          name: m.name,
          title: m.title_zh || m.name,
          model_type: m.model_type,
          is_installed: currentModels.includes(m.name),
        })));
      } else {
        // Manual mode: ask the provider for its list using the stored credentials
        const service = new AIProvidersApiService();
        const res = await service.getRemoteModels(target.id);
        setRemoteModels((res.models || []).map(m => ({ id: m.id, name: m.name || m.id, model_type: m.model_type })));
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
      // Manual mode may fail with an empty key; only surface store failures
      if (target.isFromStore) {
        toast?.showToast('error', t('settings.providers.fetchModels.failed'), errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (isOpen && provider) {
      fetchAvailableModels(provider);
    } else {
      setRemoteModels([]);
      setModelId('');
      setModelType('chat');
      setSelectedModels([]);
    }
  }, [isOpen, provider, fetchAvailableModels]);

  const handleInstallFromStore = async (model: AvailableModel) => {
    setSaving(true);
    setInstallingId(model.id);
    try {
      await storeApi.installModel(model.id);
      toast?.showToast('success', t('tools.store.model.installSuccess'));
      await loadProviders();
      onClose();
    } catch (e) {
      toast?.showToast('error', t('common.saveFailed'), errorMessage(e));
    } finally {
      setSaving(false);
      setInstallingId(null);
    }
  };

  const handleManualAdd = async () => {
    if (!provider || (selectedModels.length === 0 && !modelId.trim())) return;

    setSaving(true);
    try {
      const modelsToSubmit = [...selectedModels];
      if (modelId.trim() && !modelsToSubmit.some(m => m.id === modelId.trim())) {
        modelsToSubmit.push({ id: modelId.trim(), type: modelType });
      }

      await addModelToProvider(provider.id, modelsToSubmit.map(m => ({ model_id: m.id, model_type: m.type })));
      toast?.showToast('success', t('settings.providers.toast.modelAdded'));
      onClose();
    } catch (e) {
      toast?.showToast('error', t('common.saveFailed'), errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleModel = (id: string, type: ModelType) => {
    setSelectedModels(prev => (prev.some(m => m.id === id) ? prev.filter(m => m.id !== id) : [...prev, { id, type }]));
  };

  if (!provider) return null;

  const typedModels = remoteModels.filter(m => !m.model_type || m.model_type === modelType);
  const suggestions = typedModels.filter(m => !modelId.trim() || m.id.toLowerCase().includes(modelId.toLowerCase()));
  const canAdd = selectedModels.length > 0 || Boolean(modelId.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      preventClose={saving}
      zIndex="z-[60]"
      icon={Cpu}
      title={`${t('settings.providers.addModelTo')} ${provider.name}`}
      subtitle={isStore ? t('settings.providers.storeModel') : t(`settings.providers.provider.${provider.kind}`)}
      footer={
        isStore ? (
          <SecondaryButton onClick={onClose}>{t('common.close', 'Close')}</SecondaryButton>
        ) : (
          <>
            <SecondaryButton onClick={onClose} disabled={saving}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton onClick={handleManualAdd} loading={saving} disabled={!canAdd} icon={<Plus className="h-4 w-4" />}>
              {selectedModels.length > 0 ? `${t('common.add')} (${selectedModels.length})` : t('common.add')}
            </PrimaryButton>
          </>
        )
      }
    >
      <Field label={t('settings.providers.fields.modelType')}>
        <div className="tgo-tabs w-full" role="radiogroup">
          {([
            { value: 'chat' as const, icon: MessageSquareText, label: t('settings.providers.modelTypes.chat') },
            { value: 'embedding' as const, icon: Binary, label: t('settings.providers.modelTypes.embedding') },
          ]).map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={modelType === option.value}
                data-active={modelType === option.value}
                onClick={() => setModelType(option.value)}
                className="tgo-tab flex-1 justify-center"
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>

      {isStore ? (
        loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">{t('common.loading')}</p>
          </div>
        ) : typedModels.length === 0 ? (
          <div className="tgo-well flex flex-col items-center py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm dark:bg-gray-800">
              <Cpu className="h-5 w-5" />
            </span>
            <p className="text-sm text-gray-500">{t('settings.providers.noStoreModels')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {typedModels.map(m => (
              <li key={m.id} className="tgo-well flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{m.title || m.name}</p>
                  <p className="truncate font-mono text-[11px] text-gray-400">{m.name}</p>
                </div>
                {m.is_installed ? (
                  <span className="tgo-chip bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300">
                    <Check className="h-3 w-3" />
                    {t('common.installed')}
                  </span>
                ) : (
                  <PrimaryButton
                    onClick={() => handleInstallFromStore(m)}
                    disabled={saving}
                    loading={installingId === m.id}
                    icon={<Plus className="h-3.5 w-3.5" />}
                    className="!h-9 !px-4 text-xs"
                  >
                    {t('common.install')}
                  </PrimaryButton>
                )}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <Field label={t('settings.providers.fields.modelId')} htmlFor="manual-model-id" required hint={t('tagInput.hint', 'Press Enter to add')}>
            {selectedModels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedModels.map(m => (
                  <span key={m.id} className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-900 pl-3 pr-1.5 text-xs font-medium text-white dark:bg-acid-400 dark:text-ink-900">
                    {m.id}
                    <button
                      type="button"
                      onClick={() => toggleModel(m.id, m.type)}
                      className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/20 dark:hover:bg-black/15"
                      aria-label={`${t('common.delete')} ${m.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              id="manual-model-id"
              className="tgo-input font-mono text-[13px]"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={t('settings.providers.placeholders.manualModelId')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && modelId.trim()) {
                  toggleModel(modelId.trim(), modelType);
                  setModelId('');
                  e.preventDefault();
                }
              }}
            />
          </Field>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : suggestions.length > 0 && (
            <div>
              <p className="tgo-eyebrow mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {t('settings.providers.suggestedModels')}
              </p>
              <div className="custom-scrollbar grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
                {suggestions.map(m => {
                  const isSelected = selectedModels.some(sm => sm.id === m.id);
                  const type: ModelType = m.model_type === 'embedding' ? 'embedding' : m.model_type === 'chat' ? 'chat' : modelType;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-active={isSelected}
                      onClick={() => toggleModel(m.id, type)}
                      className="tgo-option !py-2.5 font-mono text-[13px] text-gray-800 dark:text-gray-200"
                    >
                      <span className="min-w-0 flex-1 truncate">{m.id}</span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${isSelected ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-transparent dark:bg-gray-700'}`}>
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default AddModelModal;
