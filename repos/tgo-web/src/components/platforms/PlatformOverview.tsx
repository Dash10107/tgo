/**
 * Platforms index: headline stats, a filterable grid of connected channels
 * and an add-channel tile, in the workflow page's card language.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Hand, Plus, PowerOff, Radio, Settings2, Zap, type LucideIcon } from 'lucide-react';
import { usePlatformStore } from '@/stores/platformStore';
import type { Platform, PlatformAIMode } from '@/types';
import { getPlatformLabel, toPlatformType } from '@/utils/platformUtils';
import {
  EmptyPanel,
  ErrorPanel,
  FeatureBanner,
  FilterPills,
  InkButton,
  NotchCard,
  PageHeader,
  PageShell,
  RefreshButton,
  SearchField,
  SectionHeader,
  SkeletonGrid,
  type FilterOption,
} from '@/components/ui/PageKit';
import { PlatformIcon, useStatusMeta } from './PlatformKit';

export interface PlatformOutletContext {
  openAddPlatform: () => void;
}

type StatusFilter = 'all' | 'live' | 'off';

const AI_MODE_ICONS: Record<PlatformAIMode, LucideIcon> = { auto: Zap, assist: Hand, off: PowerOff };

const PlatformCard: React.FC<{ platform: Platform; onOpen: (id: string) => void }> = ({ platform, onOpen }) => {
  const { t } = useTranslation();
  const getStatusMeta = useStatusMeta();
  const status = getStatusMeta(platform.status);
  const displayName = platform.display_name || platform.name;
  const typeLabel = getPlatformLabel(toPlatformType(platform.type));
  const mode: PlatformAIMode = platform.ai_mode ?? 'auto';
  const ModeIcon = AI_MODE_ICONS[mode];
  const modeLabel = mode === 'auto'
    ? t('platforms.aiSettings.modeAuto', 'Auto')
    : mode === 'assist' ? t('platforms.aiSettings.modeAssist', 'Assist') : t('platforms.aiSettings.modeOff', 'Off');
  const unsupported = platform.is_supported === false;

  return (
    <NotchCard
      corner={
        <button
          type="button"
          onClick={() => onOpen(platform.id)}
          disabled={unsupported}
          aria-label={t('platforms.overview.open', 'Open settings')}
          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex items-center gap-3 pr-10">
        <PlatformIcon type={platform.type} size="md" dot={status.dot} dotRing="ring-white dark:ring-gray-800" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{typeLabel}</p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
            <ModeIcon className="h-3 w-3" />
            {t('platforms.overview.aiMode', 'AI · {{mode}}', { mode: modeLabel })}
          </p>
        </div>
      </div>

      <button type="button" onClick={() => onOpen(platform.id)} disabled={unsupported} className="mt-5 text-left disabled:cursor-not-allowed">
        <h3 className="line-clamp-1 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100" title={displayName}>
          {displayName}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {platform.description || (unsupported
            ? t('platforms.list.status.unsupported', 'Coming Soon')
            : t('platforms.overview.cardHint', 'Credentials, webhook and AI routing for this channel.'))}
        </p>
      </button>

      <div className="mt-auto pt-5">
        <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('channels.status', 'Status')}</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-sm text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700">
            <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot} ${status.live ? 'tgo-pulse-ring' : ''}`} />
            <span className="truncate">{status.label}</span>
          </span>
          <button
            type="button"
            onClick={() => onOpen(platform.id)}
            disabled={unsupported}
            aria-label={t('platforms.overview.open', 'Open settings')}
            title={t('platforms.overview.open', 'Open settings')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 dark:bg-acid-400 dark:text-ink-900"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NotchCard>
  );
};

const AddPlatformTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-72 flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed border-gray-200 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-acid-500 hover:bg-white dark:border-gray-800 dark:hover:border-acid-400/60 dark:hover:bg-gray-900"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg transition-transform duration-500 group-hover:rotate-90 dark:bg-acid-400 dark:text-ink-900">
        <Plus className="h-6 w-6" />
      </span>
      <span>
        <span className="block text-base font-medium text-gray-900 dark:text-gray-100">{t('platforms.list.addPlatform', 'Add Platform')}</span>
        <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{t('platforms.overview.addHint', 'Website, email, Telegram, Slack and more')}</span>
      </span>
    </button>
  );
};

const PlatformOverview: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openAddPlatform } = useOutletContext<PlatformOutletContext>();
  const platforms = usePlatformStore(s => s.platforms);
  const isLoading = usePlatformStore(s => s.isLoading);
  const loadError = usePlatformStore(s => s.loadError);
  const initializeStore = usePlatformStore(s => s.initializeStore);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => {
    const live = platforms.filter(p => p.status === 'connected').length;
    return { all: platforms.length, live, off: platforms.length - live };
  }, [platforms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platforms.filter(p => {
      if (filter === 'live' && p.status !== 'connected') return false;
      if (filter === 'off' && p.status === 'connected') return false;
      if (!q) return true;
      return (p.display_name || p.name).toLowerCase().includes(q)
        || getPlatformLabel(toPlatformType(p.type)).toLowerCase().includes(q);
    });
  }, [platforms, query, filter]);

  const filterOptions: FilterOption<StatusFilter>[] = [
    { value: 'all', label: t('common.all', 'All'), count: counts.all },
    { value: 'live', label: t('platforms.overview.live', 'Live'), count: counts.live, dot: 'bg-acid-500' },
    { value: 'off', label: t('platforms.overview.off', 'Off'), count: counts.off, dot: 'bg-gray-400' },
  ];

  const openPlatform = (id: string) => navigate(`/platforms/${id}`);
  const hasFilters = Boolean(query) || filter !== 'all';

  return (
    <PageShell>
      <PageHeader
        title={t('platforms.list.title', 'Platforms')}
        actions={
          <InkButton onClick={openAddPlatform} icon={<Plus className="h-4 w-4" />}>
            {t('platforms.list.addPlatform', 'Add Platform')}
          </InkButton>
        }
        total={counts.all}
        stats={[
          { key: 'live', value: counts.live, label: t('platforms.overview.live', 'Live').toLowerCase(), badge: 'bg-acid-300 text-ink-900' },
          { key: 'off', value: counts.off, label: t('platforms.overview.off', 'Off').toLowerCase(), badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
        ]}
      />

      <FeatureBanner
        icon={Radio}
        eyebrow={t('platforms.overview.bannerEyebrow', 'One inbox, every channel')}
        title={t('platforms.overview.bannerTitle', 'Meet customers where they already are')}
        description={t('platforms.overview.bannerDesc', 'Connect your website, email and messaging apps. Every conversation lands in one inbox, and your AI agents answer around the clock.')}
        action={
          <button type="button" onClick={openAddPlatform} className="tgo-btn-ink">
            <span className="tgo-btn-icon"><Plus className="h-4 w-4" /></span>
            {t('platforms.overview.connect', 'Connect a channel')}
          </button>
        }
      />

      <section className="space-y-5">
        <SectionHeader title={t('platforms.overview.listTitle', 'Your channels')} count={visible.length} countLabel={t('platforms.overview.countLabel', 'channels')}>
          <SearchField value={query} onChange={setQuery} />
          <RefreshButton onClick={() => { void initializeStore(); }} spinning={isLoading} disabled={isLoading} />
          <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
        </SectionHeader>

        {loadError && platforms.length === 0 ? (
          <ErrorPanel message={loadError} onRetry={() => { void initializeStore(); }} />
        ) : isLoading && platforms.length === 0 ? (
          <SkeletonGrid count={4} />
        ) : platforms.length === 0 ? (
          <EmptyPanel
            icon={Radio}
            title={t('platforms.list.emptyTitle', 'No Platforms')}
            description={t('platforms.overview.emptyDesc', 'Add your first channel to start receiving conversations.')}
            action={
              <InkButton onClick={openAddPlatform} icon={<Plus className="h-4 w-4" />}>
                {t('platforms.list.addPlatform', 'Add Platform')}
              </InkButton>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyPanel
            icon={Radio}
            title={t('platforms.overview.noResults', 'No channels match your search')}
            description={hasFilters ? t('workflow.empty.noResultsDesc', 'Try adjusting your search keywords or filters') : undefined}
          />
        ) : (
          <div className="tgo-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map(platform => (
              <PlatformCard key={platform.id} platform={platform} onOpen={openPlatform} />
            ))}
            {!hasFilters && <AddPlatformTile onClick={openAddPlatform} />}
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default PlatformOverview;
