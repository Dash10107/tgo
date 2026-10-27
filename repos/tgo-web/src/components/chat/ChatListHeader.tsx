import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import SearchPanel from '@/components/chat/SearchPanel';

export interface ChatListHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** Number of conversations currently listed */
  count?: number;
}

const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Chat list header: section title, conversation count and the global search trigger.
 * Search opens the full SearchPanel (also reachable with Ctrl/⌘ + K).
 */
export const ChatListHeader: React.FC<ChatListHeaderProps> = React.memo(({ count }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useTranslation();

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Ctrl/⌘ + K opens search from anywhere on the chat page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="tgo-display text-[32px] text-gray-900 dark:text-white">
          {t('chat.list.title', 'Inbox')}
        </h2>
        {typeof count === 'number' && (
          <span className="tgo-count mb-0.5">
            <b key={count} className="tgo-pop tabular-nums">{count}</b>
            {t('chat.list.countLabel', 'chats')}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={openSearch}
        aria-label={t('chat.list.searchAria', 'Search conversations')}
        className="group mt-4 flex h-10 w-full items-center gap-2.5 rounded-full bg-gray-100 pl-3.5 pr-2 text-left text-sm text-gray-400 ring-1 ring-transparent transition-all duration-200 hover:bg-white hover:ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-800/70 dark:hover:ring-gray-700"
      >
        <Icon name="Search" size={16} className="h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-700 dark:group-hover:text-gray-200" />
        <span className="flex-1 truncate">{t('chat.list.searchPlaceholder', 'Search')}</span>
        <kbd className="rounded-full bg-white px-2 py-0.5 font-sans text-[10.5px] font-medium text-gray-500 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700">
          {isMacPlatform ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {searchOpen && <SearchPanel open={searchOpen} onClose={closeSearch} />}
    </div>
  );
});

ChatListHeader.displayName = 'ChatListHeader';
