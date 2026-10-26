/**
 * Toast Helper Functions
 * Provides convenience functions for common toast scenarios using the UI component system
 */

import { ToastType } from '@/components/ui/Toast';

import i18n from '@/i18n';
// Type for the toast function from useToast hook
export type ShowToastFunction = (type: ToastType, title: string, message?: string, duration?: number) => void;

/**
 * Show API error with appropriate message
 */
export const showApiError = (showToast: ShowToastFunction, error: unknown): void => {
  let title = i18n.t('toast.operationFailed', 'Operation failed');
  let message = i18n.t('toast.tryAgainLater', 'Please try again later');
  
  if (error instanceof Error) {
    title = i18n.t('toast.operationFailed', 'Operation failed');
    message = error.message;
    
    // Handle authentication errors specially
    if (message.includes('Authentication failed') || message.includes('401')) {
      title = i18n.t('toast.authFailed', 'Authentication failed');
      message = i18n.t('toast.loginAgain', 'Please log in again and retry');
      // Show error with longer duration for auth issues
      showToast('error', title, message, 8000);
      return;
    }
    
    // Handle specific error types
    if (message.includes('Network connection failed') || message.includes('Network')) {
      title = i18n.t('toast.networkError', 'Network error');
      message = i18n.t('toast.checkNetwork', 'Please check your network connection and try again');
    } else if (message.includes('Insufficient permissions') || message.includes('403')) {
      title = i18n.t('toast.permissionDenied', 'Insufficient permissions');
      message = i18n.t('toast.cannotPerform', 'Unable to perform this action');
    } else if (message.includes('too large') || message.includes('413')) {
      title = i18n.t('toast.fileTooLarge', 'File too large');
      message = i18n.t('toast.chooseSmallerFile', 'Please choose a smaller file');
    } else if (message.includes('Unsupported file type') || message.includes('415')) {
      title = i18n.t('toast.fileTypeError', 'File type error');
      message = i18n.t('errors.unsupportedFileType', 'Unsupported file type');
    } else if (message.includes('Server') || message.includes('server') || message.includes('500')) {
      title = i18n.t('toast.serverError', 'Server error');
      message = i18n.t('toast.serviceUnavailable', 'The service is temporarily unavailable, please try again later');
    }
  }
  
  showToast('error', title, message);
};

/**
 * Show network error
 */
export const showNetworkError = (showToast: ShowToastFunction): void => {
  showToast('error', i18n.t('toast.networkError', 'Network error'), i18n.t('errors.networkFailed', 'Network connection failed, please check your network and try again'));
};

/**
 * Show success message
 */
export const showSuccess = (showToast: ShowToastFunction, message: string, details?: string): void => {
  showToast('success', message, details);
};

/**
 * Show warning message
 */
export const showWarning = (showToast: ShowToastFunction, message: string, details?: string): void => {
  showToast('warning', message, details);
};

/**
 * Show info message
 */
export const showInfo = (showToast: ShowToastFunction, message: string, details?: string): void => {
  showToast('info', message, details);
};

/**
 * Show authentication error with special handling
 */
export const showAuthError = (showToast: ShowToastFunction, message?: string): void => {
  const title = i18n.t('toast.authFailed', 'Authentication failed');
  const authMessage = message || i18n.t('toast.loginAgain', 'Please log in again and retry');
  showToast('error', title, authMessage, 8000);
  
  // Log for potential redirect logic
  console.log('Authentication required - redirect to login if needed');
};

/**
 * Show file operation success
 */
export const showFileSuccess = (showToast: ShowToastFunction, operation: string, fileName: string): void => {
  const messages = {
    upload: i18n.t('toast.file.uploadSuccess', 'Upload successful'),
    delete: i18n.t('toast.file.deleteSuccess', 'Deleted successfully'),
    download: i18n.t('toast.file.downloadDone', 'Download complete'),
  };
  
  const title = messages[operation as keyof typeof messages] || i18n.t('toast.operationSuccess', 'Operation successful');
  showToast('success', title, i18n.t('toast.file.detail', { fileName, title, defaultValue: 'File "{{fileName}}": {{title}}' }));
};

/**
 * Show file operation error
 */
export const showFileError = (showToast: ShowToastFunction, operation: string, fileName: string, error?: unknown): void => {
  const messages = {
    upload: i18n.t('toast.file.uploadFailed', 'Upload failed'),
    delete: i18n.t('toast.file.deleteFailed', 'Delete failed'),
    download: i18n.t('toast.file.downloadFailed', 'Download failed'),
  };
  
  const title = messages[operation as keyof typeof messages] || i18n.t('toast.operationFailed', 'Operation failed');
  let message = i18n.t('toast.file.detail', { fileName, title, defaultValue: 'File "{{fileName}}": {{title}}' });
  
  if (error instanceof Error) {
    message += `：${error.message}`;
  }
  
  showToast('error', title, message);
};

/**
 * Show knowledge base operation success
 */
export const showKnowledgeBaseSuccess = (showToast: ShowToastFunction, operation: string, name?: string): void => {
  const messages = {
    create: i18n.t('toast.kb.createSuccess', 'Created successfully'),
    update: i18n.t('toast.kb.updateSuccess', 'Updated successfully'),
    delete: i18n.t('toast.kb.deleteSuccess', 'Deleted successfully'),
  };
  
  const title = messages[operation as keyof typeof messages] || i18n.t('toast.operationSuccess', 'Operation successful');
  const message = name ? i18n.t('toast.kb.detailNamed', { name, title, defaultValue: 'Knowledge base "{{name}}": {{title}}' }) : i18n.t('toast.kb.detail', { title, defaultValue: 'Knowledge base: {{title}}' });
  showToast('success', title, message);
};

/**
 * Show knowledge base operation error
 */
export const showKnowledgeBaseError = (showToast: ShowToastFunction, operation: string, error?: unknown, name?: string): void => {
  const messages = {
    create: i18n.t('toast.kb.createFailed', 'Creation failed'),
    update: i18n.t('toast.kb.updateFailed', 'Update failed'),
    delete: i18n.t('toast.kb.deleteFailed', 'Delete failed'),
    load: i18n.t('toast.kb.loadFailed', 'Load failed'),
  };
  
  const title = messages[operation as keyof typeof messages] || i18n.t('toast.operationFailed', 'Operation failed');
  let message = name ? i18n.t('toast.kb.detailNamed', { name, title, defaultValue: 'Knowledge base "{{name}}": {{title}}' }) : i18n.t('toast.kb.detail', { title, defaultValue: 'Knowledge base: {{title}}' });
  
  if (error instanceof Error) {
    message += `：${error.message}`;
  }
  
  showToast('error', title, message);
};
