import React, { useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ChatMessage, { type MessageGroupPosition } from './ChatMessage';
import LoadingStates from './LoadingStates';
import EmptyState from './EmptyState';
import { isSystemMessageType, type WuKongIMMessage, type Message } from '@/types';

// Constants
const SCROLL_THRESHOLD = 100; // Load more when within 100px of top
const SCROLL_POSITION_TOLERANCE = 50; // Tolerance for "at bottom" detection (increased for better UX)
const IS_DEVELOPMENT = import.meta.env.DEV; // Vite environment variable

/**
 * Props for the MessagesList component
 */
export interface MessagesListProps {
  /** Whether this is a WuKongIM chat */
  isWuKongIMChat: boolean;
  /** Historical messages from WuKongIM */
  historicalMessages: WuKongIMMessage[];
  /** Real-time messages from chat store */
  realtimeMessages: Message[];
  /** Whether initial history is loading */
  isLoadingHistory: boolean;
  /** Whether more messages are being loaded (top/older) */
  isLoadingMore: boolean;
  /** Error message if loading failed */
  historyError: string | null;
  /** Whether there are more messages to load (top/older) */
  hasMoreHistory: boolean;
  /** Whether there are more newer messages to load (bottom/newer) */
  hasMoreNewerHistory?: boolean;
  /** Whether more newer messages are being loaded (bottom/newer) */
  isLoadingMoreNewer?: boolean;
  /** Function to convert WuKongIM message to internal format */
  convertWuKongIMToMessage: (wkMessage: WuKongIMMessage) => Message;
  /** Callback to load more messages (top/older) */
  onLoadMore: () => Promise<void>;
  /** Callback to load newer messages (bottom/newer) */
  onLoadMoreNewer?: () => Promise<void>;
  /** Callback to retry loading */
  onRetry: () => void;
  /** Callback when suggestion is clicked */
  onSuggestionClick: (suggestion: string) => void;
  /** Target message sequence to scroll to and highlight */
  scrollToSeq?: number | null;
  /** Callback when the component finished scrolling/highlighting */
  onScrolledToSeq?: () => void;
  /** Callback for sending a message (used by the msg:// protocol in Widgets) */
  onSendMessage?: (message: string) => void;
}

/**
 * Component for displaying the messages list with infinite scroll
 * Memoized to prevent unnecessary re-renders
 */
const MessagesListComponent: React.FC<MessagesListProps> = ({
  isWuKongIMChat,
  historicalMessages,
  realtimeMessages,
  isLoadingHistory,
  isLoadingMore,
  historyError,
  hasMoreHistory,
  hasMoreNewerHistory,
  isLoadingMoreNewer,
  convertWuKongIMToMessage,
  onLoadMore,
  onLoadMoreNewer,
  onRetry,
  onSuggestionClick,
  scrollToSeq,
  onScrolledToSeq,
  onSendMessage
}) => {
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const highlightTimersRef = useRef<number[]>([]);

  // Memoize total message count to prevent unnecessary recalculations
  const totalMessageCount = useMemo(
    () => historicalMessages.length + realtimeMessages.length,
    [historicalMessages.length, realtimeMessages.length]
  );

  // Track initial load state for different scroll behaviors
  // Use refs instead of state to avoid triggering re-renders
  const isInitialLoadRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  // Track scroll position for preservation during load more
  const shouldPreserveScrollRef = useRef(false);
  const savedScrollHeightRef = useRef(0);

  // Track if user is at bottom (for auto-scroll on stream updates)
  const isUserAtBottomRef = useRef(true);

  // Handle scroll to a specific message sequence with highlight
  useEffect(() => {
    if (scrollToSeq == null) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    let attempts = 0;
    let cancelled = false;

    const tryLocate = () => {
      if (cancelled) return;
      const el = container.querySelector(`[data-message-seq="${scrollToSeq}"]`) as HTMLElement | null;
      if (!el) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(tryLocate, 80);
        } else {
          onScrolledToSeq?.();
        }
        return;
      }
      // Scroll and highlight
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('target-highlight');
      const timer = window.setTimeout(() => {
        el.classList.remove('target-highlight');
        onScrolledToSeq?.();
      }, 2600);
      highlightTimersRef.current.push(timer as unknown as number);
    };

    // Try after next paint to ensure nodes are mounted
    requestAnimationFrame(() => requestAnimationFrame(tryLocate));

    return () => {
      cancelled = true;
      highlightTimersRef.current.forEach(clearTimeout);
      highlightTimersRef.current = [];
    };
  }, [scrollToSeq, totalMessageCount, onScrolledToSeq]);

  // Memoize combined messages to prevent unnecessary re-renders
  // NOTE: We intentionally do NOT include convertWuKongIMToMessage in dependencies
  // because it's not stable and would cause infinite loops. The function itself
  // doesn't change behavior, only its reference changes.
  const combinedMessages = useMemo(() => {
    const historical = historicalMessages.map((wkMessage) => ({
      key: `historical-${wkMessage.message_id_str}`,
      message: convertWuKongIMToMessage(wkMessage),
      isHistorical: true,
      messageIdStr: wkMessage.message_id_str,
      clientMsgNo: wkMessage.client_msg_no,
    }));

    // Build a Set of message identifiers from historical messages for deduplication
    const historicalIds = new Set<string>();
    historical.forEach(item => {
      if (item.messageIdStr) historicalIds.add(item.messageIdStr);
      if (item.clientMsgNo) historicalIds.add(item.clientMsgNo);
    });

    // Filter out realtime messages that already exist in historical messages
    const realtime = realtimeMessages
      .filter((message) => {
        // Check by messageId (string form) or clientMsgNo
        const msgIdStr = message.messageId || message.id;
        const clientNo = message.clientMsgNo;
        
        // If either identifier matches historical, skip this realtime message
        if (msgIdStr && historicalIds.has(msgIdStr)) return false;
        if (clientNo && historicalIds.has(clientNo)) return false;
        
        return true;
      })
      .map((message) => ({
        key: `realtime-${message.id}`,
        message,
        isHistorical: false,
        messageIdStr: message.messageId || message.id,
        clientMsgNo: message.clientMsgNo,
      }));

    return [...historical, ...realtime];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalMessages, realtimeMessages]);

  // Per-message layout: time separators (5+ minute gaps) and sender runs for bubble grouping
  const messageLayout = useMemo(() => {
    const TIME_GAP_THRESHOLD = 300; // 5 minutes in seconds
    const GROUP_GAP_THRESHOLD = 120; // consecutive messages within 2 minutes stack together
    const toSeconds = (timestamp: Message['timestamp'] | number | undefined): number => {
      if (!timestamp) return 0;
      return typeof timestamp === 'string' ? new Date(timestamp).getTime() / 1000 : timestamp;
    };
    const isSystem = (message: Message): boolean => {
      const payloadType = (message.payload as { type?: number } | undefined)?.type ?? message.payloadType;
      return message.type === 'system' || (typeof payloadType === 'number' && isSystemMessageType(payloadType));
    };
    const formatSeparator = (seconds: number): string => {
      const date = new Date(seconds * 1000);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
      const timeString = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

      if (diffDays === 0) return `${t('chat.history.today', 'Today')} · ${timeString}`;
      if (diffDays === 1) return `${t('chat.history.yesterday', 'Yesterday')} · ${timeString}`;
      if (diffDays < 7) {
        const weekdays = [
          t('chat.history.weekday.sunday', 'Sunday'),
          t('chat.history.weekday.monday', 'Monday'),
          t('chat.history.weekday.tuesday', 'Tuesday'),
          t('chat.history.weekday.wednesday', 'Wednesday'),
          t('chat.history.weekday.thursday', 'Thursday'),
          t('chat.history.weekday.friday', 'Friday'),
          t('chat.history.weekday.saturday', 'Saturday'),
        ];
        return `${weekdays[date.getDay()]} · ${timeString}`;
      }
      return `${date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })} · ${timeString}`;
    };

    const items = combinedMessages.map(({ message }, index) => {
      const seconds = toSeconds(message.timestamp);
      const prevSeconds = index > 0 ? toSeconds(combinedMessages[index - 1].message.timestamp) : 0;
      const showSeparator = index === 0 || seconds - prevSeconds >= TIME_GAP_THRESHOLD;
      return {
        seconds,
        system: isSystem(message),
        separatorText: showSeparator && seconds > 0 ? formatSeparator(seconds) : '',
      };
    });

    // A message continues the previous run when the sender matches, it is close in time and no separator splits them
    const continuesRun = (index: number): boolean => {
      if (index <= 0 || index >= items.length) return false;
      const cur = items[index];
      const prev = items[index - 1];
      if (cur.separatorText || cur.system || prev.system) return false;
      const curFrom = combinedMessages[index].message.fromUid;
      const prevFrom = combinedMessages[index - 1].message.fromUid;
      return Boolean(curFrom) && curFrom === prevFrom && cur.seconds - prev.seconds < GROUP_GAP_THRESHOLD;
    };

    return items.map((item, index) => {
      const joinsPrev = continuesRun(index);
      const joinsNext = continuesRun(index + 1);
      const groupPosition: MessageGroupPosition = joinsPrev
        ? (joinsNext ? 'middle' : 'last')
        : (joinsNext ? 'first' : 'single');
      return { separatorText: item.separatorText, groupPosition };
    });
  }, [combinedMessages, i18n.language, t]);

  // Reset initial load state when conversation changes (no messages to some messages)
  useEffect(() => {
    if (totalMessageCount === 0) {
      isInitialLoadRef.current = true;
      previousMessageCountRef.current = 0;
      if (IS_DEVELOPMENT) {
        console.log('📝 MessagesList: Reset initial load state (no messages)');
      }
    }
  }, [totalMessageCount]);

  // Optimize scroll behavior with useCallback to prevent recreation
  const scrollToBottom = useCallback((smooth = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (smooth) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }

    // After scrolling to bottom, mark user as at bottom
    isUserAtBottomRef.current = true;

    if (IS_DEVELOPMENT) {
      console.log('📜 MessagesList: Scrolled to bottom', {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        smooth
      });
    }
  }, []);

  // Optimize scroll preservation logic
  const preserveScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || savedScrollHeightRef.current <= 0) return;

    const newScrollHeight = container.scrollHeight;
    const scrollDifference = newScrollHeight - savedScrollHeightRef.current;
    container.scrollTop = container.scrollTop + scrollDifference;

    if (IS_DEVELOPMENT) {
      console.log('📜 MessagesList: Preserved scroll position', {
        savedScrollHeight: savedScrollHeightRef.current,
        newScrollHeight,
        scrollDifference,
        newScrollTop: container.scrollTop
      });
    }

    shouldPreserveScrollRef.current = false;
    savedScrollHeightRef.current = 0;
  }, []); // No dependencies needed since we use refs

  // Auto-scroll to bottom with different behaviors for initial load vs new messages
  useEffect(() => {
    if (!messagesEndRef.current || isLoadingMore || totalMessageCount === 0) return;

    const previousCount = previousMessageCountRef.current;
    const isInitialLoad = isInitialLoadRef.current;
    const shouldPreserveScroll = shouldPreserveScrollRef.current;

    const isNewMessage = totalMessageCount > previousCount && previousCount > 0;
    const isLoadMoreScenario = shouldPreserveScroll && previousCount > 0;

    if (IS_DEVELOPMENT) {
      console.log('📜 MessagesList: Auto-scroll triggered', {
        totalMessageCount,
        previousMessageCount: previousCount,
        isInitialLoad,
        isNewMessage,
        isLoadingMore,
        shouldPreserveScroll,
        isLoadMoreScenario
      });
    }

    // Handle different scroll scenarios:
    if (isLoadMoreScenario) {
      preserveScrollPosition();
    } else if (isInitialLoad || (isNewMessage && isUserAtBottomRef.current)) {
      // Use requestAnimationFrame to ensure DOM is fully rendered before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(!isInitialLoad); // Smooth scroll for new messages, instant for initial
          if (isInitialLoad) {
            isInitialLoadRef.current = false;
          }
        });
      });
    }

    previousMessageCountRef.current = totalMessageCount;
  }, [totalMessageCount, isLoadingMore, scrollToBottom, preserveScrollPosition]);

  // Auto-scroll on stream message updates (content changes without message count change)
  // This handles AI streaming where content is appended to existing messages
  // NOTE: We rely on the 'chat:stream-update' event instead of watching realtimeMessages
  // to avoid infinite loops caused by array reference changes

  // Listen for explicit stream update events dispatched by the WebSocket layer
  useEffect(() => {
    const handleStreamUpdate = () => {
      if (!messagesContainerRef.current || !isUserAtBottomRef.current) return;
      scrollToBottom(false);
      isUserAtBottomRef.current = true;
    };

    window.addEventListener('chat:stream-update', handleStreamUpdate as EventListener);
    return () => {
      window.removeEventListener('chat:stream-update', handleStreamUpdate as EventListener);
    };
  }, [scrollToBottom]);

  // Listen for message sent events (e.g., from Widget msg:// actions)
  // Always scroll to bottom when user sends a message
  useEffect(() => {
    const handleMessageSent = () => {
      if (!messagesContainerRef.current) return;
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        scrollToBottom(true); // Smooth scroll
        isUserAtBottomRef.current = true;
      });
    };

    window.addEventListener('chat:message-sent', handleMessageSent as EventListener);
    return () => {
      window.removeEventListener('chat:message-sent', handleMessageSent as EventListener);
    };
  }, [scrollToBottom]);

  // Additional failsafe: ensure scroll to bottom on initial load using useLayoutEffect
  // This runs synchronously after all DOM mutations but before browser paint
  useLayoutEffect(() => {
    if (isInitialLoadRef.current && totalMessageCount > 0 && messagesContainerRef.current && !isLoadingMore) {
      const container = messagesContainerRef.current;
      // Force scroll to bottom immediately
      container.scrollTop = container.scrollHeight;
      // Mark user as at bottom after initial scroll
      isUserAtBottomRef.current = true;

      if (IS_DEVELOPMENT) {
        const isAtBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - SCROLL_POSITION_TOLERANCE;
        console.log('📜 MessagesList: Failsafe scroll to bottom (useLayoutEffect)', {
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          isAtBottom
        });
      }
    }
  }, [totalMessageCount, isLoadingMore]);

  // Handle scroll for infinite loading - optimized with throttling prevention
  const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // Check if user is at bottom (for auto-scroll on stream updates)
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= SCROLL_POSITION_TOLERANCE;
    isUserAtBottomRef.current = atBottom;

    // Calculate distance from top
    const distanceFromTop = scrollTop;
    const shouldLoadMore = (
      distanceFromTop <= SCROLL_THRESHOLD &&
      hasMoreHistory &&
      !isLoadingHistory &&
      !isLoadingMore &&
      !shouldPreserveScrollRef.current // Prevent triggering during scroll preservation
    );

    // if (IS_DEVELOPMENT) {
    //   console.log('📜 MessagesList: Scroll event', {
    //     scrollTop,
    //     scrollHeight,
    //     clientHeight,
    //     distanceFromTop,
    //     threshold: SCROLL_THRESHOLD,
    //     hasMoreHistory,
    //     isLoadingHistory,
    //     isLoadingMore,
    //     shouldLoadMore
    //   });
    // }

    // Trigger load more when scrolled near the top
    if (shouldLoadMore) {
      if (IS_DEVELOPMENT) {
        console.log('📜 MessagesList: Triggering load more messages');
      }

      // Save current scroll position before loading more
      shouldPreserveScrollRef.current = true;
      savedScrollHeightRef.current = scrollHeight;

      try {
        await onLoadMore();
      } catch (error) {
        console.error('📜 MessagesList: Failed to load more messages:', error);
        // Reset preservation flags on error
        shouldPreserveScrollRef.current = false;
        savedScrollHeightRef.current = 0;
      }
    }

    // Trigger load newer when scrolled near the bottom
    const shouldLoadMoreNewer = (
      distanceFromBottom <= SCROLL_THRESHOLD &&
      !!hasMoreNewerHistory &&
      !isLoadingHistory &&
      !isLoadingMore &&
      !isLoadingMoreNewer
    );

    if (shouldLoadMoreNewer && onLoadMoreNewer) {
      try {
        await onLoadMoreNewer();
      } catch (error) {
        console.error('📜 MessagesList: Failed to load newer messages:', error);
      }
    }
  }, [hasMoreHistory, hasMoreNewerHistory, isLoadingHistory, isLoadingMore, isLoadingMoreNewer, onLoadMore, onLoadMoreNewer]);
  if (isWuKongIMChat) {
    return (
      <div
        className="h-full overflow-y-auto px-4 pb-8 pt-4 md:px-8"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        <div className="mx-auto w-full max-w-[920px]">
        {/* Local highlight animation styles */}
        <style>{`
          @keyframes targetFlash { from { background-color: rgba(205, 238, 85, 0.55); } to { background-color: transparent; } }
          .target-highlight { animation: targetFlash 2.6s ease-out forwards; border-radius: 1.5rem; box-shadow: inset 0 0 0 1px rgba(143, 179, 30, 0.45); }
        `}</style>
        {/* Load More Button */}
        <LoadingStates
          isLoadingHistory={isLoadingHistory}
          isLoadingMore={isLoadingMore}
          historyError={historyError}
          hasMoreHistory={hasMoreHistory}
          hasMessages={historicalMessages.length > 0}
          onLoadMore={onLoadMore}
          onRetry={onRetry}
        />

        {/* Empty State */}
        {!isLoadingHistory && !historyError && totalMessageCount === 0 ? (
          <EmptyState type="no-messages" />
        ) : totalMessageCount > 0 ? (
          /* Combined Messages: Historical + Real-time */
          <>
            {/* Render Combined Messages with Time Separators and sender runs */}
            {combinedMessages.map(({ key, message }, index) => {
              const { separatorText, groupPosition } = messageLayout[index];
              const continuesRun = groupPosition === 'middle' || groupPosition === 'last';
              return (
                <React.Fragment key={key}>
                  {separatorText && (
                    <div className="flex items-center gap-4 pb-2 pt-8 first:pt-2" role="separator">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200 dark:to-gray-800" />
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[11px] font-medium tabular-nums text-gray-500 shadow-sm ring-1 ring-gray-100 backdrop-blur dark:bg-gray-900/90 dark:text-gray-400 dark:ring-gray-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-acid-500" />
                        {separatorText}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200 dark:to-gray-800" />
                    </div>
                  )}
                  <div data-message-seq={message.messageSeq ?? undefined} className={continuesRun ? 'pt-1' : 'pt-5'}>
                    <ChatMessage
                      message={message}
                      groupPosition={groupPosition}
                      onSuggestionClick={onSuggestionClick}
                      onSendMessage={onSendMessage}
                    />
                  </div>
                </React.Fragment>
              );
            })}

            {isLoadingMoreNewer ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400 dark:text-gray-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid-500" />
                {t('chat.history.loadingNewer', 'Loading...')}
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </>
        ) : null}
        </div>
      </div>
    );
  }

  // No fallback mock messages; show empty state for non-WuKongIM chats
  return (
    <EmptyState type="no-messages" />
  );
};


