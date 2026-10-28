import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowUpRight, Loader2, Plug, RefreshCw, Search } from 'lucide-react';
import platformsApiService, { type PlatformTypeDefinitionResponse } from '@/services/platformsApi';
import { Modal, SecondaryButton } from '@/components/ui/ModalKit';
import { PlatformIcon } from './PlatformKit';

interface PlatformTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  /** Creates the platform; the dialog shows progress until the promise settles */
  onSelect: (type: { type: string; name: string }) => void | Promise<void>;
}

const errorMessage = (e: unknown, fallback: string): string => {
  if (e && typeof e === 'object') {
    const err = e as { getUserMessage?: () => string; message?: string };
    return err.getUserMessage?.() || err.message || fallback;
  }
  return fallback;
};

const PlatformTypeSelector: React.FC<PlatformTypeSelectorProps> = ({ open, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [types, setTypes] = useState<PlatformTypeDefinitionResponse[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingType, setPendingType] = useState<string | null>(null);

  const fetchTypes = useCallback(async (force: boolean, isCancelled: () => boolean = () => false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await platformsApiService.listPlatformTypes(force);
      if (!isCancelled()) setTypes(data);
    } catch (e) {
      if (!isCancelled()) setError(errorMessage(e, t('platforms.typeSelector.loadFailed', 'Load Failed')));
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  }, [t]);

  // Fetch when opened; reset search each time
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setQuery('');
    void fetchTypes(false, () => cancelled);
    return () => { cancelled = true; };
  }, [open, fetchTypes]);

  const supported = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (types ?? [])
      .filter(pt => pt.is_supported !== false)
      .filter(pt => !q || (pt.display_name || pt.name).toLowerCase().includes(q) || pt.type.toLowerCase().includes(q));
  }, [types, query]);

  const handleSelect = async (pt: PlatformTypeDefinitionResponse) => {
    if (pendingType) return;
    setPendingType(pt.type);
    try {
      await onSelect({ type: pt.type, name: pt.name });
    } finally {
      setPendingType(null);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('platforms.typeSelector.title', 'Select Platform Type')}
      subtitle={t('platforms.typeSelector.subtitle', 'Pick where your customers reach you. You can fine-tune credentials right after.')}
      icon={Plug}
      size="lg"
      preventClose={Boolean(pendingType)}
      footer={
        <SecondaryButton onClick={onClose} disabled={Boolean(pendingType)}>
          {t('common.cancel', 'Cancel')}
        </SecondaryButton>
      }
    >
      <label className="group relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-ink-900 dark:group-focus-within:text-white" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search', 'Search')}
          aria-label={t('common.search', 'Search')}
          className="tgo-input pl-11"
          autoFocus
        />
      </label>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={t('platforms.typeSelector.loading', 'Loading available platform types...')}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="tgo-skeleton h-[68px] rounded-[1.25rem]" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="tgo-well flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="mb-4 max-w-sm text-sm text-gray-600 dark:text-gray-300">
            {error || t('platforms.typeSelector.loadError', 'Failed to load platform types, please try again later')}
          </p>
          <button type="button" onClick={() => { void fetchTypes(true); }} className="tgo-btn-ink" data-icon-motion="nudge">
            <span className="tgo-btn-icon"><RefreshCw className="h-4 w-4" /></span>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && (
        supported.length > 0 ? (
          <div className="tgo-stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {supported.map(pt => {
              const isPending = pendingType === pt.type;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => handleSelect(pt)}
                  disabled={Boolean(pendingType) && !isPending}
                  aria-busy={isPending}
                  data-active={isPending}
                  className="tgo-option group"
                >
                  <PlatformIcon type={pt.type} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{pt.display_name || pt.name}</span>
                    <span className="block truncate font-mono text-[11px] text-gray-400">{pt.type}</span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 group-hover:rotate-45 group-hover:bg-acid-300 group-hover:text-ink-900 dark:bg-gray-700 dark:text-gray-300">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="tgo-well px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('platforms.typeSelector.emptyTypes', 'No available platform types')}
          </div>
        )
      )}
    </Modal>
  );
};

export default PlatformTypeSelector;
