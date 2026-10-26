import { useContext } from 'react';
import { ToastContext } from '@/components/ui/ToastContainer';

/**
 * Toast hook for showing Toast notifications in components
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastContainer');
  }

  const { showToast } = context;

  return {
    showToast,
    showSuccess: (title: string, message?: string, duration?: number) => 
      showToast('success', title, message, duration),
    showError: (title: string, message?: string, duration?: number) => 
      showToast('error', title, message, duration),
    showWarning: (title: string, message?: string, duration?: number) => 
      showToast('warning', title, message, duration),
    showInfo: (title: string, message?: string, duration?: number) => 
      showToast('info', title, message, duration),
  };
};
