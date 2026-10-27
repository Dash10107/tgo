import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MessagePayloadType, type Chat } from '@/types';
import { useChatStore, chatSelectors, useUIStore, useConversationStore } from '@/stores';
import { useSyncStore } from '@/stores/syncStore';
import { useChannelStore } from '@/stores/channelStore';
import { conversationsApi } from '@/services/conversationsApi';
import { tagsApiService, type TagResponse } from '@/services/tagsApi';
import { wukongimWebSocketService } from '@/services/wukongimWebSocket';
import { getChannelKey } from '@/utils/channelUtils';
import { ChatListHeader } from '@/components/chat/ChatListHeader';
import { ChatListEmpty } from '@/components/chat/ChatListEmpty';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { UnassignedChatListItem } from '@/components/chat/UnassignedChatListItem';
import { OnlineVisitorListItem } from '@/components/chat/OnlineVisitorListItem';
import { ChatListTabs, ChatTabType } from '@/components/chat/ChatListTabs';
import OnboardingSidebarPanel from '@/components/onboarding/OnboardingSidebarPanel';
import { visitorApiService, type VisitorResponse } from '@/services/visitorApi';
import { CHAT_PRIORITY, CHAT_STATUS, VISITOR_STATUS } from '@/constants';
import { useToast } from '@/hooks/useToast';
import { showApiError } from '@/utils/toastHelpers';
import { PlatformType } from '@/types';
import type { ChannelVisitorExtra, ChannelInfo, InboxSummary } from '@/types';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Props for the ChatList component
 */
interface ChatListProps {
  /** Currently active chat */
  activeChat?: Chat;
  /** Callback when a chat is selected */
  onChatSelect: (chat: Chat) => void;
  /** Active tab (controlled by parent if provided) */
  activeTab?: ChatTabType;
  /** Callback when tab changes */
  onTabChange?: (tab: ChatTabType) => void;
  /** Trigger to refresh lists (increment to trigger refresh) */
  refreshTrigger?: number;
  /** Channel info of the deleted chat (to remove from local state) */
  deletedChatChannel?: { channelId: string; channelType: number } | null;
  /** Reports inbox totals whenever they change (used by the workspace overview) */
  onSummaryChange?: (summary: InboxSummary) => void;
}

/**
 * Custom hook for managing chat list filtering with search
 */
const useSearchFiltering = (chats: Chat[], searchQuery: string) => {
  return useMemo(() => {
    if (!searchQuery.trim()) return chats;
    
    const lowerQuery = searchQuery.toLowerCase();
    return chats.filter((chat: Chat) => {
      const baseId = chat.channelId || chat.id;
      const name = (chat.channelInfo?.name || `Visitor ${String(baseId).slice(-4)}`).toLowerCase();
      return name.includes(lowerQuery) || chat.lastMessage.toLowerCase().includes(lowerQuery);
    });
  }, [chats, searchQuery]);
};

/**
 * Sort chats by timestamp (desc)
 */
const sortChatsByTimestamp = (chats: Chat[]): Chat[] => {
  return [...chats].sort((a, b) => {
    const aSec = a.lastTimestampSec ?? (a.timestamp ? Math.floor(new Date(a.timestamp).getTime() / 1000) : 0);
    const bSec = b.lastTimestampSec ?? (b.timestamp ? Math.floor(new Date(b.timestamp).getTime() / 1000) : 0);
    return bSec - aSec;
  });
};

import { normalizeTagHex, hexToRgba } from '@/utils/tagUtils';

type StoredVisitorTag = {
  id: string;
  display_name?: string;
  name?: string;
  color?: string | null;
};

/**
 * Chat list sidebar component
 * Displays a list of conversations with search and sync functionality
 *
 * Features:
 * - Tab filtering (Mine, Unassigned, All) - each tab has its own data source
 * - "Mine": /conversations/my + conversations created by new messages
 * - "Unassigned": /conversations/waiting
 * - "All": /conversations/all
 * - Search filtering by visitor name or last message
 * - Real-time sync with WuKongIM
 * - Empty state when no conversations exist
 * - Optimized rendering with memoized sub-components
 */
