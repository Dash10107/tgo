import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, ChevronUp } from 'lucide-react';

/**
 * Props for the LoadingStates component
 */
export interface LoadingStatesProps {
  /** Whether initial history is loading */
  isLoadingHistory: boolean;
  /** Whether more messages are being loaded */
  isLoadingMore: boolean;
  /** Error message if loading failed */
  historyError: string | null;
  /** Whether there are more messages to load */
  hasMoreHistory: boolean;
  /** Whether there are any messages */
  hasMessages: boolean;
  /** Callback to load more messages */
  onLoadMore: () => void;
  /** Callback to retry loading */
  onRetry: () => void;
}

/**
 * Component for displaying various loading states in the chat
 * Memoized to prevent unnecessary re-renders
 */
const LoadingStates: React.FC<LoadingStatesProps> = React.memo(({
  isLoadingHistory,
  isLoadingMore,
  historyError,
  hasMoreHistory,
  hasMessages,
  onLoadMore,
  onRetry
}) => {
  const { t } = useTranslation();

  // Load More Button
  if (hasMoreHistory && hasMessages) {
    return (
      <div className="flex justify-center pb-4">
        <button
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="tgo-pill h-8 px-3.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingMore ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ChevronUp className="w-4 h-4 mr-2" />
          )}
          {isLoadingMore 
            ? t('chat.history.loading', 'Loading historical messages...') 
            : t('chat.history.loadMore', 'Load more historical messages')
          }
        </button>
      </div>
    );
  }

  // Initial Loading State
  if (isLoadingHistory && !hasMessages) {
    return (
      <div className="space-y-5 py-2" role="status" aria-label={t('chat.history.loading', 'Loading historical messages...')}>
        {[
          { side: 'left', width: 'w-56' },
          { side: 'right', width: 'w-44' },
          { side: 'left', width: 'w-72' },
          { side: 'right', width: 'w-32' },
        ].map((row, i) => (
          <div key={i} className={`flex items-end gap-2 ${row.side === 'right' ? 'justify-end' : ''}`} style={{ opacity: 1 - i * 0.18 }}>
            {row.side === 'left' && <div className="tgo-skeleton h-8 w-8 shrink-0 rounded-full" />}
            <div className={`tgo-skeleton h-10 ${row.width} ${row.side === 'right' ? 'rounded-[20px] rounded-br-md' : 'rounded-[20px] rounded-bl-md'}`} />
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (historyError) {
    return (
      <div className="flex flex-col items-center justify-center h-32">
        <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">{historyError}</p>
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-ink-900 text-white text-sm font-medium rounded-full hover:bg-ink-700 active:scale-95 transition-all dark:bg-acid-400 dark:text-ink-900"
        >
          {t('chat.history.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return null;
});

LoadingStates.displayName = 'LoadingStates';

export default LoadingStates;
