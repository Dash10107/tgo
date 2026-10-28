import React, { useCallback, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Plus, RefreshCw, Search, Radio, AlertTriangle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatformStore } from '@/stores';
import type { Platform } from '@/types';
import { getPlatformLabel, toPlatformType } from '@/utils/platformUtils';
import OnboardingSidebarPanel from '@/components/onboarding/OnboardingSidebarPanel';
import { PlatformIcon, useStatusMeta } from './PlatformKit';

/**
 * Single platform row: brand icon with status dot, name and type/status line
 */
const PlatformListItem: React.FC<{ platform: Platform }> = ({ platform }) => {
  const { t } = useTranslation();
  const getStatusMeta = useStatusMeta();
  const status = getStatusMeta(platform.status);
  const displayName = platform.display_name || platform.name;
  const typeLabel = getPlatformLabel(toPlatformType(platform.type));

  // Unsupported platform types render as a disabled row
  if (platform.is_supported === false) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-[22px] py-1.5 pl-1.5 pr-4 opacity-55" aria-disabled="true">
        <PlatformIcon type={platform.type} size="sm" className="grayscale" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{displayName}</span>
          <span className="block truncate text-[11px] text-gray-400">{t('platforms.list.status.unsupported', 'Coming Soon')}</span>
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={`/platforms/${platform.id}`}
      title={`${displayName} · ${typeLabel}`}
      className={({ isActive }) => `group flex w-full items-center gap-3 rounded-[22px] py-1.5 pl-1.5 pr-4 text-left transition-all duration-300 ${
        isActive
          ? 'bg-ink-900 text-white shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900'
          : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      }`}
    >
      {({ isActive }) => (
        <>
          <PlatformIcon
            type={platform.type}
            size="sm"
            dot={status.dot}
            dotRing={isActive ? 'ring-ink-900 dark:ring-acid-400' : 'ring-gray-50 group-hover:ring-white dark:ring-gray-900 dark:group-hover:ring-gray-800'}
          />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${isActive ? 'font-medium' : ''}`}>{displayName}</span>
            <span className={`block truncate text-[11px] ${isActive ? 'text-white/60 dark:text-ink-900/60' : 'text-gray-400 dark:text-gray-500'}`}>
              {typeLabel} · {status.label}
            </span>
          </span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-acid-400 transition-all duration-300 dark:bg-ink-900 ${isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
        </>
      )}
    </NavLink>
  );
};

interface PlatformListProps {
  onAdd: () => void;
}

/**
 * Platform list sidebar component
 */
const PlatformList: React.FC<PlatformListProps> = ({ onAdd }) => {
  const { t } = useTranslation();
  const platforms = usePlatformStore(s => s.platforms);
  const isLoading = usePlatformStore(s => s.isLoading);
  const loadError = usePlatformStore(s => s.loadError);
  const initializeStore = usePlatformStore(s => s.initializeStore);
  const [isRetrying, setIsRetrying] = useState(false);
  const [query, setQuery] = useState('');

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await initializeStore();
    } catch (error) {
      // Error is already handled in the store
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [initializeStore]);

  const liveCount = useMemo(() => platforms.filter(p => p.status === 'connected').length, [platforms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return platforms;
    return platforms.filter(p =>
      (p.display_name || p.name).toLowerCase().includes(q)
      || getPlatformLabel(toPlatformType(p.type)).toLowerCase().includes(q)
    );
  }, [platforms, query]);

  const showSkeleton = isLoading && platforms.length === 0;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200/60 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 pb-5 pt-7">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acid-400 text-ink-900">
            <Radio className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={onAdd}
            title={t('platforms.list.addPlatform', 'Add Platform')}
            aria-label={t('platforms.list.addPlatform', 'Add Platform')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-[0_10px_22px_-12px_rgb(15_16_18/0.8)] transition-transform duration-300 hover:rotate-90 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <h3 className="tgo-display text-[30px] text-gray-900 dark:text-white">
          {t('platforms.list.title', 'Platforms')}
        </h3>
        <p className="tgo-eyebrow mt-2">
          {t('platforms.list.summary', '{{total}} channels · {{live}} live', { total: platforms.length, live: liveCount })}
        </p>

        <label className="group relative mt-5 flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-ink-900 dark:group-focus-within:text-white" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', 'Search')}
            aria-label={t('common.search', 'Search')}
            className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-sm text-gray-900 shadow-[inset_0_0_0_1px_var(--color-gray-200)] outline-none transition-all duration-300 placeholder:text-gray-400 focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)]"
          />
        </label>
      </div>

      {/* Platform list */}
      <nav className="custom-scrollbar flex-grow space-y-1 overflow-y-auto px-3 pb-3">
        <NavLink
          to="/platforms"
          end
          className={({ isActive }) => `group mb-2 flex w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-sm transition-all duration-300 ${
            isActive
              ? 'bg-ink-900 font-medium text-white shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900'
              : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          {({ isActive }) => (
            <>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                isActive ? 'bg-acid-400 text-ink-900 dark:bg-ink-900 dark:text-acid-400' : 'bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700'
              }`}>
                <LayoutGrid className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{t('platforms.overview.nav', 'Overview')}</span>
            </>
          )}
        </NavLink>

        {showSkeleton && (
          <div className="space-y-2 px-1 pt-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.2 }}>
                <span className="tgo-skeleton h-9 w-9 shrink-0 rounded-full" />
                <span className="flex-1 space-y-1.5">
                  <span className="tgo-skeleton block h-3 w-3/4 rounded-full" />
                  <span className="tgo-skeleton block h-2.5 w-1/2 rounded-full" />
                </span>
              </div>
            ))}
          </div>
        )}

        {!showSkeleton && loadError && (
          <div className="mx-1 rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/5">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('platforms.list.loadFailedTitle', 'Load Failed')}</p>
            <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{loadError}</p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-ink-900 px-4 text-xs font-medium text-white transition-transform active:scale-95 disabled:opacity-60 dark:bg-acid-400 dark:text-ink-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? t('platforms.list.retrying', 'Retrying...') : t('platforms.list.retry', 'Retry')}
            </button>
          </div>
        )}

        {!showSkeleton && !loadError && visible.map(platform => (
          <PlatformListItem key={platform.id} platform={platform} />
        ))}

        {!showSkeleton && !loadError && platforms.length > 0 && visible.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-400">{t('platforms.overview.noResults', 'No channels match your search')}</p>
        )}

        {!showSkeleton && !loadError && platforms.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="mx-1 flex w-[calc(100%-0.5rem)] flex-col items-center rounded-3xl border border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-acid-500 hover:bg-white dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Inbox className="mb-2 h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('platforms.list.emptyTitle', 'No Platforms')}</span>
            <span className="mt-0.5 text-xs text-gray-400">{t('platforms.list.emptyDescription', 'Click the button above to add a platform')}</span>
          </button>
        )}
      </nav>

      {/* Onboarding Panel */}
      <div className="mt-auto">
        <OnboardingSidebarPanel />
      </div>
    </aside>
  );
};

export default PlatformList;