const ChatListComponent: React.FC<ChatListProps> = ({ 
  activeChat, 
  onChatSelect,
  activeTab: controlledActiveTab,
  onTabChange: controlledOnTabChange,
  refreshTrigger,
  deletedChatChannel,
  onSummaryChange,
}) => {
  const { t } = useTranslation();
  
  // Store subscriptions - chats stores conversations created by new messages
  const realtimeChats = useChatStore(chatSelectors.chats) ?? [];
  const searchQuery = useChatStore(chatSelectors.searchQuery) ?? '';
  const setSearchQuery = useChatStore(state => state.setSearchQuery);
  
  // Get convertWuKongIMToChat from syncStore
  const convertWuKongIMToChat = useSyncStore(state => state.convertWuKongIMToChat);
  
  // Get seedChannel from channelStore to cache channel info from API responses
  const seedChannel = useChannelStore(state => state.seedChannel);

  // Tag filter for the "Mine" tab
  const mineTagIds = useConversationStore(state => state.mineTagIds);
  const setMineTagIds = useConversationStore(state => state.setMineTagIds);
  const [mineTagMeta, setMineTagMeta] = useState<Record<string, StoredVisitorTag>>({});
  const [availableVisitorTags, setAvailableVisitorTags] = useState<TagResponse[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false); // Selection panel (opened by "+")
  const [isEditingMineTags, setIsEditingMineTags] = useState(false); // "-" enters edit/delete mode
  const tagFilterRef = useRef<HTMLDivElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [tagPickerPos, setTagPickerPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [tagSearch, setTagSearch] = useState('');

  // Whether initialization has completed
  const [mineTagInitialized] = useState(true);
  
  // When the tag filter is on but the async backfill of channel info (including tags) fails: retry a limited number of times to avoid wrongly entering the filter results or endless requests
  const [channelInfoRetryTick, setChannelInfoRetryTick] = useState(0);
  const channelInfoRetryCountRef = useRef<Record<string, number>>({});
  const channelInfoPendingRef = useRef<Set<string>>(new Set());
  // When the tag filter is on and a conversation's channel info finally fails to load: allow a "fallback display" in the list so conversations/messages don't appear to be lost
  // Once the tags are obtained later, the fallback mark is removed automatically and normal filtering resumes
  const [tagFilterBypassKeys, setTagFilterBypassKeys] = useState<Record<string, true>>({});

  // Connection status from uiStore
  const isConnected = useUIStore(state => state.isConnected);
  const isConnecting = useUIStore(state => state.isConnecting);

  // Local state for tabs (used when not controlled by parent)
  const [internalActiveTab, setInternalActiveTab] = useState<ChatTabType>('mine');
  
  // Use controlled tab if provided, otherwise use internal state
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = controlledOnTabChange ?? setInternalActiveTab;
  
  // Independent conversation list for each tab
  const [myChats, setMyChats] = useState<Chat[]>([]);
  const [unassignedChats, setUnassignedChats] = useState<Chat[]>([]);
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [manualChats, setManualChats] = useState<Chat[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<VisitorResponse[]>([]);
  
  // Loading state for each tab
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  
  // Loading more state for pagination
  const [isLoadingMoreUnassigned, setIsLoadingMoreUnassigned] = useState(false);
  const [isLoadingMoreAll, setIsLoadingMoreAll] = useState(false);
  const [isLoadingMoreManual, setIsLoadingMoreManual] = useState(false);
  const [isLoadingMoreRecent, setIsLoadingMoreRecent] = useState(false);
  
  // Has more data for pagination
  const [hasMoreUnassigned, setHasMoreUnassigned] = useState(false);
  const [hasMoreAll, setHasMoreAll] = useState(false);
  const [hasMoreManual, setHasMoreManual] = useState(false);
  const [hasMoreRecent, setHasMoreRecent] = useState(false);
  
  // Track which tabs have been loaded (to prevent duplicate requests on mount)
  const loadedTabsRef = useRef<Set<ChatTabType>>(new Set());
  
  // Scroll container ref for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Unassigned count (fetched from the API, updated by listening to the queue.updated event)
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  
  // Function to fetch the unassigned count
  const fetchUnassignedCount = useCallback(async () => {
    try {
      const response = await conversationsApi.getWaitingQueueCount();
      // The API may return { count: number } or { waiting: number }
      const count = response.waiting ?? 0;
      setUnassignedCount(count);
      console.log('📋 ChatList: Fetched unassigned count:', count, response);
    } catch (error) {
      console.error('📋 ChatList: Failed to fetch unassigned count:', error);
    }
  }, []);
  
  // Fetch once on init and listen for the queue.updated event
  useEffect(() => {
    // Fetch once immediately
    fetchUnassignedCount();
    
    // Listen for the queue.updated event
    const unsubscribe = wukongimWebSocketService.onQueueUpdated(() => {
      console.log('📋 ChatList: queue.updated event received, refreshing count');
      fetchUnassignedCount();
    });
    
    // Clean up the subscription
    return () => unsubscribe();
  }, [fetchUnassignedCount]);
  
  // Fetch the "Mine" conversations
  const fetchMyConversations = useCallback(async (force = false) => {
    if (!force && loadedTabsRef.current.has('mine')) return;
    loadedTabsRef.current.add('mine');
    
    setIsLoadingMine(true);
    try {
      const response = await conversationsApi.getMyConversations(1, {
        tag_ids: mineTagIds.length > 0 ? mineTagIds : undefined,
      });
      if (response?.conversations) {
        const chats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setMyChats(sortChatsByTimestamp(chats));
        console.log(`📋 ChatList: Loaded "mine" tab, ${chats.length} conversations`);
        
        // Cache the channel info to avoid separate requests later
        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
          console.log(`📋 ChatList: Cached ${response.channels.length} channels from "mine" tab`);
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load "mine" conversations:', error);
    } finally {
      setIsLoadingMine(false);
    }
  }, [convertWuKongIMToChat, seedChannel, mineTagIds]);

  // Load the selectable visitor tags (for the "Mine" tag filter)
  useEffect(() => {
    let mounted = true;
    if (!isTagFilterOpen) return; // Only request when the panel is open
    (async () => {
      setIsLoadingTags(true);
      try {
        const resp = await tagsApiService.listVisitorTags({ limit: 100, offset: 0 });
        if (!mounted) return;
        setAvailableVisitorTags(resp.data ?? []);

        // Fill in the display info of the selected tags (avoids missing names/colors because of pagination)
        if (resp.data && resp.data.length > 0) {
          setMineTagMeta((prev) => {
            const next = { ...prev };
            mineTagIds.forEach((id: string) => {
              const found = resp.data!.find((t) => t.id === id);
              if (found) {
                next[id] = {
                  id: found.id,
                  display_name: found.display_name,
                  name: found.name,
                  color: found.color ?? null,
                };
              }
            });
            return next;
          });
        }
      } catch (e) {
        // Fail silently: does not affect using the conversation list
        if (!mounted) return;
        setAvailableVisitorTags([]);
      } finally {
        if (mounted) setIsLoadingTags(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isTagFilterOpen]);

  // Close the tag filter panel when clicking outside
  useEffect(() => {
    if (!isTagFilterOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = tagFilterRef.current;
      const pickerEl = tagPickerRef.current;
      if (e.target && el && el.contains(e.target as Node)) return;
      if (e.target && pickerEl && pickerEl.contains(e.target as Node)) return;
      setIsTagFilterOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isTagFilterOpen]);

  // Compute the anchor position when opening the tag selection panel (Portal + fixed, to avoid being covered/clipped by the list)
  useEffect(() => {
    if (!isTagFilterOpen) return;

    const updatePos = () => {
      const btn = addButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = 260;
      const left = Math.max(50, Math.min(window.innerWidth - width - 8, rect.right - width)); // Right-align with the button
      const top = Math.min(window.innerHeight - 8, rect.bottom + 8);
      setTagPickerPos({ top, left, width });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    // Capture all scrolling (including list scrolling) so the position follows
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isTagFilterOpen]);

  // When the tag filter changes, force-refresh the "Mine" conversations (prevents loadedTabsRef from blocking the refresh)
  // Must wait until localStorage initialization completes before triggering, to avoid useless requests with an empty array
  useEffect(() => {
    if (!mineTagInitialized) return; // Wait for initialization to complete
    if (activeTab === 'mine') {
      loadedTabsRef.current.delete('mine');
      fetchMyConversations(true);
    }
  }, [mineTagInitialized, mineTagIds, activeTab, fetchMyConversations]);
  
  // Number of conversations per page
  const PAGE_SIZE = 20;
  
  // Fetch the "Unassigned" conversations (first load)
  const fetchUnassignedConversations = useCallback(async () => {
    setIsLoadingUnassigned(true);
    try {
      const response = await conversationsApi.getWaitingConversations(20, PAGE_SIZE, 0);
      if (response?.conversations) {
        const chats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setUnassignedChats(sortChatsByTimestamp(chats));
        setHasMoreUnassigned(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded "unassigned" tab, ${chats.length} conversations, hasMore: ${response.pagination?.has_next}`);
        
        // Cache the channel info to avoid separate requests later
        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
          console.log(`📋 ChatList: Cached ${response.channels.length} channels from "unassigned" tab`);
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load "unassigned" conversations:', error);
    } finally {
      setIsLoadingUnassigned(false);
    }
  }, [convertWuKongIMToChat, seedChannel]);
  
  // Load more "Unassigned" conversations
  const loadMoreUnassignedConversations = useCallback(async () => {
    if (isLoadingMoreUnassigned || !hasMoreUnassigned) return;
    
    setIsLoadingMoreUnassigned(true);
    try {
      const offset = unassignedChats.length;
      const response = await conversationsApi.getWaitingConversations(20, PAGE_SIZE, offset);
      if (response?.conversations) {
        const newChats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setUnassignedChats(prev => [...prev, ...newChats]);
        setHasMoreUnassigned(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded more "unassigned", +${newChats.length} conversations, hasMore: ${response.pagination?.has_next}`);
        
        // Cache the channel info
        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load more "unassigned" conversations:', error);
    } finally {
      setIsLoadingMoreUnassigned(false);
    }
  }, [isLoadingMoreUnassigned, hasMoreUnassigned, unassignedChats.length, convertWuKongIMToChat, seedChannel]);
  
  // Fetch the "Completed" conversations (called every time this tab is switched to)
  const fetchAllConversations = useCallback(async () => {
    setIsLoadingAll(true);
    try {
      const response = await conversationsApi.getAllConversations(20, PAGE_SIZE, 0, { only_completed_recent: true });
      if (response?.conversations) {
        const chats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setAllChats(sortChatsByTimestamp(chats));
        setHasMoreAll(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded "all" tab, ${chats.length} conversations, hasMore: ${response.pagination?.has_next}`);
        
        // Cache the channel info to avoid separate requests later
        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
          console.log(`📋 ChatList: Cached ${response.channels.length} channels from "all" tab`);
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load "all" conversations:', error);
    } finally {
      setIsLoadingAll(false);
    }
  }, [convertWuKongIMToChat, seedChannel]);
  
  // Load more "Completed" conversations
  const loadMoreAllConversations = useCallback(async () => {
    if (isLoadingMoreAll || !hasMoreAll) return;
    
    setIsLoadingMoreAll(true);
    try {
      const offset = allChats.length;
      const response = await conversationsApi.getAllConversations(20, PAGE_SIZE, offset, { only_completed_recent: true });
      if (response?.conversations) {
        const newChats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setAllChats(prev => [...prev, ...newChats]);
        setHasMoreAll(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded more "all", +${newChats.length} conversations, hasMore: ${response.pagination?.has_next}`);
        
        // Cache the channel info
        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load more "all" conversations:', error);
    } finally {
      setIsLoadingMoreAll(false);
    }
  }, [isLoadingMoreAll, hasMoreAll, allChats.length, convertWuKongIMToChat, seedChannel]);

  // Fetch the "Manual Service" conversations (filtered by visitor tag, manual_service_contain=true)
  const fetchManualConversations = useCallback(async () => {
    setIsLoadingManual(true);
    try {
      const response = await conversationsApi.getRecentConversationsByTagsRecent({
        manual_service_contain: true,
        msg_count: 20,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (response?.conversations) {
        const chats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setManualChats(sortChatsByTimestamp(chats));
        setHasMoreManual(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded "manual" tab, ${chats.length} conversations, hasMore: ${response.pagination?.has_next}`);

        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
          console.log(`📋 ChatList: Cached ${response.channels.length} channels from "manual" tab`);
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load "manual" conversations:', error);
    } finally {
      setIsLoadingManual(false);
    }
  }, [convertWuKongIMToChat, seedChannel]);

  const loadMoreManualConversations = useCallback(async () => {
    if (isLoadingMoreManual || !hasMoreManual) return;
    setIsLoadingMoreManual(true);
    try {
      const offset = manualChats.length;
      const response = await conversationsApi.getRecentConversationsByTagsRecent({
        manual_service_contain: true,
        msg_count: 20,
        limit: PAGE_SIZE,
        offset,
      });
      if (response?.conversations) {
        const newChats = response.conversations.map(conv => convertWuKongIMToChat(conv));
        setManualChats(prev => [...prev, ...newChats]);
        setHasMoreManual(response.pagination?.has_next ?? false);

        if (response.channels && response.channels.length > 0) {
          response.channels.forEach(channel => {
            if (channel.channel_id && channel.channel_type != null) {
              seedChannel(channel.channel_id, channel.channel_type, channel);
            }
          });
        }
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load more "manual" conversations:', error);
    } finally {
      setIsLoadingMoreManual(false);
    }
  }, [isLoadingMoreManual, hasMoreManual, manualChats.length, convertWuKongIMToChat, seedChannel]);

  // Fetch the "Recently online" visitors
  const fetchRecentVisitors = useCallback(async () => {
    setIsLoadingRecent(true);
    try {
      const response = await visitorApiService.listVisitors({
        service_status: ['new'],
        sort_by: 'last_offline_time',
        sort_order: 'desc',
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (response?.data) {
        setRecentVisitors(response.data);
        setHasMoreRecent(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded "recent" tab, ${response.data.length} visitors, hasMore: ${response.pagination?.has_next}`);
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load "recent" visitors:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  const loadMoreRecentVisitors = useCallback(async () => {
    if (isLoadingMoreRecent || !hasMoreRecent) return;
    setIsLoadingMoreRecent(true);
    try {
      const offset = recentVisitors.length;
      const response = await visitorApiService.listVisitors({
        service_status: ['new'],
        sort_by: 'last_offline_time',
        sort_order: 'desc',
        limit: PAGE_SIZE,
        offset,
      });
      if (response?.data) {
        setRecentVisitors(prev => [...prev, ...response.data]);
        setHasMoreRecent(response.pagination?.has_next ?? false);
        console.log(`📋 ChatList: Loaded more "recent", +${response.data.length} visitors, hasMore: ${response.pagination?.has_next}`);
      }
    } catch (error) {
      console.error('📋 ChatList: Failed to load more "recent" visitors:', error);
    } finally {
      setIsLoadingMoreRecent(false);
    }
  }, [isLoadingMoreRecent, hasMoreRecent, recentVisitors.length]);
  
  // Fetch the data for the current tab (on component mount and tab switch)
  // Note: the request for the 'mine' tab is handled by the tag filter effect, so it is not called separately here
  useEffect(() => {
    if (activeTab === 'unassigned') {
      fetchUnassignedConversations();
    } else if (activeTab === 'all') {
      fetchAllConversations();
    } else if (activeTab === 'manual') {
      fetchManualConversations();
    } else if (activeTab === 'recent') {
      fetchRecentVisitors();
    }
    // The 'mine' tab is not handled here; it is managed by the tag filter effect
  }, [activeTab, fetchUnassignedConversations, fetchAllConversations, fetchManualConversations]);
  
  // When refreshTrigger changes, force-refresh the "Mine" and "Unassigned" lists and counts
  const prevRefreshTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    // Only trigger when refreshTrigger changes (not on initial mount)
    if (refreshTrigger !== undefined && refreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger;
      console.log('📋 ChatList: refreshTrigger changed, refreshing lists');
      // Force-refresh the "Mine" conversations
      loadedTabsRef.current.delete('mine');
      fetchMyConversations(true);
      // Refresh the unassigned list and count
      fetchUnassignedConversations();
      fetchUnassignedCount();
    }
  }, [refreshTrigger, fetchMyConversations, fetchUnassignedConversations, fetchUnassignedCount]);
  
  // Track the deletedChatChannel processed last time to avoid duplicate handling
  const lastDeletedChannelRef = useRef<string | null>(null);
  
  // When deletedChatChannel changes, remove that conversation from local state and select the next one
  useEffect(() => {
    if (deletedChatChannel?.channelId && deletedChatChannel?.channelType != null) {
      const { channelId, channelType } = deletedChatChannel;
      const key = getChannelKey(channelId, channelType);
      
      // Avoid handling the same deletion twice
      if (lastDeletedChannelRef.current === key) {
        return;
      }
      lastDeletedChannelRef.current = key;
      
      console.log('📋 ChatList: Removing deleted chat from local state:', key);
      
      // Remove from local state (functional update, no dependency on external state)
      setMyChats(prev => {
        const remaining = prev.filter(c => !(c.channelId === channelId && c.channelType === channelType));
        
        // If the deleted one is the currently selected conversation, select the next one
        if (activeChat?.channelId === channelId && activeChat?.channelType === channelType && remaining.length > 0 && activeTab === 'mine') {
          const deletedIndex = prev.findIndex(c => c.channelId === channelId && c.channelType === channelType);
          const nextIndex = Math.min(deletedIndex, remaining.length - 1);
          const nextChat = remaining[Math.max(0, nextIndex)];
          console.log('📋 ChatList: Selecting next chat:', nextChat.channelId);
          // Use setTimeout to avoid calling inside a setState callback
          setTimeout(() => onChatSelect(nextChat), 0);
        }
        
        return remaining;
      });
      setAllChats(prev => prev.filter(c => !(c.channelId === channelId && c.channelType === channelType)));
    }
  }, [deletedChatChannel, activeChat, activeTab, onChatSelect]);
  
  // Merge the "Mine" conversations: those returned by the API + those created by new messages
  // Prefer the updated data in realtimeChats (including the latest lastMessage and unreadCount)
  // But only use it when the realtimeChats data is newer than the API's
  const mergedMyChats = useMemo(() => {
    const selectedTagIds = (mineTagIds ?? []).filter(Boolean);
    const selectedTagSet = new Set(selectedTagIds);
    const hasTagFilter = selectedTagSet.size > 0;

    const shouldBypassFilter = (chat: Chat): boolean => {
      if (!hasTagFilter) return false;
      if (!chat.channelId || chat.channelType == null) return false;
      const key = getChannelKey(chat.channelId, chat.channelType);
      return tagFilterBypassKeys[key] === true;
    };

    const extractChannelTagIds = (chat: Chat): string[] => {
      const extra: any = (chat.channelInfo as any)?.extra;
      const tags: any[] = Array.isArray(extra?.tags) ? extra.tags : [];
      const ids = tags
        .map((t) => (t?.id ?? t?.tag_id ?? t?.tagId ?? t?.value ?? null))
        .filter((x) => typeof x === 'string' && x.trim().length > 0)
        .map((x) => String(x));
      return ids;
    };

    const matchTagFilter = (chat: Chat): boolean => {
      if (!hasTagFilter) return true;
      // If the conversation is marked as "channel info fetch failed", show it as a fallback (so conversations/messages don't appear lost)
      if (shouldBypassFilter(chat)) return true;
      // Tags come from the channel info (async); do not show before the tags arrive, to avoid mixing non-matching visitors into the filter results
      const ids = extractChannelTagIds(chat);
      if (ids.length === 0) return false;
      return ids.some((id) => selectedTagSet.has(id));
    };

    // Build a key -> chat map of realtimeChats for fast lookup
    const realtimeChatMap = new Map<string, Chat>();
    realtimeChats.forEach(c => {
      const key = getChannelKey(c.channelId, c.channelType);
      realtimeChatMap.set(key, c);
    });
    
    // Merge the API conversations; if realtimeChats has an update (later timestamp or different content), use the updated data
    const mergedFromApi = myChats.map(apiChat => {
      const key = getChannelKey(apiChat.channelId, apiChat.channelType);
      const realtimeChat = realtimeChatMap.get(key);
      if (realtimeChat) {
        const apiTimestamp = apiChat.lastTimestampSec ?? 0;
        const realtimeTimestamp = realtimeChat.lastTimestampSec ?? 0;
        
        // Decide whether the realtime data is newer:
        // 1. The timestamp is later
        // 2. The timestamp is the same but the content differs (e.g. a streaming message incrementally updating the preview)
        const isNewer = realtimeTimestamp > apiTimestamp;
        const isContentUpdated = realtimeTimestamp === apiTimestamp && realtimeChat.lastMessage !== apiChat.lastMessage;

        if ((isNewer || isContentUpdated) && (realtimeChat.lastMessage || realtimeChat.payloadType === MessagePayloadType.STREAM)) {
          return {
            ...apiChat,
            lastMessage: realtimeChat.lastMessage,
            payloadType: realtimeChat.payloadType,
            timestamp: realtimeChat.timestamp,
            lastTimestampSec: realtimeChat.lastTimestampSec,
            unreadCount: realtimeChat.unreadCount,
            priority: realtimeChat.priority,
          };
        }
      }
      return apiChat;
    });
    
    // Get the keys of the conversations returned by the API
    const apiChatKeys = new Set(myChats.map(c => getChannelKey(c.channelId, c.channelType)));
    
    // Filter the realtime conversations that are not in the API result (created by new messages, with actual content or a special message type)
    const newRealtimeChats = realtimeChats.filter(
      c =>
        !apiChatKeys.has(getChannelKey(c.channelId, c.channelType)) &&
        (c.lastMessage || c.payloadType === MessagePayloadType.STREAM) &&
        matchTagFilter(c)
    );
    
    // Merge and sort
    return sortChatsByTimestamp([...mergedFromApi, ...newRealtimeChats]);
  }, [myChats, realtimeChats, mineTagIds, tagFilterBypassKeys]);

  // When the tag filter is on, a new realtime conversation that lacks channelInfo.extra.tags is hidden;
  // so we proactively trigger a "refresh channel info" to get the tags quickly (limited retries to avoid endless requests).
  useEffect(() => {
    if (!mineTagInitialized) return;
    if (activeTab !== 'mine') return;
    if (!mineTagIds || mineTagIds.length === 0) return;

    const apiChatKeys = new Set(myChats.map((c) => getChannelKey(c.channelId, c.channelType)));

    const getChannelTagState = (channelId: string, channelType: number) => {
      const channelStore = useChannelStore.getState();
      const info = channelStore.getChannel(channelId, channelType);
      const key = getChannelKey(channelId, channelType);
      const err = (channelStore as any).errors?.[key] as string | null | undefined;
      const extra: any = info?.extra;
      const hasTagsField = Array.isArray(extra?.tags);
      const tagIds: string[] = hasTagsField
        ? (extra.tags as any[])
            .map((t) => (t?.id ?? t?.tag_id ?? t?.tagId ?? t?.value ?? null))
            .filter((x) => typeof x === 'string' && x.trim().length > 0)
            .map((x) => String(x))
        : [];
      return { key, err, hasTagsField, tagIds };
    };

    const candidates = realtimeChats.filter((c) => {
      if (!c.lastMessage && c.payloadType !== MessagePayloadType.STREAM) return false;
      if (!c.channelId || c.channelType == null) return false;
      const key = getChannelKey(c.channelId, c.channelType);
      if (apiChatKeys.has(key)) return false;
      // Do not retry those already marked for fallback display
      if (tagFilterBypassKeys[key] === true) return false;

      // Only trigger a refresh when the "channel info is missing / has no tags field" or the "last request failed"
      const state = getChannelTagState(c.channelId, c.channelType);
      if (state.tagIds.length > 0) return false; // Already has tags; no need
      if (state.err) return true; // Has an error; retry
      if (!state.hasTagsField) return true; // The tags field has not loaded yet; retry
      // hasTagsField=true and tagIds is empty: the info was fetched successfully but there are simply no tags; do not retry
      return false;
    });

    if (candidates.length === 0) return;

    // Limit concurrency: trigger at most 6 refreshes per round
    const toRefresh = candidates.slice(0, 6);
    toRefresh.forEach((c) => {
      const key = getChannelKey(c.channelId, c.channelType);
      if (channelInfoPendingRef.current.has(key)) return;
      const retries = channelInfoRetryCountRef.current[key] ?? 0;
      if (retries >= 3) return; // Retry at most 3 times

      channelInfoPendingRef.current.add(key);
      (async () => {
        try {
          // refreshChannel + apply to chats/messages (chatStore already provides a unified entry point)
          await useChatStore.getState().syncChannelInfoAcrossUI(c.channelId!, c.channelType!);
        } catch {
          // ignore
        } finally {
          channelInfoPendingRef.current.delete(key);

          const latest = getChannelTagState(c.channelId!, c.channelType!);
          const hasTagsNow = latest.tagIds.length > 0;
          const hadError = !!latest.err;

          // If the tags were fetched successfully: clear the fallback mark and the retry count
          if (hasTagsNow) {
            channelInfoRetryCountRef.current[key] = 0;
            setTagFilterBypassKeys((prev) => {
              if (!prev[key]) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
            return;
          }

          // If the info was fetched successfully and the tags field is explicitly empty (no tags): do not show as fallback and do not retry
          if (!hadError && latest.hasTagsField) {
            channelInfoRetryCountRef.current[key] = 0;
            return;
          }

          // The request failed or the tags field is still missing: retry with backoff; show as fallback once the limit is exceeded
          const nextRetry = (channelInfoRetryCountRef.current[key] ?? 0) + 1;
          channelInfoRetryCountRef.current[key] = nextRetry;
          if (nextRetry >= 3) {
            // Final failure: show as fallback so conversations/messages don't appear lost
            setTagFilterBypassKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
            return;
          }
          const delay = Math.min(8000, 800 * Math.pow(2, nextRetry - 1)); // 800ms, 1600ms
          setTimeout(() => setChannelInfoRetryTick((t) => t + 1), delay);
        }
      })();
    });
  }, [mineTagInitialized, activeTab, mineTagIds, myChats, realtimeChats, channelInfoRetryTick, tagFilterBypassKeys]);

  // "Completed" conversations: use only the API results (do not merge realtime conversations, to avoid mixing active ones into "Completed")
  const mergedAllChats = useMemo(() => {
    return sortChatsByTimestamp(allChats);
  }, [allChats]);

  // Get the appropriate chat list based on active tab
  const getChatsForTab = useCallback((): Chat[] => {
    switch (activeTab) {
      case 'mine':
        return mergedMyChats;
      case 'unassigned':
        return unassignedChats;
      case 'all':
        return mergedAllChats;
      case 'manual':
        return manualChats;
      default:
        return mergedMyChats;
    }
  }, [activeTab, mergedMyChats, unassignedChats, mergedAllChats, manualChats]);

  // Calculate counts for tabs
  // The "Mine" tab shows the conversation count; the "Unassigned" tab shows the waiting count
  const counts = useMemo(() => {
    return {
      mine: mergedMyChats.length,
      unassigned: unassignedCount,
    };
  }, [mergedMyChats.length, unassignedCount]);

  // Publish inbox totals for the workspace overview
  const unreadTotal = useMemo(
    () => mergedMyChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0),
    [mergedMyChats]
  );
  useEffect(() => {
    onSummaryChange?.({ conversations: mergedMyChats.length, unread: unreadTotal, waiting: unassignedCount });
  }, [onSummaryChange, mergedMyChats.length, unreadTotal, unassignedCount]);

  // Get chats for current tab
  const tabChats = getChatsForTab();
  
  // Apply search filtering
  const filteredChats = useSearchFiltering(tabChats, searchQuery);

  const filteredRecentVisitors = useMemo(() => {
    if (!searchQuery.trim()) return recentVisitors;
    const lowerQuery = searchQuery.toLowerCase();
    return recentVisitors.filter(v => {
      const name = (v.name || v.display_nickname || v.nickname_zh || v.nickname || `Visitor ${String(v.id).slice(-4)}`).toLowerCase();
      return name.includes(lowerQuery);
    });
  }, [recentVisitors, searchQuery]);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, [setSearchQuery]);

  const handleTabChange = useCallback((tab: ChatTabType) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  // Handle chat click - clear unread count locally and call parent handler
  const handleChatClick = useCallback((chat: Chat) => {
    // Don't clear unread for unassigned tab
    if (activeTab !== 'unassigned' && (chat.unreadCount || 0) > 0) {
      const updateChatUnread = (chats: Chat[]) => 
        chats.map(c => 
          c.channelId === chat.channelId && c.channelType === chat.channelType
            ? { ...c, unreadCount: 0 }
            : c
        );
      
      // Update local state for the appropriate tab
      setMyChats(updateChatUnread);
      setAllChats(updateChatUnread);
    }
    
    // Call parent handler
    onChatSelect(chat);
  }, [activeTab, onChatSelect]);

  const { showToast } = useToast();

  const handleOnlineVisitorClick = useCallback((v: VisitorResponse) => {
    try {
      const visitorId = v?.id;
      if (!visitorId) {
        showToast('warning', t('search.toasts.incompleteVisitorInfo', 'Visitor information is incomplete'), t('search.toasts.missingVisitorId', 'Missing visitor_id'));
        return;
      }
      const channelId = `${visitorId}-vtr`;
      const channelType = 251; // Visitor conversation type

      // 1) If it already exists, switch to it directly
      const exist = realtimeChats.find(c => c.channelId === channelId && c.channelType === channelType);
      if (exist) {
        onChatSelect(exist);
        return;
      }

      // 2) Otherwise create a new Chat object and insert it at the top
      const fallbackName = t('visitor.fallbackName', 'Visitor {{suffix}}').replace('{{suffix}}', (v.platform_open_id || '').slice(-4));
      const rawName = (v.name || v.display_nickname || v.nickname_zh || v.nickname || fallbackName) as string;
      const plainName = (rawName || '').replace(/<[^>]*>/g, '') || fallbackName;

      const key = getChannelKey(channelId, channelType);
      const nowIso = new Date().toISOString();
      const nowSec = Math.floor(Date.now() / 1000);

      const extra: ChannelVisitorExtra = {
        id: v.id,
        platform_id: v.platform_id,
        platform_type: (v.platform_type as PlatformType ?? PlatformType.WEBSITE),
        platform_open_id: v.platform_open_id,
        name: v.name || undefined,
        nickname: v.nickname || undefined,
        display_nickname: v.display_nickname || undefined,
        avatar_url: v.avatar_url || undefined,
        is_online: v.is_online,
        created_at: v.created_at,
        updated_at: v.updated_at,
        ai_disabled: v.ai_disabled ?? undefined,
        ai_settings: (v as any).ai_settings,
        tags: v.tags as any,
      };

      const channelInfo: ChannelInfo = {
        name: plainName,
        avatar: v.avatar_url || '',
        channel_id: channelId,
        channel_type: channelType,
        extra,
      };

      const newChat: Chat = {
        id: key,
        platform: (v.platform_type ?? PlatformType.WEBSITE) as unknown as string,
        lastMessage: '',
        timestamp: nowIso,
        lastTimestampSec: nowSec,
        status: CHAT_STATUS.ACTIVE,
        unreadCount: 0,
        channelId,
        channelType,
        lastMsgSeq: 0,
        channelInfo,
        tags: (v.tags || []).map(t => ({ name: t.name, color: t.color })),
        priority: CHAT_PRIORITY.NORMAL,
        visitorStatus: v.is_online ? VISITOR_STATUS.ONLINE : VISITOR_STATUS.OFFLINE,
      } as any;

      useChatStore.getState().setChats([newChat, ...realtimeChats]);
      onChatSelect(newChat);
    } catch (e) {
      console.error('Failed to open visitor conversation', e);
      showApiError(showToast, e);
    }
  }, [t, onChatSelect, realtimeChats, showToast]);

  // Loading state based on active tab
  const isLoading = useMemo(() => {
    switch (activeTab) {
      case 'mine':
        return isLoadingMine;
      case 'unassigned':
        return isLoadingUnassigned;
      case 'all':
        return isLoadingAll;
      case 'manual':
        return isLoadingManual;
      case 'recent':
        return isLoadingRecent;
      default:
        return false;
    }
  }, [activeTab, isLoadingMine, isLoadingUnassigned, isLoadingAll, isLoadingManual, isLoadingRecent]);
  
  // Whether more is currently loading
  const isLoadingMore = useMemo(() => {
    switch (activeTab) {
      case 'unassigned':
        return isLoadingMoreUnassigned;
      case 'all':
        return isLoadingMoreAll;
      case 'manual':
        return isLoadingMoreManual;
      case 'recent':
        return isLoadingMoreRecent;
      default:
        return false;
    }
  }, [activeTab, isLoadingMoreUnassigned, isLoadingMoreAll, isLoadingMoreManual, isLoadingMoreRecent]);
  
  // Whether there is more data
  const hasMore = useMemo(() => {
    switch (activeTab) {
      case 'unassigned':
        return hasMoreUnassigned;
      case 'all':
        return hasMoreAll;
      case 'manual':
        return hasMoreManual;
      case 'recent':
        return hasMoreRecent;
      default:
        return false;
    }
  }, [activeTab, hasMoreUnassigned, hasMoreAll, hasMoreManual, hasMoreRecent]);
  
  // Scroll event handling - pull up to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // Trigger loading more when scrolled within 100px of the bottom
    const threshold = 100;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    
    if (isNearBottom && !isLoadingMore && hasMore) {
      if (activeTab === 'unassigned') {
        loadMoreUnassignedConversations();
      } else if (activeTab === 'all') {
        loadMoreAllConversations();
      } else if (activeTab === 'manual') {
        loadMoreManualConversations();
      } else if (activeTab === 'recent') {
        loadMoreRecentVisitors();
      }
    }
  }, [activeTab, isLoadingMore, hasMore, loadMoreUnassignedConversations, loadMoreAllConversations, loadMoreManualConversations, loadMoreRecentVisitors]);

  return (
    <div className="tgo-surface w-[300px] shrink-0 flex flex-col overflow-hidden">
      {/* Header with search */}
      <ChatListHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        count={activeTab === 'recent' ? filteredRecentVisitors.length : filteredChats.length}
      />

      {/* Connection Status Banner */}
      {!isConnected && (
        <div className={`tgo-fade-in mx-3 mb-2 px-3 py-2 rounded-full flex items-center gap-2 ${isConnecting ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            {isConnecting ? (
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <X size={14} />
            )}
          </div>
          <span className="text-xs font-medium flex-grow">
            {isConnecting ? t('chat.status.connecting', 'Connecting...') : t('chat.status.disconnected', 'Disconnected')}
          </span>
          {!isConnecting && (
            <button 
              onClick={() => window.location.reload()}
              className="text-[10px] underline hover:no-underline"
            >
              {t('common.retry', 'Retry')}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <ChatListTabs 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        counts={counts}
      />

      {/* "Mine" tab tag filter */}
      {activeTab === 'mine' && (
        <div className="px-4 pt-3 pb-1">
          <div ref={tagFilterRef} className="relative z-40">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Display of selected tags (compact chips) */}
              {mineTagIds.map((id: string) => {
                const fromList = availableVisitorTags.find(tg => tg.id === id);
                const meta = mineTagMeta[id];
                const displayName = (fromList?.display_name || fromList?.name || meta?.display_name || meta?.name || id);
                const color = (fromList?.color ?? meta?.color ?? null) as string | null;
                const tagForStyle = { id, display_name: displayName, color } as unknown as TagResponse;
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-medium leading-none ${
                      isEditingMineTags ? 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200' : ''
                    }`}
                    style={
                      isEditingMineTags
                        ? undefined
                        : (() => {
                            const hex = normalizeTagHex(tagForStyle.color);
                            return {
                              backgroundColor: hexToRgba(hex, 0.12),
                              color: hex,
                            } as React.CSSProperties;
                          })()
                    }
                  >
                    <span className="truncate max-w-[140px]">{displayName}</span>
                    {isEditingMineTags && (
                      <button
                        type="button"
                        title={t('chat.list.tagFilter.remove', 'Remove tag')}
                        aria-label={t('chat.list.tagFilter.remove', 'Remove tag')}
                        className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-gray-200/70 dark:hover:bg-gray-600/60"
                        onClick={() => {
                          setMineTagIds(mineTagIds.filter((x: string) => x !== id));
                          setMineTagMeta(prev => {
                            const next = { ...prev };
                            delete next[id];
                            return next;
                          });
                          setIsEditingMineTags(false); // Exit edit mode after deleting
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}

              {/* Put + / - after the tags */}
              <button
                ref={addButtonRef}
                type="button"
                title={t('chat.list.tagFilter.add', 'Add filter tag')}
                aria-label={t('chat.list.tagFilter.add', 'Add filter tag')}
                onClick={() => {
                  setIsEditingMineTags(false);
                  setIsTagFilterOpen(v => !v);
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700 hover:text-ink-900 hover:bg-acid-300 hover:ring-transparent dark:hover:text-ink-900 transition"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={mineTagIds.length === 0}
                title={t('chat.list.tagFilter.edit', 'Edit filter tags')}
                aria-label={t('chat.list.tagFilter.edit', 'Edit filter tags')}
                onClick={() => {
                  if (mineTagIds.length === 0) return;
                  setIsTagFilterOpen(false);
                  setIsEditingMineTags(v => !v); // Clicking repeatedly toggles edit / non-edit
                }}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition ${
                  mineTagIds.length === 0
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : isEditingMineTags
                      ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag selection panel (Portal to body, to avoid being covered/clipped by the conversation list) */}
      {isTagFilterOpen && tagPickerPos && typeof document !== 'undefined' && (
        <>
          {createPortal(
            <div
              ref={tagPickerRef}
              className="tgo-pop fixed z-[99999] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
              style={{ top: tagPickerPos.top, left: tagPickerPos.left, width: tagPickerPos.width }}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-200/70 dark:border-gray-700/70">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-100">
                  {t('chat.list.tagFilter.add', 'Add filter tag')}
                </div>
                <div className="mt-2">
                  <input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder={t('chat.list.tagFilter.searchPlaceholder', 'Search tags')}
                    className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-64 overflow-auto p-2">
                {isLoadingTags ? (
                  <div className="py-3 text-xs text-gray-500 dark:text-gray-400">
                    {t('chat.list.tagFilter.loading', 'Loading tags...')}
                  </div>
                ) : availableVisitorTags.length === 0 ? (
                  <div className="py-3 text-xs text-gray-500 dark:text-gray-400">
                    {t('chat.list.tagFilter.empty', 'No tags')}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {availableVisitorTags
                      .filter(tg => !mineTagIds.includes(tg.id))
                      .filter(tg => {
                        const q = tagSearch.trim().toLowerCase();
                        if (!q) return true;
                        const label = (tg.display_name || tg.name || '').toLowerCase();
                        return label.includes(q);
                      })
                      .map((tg) => {
                        const label = tg.display_name || tg.name;
                        const hex = normalizeTagHex(tg.color);
                        return (
                          <button
                            key={tg.id}
                            type="button"
                            className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/60"
                            onClick={() => {
                              setMineTagIds(mineTagIds.includes(tg.id) ? mineTagIds : [...mineTagIds, tg.id]);
                              setMineTagMeta(prev => ({
                                ...prev,
                                [tg.id]: { id: tg.id, display_name: tg.display_name, name: tg.name, color: tg.color ?? null },
                              }));
                              setIsTagFilterOpen(false);
                              setTagSearch('');
                            }}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
                              <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{label}</span>
                            </span>
                            <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* Chat list */}
      <div 
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto px-2.5 pt-2 pb-3 space-y-1" 
        style={{ height: 0 }}
        onScroll={handleScroll}
      >
        {activeTab === 'recent' ? (
          filteredRecentVisitors.length === 0 ? (
            <ChatListEmpty isSyncing={isLoading} />
          ) : (
            <>
              {filteredRecentVisitors.map((visitor: VisitorResponse) => (
                <OnlineVisitorListItem
                  key={visitor.id}
                  visitor={visitor}
                  isActive={activeChat?.channelId === `${visitor.id}-vtr`}
                  onClick={handleOnlineVisitorClick}
                />
              ))}
              {/* Load-more hint */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-3">
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-acid-500 rounded-full animate-spin" />
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{t('common.loadingMore')}</span>
                </div>
              )}
              {/* No-more-data hint */}
              {!hasMore && filteredRecentVisitors.length > 0 && (
                <div className="flex items-center justify-center py-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t('common.noMore')}</span>
                </div>
              )}
            </>
          )
        ) : filteredChats.length === 0 ? (
          <ChatListEmpty isSyncing={isLoading} />
        ) : (
          <>
            {filteredChats.map((chat: Chat) => (
              activeTab === 'unassigned' ? (
                <UnassignedChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChat?.id === chat.id}
                  onClick={onChatSelect}
                />
              ) : (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChat?.id === chat.id}
                  onClick={handleChatClick}
                />
              )
            ))}
            {/* Load-more hint */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-3">
                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-acid-500 rounded-full animate-spin" />
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{t('common.loadingMore')}</span>
              </div>
            )}
            {/* No-more-data hint */}
            {!hasMore && filteredChats.length > 0 && (activeTab === 'unassigned' || activeTab === 'all' || activeTab === 'manual') && (
              <div className="flex items-center justify-center py-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('common.noMore')}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Onboarding Panel */}
      <OnboardingSidebarPanel />
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
const ChatList = React.memo(ChatListComponent);
ChatList.displayName = 'ChatList';

export default ChatList;
