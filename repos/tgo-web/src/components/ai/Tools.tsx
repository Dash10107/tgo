import React, { useState, useMemo, useEffect } from 'react';
import { Globe, Package, Plug, Store, Wrench } from 'lucide-react';
import {
  PageShell, PageHeader, InkButton, GhostButton, SectionHeader, SearchField, RefreshButton,
  FilterPills, FeatureBanner, EmptyPanel, ErrorPanel, SkeletonGrid, type FilterOption,
} from '@/components/ui/PageKit';
import { useTranslation } from 'react-i18next';
import ToolsList from './ToolsList';
import AddToolModal from './AddToolModal';
import EditToolModal from './EditToolModal';
import AddHTTPToolModal from './AddHTTPToolModal';
import EditHTTPToolModal from './EditHTTPToolModal';
import { ToolToastProvider, useToast } from './ToolToastProvider';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectToolsStore } from '@/stores/projectToolsStore';
import { transformAiToolResponseList, searchProjectTools } from '@/utils/projectToolsTransform';
import ToolStoreModal from './ToolStoreModal';
import type { AiTool, AiToolResponse } from '@/types';

/**
 * Tools page component content
 * Updated to use NEW /v1/ai/tools API
 */
type ToolTypeFilter = 'all' | 'mcp' | 'http';

/** HTTP tools are stored as FUNCTION tools; everything else is served over MCP */
const getToolKind = (tool: AiTool): Exclude<ToolTypeFilter, 'all'> =>
  tool.config?.tool_type === 'FUNCTION' ? 'http' : 'mcp';

