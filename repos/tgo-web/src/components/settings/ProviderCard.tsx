import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Loader2, Zap, Box, Plus, X, Activity, Link2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProvidersStore, type ModelProviderConfig } from '@/stores/providersStore';
import { ToastContext } from '@/components/ui/ToastContainer';

interface ProviderCardProps {
  provider: ModelProviderConfig;
  onEdit: (provider: ModelProviderConfig) => void;
  onDelete: (id: string) => void;
  onTest: (provider: ModelProviderConfig) => void;
  onAddModel: (provider: ModelProviderConfig) => void;
  isTesting: boolean;
}

const MAX_VISIBLE_MODELS = 6;

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onEdit,
  onDelete,
  onTest,
  onAddModel,
  isTesting
}) => {
  const { t } = useTranslation();
  const toast = useContext(ToastContext);
  const { removeModelFromProvider } = useProvidersStore();
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const isStore = !!provider.isFromStore;
  const models = provider.models || [];

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    setIsDeletingModel(true);
    try {
      await removeModelFromProvider(provider.id, modelToDelete);
      toast?.showToast('success', t('settings.providers.toast.modelDeleted'));
      setModelToDelete(null);
    } catch (e) {
      toast?.showToast('error', t('common.deleteFailed'), e instanceof Error ? e.message : undefined);
    } finally {
      setIsDeletingModel(false);
    }
  };

  return (
    <div className="group relative h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
      <div className="tgo-surface relative flex h-full flex-col p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
            {isStore ? <Box className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${provider.enabled ? 'bg-acid-500' : 'bg-gray-300'}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              {isStore ? t('settings.providers.storeModel') : t(`settings.providers.provider.${provider.kind}`)}
            </p>
            <h3 className="mt-0.5 truncate text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100" title={provider.name}>
              {provider.name}
            </h3>
          </div>
          {provider.enabled && (
            <span className="tgo-chip bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300">
              <span className="h-1.5 w-1.5 rounded-full bg-acid-500" />
              {t('common.enabled')}
            </span>
          )}
        </div>

        <p className="mt-4 flex items-center gap-1.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={provider.apiBaseUrl}>
          <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{provider.apiBaseUrl || t('settings.providers.placeholders.baseUrl.default', 'Default URL')}</span>
        </p>

        {/* Models */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] text-gray-400">
            {t('settings.providers.modelsLabel', 'models')} · {models.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {models.slice(0, MAX_VISIBLE_MODELS).map(m => {
              const isDefault = provider.defaultModel === m;
              return (
                <span
                  key={m}
                  className={`group/model inline-flex h-7 max-w-full items-center gap-1 rounded-full pl-3 pr-1.5 text-xs font-medium transition-colors ${
                    isDefault
                      ? 'bg-ink-900 text-white dark:bg-acid-400 dark:text-ink-900'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                  title={isDefault ? `${m} (${t('settings.providers.badges.default')})` : m}
                >
                  <span className="truncate">{m}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setModelToDelete(m); }}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-40 transition-all hover:bg-red-500 hover:text-white hover:opacity-100 group-hover/model:opacity-80"
                    title={t('common.delete')}
                    aria-label={`${t('common.delete')} ${m}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
            {models.length > MAX_VISIBLE_MODELS && (
              <span className="inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium text-gray-400">
                +{models.length - MAX_VISIBLE_MODELS}
              </span>
            )}
            <button
              onClick={() => onAddModel(provider)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium text-gray-600 shadow-[inset_0_0_0_1px_var(--color-gray-200)] transition-colors hover:bg-acid-300 hover:text-ink-900 hover:shadow-none dark:text-gray-300 dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)] dark:hover:bg-acid-400 dark:hover:text-ink-900"
              title={t('settings.providers.addModel', 'Add Model')}
            >
              <Plus className="h-3 w-3" />
              {t('settings.providers.addModel', 'Add Model')}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-6">
          {!isStore && (
            <>
              <button onClick={() => onTest(provider)} disabled={isTesting} className="tgo-pill h-10 flex-1 justify-center disabled:opacity-60">
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                {t('settings.providers.testButton', 'Test')}
              </button>
              <button
                onClick={() => onEdit(provider)}
                aria-label={t('common.edit', 'Edit')}
                title={t('common.edit', 'Edit')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(provider.id)}
            aria-label={t('common.delete', 'Delete')}
            title={t('common.delete', 'Delete')}
            className={`tgo-icon-btn h-10 w-10 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400 ${isStore ? 'ml-auto' : ''}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!modelToDelete}
        title={t('settings.providers.deleteModelTitle', 'Remove Model')}
        message={t('settings.providers.confirmDeleteModel', { model: modelToDelete })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDeleteModel}
        onCancel={() => setModelToDelete(null)}
        isLoading={isDeletingModel}
      />
    </div>
  );
};

export default ProviderCard;
