import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

/**
 * Toast notification component
 */
const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [id, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'info':
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'bg-acid-400 text-ink-900';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-amber-400 text-ink-900';
      case 'info':
      default:
        return 'bg-white/15 text-white';
    }
  };

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className="tgo-toast relative min-w-80 max-w-md w-auto overflow-hidden rounded-[20px] bg-ink-900 p-3 pr-2 text-white shadow-[0_20px_44px_-18px_rgba(15,16,18,0.75)] ring-1 ring-white/10 dark:bg-gray-800"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${getIconColor()}`}>
          {getIcon()}
        </span>
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="truncate text-sm font-medium">{title}</p>
          {message && (
            <p className="mt-1 break-words text-[13px] leading-relaxed text-white/60">{message}</p>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          aria-label="Close"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {duration > 0 && (
        <span
          aria-hidden="true"
          className="tgo-toast-timer absolute bottom-0 left-0 h-0.5 w-full origin-left bg-acid-400/70"
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
};

export default Toast;
