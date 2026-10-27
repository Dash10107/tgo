import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVisitorStore } from '@/stores/visitorStore';
import VisitorTable from '@/components/visitor/VisitorTable';
import VisitorFilters from '@/components/visitor/VisitorFilters';
import VisitorDetailPanel from '@/components/visitor/VisitorDetailPanel';
import Pagination from '@/components/ui/Pagination';
import { Users } from 'lucide-react';
import { PageShell, PageHeader, SectionHeader, RefreshButton, EmptyPanel, ErrorPanel, SkeletonGrid } from '@/components/ui/PageKit';
import { visitorApiService, type VisitorResponse } from '@/services/visitorApi';

const VisitorManagement: React.FC = () => {
  const { t } = useTranslation();
  const {
    visitors,
    total,
    page,
    pageSize,
    loading,
    error,
    fetchVisitors,
    setPage,
  } = useVisitorStore();

  const [selectedVisitor, setSelectedVisitor] = useState<VisitorResponse | null>(null);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const handleVisitorClick = useCallback(async (visitor: VisitorResponse) => {
    // Show the basic info first, then fetch the full details
    setSelectedVisitor(visitor);
    try {
      const fullDetail = await visitorApiService.getVisitor(visitor.id);
      setSelectedVisitor(fullDetail);
    } catch (err) {
      console.error('Failed to fetch visitor details:', err);
      // Still show the basic info even if fetching the details fails
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedVisitor(null);
  }, []);

  // Esc closes the detail drawer
  useEffect(() => {
    if (!selectedVisitor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedVisitor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedVisitor]);

  // Callback when visitor data is updated in the panel
  const handleVisitorUpdated = useCallback(async (visitorId: string) => {
    // Refresh the list data
    fetchVisitors();
    
    // Update the currently selected visitor details
    try {
      const updatedVisitor = await visitorApiService.getVisitor(visitorId);
      setSelectedVisitor(updatedVisitor);
    } catch (err) {
      console.error('Failed to refresh visitor details:', err);
    }
  }, [fetchVisitors]);

  const totalPages = Math.ceil(total / pageSize);

  const onlineInView = (visitors || []).filter(v => v?.is_online).length;

  return (
    <PageShell
      after={
        /* Visitor Detail Drawer - Using shared VisitorDetailPanel */
        selectedVisitor && (
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30 p-0 sm:p-3"
            onClick={handleCloseDetail}
          >
            <div
              className="tgo-drawer h-full w-full max-w-[440px]"
              onClick={(e) => e.stopPropagation()}
            >
              <VisitorDetailPanel
                visitorId={selectedVisitor.id}
                visitorData={selectedVisitor}
                showCloseButton={true}
                onClose={handleCloseDetail}
                onVisitorUpdated={handleVisitorUpdated}
                variant="drawer"
              />
            </div>
          </div>
        )
      }
    >
      {/* Header */}
      <PageHeader
        title={t('visitor.management.titleShort', 'Visitors')}
        stats={[
          {
            key: 'total',
            value: total || 0,
            label: t('visitor.stats.total', 'total'),
            badge: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
            badgeText: t('visitor.stats.allPlatforms', 'all'),
          },
          {
            key: 'online',
            value: onlineInView,
            label: t('visitor.stats.onlineInView', 'online in view'),
            badge: 'bg-acid-300 text-ink-900',
            badgeText: t('visitor.stats.live', 'live'),
          },
        ]}
      />

      <section className="space-y-5">
        <SectionHeader title={t('visitor.listTitle', 'Visitor List')} count={total || 0} countLabel={t('visitor.countLabel', 'visitors')}>
          <RefreshButton onClick={() => fetchVisitors()} spinning={loading} disabled={loading} />
        </SectionHeader>

        <VisitorFilters />

        {error ? (
          <ErrorPanel message={error} onRetry={() => fetchVisitors()} />
        ) : loading && (!visitors || visitors.length === 0) ? (
          <SkeletonGrid count={6} className="space-y-2" itemClassName="h-16 !rounded-3xl" />
        ) : !visitors || visitors.length === 0 ? (
          <EmptyPanel
            icon={Users}
            title={t('visitor.table.empty', 'No visitor data')}
            description={t('visitor.management.subtitle', 'View and manage visitor information from all platforms')}
          />
        ) : (
          <div className="tgo-surface tgo-fade-up overflow-hidden">
            <div className="overflow-x-auto">
              <VisitorTable visitors={visitors} onVisitorClick={handleVisitorClick} />
            </div>
          </div>
        )}

        {/* Pagination */}
        {!error && totalPages > 1 && (
          <div className="flex justify-center pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default VisitorManagement;
