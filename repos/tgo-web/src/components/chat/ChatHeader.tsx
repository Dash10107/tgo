import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Chat, PlatformType, ChannelVisitorExtra, VisitorServiceStatus } from '@/types';
import { useTranslation } from 'react-i18next';
import { Bot, LogOut, Loader2, ArrowRightLeft, ChevronDown, User, RotateCcw } from 'lucide-react';

import { getPlatformIconComponent, getPlatformLabel, toPlatformType, getPlatformColor } from '@/utils/platformUtils';
import { visitorApiService } from '@/services/visitorApi';
import { staffApi, type StaffListResponse } from '@/services/staffApi';
import type { StaffResponse } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useChannelStore } from '@/stores/channelStore';
import { useChannelDisplay } from '@/hooks/useChannelDisplay';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { chatMessagesApiService } from '@/services/chatMessagesApi';

/**
 * Props for the ChatHeader component
 */
export interface ChatHeaderProps {
  /** The active chat to display in the header */
  activeChat: Chat;
  /** Callback when chat is ended successfully (with channel info) */
  onEndChatSuccess?: (channelId: string, channelType: number) => void;
}

/**
 * Chat header component displaying visitor name and platform icon
 * Memoized to prevent unnecessary re-renders
 */
const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({ activeChat, onEndChatSuccess }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [isClosing, setIsClosing] = useState(false);
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferMenu, setShowTransferMenu] = useState(false);
  const [staffList, setStaffList] = useState<StaffResponse[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const transferMenuRef = useRef<HTMLDivElement>(null);
  const updateChannelExtra = useChannelStore(state => state.updateChannelExtra);
  const deleteChat = useChatStore(state => state.deleteChat);
  const clearHistoricalMessages = useChatStore(state => state.clearHistoricalMessages);
  const setMessages = useChatStore(state => state.setMessages);
  const updateConversationPreview = useChatStore(state => state.updateConversationPreview);
  const currentUser = useAuthStore(state => state.user);
  
  // Determine whether this is an agent conversation (channelId ends with -agent)
  const isAgentChat = activeChat.channelId?.endsWith('-agent') ?? false;
  const isAIChat = isAgentChat;
  
  // Use the useChannelDisplay hook to get channel display info
  const { name: channelName, extra } = useChannelDisplay({
    channelId: activeChat.channelId,
    channelType: activeChat.channelType,
    skipFetch: false, 
  });
  
  // Get visitor info
  const visitorExtra = extra as ChannelVisitorExtra | undefined;
  const visitorId = visitorExtra?.id;
  const serviceStatus = visitorExtra?.service_status as VisitorServiceStatus | undefined;
  const assignedStaffId = visitorExtra?.assigned_staff_id;
  
  // Check whether the visitor is assigned to the current agent
  const isMyVisitor = !assignedStaffId || assignedStaffId === currentUser?.id;
  
  // Show the end-chat button only for visitor conversations that are active and belong to me
  const showEndChatButton = !isAIChat && visitorId && serviceStatus === 'active' && isMyVisitor;
  
  // Get the display name
  const displayName = channelName || '';

  // Handle ending the chat
  const handleEndChat = useCallback(async () => {
    if (!visitorId || isClosing) return;
    
    setIsClosing(true);
    try {
      await visitorApiService.closeSession(visitorId);
      showSuccess(t('chat.header.endChatSuccess', 'Chat ended'));
      
      // Save the channel info to notify the parent component
      const channelId = activeChat.channelId;
      const channelType = activeChat.channelType;
      
      // Update local state
      if (channelId && channelType !== undefined) {
        updateChannelExtra(channelId, channelType, {
          service_status: 'closed' as VisitorServiceStatus,
        });
        // Remove the current conversation from the recent conversation list
        deleteChat(activeChat.id);
        
        // Notify the parent that ending the chat succeeded (passing the channel info) so it can remove it and select the next conversation
        onEndChatSuccess?.(channelId, channelType);
      }
    } catch (error: any) {
      console.error('Failed to close session:', error);
      showError(error?.message || t('chat.header.endChatError', 'Failed to end chat'));
    } finally {
      setIsClosing(false);
    }
  }, [visitorId, isClosing, showSuccess, showError, t, activeChat.channelId, activeChat.channelType, activeChat.id, updateChannelExtra, deleteChat, onEndChatSuccess]);

  // Handle clearing memory
  const handleClearMemory = useCallback(async () => {
    if (!activeChat.channelId || activeChat.channelType === undefined || isClearingMemory) return;
    
    const confirmClear = window.confirm(t('chat.header.clearMemoryConfirm', 'Are you sure you want to clear the AI memory for this session? The AI will no longer remember previous conversations.'));
    if (!confirmClear) return;

    setIsClearingMemory(true);
    try {
      // 1. Call the API to clear remotely first
      await chatMessagesApiService.clearChatMemory({
        channel_id: activeChat.channelId,
        channel_type: activeChat.channelType,
      });

      // 2. If the remote call succeeds, clear the locally cached chat records
      clearHistoricalMessages(activeChat.channelId, activeChat.channelType);
      setMessages([]);
      updateConversationPreview(activeChat.channelId, activeChat.channelType, '');
      
      showSuccess(t('chat.header.clearMemorySuccess', 'Memory cleared'));
    } catch (error: any) {
      // 3. If the remote call fails, notify the user
      console.error('Failed to clear memory:', error);
      showError(error?.message || t('chat.header.clearMemoryError', 'Failed to clear memory'));
    } finally {
      setIsClearingMemory(false);
    }
  }, [activeChat.channelId, activeChat.channelType, isClearingMemory, clearHistoricalMessages, setMessages, updateConversationPreview, showSuccess, showError, t]);

  // Load the agent list
  const loadStaffList = useCallback(async () => {
    if (isLoadingStaff) return;
    setIsLoadingStaff(true);
    try {
      const response: StaffListResponse = await staffApi.listStaff({ limit: 50 });
      // Filter out the current user and inactive agents
      const filteredStaff = response.data.filter(
        staff => staff.id !== currentUser?.id && staff.is_active !== false
      );
      setStaffList(filteredStaff);
    } catch (error) {
      console.error('Failed to load staff list:', error);
      showError(t('chat.header.loadStaffError', 'Failed to load the agent list'));
    } finally {
      setIsLoadingStaff(false);
    }
  }, [isLoadingStaff, currentUser?.id, showError, t]);

  // Open the transfer menu
  const handleTransferClick = useCallback(() => {
    if (!showTransferMenu) {
      loadStaffList();
    }
    setShowTransferMenu(!showTransferMenu);
  }, [showTransferMenu, loadStaffList]);

  // Perform the transfer
  const handleTransferToStaff = useCallback(async (targetStaffId: string, staffName: string) => {
    if (!visitorId || isTransferring) return;
    
    setIsTransferring(true);
    setShowTransferMenu(false);
    try {
      await visitorApiService.transferSession(visitorId, targetStaffId);
      showSuccess(t('chat.header.transferSuccess', 'Transferred to {{name}}', { name: staffName }));
      
      // Save the channel info to notify the parent component
      const channelId = activeChat.channelId;
      const channelType = activeChat.channelType;
      
      // Update local state
      if (channelId && channelType !== undefined) {
        updateChannelExtra(channelId, channelType, {
          service_status: 'closed' as VisitorServiceStatus,
        });
        // Remove the current conversation from the recent conversation list
        deleteChat(activeChat.id);
        
        // Notify the parent that the transfer succeeded (passing the channel info) so it can remove it and select the next conversation
        onEndChatSuccess?.(channelId, channelType);
      }
    } catch (error: any) {
      console.error('Failed to transfer session:', error);
      showError(error?.message || t('chat.header.transferError', 'Transfer failed'));
    } finally {
      setIsTransferring(false);
    }
  }, [visitorId, isTransferring, showSuccess, showError, t, activeChat.channelId, activeChat.channelType, activeChat.id, updateChannelExtra, deleteChat, onEndChatSuccess]);

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transferMenuRef.current && !transferMenuRef.current.contains(event.target as Node)) {
        setShowTransferMenu(false);
      }
    };
    if (showTransferMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransferMenu]);
  
  return (
    <header className="px-6 py-3 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <span>{displayName}</span>
          {isAgentChat ? (
            <span title={t('chat.header.agentTooltip', 'AI Employee Chat')}>
              <Bot className="w-4 h-4 inline-block ml-1.5 -mt-0.5 text-purple-500 dark:text-purple-400" />
            </span>
          ) : (
            (() => {
              const fromExtra: PlatformType | undefined = visitorExtra?.platform_type;
              const type = fromExtra ?? toPlatformType(activeChat.platform);
              const IconComp = getPlatformIconComponent(type);
              const label = getPlatformLabel(type);
              return (
                <span title={label}>
                  <IconComp size={16} className={`w-3.5 h-3.5 inline-block ml-1 -mt-0.5 ${getPlatformColor(type)}`} />
                </span>
              );
            })()
          )}
        </h2>
      </div>
      {/* Action buttons - only shown for visitor conversations */}
      {showEndChatButton && (
        <div className="flex items-center gap-1">
          {/* Transfer button */}
          <div className="relative" ref={transferMenuRef}>
            <button
              onClick={handleTransferClick}
              disabled={isTransferring}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('chat.header.transferTooltip', 'Transfer to another agent')}
            >
              {isTransferring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              )}
              <span>{t('chat.header.transfer', 'Transfer')}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {/* Agent selection dropdown */}
            {showTransferMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                {isLoadingStaff ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {t('chat.header.noAvailableStaff', 'No agents available')}
                  </div>
                ) : (
                  staffList.map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => handleTransferToStaff(staff.id, staff.nickname || staff.username)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {staff.avatar_url ? (
                        <img src={staff.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="truncate">{staff.nickname || staff.username}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {/* End chat button */}
          <button
            onClick={handleEndChat}
            disabled={isClosing}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('chat.header.endChatTooltip', 'End the current chat')}
          >
            {isClosing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>{t('chat.header.endChat', 'End Chat')}</span>
          </button>
        </div>
      )}
      {/* Action buttons - AI conversations show clear memory */}
      {isAIChat && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearMemory}
            disabled={isClearingMemory}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('chat.header.clearMemoryTooltip', 'Clear AI conversation memory and restart')}
          >
            {isClearingMemory ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{t('chat.header.clearMemory', 'Clear Memory')}</span>
          </button>
        </div>
      )}
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;
