import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { KnowledgeBaseHeader } from '@/components/knowledge/KnowledgeBaseHeader';
import { FileUpload } from '@/components/knowledge/FileUpload';
import { DocumentList } from '@/components/knowledge/DocumentList';
import { FileManagementService, type FileManagementState } from '@/services/fileManagementService';
import { transformCollectionToKnowledgeBase } from '@/utils/knowledgeBaseTransforms';
import { KnowledgeBaseApiService } from '@/services/knowledgeBaseApi';
import { useToast } from '@/hooks/useToast';
import { showApiError, showFileSuccess, showFileError } from '@/utils/toastHelpers';
import type { KnowledgeBase, KnowledgeFile } from '@/types';
import { useTranslation } from 'react-i18next';
import ProjectConfigApiService from '@/services/projectConfigApi';
import { useAuthStore } from '@/stores/authStore';

import { SearchTest } from '@/components/knowledge/SearchTest';
import { QADataView } from '@/components/knowledge/QADataView';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageShell, PageLoader, ErrorPanel, EmptyPanel, InkButton, GhostButton } from '@/components/ui/PageKit';
import { TestTube, FileText, ArrowLeft, SearchX } from 'lucide-react';

/**
 * Knowledge Base Detail Page Component
 * Based on the HTML reference design
 */
const KnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadVisible, setIsUploadVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileManagementState['uploadProgress']>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeFile | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());

  // Tabs State
  const [activeTab, setActiveTab] = useState<'documents' | 'search'>('documents');

  // QA View State
  const [qaFile, setQaFile] = useState<{ id: string; name: string } | null>(null);

  // Embedding model check state
  const [hasEmbeddingModel, setHasEmbeddingModel] = useState<boolean>(true);
  const [isCheckingEmbedding, setIsCheckingEmbedding] = useState<boolean>(true);

  // File management service
  const fileServiceRef = useRef<FileManagementService | null>(null);

  // Get project ID from auth store
  const projectId = useAuthStore(state => state.user?.project_id);

  // Check if embedding model is configured
  useEffect(() => {
    const checkEmbeddingModel = async () => {
      if (!projectId) {
        console.warn('No project ID available, skipping embedding model check');
        setIsCheckingEmbedding(false);
        setHasEmbeddingModel(false);
        return;
      }

      setIsCheckingEmbedding(true);
      try {
        const configService = new ProjectConfigApiService();
        const aiConfig = await configService.getAIConfig(projectId);

        // Check if default embedding model is configured
        const hasEmbedding = !!(aiConfig.default_embedding_provider_id && aiConfig.default_embedding_model);
        setHasEmbeddingModel(hasEmbedding);
      } catch (error) {
        console.error('Failed to check embedding model configuration:', error);
        // On error, assume no embedding model to be safe
        setHasEmbeddingModel(false);
      } finally {
        setIsCheckingEmbedding(false);
      }
    };

    checkEmbeddingModel();
  }, [projectId]);

  // Initialize page and load knowledge base data
  useEffect(() => {
    if (!id) {
      navigate('/knowledge');
      return;
    }

    const initializePage = async (): Promise<(() => void) | undefined> => {
      setIsLoading(true);
      setError(null);
      setHasError(false);

      try {
        // Get knowledge base from API
        const collection = await KnowledgeBaseApiService.getCollection(id);
        const kb = transformCollectionToKnowledgeBase(collection);
        setKnowledgeBase(kb);

        // Initialize file management service
        fileServiceRef.current = new FileManagementService(id);

        // Subscribe to file service state changes
        const unsubscribe = fileServiceRef.current.subscribe((state) => {
          setDocuments(state.files);
          setIsLoading(state.isLoading);
          setUploadProgress(state.uploadProgress);
        });

        // Load files
        await fileServiceRef.current.loadFiles();

        setIsLoading(false);
        return unsubscribe;

      } catch (error) {
        console.error('Failed to load knowledge base:', error);
        const errorMessage = error instanceof Error ? error.message : t('knowledge.detail.loadFailedDefault', 'Failed to load knowledge base details');
        setError(errorMessage);
        setHasError(true);
        setIsLoading(false);
        return undefined;
      }
    };

    const cleanup = initializePage();

    return () => {
      cleanup?.then(unsubscribe => unsubscribe?.());
    };
  }, [id, navigate, t]);

  // Handle back navigation
  const handleBack = () => {
    navigate('/knowledge');
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (!fileServiceRef.current) return;
    setIsRefreshing(true);
    try {
      await fileServiceRef.current.loadFiles();
    } catch (error) {
      console.error('Failed to refresh files:', error);
      // Error is already handled in the file service
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle upload toggle
  const handleToggleUpload = () => {
    setIsUploadVisible(!isUploadVisible);
  };

  const handleRemoveUploadProgress = (fileId: string) => {
    try {
      fileServiceRef.current?.clearUploadProgress(fileId);
    } catch (e) {
      console.error('Failed to clear upload progress:', e);
    }
  };

  // Handle file upload
  const handleFileUpload = async (files: File[]) => {
    if (!id || !fileServiceRef.current) {
      console.error('File service not initialized or collection ID missing');
      showApiError(showToast, new Error(t('knowledge.detail.fileServiceNotInitialized', 'File service not initialized')));
      return;
    }

    // Check if files exceed limit
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    // 50MB limit for batch upload
    if (totalSize > 50 * 1024 * 1024) {
      showToast(
        'error',
        t('knowledge.upload.error'),
        t('knowledge.upload.totalSizeLimit')
      );
      return;
    }

    try {
      // Use ref to call uploadFiles
      const result = await fileServiceRef.current.uploadFiles(files, {
        description: 'Uploaded via web interface',
        tags: ['web-upload'],
      });

      // Show appropriate message based on results
      if (result.failedCount === 0) {
        // All files uploaded successfully
        if (files.length === 1) {
          showFileSuccess(showToast, 'upload', files[0].name);
        } else {
          showToast('success', t('knowledge.upload.uploadComplete', 'Upload Complete'), t('knowledge.upload.multipleSuccessMessage', { count: files.length, defaultValue: `{{count}} files uploaded successfully` }));
        }
      } else if (result.successCount > 0) {
        // Partial success
        showToast('warning',
          t('knowledge.upload.partialSuccess', 'Partial Upload Success'),
          t('knowledge.upload.partialSuccessMessage', {
            success: result.successCount,
            failed: result.failedCount,
            defaultValue: `{{success}} files uploaded successfully, {{failed}} files failed`
          })
        );
      }
      // Note: If all files failed, an error will be thrown and caught below
    } catch (error) {
      console.error('File upload failed:', error);
      if (files.length === 1) {
        showFileError(showToast, 'upload', files[0].name, error);
      } else {
        showApiError(showToast, error);
      }
    }
  };

  // Handle document actions
  const handleDownload = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    const fileName = doc?.name || 'Unknown file';

    // Add to downloading set
    setDownloadingFiles(prev => new Set(prev).add(docId));

    try {
      const response = await KnowledgeBaseApiService.downloadFile(docId);

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = fileName;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showFileSuccess(showToast, 'download', filename);
    } catch (error) {
      console.error('Download failed:', error);
      showFileError(showToast, 'download', fileName, error);
    } finally {
      // Remove from downloading set
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const handleDelete = (docId: string) => {
    setDeleteTarget(documents.find(d => d.id === docId) ?? null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const docId = deleteTarget.id;
    const fileName = deleteTarget.name || 'Unknown file';
    setDeleteTarget(null);

    // Add to deleting set
    setDeletingFiles(prev => new Set(prev).add(docId));

    try {
      await KnowledgeBaseApiService.deleteFile(docId);

      // Remove from local documents state
      setDocuments(prev => prev.filter(d => d.id !== docId));

      showFileSuccess(showToast, 'delete', fileName);
    } catch (error) {
      console.error('Delete failed:', error);
      showFileError(showToast, 'delete', fileName, error);
    } finally {
      // Remove from deleting set
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const handleViewQA = (docId: string, docName: string) => {
    setQaFile({ id: docId, name: docName });
  };

  const handleCloseQA = () => {
    setQaFile(null);
  };

  // Calculate stats
  const totalSize = React.useMemo(() => {
    const totalBytes = documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);
    return (totalBytes / (1024 * 1024)).toFixed(1);
  }, [documents]);

  const lastUpdated = React.useMemo(() => {
    if (documents.length === 0) return '';
    const dates = documents.map(doc => new Date(doc.uploadDate));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleDateString(i18n.language || undefined);
  }, [documents, i18n.language]);


  if (isLoading && !knowledgeBase) {
    return <PageLoader label={t('knowledge.detail.loadingDetails', 'Loading knowledge base details...')} />;
  }

  if (hasError) {
    return (
      <PageShell>
        <ErrorPanel
          message={error || t('knowledge.detail.loadFailedDesc', 'An error occurred while loading knowledge base details')}
          onRetry={() => window.location.reload()}
        />
        <div className="flex justify-center">
          <GhostButton onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            {t('knowledge.detail.backToList', 'Back to Knowledge Base List')}
          </GhostButton>
        </div>
      </PageShell>
    );
  }

  if (!knowledgeBase) {
    return (
      <PageShell>
        <EmptyPanel
          icon={SearchX}
          title={t('knowledge.detail.notFound.title', 'Knowledge Base Not Found')}
          description={t('knowledge.detail.notFound.description', 'Please check if the link is correct')}
          action={
            <InkButton onClick={handleBack} motion="nudge" icon={<ArrowLeft className="h-4 w-4" />}>
              {t('knowledge.detail.backToList', 'Back to Knowledge Base List')}
            </InkButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      after={
        <>
          {qaFile && <QADataView fileId={qaFile.id} fileName={qaFile.name} onClose={handleCloseQA} />}
          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={t('knowledge.file.confirmDelete.title', 'Delete File')}
            message={t('knowledge.file.confirmDelete.message', { name: deleteTarget?.name, defaultValue: 'Are you sure you want to delete file "{{name}}"? This action cannot be undone.' })}
            confirmText={t('common.delete', 'Delete')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      }
    >
      <KnowledgeBaseHeader
        knowledgeBase={{
          id: knowledgeBase.id,
          name: knowledgeBase.name,
          description: knowledgeBase.description,
          category: knowledgeBase.category,
          tags: knowledgeBase.tags
        }}
        onBack={handleBack}
        onRefresh={handleRefresh}
        onToggleUpload={handleToggleUpload}
        isUploadVisible={isUploadVisible}
        isRefreshing={isRefreshing}
        totalDocuments={documents.length}
        totalSize={totalSize}
        lastUpdated={lastUpdated}
      />

      <section className="space-y-6">
        <div className="tgo-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'documents'}
            data-active={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
            className="tgo-tab"
          >
            <FileText className="h-4 w-4" />
            {t('knowledge.tabs.documents', 'Documents')}
            <span className="text-[11px] tabular-nums opacity-60">{documents.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'search'}
            data-active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
            className="tgo-tab"
          >
            <TestTube className="h-4 w-4" />
            {t('knowledge.tabs.searchTest', 'Search Test')}
          </button>
        </div>

        {activeTab === 'documents' ? (
          <div key="documents" className="tgo-fade-in space-y-6">
            <FileUpload
              onUpload={handleFileUpload}
              isVisible={isUploadVisible}
              onToggle={handleToggleUpload}
              uploadProgress={uploadProgress}
              onRemoveUploadProgress={handleRemoveUploadProgress}
              hasEmbeddingModel={hasEmbeddingModel}
              isCheckingEmbedding={isCheckingEmbedding}
            />

            <DocumentList
              documents={documents}
              isLoading={isLoading}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onViewQA={handleViewQA}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              fileTypeFilter={fileTypeFilter}
              onFilterChange={setFileTypeFilter}
              downloadingFiles={downloadingFiles}
              deletingFiles={deletingFiles}
            />
          </div>
        ) : (
          <div key="search" className="tgo-fade-in">
            <SearchTest collectionId={id!} />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default KnowledgeBaseDetail;
