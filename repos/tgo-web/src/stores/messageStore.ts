import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Message, WuKongIMMessage, ChannelInfo } from '@/types';
import { WuKongIMApiService, WuKongIMUtils } from '@/services/wukongimApi';
import { getChannelKey } from '@/utils/channelUtils';
import { MESSAGE_SENDER_TYPE, STORAGE_KEYS } from '@/constants';

import i18n from '@/i18n';
// Track channels currently loading history to prevent duplicate requests
const loadingHistoryChannels = new Set<string>();

/** Extract plain text from ui_parts for preview / search. */
function buildPlainText(parts: Array<{ type: string; text?: string }>): string {
  return parts.filter(p => p.type === 'text').map(p => p.text || '').join('');
}

/**
 * Stream End Reason constants - matches backend definitions
 * Used to indicate why a stream was completed
 */
export const StreamEndReason = {
  /** Stream completed successfully (default) */
  SUCCESS: 0,
  /** Stream ended due to inactivity timeout */
  TIMEOUT: 1,
  /** Stream ended due to an error */
  ERROR: 2,
  /** Stream was manually cancelled */
  CANCELLED: 3,
  /** Stream was forcefully ended (e.g., channel closure) */
  FORCE: 4,
} as const;

export type StreamEndReasonType = (typeof StreamEndReason)[keyof typeof StreamEndReason];

/**
 * Message Store State Interface
 * Manages real-time messages, historical messages, and streaming
 */
interface MessageState {
  // Realtime messages
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;

  // History messages
  historicalMessages: Record<string, WuKongIMMessage[]>; // channelKey -> messages
  isLoadingHistory: boolean;
  historyError: string | null;
  hasMoreHistory: Record<string, boolean>; // channelKey -> hasMore (older direction)
  nextHistorySeq: Record<string, number>; // channelKey -> nextSeq (older direction)
  hasMoreNewerHistory: Record<string, boolean>; // channelKey -> hasMore (newer direction)
  nextNewerSeq: Record<string, number>; // channelKey -> nextSeq (newer direction)

  // Streaming messages
  isStreamingInProgress: boolean;
  streamingClientMsgNo: string | null;
  /**
   * Tracks all in-progress streaming messages (clientMsgNo -> channel info and live content)
   * Even if the message is not in the currently active message list (e.g. generated in another conversation in the sidebar), the conversation preview can still be updated in sync.
   */
  activeStreamingChannels: Record<string, { channelId: string; channelType: number; content: string }>;

  // Target message location (jumping from search)
  targetMessageLocation: { channelId: string; channelType: number; messageSeq: number } | null;

  // Actions - realtime messages
  addMessage: (message: Message) => void;
  updateMessageByClientMsgNo: (clientMsgNo: string, patch: Partial<Message>) => void;
  loadMessages: (chatId: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;

  // Actions - history messages
  loadHistoricalMessages: (channelId: string, channelType: number) => Promise<void>;
  loadMoreHistory: (channelId: string, channelType: number) => Promise<void>;
  loadNewerHistory: (channelId: string, channelType: number) => Promise<void>;
  loadMessageContext: (channelId: string, channelType: number, targetSeq: number, totalLimit?: number) => Promise<void>;
  clearHistoricalMessages: (channelId: string, channelType: number) => void;
  setLoadingHistory: (loading: boolean) => void;
  setHistoryError: (error: string | null) => void;
  getChannelMessages: (channelId: string, channelType: number) => WuKongIMMessage[];

  // Actions - streaming messages
  appendStreamMessageContent: (clientMsgNo: string, content: string) => void;
  appendMixedPart: (clientMsgNo: string, part: { type: string; text?: string; data?: unknown }) => void;
  markStreamMessageEnd: (clientMsgNo: string, error?: string) => void;
  markStreamMessageFinish: (clientMsgNo: string) => void;
  cancelStreamingMessage: (clientMsgNo?: string) => Promise<void>;
  setStreamingState: (inProgress: boolean, clientMsgNo: string | null) => void;
  registerStreamingChannel: (clientMsgNo: string, channelId: string, channelType: number) => void;
  attachJSONRenderPatches: (clientMsgNo: string, patches: Record<string, unknown>[]) => void;

  // Actions - target message
  setTargetMessageLocation: (loc: { channelId: string; channelType: number; messageSeq: number } | null) => void;

  // Actions - applying channel info (message part only)
  applyChannelInfoToMessages: (channelId: string, channelType: number, info: ChannelInfo) => void;

  // Actions - update conversation preview (used by streaming messages)
  // Note: this method must call conversationStore and is implemented in cross-store communication
  onConversationPreviewUpdate?: (channelId: string, channelType: number, content: string) => void;

  // Actions - cleanup
  clearMessageStore: () => void;
}

export const useMessageStore = create<MessageState>()(
  devtools(
    (set, get) => ({
      // Initial state
      messages: [],
      isLoading: false,
      isSending: false,
      historicalMessages: {},
      isLoadingHistory: false,
      historyError: null,
      hasMoreHistory: {},
      nextHistorySeq: {},
      hasMoreNewerHistory: {},
      nextNewerSeq: {},
      isStreamingInProgress: false,
      streamingClientMsgNo: null,
      activeStreamingChannels: {},
      targetMessageLocation: null,

      // Real-time message actions
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] }), false, 'addMessage'),

