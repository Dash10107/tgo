import React from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Confirm Dialog Component - Redesigned for Modern AI-Centric Style
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';
  
  const confirmButtonClass = isDanger
    ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none'
    : 'bg-ink-900 hover:bg-ink-700 shadow-gray-300 dark:bg-acid-400 dark:text-ink-900 dark:shadow-none';

  const iconBgClass = isDanger
    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50'
    : 'bg-acid-200 dark:bg-acid-400/15 text-ink-900 dark:text-acid-400 border-acid-300 dark:border-acid-400/30';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={!isLoading ? onCancel : undefined}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="px-8 pt-8 pb-0 flex items-start justify-between">
          <div className={`p-3 rounded-full border ${iconBgClass}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onCancel}
            className="tgo-icon-btn"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pt-6 pb-8">
          <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="tgo-pill flex-1 h-11 justify-center px-6 text-sm disabled:opacity-50"
            disabled={isLoading}
          >
            {cancelText || t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-[1.5] h-11 px-6 text-sm font-medium text-white rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${confirmButtonClass}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('common.processing', 'Processing...')}</span>
              </>
            ) : (
              confirmText || t('common.confirm', 'Confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
