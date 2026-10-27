import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon';

export interface ChatListEmptyProps { isSyncing: boolean; }

const SKELETON_ROWS = 6;

/**
 * Empty state when there are no conversations to show.
 * While syncing, renders shimmering placeholder rows instead.
 */
export const ChatListEmpty: React.FC<ChatListEmptyProps> = React.memo(({ isSyncing }) => {
  const { t } = useTranslation();

  if (isSyncing) {
    return (
      <div className="space-y-1" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-3" style={{ opacity: 1 - i * 0.13 }}>
            <div className="tgo-skeleton h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="tgo-skeleton h-3 w-2/3 rounded-full" />
              <div className="tgo-skeleton h-2.5 w-11/12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tgo-fade-up flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-acid-200/60 dark:bg-acid-400/10" />
        <span className="absolute inset-3 rounded-full bg-acid-300/70 dark:bg-acid-400/20" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
          <Icon name="MessageCircle" size={18} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('chat.sync.noConversations')}</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        {t('chat.list.emptyHint', 'New conversations will appear here the moment they arrive.')}
      </p>
    </div>
  );
});

ChatListEmpty.displayName = 'ChatListEmpty';
