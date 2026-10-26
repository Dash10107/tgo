import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Chat, ChatStatus, WuKongIMConversation, WuKongIMConversationSyncResponse } from '@/types';
import { MessagePayloadType } from '@/types';
import { WuKongIMApiService, WuKongIMUtils } from '@/services/wukongimApi';
import { getChannelKey } from '@/utils/channelUtils';
import { useChannelStore } from './channelStore';
import { useConversationStore } from './conversationStore';
import {
  DEFAULT_CHANNEL_TYPE,
  CHAT_STATUS as CHAT_STATUS_CONST,
  CHAT_PRIORITY as CHAT_PRIORITY_CONST,
  STORAGE_KEYS,
} from '@/constants';

import i18n from '@/i18n';
/**
 * Sync Store State Interface
 * Manages conversation synchronization with WuKongIM
 */
interface SyncState {
  // Sync state
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncVersion: number;
  syncError: string | null;
  hasSyncedOnce: boolean;

  // Actions - sync control
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;

  // Actions - sync methods
  syncConversations: () => Promise<void>;
  syncConversationsIfNeeded: () => Promise<void>;
  forceSyncConversations: () => Promise<void>;

  // Actions - conversion utilities
  convertWuKongIMToChat: (conversation: WuKongIMConversation) => Chat;

  // Actions - cleanup
  clearSyncStore: () => void;
}