      updateMessageByClientMsgNo: (clientMsgNo, patch) =>
        set(
          (state) => {
            const idx = state.messages.findIndex((m) => m.clientMsgNo === clientMsgNo || m.id === clientMsgNo);
            if (idx === -1) {
              return {} as any;
            }
            const prev = state.messages[idx];
            const merged: Message = {
              ...prev,
              ...patch,
              metadata: {
                ...(prev.metadata || {}),
                ...(patch.metadata || {}),
              },
            };
            const updated = [...state.messages];
            updated[idx] = merged;
            return { messages: updated } as any;
          },
          false,
          'updateMessageByClientMsgNo'
        ),

      loadMessages: async (_chatId) => {
        // Load no messages by default; real-time and historical APIs populate as events occur
        set({ isLoading: true }, false, 'loadMessages');
        try {
          set({ messages: [], isLoading: false }, false, 'loadMessagesComplete');
        } catch (error) {
          console.error('Failed to load messages:', error);
          set({ messages: [], isLoading: false }, false, 'loadMessagesError');
        }
      },

      setMessages: (messages) => set({ messages }, false, 'setMessages'),

      setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),

      setSending: (sending) => set({ isSending: sending }, false, 'setSending'),

      // Historical message actions
      loadHistoricalMessages: async (channelId: string, channelType: number) => {
        const key = getChannelKey(channelId, channelType);

        // Prevent duplicate requests: if this channel is already loading, return directly
        if (loadingHistoryChannels.has(key)) {
          console.log('loadHistoricalMessages: Already loading for', key, ', skipping');
          return;
        }

        loadingHistoryChannels.add(key);
        set({ isLoadingHistory: true, historyError: null });

        try {
          const response = await WuKongIMApiService.getChannelHistory(channelId, channelType, 50);
          console.log('loadHistoricalMessages: Response received for', channelId, response);

          // Sort and store messages for the channel
          const sortedAsc = WuKongIMUtils.sortMessages(response.messages, 'asc');
          set((state) => ({
            historicalMessages: {
              ...state.historicalMessages,
              [key]: sortedAsc,
            },
            hasMoreHistory: {
              ...state.hasMoreHistory,
              [key]: response.more,
            },
            nextHistorySeq: {
              ...state.nextHistorySeq,
              [key]: response.next_start_seq || 0,
            },
            isLoadingHistory: false,
          }));

          // Loading finished; clear the tracking
          loadingHistoryChannels.delete(key);
        } catch (error) {
          console.error('Failed to load historical messages:', error);
          loadingHistoryChannels.delete(key);
          set({
            historyError: error instanceof Error ? error.message : i18n.t('messages.loadHistoryFailed', 'Failed to load message history'),
            isLoadingHistory: false,
          });
        }
      },

      loadMoreHistory: async (channelId: string, channelType: number) => {
        console.log('loadMoreHistory: Loading more history for', channelId);
        const state = get();
        const key = getChannelKey(channelId, channelType);
        const currentMessages = state.historicalMessages[key] || [];
        const hasMore = state.hasMoreHistory[key];

        if (!hasMore || state.isLoadingHistory) {
          return;
        }

        set({ isLoadingHistory: true, historyError: null });

        try {
          // Get the earliest message sequence for pagination
          const earliestSeq =
            currentMessages.length > 0
              ? Math.min(...currentMessages.map((m) => m.message_seq))
              : state.nextHistorySeq[key] || 0;

          const response = await WuKongIMApiService.loadMoreMessages(channelId, channelType, earliestSeq, 50);
          set((state) => ({
            historicalMessages: {
              ...state.historicalMessages,
              [key]: WuKongIMUtils.mergeMessages(state.historicalMessages[key] || [], response.messages, 'asc'),
            },
            hasMoreHistory: {
              ...state.hasMoreHistory,
              [key]: response.more,
            },
            nextHistorySeq: {
              ...state.nextHistorySeq,
              [key]: response.next_start_seq || 0,
            },
            isLoadingHistory: false,
          }));
        } catch (error) {
          console.error('Failed to load more historical messages:', error);
          set({
            historyError: error instanceof Error ? error.message : i18n.t('messages.loadMoreFailed', 'Failed to load more messages'),
            isLoadingHistory: false,
          });
        }
      },

      loadNewerHistory: async (channelId: string, channelType: number) => {
        if (!channelId || channelType == null) return;
        const state = get();
        const key = getChannelKey(channelId, channelType);
        const current = state.historicalMessages[key] || [];
        const currentMaxSeq = current.length > 0 ? current[current.length - 1].message_seq : 0;

        // No more newer history and already at the latest
        if (state.hasMoreNewerHistory?.[key] === false) {
          return;
        }

        try {
          const resp = await WuKongIMApiService.syncChannelMessages({
            channel_id: channelId,
            channel_type: channelType,
            start_message_seq: currentMaxSeq,
            end_message_seq: 0,
            pull_mode: 1, // Upward / newer
            limit: 50,
          } as any);

          const merged = WuKongIMUtils.mergeMessages(current, resp?.messages || [], 'asc');

          set(
            (s) => ({
              historicalMessages: {
                ...s.historicalMessages,
                [key]: merged,
              },
              hasMoreNewerHistory: {
                ...s.hasMoreNewerHistory,
                [key]: Boolean(resp?.more),
              },
              nextNewerSeq: {
                ...s.nextNewerSeq,
                [key]: resp?.next_start_seq || 0,
              },
            }),
            false,
            'loadNewerHistorySuccess'
          );
        } catch (error) {
          console.error('Failed to load newer messages:', error);
          set({ historyError: error instanceof Error ? error.message : i18n.t('messages.loadNewerFailed', 'Failed to load newer messages') }, false, 'loadNewerHistoryError');
        }
      },

      loadMessageContext: async (channelId: string, channelType: number, targetSeq: number, totalLimit: number = 20) => {
        if (!channelId || channelType == null || !targetSeq) return;
        const key = getChannelKey(channelId, channelType);
        const half = Math.max(1, Math.floor(totalLimit / 2));
        set({ isLoadingHistory: true, historyError: null }, false, 'loadMessageContextStart');
        try {
          const reqBase = { channel_id: channelId, channel_type: channelType, start_message_seq: targetSeq, end_message_seq: 0 } as any;
          const [downResp, upResp] = await Promise.all([
            WuKongIMApiService.syncChannelMessages({ ...reqBase, pull_mode: 0, limit: half }), // Downward / older, includes the target
            WuKongIMApiService.syncChannelMessages({ ...reqBase, pull_mode: 1, limit: half }), // Upward / newer, includes the target
          ]);
          const mergedArr = [...(downResp?.messages || []), ...(upResp?.messages || [])];
          // De-duplicate so the target message (start_message_seq) is not repeated in the two-way results
          const deduped = WuKongIMUtils.deduplicateMessages(mergedArr);
          const sorted = WuKongIMUtils.sortMessages(deduped, 'asc');
          set((state) => ({
            historicalMessages: {
              ...state.historicalMessages,
              [key]: sorted, // Replace directly to ensure continuous context
            },
            // "Older direction" paging info (for continuing to load earlier messages at the top)
            hasMoreHistory: {
              ...state.hasMoreHistory,
              [key]: Boolean(downResp?.more),
            },
            nextHistorySeq: {
              ...state.nextHistorySeq,
              [key]: downResp?.next_start_seq || 0,
            },
            // "Newer direction" paging info (for continuing to load newer messages at the bottom)
            hasMoreNewerHistory: {
              ...state.hasMoreNewerHistory,
              [key]: Boolean(upResp?.more),
            },
            nextNewerSeq: {
              ...state.nextNewerSeq,
              [key]: upResp?.next_start_seq || 0,
            },
            isLoadingHistory: false,
          }));
        } catch (error) {
          console.error('Failed to load message context by seq:', error);
          set(
            { historyError: error instanceof Error ? error.message : i18n.t('messages.loadContextFailed', 'Failed to load message context'), isLoadingHistory: false },
            false,
            'loadMessageContextError'
          );
        }
      },

      clearHistoricalMessages: (channelId: string, channelType: number) => {
        const key = getChannelKey(channelId, channelType);
        set(
          (state) => ({
            historicalMessages: {
              ...state.historicalMessages,
              [key]: [],
            },
            hasMoreHistory: {
              ...state.hasMoreHistory,
              [key]: true,
            },
            nextHistorySeq: {
              ...state.nextHistorySeq,
              [key]: 0,
            },
            hasMoreNewerHistory: {
              ...state.hasMoreNewerHistory,
              [key]: false,
            },
            nextNewerSeq: {
              ...state.nextNewerSeq,
              [key]: 0,
            },
          }),
          false,
          'clearHistoricalMessages'
        );
      },

      setLoadingHistory: (loading: boolean) => set({ isLoadingHistory: loading }),

      setHistoryError: (error: string | null) => set({ historyError: error }),

      getChannelMessages: (channelId: string, channelType: number): WuKongIMMessage[] => {
        const state = get();
        const key = getChannelKey(channelId, channelType);
        return state.historicalMessages[key] || [];
      },

      // Streaming message actions
      appendStreamMessageContent: (clientMsgNo: string, content: string) => {
        const state = get();

        // 1. Update the tracking list (activeStreamingChannels) and trigger the preview update
        // This step is very important because it guarantees that the sidebar can update the preview even if the conversation is not in the currently active message list.
        const tracked = state.activeStreamingChannels[clientMsgNo];
        let newTrackedContent = content;
        if (tracked) {
          newTrackedContent = tracked.content + content;
          set(
            (s) => ({
              activeStreamingChannels: {
                ...s.activeStreamingChannels,
                [clientMsgNo]: { ...tracked, content: newTrackedContent },
              },
            }),
            false,
            'appendStreamMessageContent:tracked'
          );

          // Trigger the cross-store conversation list preview update
          const onUpdate = get().onConversationPreviewUpdate;
          if (onUpdate) {
            onUpdate(tracked.channelId, tracked.channelType, newTrackedContent);
          }
        }

        // 2. Try to find and update it in the current active message list
        const messageIndex = state.messages.findIndex((msg) => msg.clientMsgNo === clientMsgNo);

        if (messageIndex === -1) {
          // Search in historicalMessages (WuKongIMMessage format)
          let foundInHistory = false;
          let historyChannelKey: string | null = null;
          let historyMessageIndex = -1;

          for (const [channelKey, messages] of Object.entries(state.historicalMessages)) {
            const idx = messages.findIndex((msg) => msg.client_msg_no === clientMsgNo);
            if (idx !== -1) {
              foundInHistory = true;
              historyChannelKey = channelKey;
              historyMessageIndex = idx;
              break;
            }
          }

          if (foundInHistory && historyChannelKey !== null && historyMessageIndex !== -1) {
            // Historical messages now use event_meta; no stream_data to append.
            return;
          }

          // If it is not yet tracked, warn but continue
          if (!tracked) {
            console.warn('🤖 Message Store: STREAM CHUNK IGNORED (message not found or tracked)', {
              clientMsgNo,
              contentLength: content.length,
            });
          }
          return;
        }

        const message = state.messages[messageIndex];
        const metadata = message.metadata ?? {};
        const hasStreamStarted = metadata.stream_started === true;
        const isFirstChunk = !hasStreamStarted;
        const oldContent = message.content;

        const baseContent = isFirstChunk ? '' : oldContent;
        const newContent = baseContent + content;

        // Update the message with appended content
        set(
          (state) => {
            const updatedMessages = state.messages.map((msg, idx) => {
              if (idx === messageIndex) {
                return {
                  ...msg,
                  content: newContent,
                  metadata: {
                    ...(msg.metadata ?? {}),
                    has_stream_data: true, // Mark as stream data for Markdown rendering
                    is_streaming: true, // Flag to indicate message is still streaming
                    stream_started: true, // Ensure subsequent chunks append to streamed content
                    last_stream_update: Date.now(),
                  },
                };
              }
              return msg;
            });

            return { messages: updatedMessages };
          },
          false,
          'appendStreamMessageContent:realtime'
        );
      },

      appendMixedPart: (clientMsgNo: string, part: { type: string; text?: string; data?: unknown }) => {
        const state = get();

        // 1. Update tracked streaming channel preview
        const tracked = state.activeStreamingChannels[clientMsgNo];
        if (tracked && part.type === 'text' && part.text) {
          const newTrackedContent = tracked.content + part.text;
          set(
            (s) => ({
              activeStreamingChannels: {
                ...s.activeStreamingChannels,
                [clientMsgNo]: { ...tracked, content: newTrackedContent },
              },
            }),
            false,
            'appendMixedPart:tracked'
          );
          const onUpdate = get().onConversationPreviewUpdate;
          if (onUpdate) {
            onUpdate(tracked.channelId, tracked.channelType, newTrackedContent);
          }
        }

        // 2. Find message in realtime list
        const messageIndex = state.messages.findIndex((msg) => msg.clientMsgNo === clientMsgNo);
        if (messageIndex === -1) {
          // Try historical messages
          for (const [, messages] of Object.entries(state.historicalMessages)) {
            const idx = messages.findIndex((msg) => msg.client_msg_no === clientMsgNo);
            if (idx !== -1) {
              // Historical messages now use event_meta; skip appendMixedPart.
              return;
            }
          }
          return;
        }

        // 3. Update realtime message ui_parts
        set(
          (s) => ({
            messages: s.messages.map((msg, idx) => {
              if (idx !== messageIndex) return msg;
              const meta = msg.metadata ?? {};
              const parts: Array<{ type: string; text?: string; data?: unknown }> =
                Array.isArray(meta.ui_parts) ? [...(meta.ui_parts as any)] : [];

              // Merge consecutive text parts
              if (part.type === 'text' && parts.length > 0) {
                const last = parts[parts.length - 1];
                if (last.type === 'text') {
                  parts[parts.length - 1] = { type: 'text', text: (last.text || '') + (part.text || '') };
                  return {
                    ...msg,
                    content: buildPlainText(parts),
                    metadata: { ...meta, ui_parts: parts, stream_started: true, is_streaming: true, has_stream_data: true },
                  };
                }
              }

              parts.push(part);
              return {
                ...msg,
                content: buildPlainText(parts),
                metadata: { ...meta, ui_parts: parts, stream_started: true, is_streaming: true, has_stream_data: true },
              };
            }),
          }),
          false,
          'appendMixedPart'
        );
      },

      markStreamMessageEnd: (clientMsgNo: string, error?: string) => {
        const state = get();

        // Clean up the tracking list
        const nextActiveStreamingChannels = { ...state.activeStreamingChannels };
        delete nextActiveStreamingChannels[clientMsgNo];

        // Find the message by clientMsgNo in real-time messages first
        const messageIndex = state.messages.findIndex((msg) => msg.clientMsgNo === clientMsgNo);

        // If found in real-time messages, mark as stream ended
        if (messageIndex !== -1) {
          console.log('🤖 Message Store: Marking stream message as ended (realtime)', { clientMsgNo, error });
          set(
            (s) => {
              const updatedMessages = s.messages.map((msg, idx) => {
                if (idx === messageIndex) {
                  // Content before the first chunk is the anchor placeholder ("AI is thinking..."),
                  // so only streamed content counts as a real reply
                  const streamStarted = msg.metadata?.stream_started === true;
                  const hasContent = streamStarted && Boolean(msg.content?.trim());
                  return {
                    ...msg,
                    content: streamStarted ? msg.content : '',
                    metadata: {
                      ...(msg.metadata ?? {}),
                      is_streaming: false,
                      has_stream_data: hasContent,
                      stream_end: 1,
                      stream_end_reason: error ? 1 : 0, // 1 = error, 0 = success
                      error: error || undefined, // Store error message if present
                    },
                  };
                }
                return msg;
              });
              const isGlobalStreaming = Object.keys(nextActiveStreamingChannels).length > 0;
              const nextStreamingClientMsgNo = isGlobalStreaming 
                ? (nextActiveStreamingChannels[s.streamingClientMsgNo || ''] ? s.streamingClientMsgNo : Object.keys(nextActiveStreamingChannels)[0]) 
                : null;

              return {
                messages: updatedMessages,
                isStreamingInProgress: isGlobalStreaming,
                streamingClientMsgNo: nextStreamingClientMsgNo,
                activeStreamingChannels: nextActiveStreamingChannels,
              };
            },
            false,
            'markStreamMessageEnd:realtime'
          );
          return;
        }

        // If not found in real-time messages, check historical messages
        for (const [channelKey, messages] of Object.entries(state.historicalMessages)) {
          const idx = messages.findIndex((msg) => msg.client_msg_no === clientMsgNo);
          if (idx !== -1) {
            console.log('🤖 Message Store: Marking stream message as ended (historical)', { clientMsgNo, channelKey, error });
            set(
              (s) => {
                const updatedHistoricalMessages = { ...s.historicalMessages };
                const channelMessages = [...(updatedHistoricalMessages[channelKey] || [])];
                if (channelMessages[idx]) {
                  channelMessages[idx] = {
                    ...channelMessages[idx],
                    end: 1, // Mark as ended
                    end_reason: error ? 1 : 0, // 1 = error, 0 = success
                    error: error || undefined, // Store error message at WuKongIMMessage level
                  };
                  updatedHistoricalMessages[channelKey] = channelMessages;
                }
                const isGlobalStreaming = Object.keys(nextActiveStreamingChannels).length > 0;
                const nextStreamingClientMsgNo = isGlobalStreaming 
                  ? (nextActiveStreamingChannels[s.streamingClientMsgNo || ''] ? s.streamingClientMsgNo : Object.keys(nextActiveStreamingChannels)[0]) 
                  : null;

                return {
                  historicalMessages: updatedHistoricalMessages,
                  isStreamingInProgress: isGlobalStreaming,
                  streamingClientMsgNo: nextStreamingClientMsgNo,
                  activeStreamingChannels: nextActiveStreamingChannels,
                };
              },
              false,
              'markStreamMessageEnd:historical'
            );
            return;
          }
        }

        // If message not found, still clear streaming state (safety measure)
        console.warn('🤖 Message Store: Message not found for stream end', { clientMsgNo });
        const isGlobalStreaming = Object.keys(nextActiveStreamingChannels).length > 0;
        const nextStreamingClientMsgNo = isGlobalStreaming 
          ? (nextActiveStreamingChannels[state.streamingClientMsgNo || ''] ? state.streamingClientMsgNo : Object.keys(nextActiveStreamingChannels)[0]) 
          : null;

        set(
          {
            isStreamingInProgress: isGlobalStreaming,
            streamingClientMsgNo: nextStreamingClientMsgNo,
            activeStreamingChannels: nextActiveStreamingChannels,
          },
          false,
          'markStreamMessageEnd:notFound'
        );
      },

      markStreamMessageFinish: (clientMsgNo: string) => {
        // stream.finish indicates the entire stream message is completed (all channels done).
        // In single-channel mode this is mostly a confirmation after stream.close.
        // We mark the message metadata as completed.
        const state = get();

        // Try realtime messages (Message[] with clientMsgNo and metadata)
        const realtimeIdx = state.messages.findIndex(m => m.clientMsgNo === clientMsgNo);
        if (realtimeIdx >= 0) {
          const updated = [...state.messages];
          updated[realtimeIdx] = {
            ...updated[realtimeIdx],
            metadata: {
              ...updated[realtimeIdx].metadata,
              is_streaming: false,
              stream_completed: true,
            },
          };
          set({ messages: updated }, false, 'markStreamMessageFinish:realtime');
          return;
        }

        // Try historical messages (WuKongIMMessage[] with client_msg_no)
        for (const [key, msgs] of Object.entries(state.historicalMessages)) {
          const idx = msgs.findIndex(m => m.client_msg_no === clientMsgNo);
          if (idx >= 0) {
            const updated = [...msgs];
            updated[idx] = {
              ...updated[idx],
              end: 1,
            };
            set(
              { historicalMessages: { ...state.historicalMessages, [key]: updated } },
              false,
              'markStreamMessageFinish:historical'
            );
            return;
          }
        }
      },

      cancelStreamingMessage: async (clientMsgNo) => {
        const state = get();
        const targetMsgNo = clientMsgNo || state.streamingClientMsgNo;

        if (!targetMsgNo) {
          console.warn('🤖 Message Store: No streaming message to cancel');
          return;
        }

        try {
          const { aiRunsApiService } = await import('@/services/aiRunsApi');
          await aiRunsApiService.cancelByClientNo({
            client_msg_no: targetMsgNo,
            reason: 'User cancelled',
          });
          console.log('🤖 Message Store: Stream message cancelled successfully', { clientMsgNo: targetMsgNo });

          // Clear streaming state
          const nextActiveStreamingChannels = { ...state.activeStreamingChannels };
          delete nextActiveStreamingChannels[targetMsgNo];
          
          const isGlobalStreaming = Object.keys(nextActiveStreamingChannels).length > 0;
          const nextStreamingClientMsgNo = isGlobalStreaming 
            ? (nextActiveStreamingChannels[state.streamingClientMsgNo || ''] ? state.streamingClientMsgNo : Object.keys(nextActiveStreamingChannels)[0]) 
            : null;
          
          set(
            {
              isStreamingInProgress: isGlobalStreaming,
              streamingClientMsgNo: nextStreamingClientMsgNo,
              activeStreamingChannels: nextActiveStreamingChannels,
            },
            false,
            'cancelStreamingMessage:success'
          );
        } catch (error) {
          console.error('🤖 Message Store: Failed to cancel stream message:', error);
          throw error;
        }
      },

      setStreamingState: (inProgress, clientMsgNo) =>
        set(
          {
            isStreamingInProgress: inProgress,
            streamingClientMsgNo: clientMsgNo,
          },
          false,
          'setStreamingState'
        ),

      registerStreamingChannel: (clientMsgNo: string, channelId: string, channelType: number) => {
        set(
          (state) => ({
            activeStreamingChannels: {
              ...state.activeStreamingChannels,
              [clientMsgNo]: { channelId, channelType, content: '' },
            },
          }),
          false,
          'registerStreamingChannel'
        );
      },

      attachJSONRenderPatches: (clientMsgNo: string, patches: Record<string, unknown>[]) => {
        const state = get();
        const messageIndex = state.messages.findIndex((msg) => msg.clientMsgNo === clientMsgNo);
        if (messageIndex === -1) return;

        set(
          (s) => ({
            messages: s.messages.map((msg) => {
              if (msg.clientMsgNo !== clientMsgNo) return msg;
              const currentMeta = msg.metadata ?? {};
              const existingParts = Array.isArray(currentMeta.ui_parts) ? currentMeta.ui_parts as Array<Record<string, unknown>> : [];
              const nextParts = patches.length > 0
                ? [
                    ...existingParts,
                    ...patches.map((patch) => ({
                      type: 'data-spec',
                      data: {
                        type: 'patch',
                        patch,
                      },
                    })),
                  ]
                : existingParts;
              return {
                ...msg,
                metadata: {
                  ...currentMeta,
                  ui_parts: nextParts,
                },
              };
            }),
          }),
          false,
          'attachJSONRenderPatches'
        );
      },

      // Target message location
      setTargetMessageLocation: (loc) => set({ targetMessageLocation: loc }, false, 'setTargetMessageLocation'),

      // Apply channel info to messages only
      applyChannelInfoToMessages: (channelId: string, channelType: number, info: ChannelInfo) => {
        if (!channelId || channelType == null) return;

        set((state) => {
          // Update messages only when we actually modify at least one message
          let messagesChanged = false;
          let updatedMessages = state.messages;
          if (state.messages.length > 0) {
            updatedMessages = state.messages.map((msg) => {
              if (msg.channelId === channelId && msg.channelType === channelType && msg.type === MESSAGE_SENDER_TYPE.VISITOR) {
                const curName = msg.fromInfo?.name;
                const curAvatar = msg.fromInfo?.avatar || msg.avatar;
                const nextMsg = {
                  ...msg,
                  fromInfo: {
                    name: info.name,
                    avatar: info.avatar || curAvatar || '',
                    channel_id: channelId,
                    channel_type: channelType,
                    extra: info.extra ?? undefined,
                  },
                } as typeof msg;
                if (curName !== info.name || curAvatar !== (info.avatar || curAvatar || '')) {
                  messagesChanged = true;
                  return nextMsg;
                }
              }
              return msg;
            });
          }

          // If nothing actually changed, return the original state slice to avoid re-renders
          return messagesChanged ? { messages: updatedMessages } : {};
        }, false, 'applyChannelInfoToMessages');
      },

      // Clear store
      clearMessageStore: () => {
        loadingHistoryChannels.clear();
        set(
          {
            messages: [],
            isLoading: false,
            isSending: false,
            historicalMessages: {},
            isLoadingHistory: false,
            historyError: null,
            hasMoreHistory: {},
            nextHistorySeq: {},
            hasMoreNewerHistory: {},
            nextNewerSeq: {},
            isStreamingInProgress: false,
            streamingClientMsgNo: null,
            activeStreamingChannels: {},
            targetMessageLocation: null,
          },
          false,
          'clearMessageStore'
        );
      },
    }),
    { name: STORAGE_KEYS.MESSAGE || 'MessageStore' }
  )
);

// Selectors for optimized subscriptions
export const messageSelectors = {
  messages: (state: MessageState) => state.messages,
  isLoading: (state: MessageState) => state.isLoading || state.isSending,
  isLoadingHistory: (state: MessageState) => state.isLoadingHistory,
  historyError: (state: MessageState) => state.historyError,
  isStreamingInProgress: (state: MessageState) => state.isStreamingInProgress,
  streamingClientMsgNo: (state: MessageState) => state.streamingClientMsgNo,
  targetMessageLocation: (state: MessageState) => state.targetMessageLocation,
};
