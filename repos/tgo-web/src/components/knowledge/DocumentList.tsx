import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Trash2,
  FileX,
  Loader2,
  MessageSquare,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileType,
  type LucideIcon,
} from 'lucide-react';
import type { KnowledgeFile } from '@/types';
import { SearchField, FilterPills, EmptyPanel, type FilterOption } from '@/components/ui/PageKit';

interface DocumentListProps {
  documents: KnowledgeFile[];
  isLoading: boolean;
  onDownload: (docId: string) => void;
  onDelete: (docId: string) => void;
  onViewQA: (docId: string, docName: string) => void;
  // Search and filter, owned by the parent
  searchTerm: string;
  onSearchChange: (term: string) => void;
  fileTypeFilter: string;
  onFilterChange: (filter: string) => void;
  // Loading states for individual operations
  downloadingFiles?: Set<string>;
  deletingFiles?: Set<string>;
}

type SortField = 'name' | 'size' | 'date';
type SortDirection = 'asc' | 'desc';

const FILE_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  pdf: { icon: FileType, tone: 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400' },
  doc: { icon: FileText, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400' },
  txt: { icon: FileText, tone: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  xlsx: { icon: FileSpreadsheet, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  ppt: { icon: Presentation, tone: 'bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400' },
};

const STATUS_STYLES: Record<KnowledgeFile['statusType'], { dot: string; chip: string }> = {
  success: { dot: 'bg-acid-500', chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300' },
  processing: { dot: 'bg-amber-400 animate-pulse', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  error: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400' },
};

const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[minmax(0,2.4fr)_90px_150px_130px_132px]';

/**
 * Document List Component with sorting and filtering
 */
export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  isLoading,
  onDownload,
  onDelete,
  onViewQA,
  searchTerm,
  onSearchChange,
  fileTypeFilter,
  onFilterChange,
  downloadingFiles = new Set(),
  deletingFiles = new Set()
}) => {
  const { t } = useTranslation();

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => { counts[doc.type] = (counts[doc.type] ?? 0) + 1; });
    return counts;
  }, [documents]);

  const filteredAndSortedDocuments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(term);
      const matchesType = !fileTypeFilter || doc.type === fileTypeFilter;
      return matchesSearch && matchesType;
    });

    const valueOf = (doc: KnowledgeFile): string | number => {
      switch (sortField) {
        case 'name': return doc.name.toLowerCase();
        case 'size': return doc.sizeBytes;
        default: return new Date(doc.uploadDate).getTime();
      }
    };

    return [...filtered].sort((a, b) => {
      const aValue = valueOf(a);
      const bValue = valueOf(b);
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, searchTerm, fileTypeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filterOptions: FilterOption<string>[] = [
    { value: '', label: t('knowledge.detail.allTypes', 'All Types'), count: documents.length },
    { value: 'pdf', label: 'PDF', count: typeCounts.pdf ?? 0 },
    { value: 'doc', label: 'Word', count: typeCounts.doc ?? 0 },
    { value: 'txt', label: t('knowledge.fileTypes.text', 'Text'), count: typeCounts.txt ?? 0 },
    { value: 'xlsx', label: 'Excel', count: typeCounts.xlsx ?? 0 },
    { value: 'ppt', label: 'PowerPoint', count: typeCounts.ppt ?? 0 },
  ];

  const renderSortHeader = (field: SortField, children: React.ReactNode) => {
    const active = sortField === field;
    const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
          active ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        {children}
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={t('knowledge.detail.searchPlaceholder', 'Search documents...')}
          wide
        />
        <FilterPills options={filterOptions} value={fileTypeFilter} onChange={onFilterChange} />
      </div>

      {isLoading ? (
        <div className="tgo-surface space-y-2 p-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="tgo-skeleton h-16 rounded-2xl" style={{ opacity: 1 - i * 0.18 }} />
          ))}
        </div>
      ) : filteredAndSortedDocuments.length === 0 ? (
        <EmptyPanel
          icon={FileX}
          title={t('knowledge.detail.noDocuments', 'No documents')}
          description={t('knowledge.detail.noDocumentsDesc', 'Upload documents to build this knowledge base')}
        />
      ) : (
        <div className="tgo-surface overflow-hidden p-2">
          {/* Column header */}
          <div className={`${GRID} px-4 pb-2 pt-3`}>
            {renderSortHeader('name', t('knowledge.detail.documentName', 'Document Name'))}
            <span className="hidden md:block">{renderSortHeader('size', t('knowledge.detail.fileSize', 'File Size'))}</span>
            <span className="hidden md:block">{renderSortHeader('date', t('knowledge.detail.uploadTime', 'Upload Time'))}</span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 md:block">{t('knowledge.detail.status', 'Status')}</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t('knowledge.detail.actions', 'Actions')}</span>
          </div>

          <ul className="tgo-stagger">
            {filteredAndSortedDocuments.map(doc => {
              const fileIcon = FILE_ICONS[doc.type] ?? FILE_ICONS.txt;
              const Icon = fileIcon.icon;
              const status = STATUS_STYLES[doc.statusType] ?? STATUS_STYLES.processing;
              const isDownloading = downloadingFiles.has(doc.id);
              const isDeleting = deletingFiles.has(doc.id);

              return (
                <li
                  key={doc.id}
                  className={`${GRID} group rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${isDeleting ? 'opacity-50' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${fileIcon.tone}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={doc.name}>{doc.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        {doc.type}
                        <span className="md:hidden"> · {doc.size}</span>
                      </p>
                    </div>
                  </div>

                  <span className="hidden text-sm tabular-nums text-gray-600 md:block dark:text-gray-300">{doc.size}</span>
                  <span className="hidden truncate text-sm text-gray-500 md:block dark:text-gray-400">{doc.uploadDate}</span>
                  <span className="hidden md:block">
                    <span className={`tgo-chip ${status.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {doc.status}
                    </span>
                  </span>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onViewQA(doc.id, doc.name)}
                      className="tgo-icon-btn h-9 w-9"
                      title={t('knowledge.detail.viewQA', 'View Q&A pairs')}
                      aria-label={t('knowledge.detail.viewQA', 'View Q&A pairs')}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDownload(doc.id)}
                      disabled={isDownloading}
                      className="tgo-icon-btn h-9 w-9"
                      title={isDownloading ? t('knowledge.documentList.downloading', 'Downloading...') : t('knowledge.documentList.download', 'Download file')}
                      aria-label={t('knowledge.documentList.download', 'Download file')}
                    >
                      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => onDelete(doc.id)}
                      disabled={isDeleting}
                      className="tgo-icon-btn h-9 w-9 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
                      title={isDeleting ? t('knowledge.documentList.deleting', 'Deleting...') : t('knowledge.documentList.deleteFile', 'Delete file')}
                      aria-label={t('knowledge.documentList.deleteFile', 'Delete file')}
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
