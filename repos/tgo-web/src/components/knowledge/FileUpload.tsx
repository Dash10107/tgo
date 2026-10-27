import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2, FileText, Lock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  isVisible: boolean;
  onToggle: () => void;
  uploadProgress?: Map<string, FileUploadProgress>;
  onRemoveUploadProgress?: (fileId: string) => void;
  hasEmbeddingModel?: boolean;
  isCheckingEmbedding?: boolean;
}

interface UploadRow {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.ppt', '.pptx', '.md', '.markdown', '.html', '.htm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FORMAT_CHIPS = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'TXT', 'MD', 'HTML'];

/**
 * File Upload Component with Drag & Drop
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  isVisible,
  uploadProgress,
  onRemoveUploadProgress,
  hasEmbeddingModel = true,
  isCheckingEmbedding = false
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const isUploadDisabled = isCheckingEmbedding || !hasEmbeddingModel;

  // Convert service progress to display format
  const uploadRows = React.useMemo<UploadRow[]>(() => {
    if (!uploadProgress) return [];
    return Array.from(uploadProgress.values()).map(progress => ({
      id: progress.fileId,
      name: progress.fileName,
      progress: progress.progress,
      status: progress.status === 'completed' ? 'success' : progress.status === 'error' ? 'error' : 'uploading',
      error: progress.error,
    }));
  }, [uploadProgress]);

  // Validate and hand files to the parent; the service tracks progress
  const handleFiles = useCallback((files: File[]) => {
    if (isUploadDisabled) return;

    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showToast('error', file.name, t('knowledge.upload.maxFileSize'));
        return false;
      }
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        showToast('error', file.name, t('knowledge.upload.unsupportedFormat'));
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) onUpload(validFiles);
  }, [isUploadDisabled, onUpload, showToast, t]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isVisible && (uploadProgress ? uploadProgress.size === 0 : true)) {
    return null;
  }

  return (
    <div className="tgo-surface tgo-fade-up space-y-4 p-3">
      {isVisible && (
        <div
          role="button"
          tabIndex={isUploadDisabled ? -1 : 0}
          aria-disabled={isUploadDisabled}
          onClick={() => !isUploadDisabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isUploadDisabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={isUploadDisabled ? undefined : handleDragOver}
          onDragLeave={isUploadDisabled ? undefined : handleDragLeave}
          onDrop={isUploadDisabled ? undefined : handleDrop}
          className={`relative overflow-hidden rounded-[22px] border-2 border-dashed px-6 py-12 text-center outline-none transition-all duration-300 ${
            isUploadDisabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50'
              : isDragOver
                ? 'scale-[0.995] cursor-copy border-acid-500 bg-acid-50 dark:border-acid-400 dark:bg-acid-400/10'
                : 'cursor-pointer border-gray-200 bg-gray-50/60 hover:border-acid-500 hover:bg-acid-50/50 focus-visible:border-acid-500 dark:border-gray-700 dark:bg-white/[0.02] dark:hover:border-acid-400/70 dark:hover:bg-acid-400/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploadDisabled}
          />

          {isCheckingEmbedding ? (
            <div className="flex flex-col items-center">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t('knowledge.upload.checkingEmbedding', 'Checking embedding model configuration...')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
                <span className={`absolute inset-0 rounded-full transition-colors ${isUploadDisabled ? 'bg-gray-200/70 dark:bg-gray-800' : 'bg-acid-200/60 dark:bg-acid-400/10'}`} />
                <span className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-500 ${
                  isUploadDisabled ? 'bg-gray-400 text-white dark:bg-gray-700' : 'bg-ink-900 text-acid-400'
                } ${isDragOver ? '-translate-y-1 scale-110' : ''}`}>
                  {isUploadDisabled ? <Lock className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                </span>
              </div>
              <h3 className={`text-lg font-medium tracking-tight ${isUploadDisabled ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {t('knowledge.upload.title', 'Drag files here or click to upload')}
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
                {!hasEmbeddingModel
                  ? t('knowledge.embedding.requiredTitle', 'Embedding Model Required')
                  : t('knowledge.upload.supportedFormats', 'Supports PDF, Word, Excel, PowerPoint, Text files, Markdown, HTML')}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                {FORMAT_CHIPS.map(fmt => (
                  <span key={fmt} className="tgo-chip bg-white text-[10px] font-semibold tracking-wider shadow-[inset_0_0_0_1px_var(--color-gray-200)] dark:bg-gray-900 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {uploadRows.length > 0 && (
        <ul className="space-y-2">
          {uploadRows.map(file => (
            <li key={file.id} className="tgo-well flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {file.name || t('knowledge.fileUpload.unknownFile', 'Unknown file')}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {file.status === 'uploading' ? `${Math.round(file.progress)}%` : null}
                  </span>
                </div>
                {file.status === 'uploading' && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-full rounded-full bg-acid-500 transition-[width] duration-300" style={{ width: `${file.progress}%` }} />
                  </div>
                )}
                {file.status === 'error' && file.error && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{file.error}</p>
                )}
              </div>

              {file.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
              {file.status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-acid-600 dark:text-acid-400" />}
              {file.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}

              <button
                onClick={() => onRemoveUploadProgress?.(file.id)}
                className="tgo-icon-btn h-8 w-8"
                aria-label={t('common.remove', 'Remove')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