const ToolsContent: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<ToolTypeFilter>('all');
  const [showAddToolModal, setShowAddToolModal] = useState<boolean>(false);
  const [showAddHTTPToolModal, setShowAddHTTPToolModal] = useState<boolean>(false);
  const [showEditToolModal, setShowEditToolModal] = useState<boolean>(false);
  const [showEditHTTPToolModal, setShowEditHTTPToolModal] = useState<boolean>(false);
  const [showToolStoreModal, setShowToolStoreModal] = useState<boolean>(false);
  const [selectedToolForEdit, setSelectedToolForEdit] = useState<AiToolResponse | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [toolToDelete, setToolToDelete] = useState<AiTool | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const { showToast } = useToast();
  const { t } = useTranslation();

  // Project Tools store (now using AI tools)
  const {
    aiTools,
    isLoading,
    error,
    loadTools,
    deleteTool,
    clearError,
  } = useProjectToolsStore();

  // Load tools on component mount (only active tools by default)
  useEffect(() => {
    loadTools(false); // false = don't include deleted tools
  }, [loadTools]);

  // Transform API AI tools to component format
  const tools = useMemo(() => {
    return transformAiToolResponseList(aiTools);
  }, [aiTools]);

  // Filter tools by search query (client-side for better UX)
  const filteredTools = useMemo(() => {
    let filtered = tools;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(tool => getToolKind(tool) === typeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = searchProjectTools(filtered, searchQuery);
    }

    return filtered;
  }, [tools, searchQuery, typeFilter]);

  const typeCounts = useMemo(() => {
    const http = tools.filter(tool => getToolKind(tool) === 'http').length;
    return { all: tools.length, http, mcp: tools.length - http };
  }, [tools]);

  const handleToolAction = async (actionType: string, tool: AiTool): Promise<void> => {
    try {
      switch (actionType) {
        case 'delete':
        case 'uninstall':
          setToolToDelete(tool);
          setShowDeleteConfirm(true);
          break;
        case 'edit':
          // Find the original AiToolResponse for editing
          const aiTool = aiTools.find(t => t.id === tool.id);
          if (aiTool) {
            setSelectedToolForEdit(aiTool);
            if (aiTool.transport_type === 'http_webhook') {
              setShowEditHTTPToolModal(true);
            } else {
              setShowEditToolModal(true);
            }
          } else {
            showToast('error', t('tools.tools.edit.notFound', 'Tool Not Found'), t('tools.tools.edit.notFoundMessage', 'Unable to find detailed information for this tool'));
          }
          break;
        default:
          showToast('warning', t('tools.tools.unknownAction.title', 'Unknown action'), t('tools.tools.unknownAction.message', { type: actionType, defaultValue: 'Unsupported action type: {{type}}' }));
      }
    } catch (error) {
      console.error(`Tool action ${actionType} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : t('tools.tools.actionFailed.title', 'Action failed');
      showToast('error', t('tools.tools.actionFailed.title', 'Action failed'), errorMessage);
    }
  };

  // Handle retry on error
  const handleRetry = () => {
    clearError();
    loadTools(false);
  };



  const handleSearchChange = (query: string): void => {
    setSearchQuery(query);
  };

  const handleDeleteToolConfirm = async () => {
    if (!toolToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTool(toolToDelete.id);
      await loadTools(false);
      setShowDeleteConfirm(false);
      setToolToDelete(null);
    } catch (error) {
      console.error('Failed to delete tool:', error);
      const errorMessage = error instanceof Error ? error.message : t('tools.tools.actionFailed.title', 'Action failed');
      showToast('error', t('tools.tools.actionFailed.title', 'Action failed'), errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const filterOptions: FilterOption<ToolTypeFilter>[] = [
    { value: 'all', label: t('common.all', 'All'), count: typeCounts.all },
    { value: 'mcp', label: 'MCP', count: typeCounts.mcp, dot: 'bg-acid-500' },
    { value: 'http', label: 'HTTP', count: typeCounts.http, dot: 'bg-sky-400' },
  ];

  const hasActiveFilters = Boolean(searchQuery.trim()) || typeFilter !== 'all';

  return (
    <PageShell
      after={
        <>
      {/* Add MCP Tool Modal */}
      <AddToolModal
        isOpen={showAddToolModal}
        onClose={() => setShowAddToolModal(false)}
      />

      {/* Add HTTP Tool Modal */}
      <AddHTTPToolModal
        isOpen={showAddHTTPToolModal}
        onClose={() => setShowAddHTTPToolModal(false)}
      />

      {/* Edit MCP Tool Modal */}
      <EditToolModal
        isOpen={showEditToolModal}
        onClose={() => {
          setShowEditToolModal(false);
          setSelectedToolForEdit(null);
        }}
        tool={selectedToolForEdit}
      />

      {/* Edit HTTP Tool Modal */}
      <EditHTTPToolModal
        isOpen={showEditHTTPToolModal}
        onClose={() => {
          setShowEditHTTPToolModal(false);
          setSelectedToolForEdit(null);
        }}
        tool={selectedToolForEdit}
      />

      {/* Tool Store Modal */}
      <ToolStoreModal
        isOpen={showToolStoreModal}
        onClose={() => setShowToolStoreModal(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('tools.tools.confirmDelete.title', 'Confirm Delete')}
        message={t('tools.tools.confirmDelete.message', { name: toolToDelete?.name, defaultValue: 'Are you sure you want to delete the tool "{{name}}"? This action cannot be undone.' })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDeleteToolConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setToolToDelete(null);
        }}
        isLoading={isDeleting}
      />
        </>
      }
    >
      {/* Header */}
      <PageHeader
        title={t('tools.title', 'Tools')}
        total={typeCounts.all}
        stats={[
          { key: 'mcp', value: typeCounts.mcp, label: 'mcp', badge: 'bg-acid-300 text-ink-900' },
          { key: 'http', value: typeCounts.http, label: 'http', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
        ]}
        actions={
          <>
            <InkButton onClick={() => setShowAddToolModal(true)} icon={<Plug className="h-4 w-4" />}>
              {t('tools.addMCPTool', 'Add MCP Tool')}
            </InkButton>
            <GhostButton onClick={() => setShowAddHTTPToolModal(true)}>
              <Globe className="h-4 w-4" />
              {t('tools.addHttpTool', 'Add HTTP Tool')}
            </GhostButton>
            <GhostButton onClick={() => setShowToolStoreModal(true)}>
              <Store className="h-4 w-4" />
              {t('tools.toolStore', 'Tool Store')}
            </GhostButton>
          </>
        }
      />

      <FeatureBanner
        icon={Package}
        eyebrow={t('tools.banner.eyebrow', 'Capabilities')}
        title={t('tools.banner.title', 'Enhance AI Capabilities')}
        description={t('tools.banner.description', 'By adding HTTP or MCP protocol tools, you can give AI agents unlimited possibilities such as searching, querying databases, and calling external services.')}
        action={
          <button
            onClick={() => setShowToolStoreModal(true)}
            className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-ink-900 pl-1.5 pr-5 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgb(15_16_18/0.7)] transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acid-400 text-ink-900 transition-transform duration-300 group-hover:rotate-12">
              <Store className="h-4 w-4" />
            </span>
            {t('tools.banner.browse', 'Browse the Tool Store')}
          </button>
        }
      />

      {/* Tool list */}
      <section className="space-y-5">
        <SectionHeader title={t('tools.listTitle', 'Tool List')} count={filteredTools.length} countLabel={t('tools.countLabel', 'tools')}>
          <SearchField value={searchQuery} onChange={handleSearchChange} placeholder={t('tools.search.placeholder', 'Search tools...')} />
          <RefreshButton onClick={() => loadTools(false)} spinning={isLoading} disabled={isLoading} />
          <FilterPills options={filterOptions} value={typeFilter} onChange={setTypeFilter} />
        </SectionHeader>

        {error ? (
          <ErrorPanel message={error} onRetry={handleRetry} />
        ) : isLoading && tools.length === 0 ? (
          <SkeletonGrid count={8} itemClassName="h-60" />
        ) : filteredTools.length === 0 ? (
          <EmptyPanel
            icon={Wrench}
            title={hasActiveFilters ? t('tools.empty.noResults', 'No matching tools') : t('tools.tools.installedEmpty.title', 'No installed tools')}
            description={hasActiveFilters ? t('tools.empty.noResultsDesc', 'Try adjusting your search keywords or filters') : t('tools.tools.installedEmpty.description', 'Click the "Add Tool" button in the top-right to create your first tool')}
            action={!hasActiveFilters && (
              <InkButton onClick={() => setShowAddToolModal(true)} icon={<Plug className="h-4 w-4" />}>
                {t('tools.addMCPTool', 'Add MCP Tool')}
              </InkButton>
            )}
          />
        ) : (
          <ToolsList
            tools={filteredTools}
            selectedCategory="all"
            onToolAction={handleToolAction}
            onShowToast={showToast}
          />
        )}
      </section>
    </PageShell>
  );
};

/**
 * Tools page component with Toast provider
 */
const Tools: React.FC = () => {
  return (
    <ToolToastProvider>
      <ToolsContent />
    </ToolToastProvider>
  );
};

export default Tools;