// Custom comparison function for React.memo to help debug re-renders
// This will log which props changed and caused a re-render
const arePropsEqual = (prevProps: MessagesListProps, nextProps: MessagesListProps): boolean => {
  const changes: string[] = [];

  if (prevProps.isWuKongIMChat !== nextProps.isWuKongIMChat) changes.push('isWuKongIMChat');
  if (prevProps.historicalMessages !== nextProps.historicalMessages) changes.push('historicalMessages');
  if (prevProps.realtimeMessages !== nextProps.realtimeMessages) changes.push('realtimeMessages');
  if (prevProps.isLoadingHistory !== nextProps.isLoadingHistory) changes.push('isLoadingHistory');
  if (prevProps.isLoadingMore !== nextProps.isLoadingMore) changes.push('isLoadingMore');
  if (prevProps.historyError !== nextProps.historyError) changes.push('historyError');
  if (prevProps.hasMoreHistory !== nextProps.hasMoreHistory) changes.push('hasMoreHistory');
  if (prevProps.hasMoreNewerHistory !== nextProps.hasMoreNewerHistory) changes.push('hasMoreNewerHistory');
  if (prevProps.isLoadingMoreNewer !== nextProps.isLoadingMoreNewer) changes.push('isLoadingMoreNewer');
  if (prevProps.convertWuKongIMToMessage !== nextProps.convertWuKongIMToMessage) changes.push('convertWuKongIMToMessage');
  if (prevProps.onLoadMore !== nextProps.onLoadMore) changes.push('onLoadMore');
  if (prevProps.onLoadMoreNewer !== nextProps.onLoadMoreNewer) changes.push('onLoadMoreNewer');
  if (prevProps.onRetry !== nextProps.onRetry) changes.push('onRetry');
  if (prevProps.onSuggestionClick !== nextProps.onSuggestionClick) changes.push('onSuggestionClick');
  if (prevProps.scrollToSeq !== nextProps.scrollToSeq) changes.push('scrollToSeq');
  if (prevProps.onSendMessage !== nextProps.onSendMessage) changes.push('onSendMessage');

  // Skip re-render when no observable prop changed (shallow reference equality)
  return changes.length === 0;
};

// Wrap component with React.memo and custom comparison function
const MessagesList = React.memo(MessagesListComponent, arePropsEqual);
MessagesList.displayName = 'MessagesList';

export default MessagesList;
