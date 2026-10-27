import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Select from '@/components/ui/Select';
import { useVisitorStore } from '@/stores/visitorStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { tagsApiService, type TagResponse } from '@/services/tagsApi';
import { platformsApiService, type PlatformResponse } from '@/services/platformsApi';
import { RotateCcw, X } from 'lucide-react';
import { FilterPills, SearchField, type FilterOption } from '@/components/ui/PageKit';

import { normalizeTagHex, hexToRgba } from '@/utils/tagUtils';

const VisitorFilters: React.FC = () => {
  const { t } = useTranslation();
  const { filters, setFilters, resetFilters } = useVisitorStore();
  
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const debouncedSearch = useDebouncedValue(searchValue, 300);

  const [availableTags, setAvailableTags] = useState<TagResponse[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingTags(true);
      setIsLoadingPlatforms(true);
      try {
        const [tagsResp, platformsResp] = await Promise.all([
          tagsApiService.listVisitorTags({ limit: 100 }),
          platformsApiService.listPlatforms({ limit: 100 })
        ]);
        setAvailableTags(tagsResp.data || []);
        setPlatforms(platformsResp.data || []);
      } catch (err) {
        console.error('Failed to fetch filter data:', err);
      } finally {
        setIsLoadingTags(false);
        setIsLoadingPlatforms(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  const platformOptions = useMemo(() => {
    return [
      { value: '', label: t('visitor.filters.platform.all', 'All Platforms') },
      ...platforms.map(p => ({
        value: p.id,
        label: p.display_name || p.name || p.type,
      }))
    ];
  }, [platforms, t]);

  const tagOptions = useMemo(() => {
    return [
      { value: '', label: t('visitor.filters.tags.all', 'All Tags') },
      ...availableTags.map(tag => ({
        value: tag.id,
        label: tag.display_name || tag.name,
        color: normalizeTagHex(tag.color),
      }))
    ];
  }, [availableTags, t]);

  const sortOptions = [
    { value: 'last_offline_time:desc', label: t('visitor.filters.sort.lastVisit', 'Last Active') },
    { value: 'created_at:desc', label: t('visitor.filters.sort.createdAt', 'Newest') },
  ];

  const handlePlatformChange = (value: string) => {
    setFilters({ platform_id: value || undefined });
  };

  const handleOnlineChange = (value: string) => {
    setFilters({ is_online: value === '' ? undefined : value === 'true' });
  };

  const handleTagSelect = (tagId: string) => {
    if (!tagId) return;
    const currentTags = filters.tag_ids || [];
    if (!currentTags.includes(tagId)) {
      setFilters({ tag_ids: [...currentTags, tagId] });
    }
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split(':');
    setFilters({ 
      sort_by: sortBy, 
      sort_order: (sortOrder || 'desc') as 'asc' | 'desc' 
    });
  };

  const removeTag = (tagId: string) => {
    const currentTags = filters.tag_ids || [];
    setFilters({ tag_ids: currentTags.filter(id => id !== tagId) });
  };

  const hasFilters = searchValue || filters.platform_id || filters.is_online !== undefined || (filters.tag_ids && filters.tag_ids.length > 0);

  type OnlineFilter = 'all' | 'online' | 'offline';
  const onlineFilter: OnlineFilter = filters.is_online === undefined ? 'all' : (filters.is_online ? 'online' : 'offline');
  const onlinePills: FilterOption<OnlineFilter>[] = [
    { value: 'all', label: t('visitor.filters.online.all', 'All Statuses') },
    { value: 'online', label: t('visitor.filters.online.online', 'Online'), dot: 'bg-acid-500' },
    { value: 'offline', label: t('visitor.filters.online.offline', 'Offline'), dot: 'bg-gray-400' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={searchValue}
          onChange={setSearchValue}
          placeholder={t('visitor.filters.search.placeholder', 'Search name, email or phone...')}
          wide
        />

        <FilterPills
          options={onlinePills}
          value={onlineFilter}
          onChange={(value) => handleOnlineChange(value === 'all' ? '' : String(value === 'online'))}
        />

        <span className="mx-1 hidden h-6 w-px bg-gray-200 md:block dark:bg-gray-800" />

        {/* Platform Filter */}
        <div className="w-44">
          <Select
            value={filters.platform_id || ''}
            onChange={handlePlatformChange}
            options={platformOptions}
            isLoading={isLoadingPlatforms}
          />
        </div>

        {/* Tag Filter */}
        <div className="w-44">
          <Select
            value=""
            onChange={handleTagSelect}
            options={tagOptions}
            placeholder={t('visitor.filters.tags.select', 'Filter by Tag')}
            isLoading={isLoadingTags}
          />
        </div>

        {/* Sort Order */}
        <div className="w-40">
          <Select
            value={`${filters.sort_by || 'last_offline_time'}:${filters.sort_order || 'desc'}`}
            onChange={handleSortChange}
            options={sortOptions}
          />
        </div>

        {/* Reset Button */}
        {hasFilters && (
          <button
            onClick={() => {
              setSearchValue('');
              resetFilters();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('common.reset', 'Reset')}
          </button>
        )}
      </div>

      {/* Selected Tags Chips */}
      {filters.tag_ids && filters.tag_ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tgo-eyebrow">{t('visitor.filters.tags.selected', 'Selected Tags')}</span>
          {filters.tag_ids.map(tagId => {
            const tag = availableTags.find(t => t.id === tagId);
            if (!tag) return null;

            const hex = normalizeTagHex(tag.color);
            return (
              <span
                key={tagId}
                className="tgo-pop inline-flex h-7 items-center gap-1 rounded-full border pl-3 pr-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: hexToRgba(hex, 0.1),
                  color: hex,
                  borderColor: hexToRgba(hex, 0.2),
                }}
              >
                {tag.display_name || tag.name}
                <button
                  onClick={() => removeTag(tagId)}
                  className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={t('common.remove', 'Remove')}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VisitorFilters;
