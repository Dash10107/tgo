import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileText, HardDrive, CalendarClock, Files } from 'lucide-react';
import { DetailHeader, InkButton, RefreshButton, StatTile } from '@/components/ui/PageKit';
import type { KnowledgeBaseTag } from '@/types';

interface KnowledgeBaseHeaderProps {
  knowledgeBase: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    tags?: Array<string | KnowledgeBaseTag>;
  };
  onBack: () => void;
  onRefresh: () => void;
  onToggleUpload: () => void;
  isUploadVisible: boolean;
  isRefreshing?: boolean;
  // Stats props
  totalDocuments: number;
  totalSize: string;
  lastUpdated: string;
}

/**
 * Knowledge Base detail header: title block, actions and summary figures
 */
export const KnowledgeBaseHeader: React.FC<KnowledgeBaseHeaderProps> = ({
  knowledgeBase,
  onBack,
  onRefresh,
  onToggleUpload,
  isUploadVisible,
  isRefreshing = false,
  totalDocuments,
  totalSize,
  lastUpdated
}) => {
  const { t } = useTranslation();

  const tagNames = (knowledgeBase.tags ?? [])
    .map(tag => (typeof tag === 'string' ? tag : tag.name))
    .filter(Boolean);

  return (
    <div className="space-y-8">
      <DetailHeader
        title={knowledgeBase.name}
        description={knowledgeBase.description}
        eyebrow={t('knowledge.typeFile', 'File')}
        icon={FileText}
        onBack={onBack}
        backLabel={t('knowledge.detail.backToList', 'Back to Knowledge Base List')}
        meta={tagNames.map(tag => (
          <span key={tag} className="tgo-chip">{tag}</span>
        ))}
        actions={
          <>
            <RefreshButton onClick={onRefresh} spinning={isRefreshing} disabled={isRefreshing} />
            <InkButton
              onClick={onToggleUpload}
              icon={isUploadVisible ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              motion={isUploadVisible ? 'rotate' : 'nudge'}
            >
              {isUploadVisible ? t('common.close', 'Close') : t('knowledge.detail.uploadDocument', 'Upload Document')}
            </InkButton>
          </>
        }
      />

      <div className="tgo-stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label={t('knowledge.list.columns.documents', 'Documents')}
          value={totalDocuments}
          icon={Files}
          tone="bg-acid-300 text-ink-900"
        />
        <StatTile
          label={t('knowledge.detail.fileSize', 'File Size')}
          value={<>{totalSize}<span className="ml-1 text-lg text-gray-400">MB</span></>}
          icon={HardDrive}
        />
        <StatTile
          label={t('knowledge.list.columns.lastUpdated', 'Last Updated')}
          value={<span className="text-[28px]">{lastUpdated || '—'}</span>}
          icon={CalendarClock}
        />
      </div>
    </div>
  );
};