export const useSyncStore = create<SyncState>()(
  devtools(
    (set, get) => ({
      // Initial state
      isSyncing: false,
      lastSyncTime: null,
      syncVersion: 0,
      syncError: null,
      hasSyncedOnce: false,

      // Sync control
      setSyncing: (syncing) => set({ isSyncing: syncing }, false, 'setSyncing'),

      setSyncError: (error) => set({ syncError: error }, false, 'setSyncError'),

      // Convert WuKongIM conversation to internal Chat format
      convertWuKongIMToChat: (conversation: WuKongIMConversation): Chat => {
        // Use the latest message by highest message_seq to ensure we pick the true last message
        const latestWkMsg =
          Array.isArray(conversation.recents) && conversation.recents.length > 0
            ? conversation.recents.reduce(
                (acc, m) => (!acc || m.message_seq > acc.message_seq ? m : acc),
                conversation.recents[0]
              )
            : null;

        // Debug: Log the latest message
        if (latestWkMsg) {
          console.log('📋 convertWuKongIMToChat - Latest message:', {
            message_seq: latestWkMsg.message_seq,
            has_event_meta: !!latestWkMsg.event_meta?.has_events,
            payload_type: typeof latestWkMsg.payload,
            payload_preview:
              typeof latestWkMsg.payload === 'object'
                ? (latestWkMsg.payload as any).content?.substring(0, 50)
                : latestWkMsg.payload?.substring(0, 50),
          });
        }

        const lastMessage = latestWkMsg ? WuKongIMUtils.extractMessageContent(latestWkMsg) : i18n.t('sync.noMessages', 'No messages yet');
        const rawPayload = latestWkMsg?.payload;
        let lastPayload: any = undefined;
        if (typeof rawPayload === 'object' && rawPayload !== null) {
          lastPayload = rawPayload;
        } else if (typeof rawPayload === 'string') {
          try { lastPayload = JSON.parse(rawPayload); } catch {}
        }
        let payloadType = latestWkMsg ? (typeof latestWkMsg.payload === 'object' ? (latestWkMsg.payload as any)?.type : undefined) : undefined;

        // For completed STREAM messages, treat as TEXT so the conversation list
        // shows actual content instead of "AI typing..." placeholder.
        if (payloadType === MessagePayloadType.STREAM && latestWkMsg) {
          const isCompleted = latestWkMsg.end === 1
            || latestWkMsg.event_meta?.completed === true
            || (latestWkMsg.event_meta?.has_events && (latestWkMsg.event_meta?.open_event_count ?? 0) === 0);
          if (isCompleted) {
            payloadType = MessagePayloadType.TEXT;
          }
        }

        const channelId = conversation.channel_id;
        const channelType = conversation.channel_type ?? DEFAULT_CHANNEL_TYPE;

        // Derive basic presentation fields without fetching/seeding ChannelInfo here
        const platform = WuKongIMUtils.getPlatformFromChannelType(channelType);

        return {
          id: getChannelKey(channelId, channelType),
          platform,
          lastMessage,
          payloadType,
          lastPayload,
          timestamp: new Date(conversation.timestamp * 1000).toISOString(),
          lastTimestampSec: conversation.timestamp,
          status: CHAT_STATUS_CONST.ACTIVE as ChatStatus,
          unreadCount: conversation.unread,
          channelId: conversation.channel_id,
          channelType: conversation.channel_type ?? DEFAULT_CHANNEL_TYPE,
          lastMsgSeq: conversation.last_msg_seq,
          tags: [],
          priority: conversation.unread > 0 ? CHAT_PRIORITY_CONST.HIGH : CHAT_PRIORITY_CONST.NORMAL,
          lastSeenMinutes: undefined,
          metadata: {},
        };
      },

      // Sync conversations from WuKongIM
      syncConversations: async () => {
        const { setSyncing, setSyncError, syncVersion, convertWuKongIMToChat } = get();

        setSyncing(true);
        setSyncError(null);

        try {
          const { mineTagIds } = useConversationStore.getState();
          let response: WuKongIMConversationSyncResponse;

          response = await WuKongIMApiService.syncConversationsInitial(20, { tag_ids: mineTagIds });

          // Debug: Log sync response
          console.log('📋 syncConversations - API response:', {
            conversationCount: response.conversations.length,
            conversations: response.conversations.map((conv) => ({
              channel_id: conv.channel_id,
              recentsCount: conv.recents.length,
              recents: conv.recents.map((msg) => ({
                message_seq: msg.message_seq,
                has_event_meta: !!msg.event_meta?.has_events,
                payload_type: typeof msg.payload,
              })),
            })),
          });

          // Convert WuKongIM conversations to the internal format
          const convertedChats = response.conversations.map((conv) => convertWuKongIMToChat(conv));

          // Merge existing visitor/channel info to prevent losing data on navigation
          const conversationStore = useConversationStore.getState();
          const existingChats = conversationStore.chats;
          const existingMap = new Map(existingChats.map((c) => [getChannelKey(c.channelId, c.channelType), c]));
          const channelStore = useChannelStore.getState();
          
          // Set of keys of the new conversations
          const newChatKeys = new Set(convertedChats.map((c) => getChannelKey(c.channelId, c.channelType)));
          
          // Merge the new conversations (keeping existing info)
          const mergedChats = convertedChats.map((chat) => {
            const key = getChannelKey(chat.channelId, chat.channelType);
            const prev = existingMap.get(key);
            const cached = channelStore.getChannel(chat.channelId, chat.channelType);
            return {
              ...chat,
              channelInfo: prev?.channelInfo ?? cached ?? chat.channelInfo,
              visitorStatus: prev?.visitorStatus ?? chat.visitorStatus,
              // Preserve lastSeenMinutes if it was a meaningful value (>0); avoid carrying over 0 which renders as "just now"
              lastSeenMinutes:
                prev?.lastSeenMinutes != null && prev.lastSeenMinutes !== 0 ? prev.lastSeenMinutes : chat.lastSeenMinutes,
              tags: prev?.tags ?? chat.tags,
            } as Chat;
          });
          
          // Keep existing conversations that are not in the new result (they may come from other APIs such as /conversations/my)
          const preservedChats = existingChats.filter((c) => !newChatKeys.has(getChannelKey(c.channelId, c.channelType)));
          
          // Merge all conversations
          const allChats = [...mergedChats, ...preservedChats];

          // Sort conversations by lastTimestampSec (desc)
          const sortedChats = allChats.sort((a, b) => {
            const aSec = a.lastTimestampSec ?? (a.timestamp ? Math.floor(new Date(a.timestamp).getTime() / 1000) : 0);
            const bSec = b.lastTimestampSec ?? (b.timestamp ? Math.floor(new Date(b.timestamp).getTime() / 1000) : 0);
            return bSec - aSec;
          });

          // Update the chats of conversationStore
          conversationStore.setChats(sortedChats);

          // Update local state
          const maxVersion = Math.max(...response.conversations.map((c) => c.version), syncVersion);
          set(
            {
              syncVersion: maxVersion,
              lastSyncTime: new Date().toISOString(),
              isSyncing: false,
              syncError: null,
              hasSyncedOnce: true,
            },
            false,
            'syncConversationsSuccess'
          );
        } catch (error) {
          console.error('Sync conversation failed:', error);
          const errorMessage = error instanceof Error ? error.message : i18n.t('sync.failed', 'Sync failed');
          setSyncError(errorMessage);
          setSyncing(false);
        }
      },

      // Sync the conversation list only if it has not been synced yet
      syncConversationsIfNeeded: async () => {
        const { hasSyncedOnce, isSyncing, syncConversations } = get();
        if (hasSyncedOnce || isSyncing) {
          console.log('📋 syncConversationsIfNeeded: Skipping sync (already synced or syncing)', { hasSyncedOnce, isSyncing });
          return;
        }
        console.log('📋 syncConversationsIfNeeded: First time sync');
        await syncConversations();
      },

      // Force-sync the conversation list (used after a WebSocket reconnect)
      forceSyncConversations: async () => {
        console.log('📋 forceSyncConversations: Force syncing conversations after reconnect');
        await get().syncConversations();
      },

      // Clear store
      clearSyncStore: () => {
        set(
          {
            isSyncing: false,
            lastSyncTime: null,
            syncVersion: 0,
            syncError: null,
            hasSyncedOnce: false,
          },
          false,
          'clearSyncStore'
        );
      },
    }),
    { name: STORAGE_KEYS.SYNC || 'SyncStore' }
  )
);

// Selectors for optimized subscriptions
export const syncSelectors = {
  isSyncing: (state: SyncState) => state.isSyncing,
  lastSyncTime: (state: SyncState) => state.lastSyncTime,
  syncVersion: (state: SyncState) => state.syncVersion,
  syncError: (state: SyncState) => state.syncError,
  hasSyncedOnce: (state: SyncState) => state.hasSyncedOnce,
};
