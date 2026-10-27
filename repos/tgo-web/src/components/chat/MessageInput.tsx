import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from 'react-i18next';


import { useChatStore, chatSelectors, useMessageStore } from '@/stores';
import { useChannelStore } from '@/stores/channelStore';
import { useAuthStore } from '@/stores/authStore';
import type { ChannelVisitorExtra, Message } from '@/types';
import { MessagePayloadType, PlatformType } from '@/types';
import { DEFAULT_CHANNEL_TYPE } from '@/constants';
import { visitorApiService } from '@/services/visitorApi';
import { conversationsApi } from '@/services/conversationsApi';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import Toggle from '@/components/ui/Toggle';
import EmojiPickerPopover from '@/components/chat/EmojiPickerPopover';
import { uploadChatImageWithProgress, uploadChatFileWithProgress } from '@/services/chatUploadApi';
import { useWuKongIMWebSocket } from '@/hooks/useWuKongIMWebSocket';
import { WsSendError } from '@/services/wukongimWebSocket';
import { toAbsoluteApiUrl } from '@/utils/url';
import { getFileIcon } from '@/utils/fileIcons';
import { chatMessagesApiService } from '@/services/chatMessagesApi';
import { APIError } from '@/services/api';

import { Smile, Scissors, Image as ImageIcon, Folder, Pause, Loader2, UserPlus, ArrowUp } from 'lucide-react';
import ChatToolbarPluginButtons from '../plugin/ChatToolbarPluginButtons';

/**
 * Extract error message from error object (supports APIError, WsSendError and generic Error)
 * @param error The error object
 * @param t i18n translation function
 * @param fallbackKey Fallback i18n key for unknown errors
 * @param fallbackDefault Fallback default message
 */
const getErrorMessage = (
  error: unknown, 
  t?: (key: string, defaultValue: string) => string,
  fallbackKey?: string,
  fallbackDefault?: string
): string => {
  if (error instanceof WsSendError && t) {
    return t(error.i18nKey, error.defaultMessage);
  }
  if (error instanceof APIError) {
    return error.getUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (t && fallbackKey && fallbackDefault) {
    return t(fallbackKey, fallbackDefault);
  }
  return 'Upload failed';
};

interface MessageInputProps {
  onSendMessage?: (message: string) => void;
  isSending?: boolean;
  onAcceptVisitor?: () => void;
}

/**
 * Message input component with toolbar and send functionality
 */
const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isSending = false,
  onAcceptVisitor,
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState<boolean>(false);

  const shouldMaintainFocus = useRef<boolean>(false);
  // Emoji picker state and anchor
  const [showEmoji, setShowEmoji] = useState<boolean>(false);
  // Screenshot tooltip state and anchor
  const [showScreenshotTip, setShowScreenshotTip] = useState<boolean>(false);
  const screenshotBtnRef = useRef<HTMLButtonElement>(null);
  const [screenshotTipPos, setScreenshotTipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const TIP_WIDTH = 320;

  const TIP_HEIGHT = 120; // approximate height for positioning
  const TIP_MARGIN = 8;
  // Pasted images preview state (supports multiple)
  type PastedItem = { file: File; previewUrl: string; width: number; height: number; progress?: number; status?: 'idle' | 'uploading' | 'completed' | 'error' };
  const [pastedItems, setPastedItems] = useState<PastedItem[]>([]);

  // Selected files (documents) preview state
  type SelectedFile = { id: string; file: File };
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);






  const computeScreenshotTipPosition = useCallback(() => {
    const anchor = screenshotBtnRef.current as HTMLElement | null;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    const hasSpaceAbove = rect.top >= TIP_HEIGHT + TIP_MARGIN + 10;
    const hasSpaceBelow = window.innerHeight - rect.bottom >= TIP_HEIGHT + TIP_MARGIN + 10;

    let placement: 'top' | 'bottom' = hasSpaceAbove ? 'top' : 'bottom';
    if (!hasSpaceAbove && !hasSpaceBelow) {
      placement = rect.top > window.innerHeight - rect.bottom ? 'top' : 'bottom';
    }

    let top: number;
    if (placement === 'top') {
      top = Math.max(10, rect.top - TIP_HEIGHT - TIP_MARGIN);
    } else {
      top = Math.min(window.innerHeight - TIP_HEIGHT - 10, rect.bottom + TIP_MARGIN);
    }

    const centerLeft = rect.left + rect.width / 2 - TIP_WIDTH / 2;
    const left = Math.min(Math.max(10, centerLeft), window.innerWidth - TIP_WIDTH - 10);

    setScreenshotTipPos({ top, left });
  }, []);

  useEffect(() => {
    if (!showScreenshotTip) return;
    computeScreenshotTipPosition();
    const handler = () => computeScreenshotTipPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [showScreenshotTip, computeScreenshotTipPosition]);

  const handleClickScreenshotBtn = useCallback(() => {
    setShowEmoji(false);
    setShowScreenshotTip((v) => !v);
    // Slight delay to allow state update before computing position
    setTimeout(() => computeScreenshotTipPosition(), 0);
  }, [computeScreenshotTipPosition]);

  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  const focusTimeoutRef = useRef<number | null>(null);

  // Subscribe to activeChat to focus when switching conversations
  const activeChat = useChatStore(chatSelectors.activeChat);
  const channelId = activeChat?.channelId;
  const channelType = activeChat?.channelType;

  // Determine whether the current conversation is streaming a response
  const activeStreamingChannels = useMessageStore(state => state.activeStreamingChannels);
  const isStreamingInProgress = useMemo(() => {
    if (!channelId || channelType == null) return false;
    return Object.values(activeStreamingChannels).some(
      c => c.channelId === channelId && c.channelType === channelType
    );
  }, [activeStreamingChannels, channelId, channelType]);

  // Detect user's platform for keyboard shortcut hints
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const newlineHint = isMac
    ? t('chat.input.shortcuts.newline.mac', '⌘ + Enter to newline')
    : t('chat.input.shortcuts.newline.windows', 'Ctrl + Enter to newline');

  // Focus on conversation switch
  useEffect(() => {
    let switchFocusTimeout: number | undefined;
    if (activeChat && textareaRef.current) {
      console.log('Conversation switched, focusing input for:', activeChat.channelInfo?.name || activeChat.channelId);
      // Small delay to ensure the component is fully rendered
      switchFocusTimeout = window.setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          console.log('Focus applied after conversation switch');
        }
      }, 100);
    }
    return () => {
      if (switchFocusTimeout) clearTimeout(switchFocusTimeout);
    };
  }, [activeChat?.id]); // Only trigger when activeChat ID changes

  // Advanced focus management function with multiple strategies
  const maintainTextareaFocus = useCallback(() => {
    if (!textareaRef.current || !shouldMaintainFocus.current) return;

    // Clear any existing timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Strategy 1: Immediate focus attempt
    textareaRef.current.focus();

    // Strategy 2: Delayed focus attempt (for React state updates)
    focusTimeoutRef.current = window.setTimeout(() => {
      if (textareaRef.current && shouldMaintainFocus.current) {
        textareaRef.current.focus();
      }
    }, 50);

    // Strategy 3: Post-render focus attempt
    requestAnimationFrame(() => {
      if (textareaRef.current && shouldMaintainFocus.current && document.activeElement !== textareaRef.current) {
        textareaRef.current.focus();
        console.log('Animation frame focus applied - new active element:', document.activeElement);
        shouldMaintainFocus.current = false; // Reset flag after successful focus
      }
    });
  }, []);

  // Effect-based focus recovery - runs after every render
  // AI toggle integration
  
  // Determine whether this is an agent conversation (channelId ends with -agent)
  const isAgentChat = channelId?.endsWith('-agent') ?? false;
  const isAIChat = isAgentChat;
  
  const channelInfo = useChannelStore(state =>
    channelId && typeof channelType === 'number'
      ? state.getChannel(channelId, channelType)
      : undefined
  );
  const visitorExtra = (channelInfo?.extra as ChannelVisitorExtra | undefined);
  const visitorId = visitorExtra?.id;
  const serviceStatus = visitorExtra?.service_status;
  const assignedStaffId = visitorExtra?.assigned_staff_id;
  const isQueued = serviceStatus === 'queued' || serviceStatus === 'new';
  const isClosed = serviceStatus === 'closed';
  
  // AI status logic:
  // 1. If ai_disabled is not set (null/undefined), use ai_mode (auto -> ON, others -> OFF)
  // 2. If ai_disabled is set, use its value (!ai_disabled -> ON)
  const aiDisabledRaw = visitorExtra?.ai_disabled;
  const aiMode = visitorExtra?.ai_settings?.ai_mode ?? 'auto';
  const isAIEnabled = (aiDisabledRaw === null || aiDisabledRaw === undefined) 
    ? (aiMode === 'auto') 
    : !aiDisabledRaw;
  
  // Get the channel info of the assigned agent (to show the agent's name)
  const assignedStaffChannelId = assignedStaffId ? `${assignedStaffId}-staff` : undefined;
  const assignedStaffChannelInfo = useChannelStore(state => 
    assignedStaffChannelId ? state.getChannel(assignedStaffChannelId, 1) : undefined
  );
  const assignedStaffName = assignedStaffChannelInfo?.name;
  
  // Manual input is not disabled in agent conversations
  const isManualDisabled = isAIChat ? false : isAIEnabled;
  // The input box is not disabled while a stream message is in progress, but the send button becomes a pause button
  const { showToast, showError } = useToast();
  useEffect(() => {
    if (isManualDisabled) {
      setShowEmoji(false);
      setShowScreenshotTip(false);
    }
  }, [isManualDisabled]);

  // When the visitor is assigned to another agent, fetch that agent's channel info to show the name
  const ensureChannel = useChannelStore(state => state.ensureChannel);
  useEffect(() => {
    if (assignedStaffChannelId && !assignedStaffChannelInfo) {
      ensureChannel({ channel_id: assignedStaffChannelId, channel_type: DEFAULT_CHANNEL_TYPE });
    }
  }, [assignedStaffChannelId, assignedStaffChannelInfo, ensureChannel]);

  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  
  // Handle accepting a visitor from the waiting queue
  const handleAcceptVisitor = useCallback(async () => {
    if (!visitorId || isAccepting) return;
    
    try {
      setIsAccepting(true);
      await conversationsApi.acceptVisitor(visitorId);
      
      // Refresh channel info to get updated service_status
      if (channelId && typeof channelType === 'number') {
        const channelStore = useChannelStore.getState();
        await channelStore.refreshChannel({ channel_id: channelId, channel_type: channelType });
      }
      
      showSuccess(showToast, t('chat.input.accept.successTitle', 'Accepted'), t('chat.input.accept.successMessage', 'Visitor accepted successfully'));
      
      // Notify parent to switch to "my" tab
      onAcceptVisitor?.();
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsAccepting(false);
    }
  }, [visitorId, isAccepting, channelId, channelType, showToast, t, onAcceptVisitor]);

  // Image upload & send (WeChat-like)
  const user = useAuthStore(state => state.user);
  const addMessage = useChatStore(state => state.addMessage);
  const updateConversationLastMessage = useChatStore(state => state.updateConversationLastMessage);
  const moveConversationToTop = useChatStore(state => state.moveConversationToTop);
  const updateMessageByClientMsgNo = useChatStore(state => state.updateMessageByClientMsgNo);
  const cancelStreamingMessage = useChatStore(state => state.cancelStreamingMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDocInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage: sendWsMessage, isConnected } = useWuKongIMWebSocket();

  // Local sending guard to prevent duplicate sends within this component
  const [isSendingLocal, setIsSendingLocal] = useState(false);

  const getImageDimensions = useCallback(async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const width = (img as any).naturalWidth || img.width;
        const height = (img as any).naturalHeight || img.height;
        URL.revokeObjectURL(url);
        resolve({ width, height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  }, []);

  const handleClickImageBtn = useCallback(() => {
    if (isManualDisabled) return;
    fileInputRef.current?.click();
  }, [isManualDisabled]);

  const handleClickFileBtn = useCallback(() => {
    if (isManualDisabled) return;
    fileDocInputRef.current?.click();
  }, [isManualDisabled]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;

    // Reset input value to allow re-selecting the same file(s)
    // e.target.value = '';
    if (!filesList || filesList.length === 0) {
      return;
    }

    // Categorize files into images and non-images
    const imageFiles: File[] = [];
    const nonImageFiles: File[] = [];

    Array.from(filesList).forEach(f => {
      const mime = (f.type || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      const isImageByMime = /^image\//i.test(mime);
      const isImageByExt = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|tiff?)$/.test(name);
      const isImage = isImageByMime || isImageByExt;

      if (isImage) {
        imageFiles.push(f);
      } else {
        nonImageFiles.push(f);
      }
    });

    // Handle image files - add to pastedItems (respecting 9-image limit)
    if (imageFiles.length > 0) {
      const currentImageCount = pastedItems.length;
      const availableSlots = 9 - currentImageCount;

      if (availableSlots <= 0) {
        showError(
          t('chat.input.errors.images.limitReachedTitleSimple', 'Image limit reached'),
          t('chat.input.errors.images.limitReachedAddNine', 'Maximum 9 images can be added')
        );
      } else {
        const imagesToAdd = imageFiles.slice(0, availableSlots);
        const skippedCount = imageFiles.length - imagesToAdd.length;

        // Process images and add to pastedItems
        const newPastedItems: PastedItem[] = await Promise.all(
          imagesToAdd.map(async (file) => {
            const previewUrl = URL.createObjectURL(file);
            const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve({ width: 0, height: 0 });
              img.src = previewUrl;
            });

            return {
              file,
              previewUrl,
              width,
              height,
              progress: 0,
              status: 'idle' as const,
            };
          })
        );

        setPastedItems(prev => [...prev, ...newPastedItems]);

        if (skippedCount > 0) {
          showError(
            t('chat.input.errors.images.partialNotAddedTitle', 'Some images not added'),
            t('chat.input.errors.images.partialNotAddedDesc', 'Added {{added}} images, skipped {{skipped}} (exceeds 9 image limit)', { added: imagesToAdd.length, skipped: skippedCount })
          );
        }
      }
    }

    // Handle non-image files - add to selectedFiles (limit to 1)
    if (nonImageFiles.length > 0) {
      if (selectedFiles.length > 0) {
        showError(
          t('chat.input.errors.files.onlyOne', 'Only one file supported'),
          t('chat.input.errors.files.removeCurrent', 'Please remove current file first')
        );
      } else {
        const fileToAdd = nonImageFiles[0];
        const skippedCount = nonImageFiles.length - 1;

        const newItem: SelectedFile = {
          id: `sel-file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file: fileToAdd
        };

        setSelectedFiles([newItem]);

        if (skippedCount > 0) {
          showError(
            t('chat.input.errors.files.onlyOne', 'Only one file supported'),
            t('chat.input.errors.files.skippedOther', 'Added "{{name}}", skipped {{count}} other files', { name: fileToAdd.name, count: skippedCount })
          );
        }
      }
    }
  }, [pastedItems, selectedFiles, setPastedItems, setSelectedFiles, showError]);

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    // Reset input value to allow re-selecting the same file(s)
    // e.target.value = '';
    if (!filesList || filesList.length === 0) return;

    // Build array of File objects (accept only images)
    const files: File[] = Array.from(filesList).filter(f => /^image\/(png|jpe?g|gif|webp)$/i.test(f.type));
    if (files.length === 0) {
      showError(
        t('chat.input.errors.images.unsupportedTypeTitle', 'Unsupported file type'),
        t('chat.input.errors.images.unsupportedTypeDesc', 'Only image files are supported (jpg/png/gif/webp)')
      );
      return;
    }

    // Enforce 9-image limit with feedback
    const current = pastedItems.length;
    const allowed = Math.max(0, 9 - current);
    if (allowed <= 0) {
      showError(
        t('chat.input.errors.images.limitReachedTitle', 'Image limit reached (9 images)'),
        t('chat.input.errors.images.limitReachedDesc', 'Maximum 9 images allowed')
      );
      return;
    }

    const toUse = files.slice(0, allowed);
    if (files.length > allowed) {
      showError(
        t('chat.input.errors.images.tooManyTitle', 'Maximum 9 images allowed'),
        t('chat.input.errors.images.tooManyDesc', 'Exceeded the number of images that can be added')
      );
    }

    // Build preview items and append to pastedItems (do not send immediately)
    const newItems: PastedItem[] = [];
    for (const f of toUse) {
      try {
        const previewUrl = URL.createObjectURL(f);
        const { width, height } = await getImageDimensions(f);
        newItems.push({ file: f, previewUrl, width, height, progress: 0, status: 'idle' });
      } catch {}
    }
    if (newItems.length) {
      setPastedItems(prev => [...prev, ...newItems]);
    }
  }, [pastedItems, getImageDimensions, showError]);


  const handleChangeAI = useCallback(async (nextEnabled: boolean) => {
    if (!visitorId || !channelId || typeof channelType !== 'number') return;
    if (nextEnabled === isAIEnabled) return; // no change
    try {

      setIsTogglingAI(true);

      const chatStore = useChatStore.getState();
      const channelStore = useChannelStore.getState();

      // Call appropriate API to reach desired state
      const updated = nextEnabled
        ? await visitorApiService.enableAI(visitorId)
        : await visitorApiService.disableAI(visitorId);

      // Toast success
      if (nextEnabled) {
        showSuccess(showToast, t('chat.input.ai.enabledTitle', 'AI Enabled'), t('chat.input.ai.enabledMessage', 'Visitor AI assistant has been enabled'));
      } else {
        showSuccess(showToast, t('chat.input.ai.disabledTitle', 'AI Disabled'), t('chat.input.ai.disabledMessage', 'Visitor AI assistant has been disabled'));
      }

      // Patch local store state to reflect new status immediately
      const current = channelStore.getChannel(channelId, channelType);
      if (current) {
        const newAiDisabled = (updated as any)?.ai_disabled ?? !nextEnabled;
        const newExtra = { ...(current.extra as any), ai_disabled: newAiDisabled };
        channelStore.seedChannel(channelId, channelType, { extra: newExtra });
        chatStore.applyChannelInfo(channelId, channelType, { ...current, extra: newExtra });
      }
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsTogglingAI(false);
    }
  }, [visitorId, channelId, channelType, isAIEnabled, showToast]);

  useEffect(() => {
    if (shouldMaintainFocus.current) {
      maintainTextareaFocus();
    }
  });

  // Focus restoration when isSending changes from true to false
  useEffect(() => {
    if (!isSending && shouldMaintainFocus.current) {
      console.log('isSending changed to false, attempting focus restoration');
      maintainTextareaFocus();
    }
  }, [isSending, maintainTextareaFocus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Format bytes for human readable size
  const formatBytes = useCallback((bytes?: number) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }, []);

  // Remove a selected file from preview
  const removeSelectedFile = useCallback((id: string) => {
    setSelectedFiles(prev => prev.filter(sf => sf.id !== id));
  }, []);


  const handleCancelStream = useCallback(async (): Promise<void> => {
    if (!isStreamingInProgress) return;
    
    // Find the streaming message ID of the current conversation
    const entry = Object.entries(activeStreamingChannels).find(
      ([_, c]) => c.channelId === channelId && c.channelType === channelType
    );
    const targetClientMsgNo = entry ? entry[0] : undefined;

    try {
      await cancelStreamingMessage(targetClientMsgNo);
      showSuccess(showToast, t('chat.input.streaming.cancelledTitle', 'Paused'), t('chat.input.streaming.cancelledMessage', 'Streaming message paused'));
    } catch (error) {
      console.error('Failed to cancel stream message:', error);
      showApiError(showToast, error);
    }
  }, [isStreamingInProgress, activeStreamingChannels, channelId, channelType, cancelStreamingMessage, showToast, t]);

  const handleSend = async (): Promise<void> => {
    if (isManualDisabled) return;
    if (isSending || isSendingLocal) return;
    
    // If streaming in progress, cancel it instead of sending
    if (isStreamingInProgress) {
      await handleCancelStream();
      return;
    }

    const hasImages = pastedItems.length > 0;
    const hasText = !!message.trim();
    const hasFiles = selectedFiles.length > 0;

    shouldMaintainFocus.current = true;

    // Priority order:
    // 1. Text + Images → RICH_TEXT with images
    // 2. Text + File → RICH_TEXT with file
    // 3. Images only → IMAGE messages
    // 4. File only → FILE message
    // 5. Text only → TEXT message

    try {
      if (hasImages && hasText) {
        setIsSendingLocal(true);
        await sendRichTextWithImages();
      } else if (hasFiles && hasText) {
        setIsSendingLocal(true);
        await sendRichTextWithFile();
      } else if (hasImages) {
        setIsSendingLocal(true);
        await sendImagesOnly();
      } else if (hasFiles) {
        setIsSendingLocal(true);
        await sendSelectedFilesOnly();
      } else if (hasText) {
        onSendMessage?.(message.trim());
        setMessage('');

      }
    } finally {
      setIsSendingLocal(false);
      maintainTextareaFocus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isManualDisabled) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      // Don't handle Enter if IME is composing (Chinese input method active)
      if (isComposing) {
        return;
      }

      // Ctrl + Enter (Windows) or Cmd + Enter (Mac) for new line
      if (e.ctrlKey || e.metaKey) {
        // Insert new line at cursor position
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = `${message.substring(0, start)}\n${message.substring(end)}`;
          setMessage(newValue);

          // Set cursor position after the inserted newline
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          }, 0);
        }
        return;
      }

      // Plain Enter to send message (text, images or files)
      const canSend = !isSending && !isSendingLocal && (message.trim() || pastedItems.length > 0 || selectedFiles.length > 0);
      if (canSend) {
        e.preventDefault(); // Prevent new line
        handleSend();
      } else {
        e.preventDefault(); // Prevent new line if nothing to send or currently sending
      }
    }
  };

  // Handle IME composition events for Chinese input methods
  const handleCompositionStart = (): void => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (): void => {
    setIsComposing(false);
  };

  // Insert emoji at current cursor position and keep focus
  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? message.length;
    const end = ta.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      try {
        ta.selectionStart = ta.selectionEnd = pos;
      } catch {
        // Some browsers may throw if not focusable; ignore
      }
    });
  }, [message]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isManualDisabled) { e.preventDefault(); return; }
    const cd = e.clipboardData;
    if (!cd) return;
    const items = Array.from(cd.items).filter(it => it.kind === 'file' && it.type && it.type.startsWith('image/'));
    if (!items.length) return; // allow normal text paste if no image

    // Prevent default text paste when images are present
    e.preventDefault();

    const files: File[] = [];
    for (const it of items) {
      const f = it.getAsFile();
      if (f && /^image\/(png|jpe?g|gif|webp)$/i.test(f.type)) {
        files.push(f);
      }
    }
    if (!files.length) return;

    // Enforce 9-image limit
    const current = pastedItems.length;
    const allowed = Math.max(0, 9 - current);
    if (allowed <= 0) {
      showError(
        t('chat.input.errors.images.limitReachedTitle', '\u5df2\u8fbe\u5230\u56fe\u7247\u6570\u91cf\u4e0a\u9650\uff089\u5f20\uff09'),
        t('chat.input.errors.images.limitReachedDesc', '\u6700\u591a\u53ea\u80fd\u4e0a\u4f209\u5f20\u56fe\u7247')
      );
      return;
    }
    const toUse = files.slice(0, allowed);
    if (files.length > allowed) {
      showError(
        t('chat.input.errors.images.tooManyTitle', '\u6700\u591a\u53ea\u80fd\u4e0a\u4f209\u5f20\u56fe\u7247'),
        t('chat.input.errors.images.tooManyDesc', '\u5df2\u8d85\u8fc7\u53ef\u6dfb\u52a0\u7684\u56fe\u7247\u6570\u91cf')
      );
    }

    setShowScreenshotTip(false);

    // Build new pasted items with preview URLs and dimensions
    const newItems: PastedItem[] = [];
    for (const f of toUse) {
      try {
        const previewUrl = URL.createObjectURL(f);
        const { width, height } = await getImageDimensions(f);
        newItems.push({ file: f, previewUrl, width, height, progress: 0, status: 'idle' });
      } catch {}
    }
    if (newItems.length) {
      setPastedItems(prev => [...prev, ...newItems]);
    }
  }, [pastedItems, getImageDimensions, showError, isManualDisabled]);

  // Cleanup preview URLs on unmount or when items change
  useEffect(() => {
    return () => {
      for (const it of pastedItems) {
        try { URL.revokeObjectURL(it.previewUrl); } catch {}
      }
    };
  }, [pastedItems]);


  const removePastedItem = useCallback((index: number) => {
    setPastedItems(prev => {
      const arr = [...prev];
      const [removed] = arr.splice(index, 1);
      if (removed) {
        try { URL.revokeObjectURL(removed.previewUrl); } catch {}
      }
      return arr;
    });
    // Reset image input so re-selecting the same files will trigger onChange again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const sendImagesOnly = useCallback(async (): Promise<void> => {
    if (!channelId || typeof channelType !== 'number') {
      showError(
        t('chat.input.errors.noConversationTitle', 'Please select a conversation'),
        t('chat.input.errors.noConversationDesc.image', 'Please select a conversation before sending images')
      );
      return;
    }

    const items = [...pastedItems];
    for (const it of items) {
      const nowId = `local-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const width = it.width; const height = it.height;
      const previewUrl = it.previewUrl;

      const localMessage: Message = {
        id: nowId,
        type: 'staff',
        content: '[Image]',
        timestamp: new Date().toISOString(),
        messageId: nowId,
        clientMsgNo: nowId,
        messageSeq: 0,
        fromUid: user?.id ? `${user.id}-staff` : 'staff',
        channelId: channelId,
        channelType: channelType,
        payloadType: MessagePayloadType.IMAGE,
        metadata: {
          isLocal: true,
          image_preview_url: previewUrl,
          image_width: width,
          image_height: height,
          upload_status: 'uploading',
          upload_progress: 0,
        }
      };

      addMessage(localMessage);
      updateConversationLastMessage(channelId, channelType, localMessage);
      moveConversationToTop(channelId, channelType);

      await uploadChatImageWithProgress(it.file, channelId, channelType, {
        onProgress: (p) => {
          updateMessageByClientMsgNo(nowId, {
            metadata: {
              upload_progress: p.progress,
              upload_status: p.status,
            }
          });
        }
      }).then(async (res) => {
        updateMessageByClientMsgNo(nowId, {
          metadata: {
            image_url: toAbsoluteApiUrl(res.file_url),
            upload_progress: 100,
            upload_status: 'completed',
          }
        });

        const payload = {
          type: MessagePayloadType.IMAGE,
          content: '[Image]',
          url: toAbsoluteApiUrl(res.file_url),
          width,
          height,
          timestamp: Date.now(),
        } as any;

        try {
          if (visitorExtra?.platform_type && visitorExtra.platform_type !== PlatformType.WEBSITE) {
            try {
              await chatMessagesApiService.staffSendPlatformMessage({
                channel_id: channelId,
                channel_type: channelType,
                payload,
                client_msg_no: nowId,
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : t('chat.input.errors.platformFailed', 'Platform message send failed, please try again later');
              updateMessageByClientMsgNo(nowId, { metadata: { platform_send_error: true, error_text: errMsg } });
              showApiError(showToast, err);
              return;
            }
          }
          if (!isConnected) throw new Error(t('chat.input.errors.websocketNotConnected.image', 'WebSocket not connected, cannot send image message'));
          console.log("Sending image message via WebSocket", payload);
          await sendWsMessage(channelId, channelType, payload, nowId);
          updateMessageByClientMsgNo(nowId, { metadata: { ws_sent: true, ws_send_error: false } });
        } catch (err) {
          const errMsg = getErrorMessage(err, t, 'chat.input.errors.websocketFailed', 'WebSocket send failed, please check your network connection');
          updateMessageByClientMsgNo(nowId, { metadata: { ws_send_error: true, error_text: errMsg } });
          showApiError(showToast, err);
        }
      }).catch((err) => {
        const errorMessage = getErrorMessage(err);
        updateMessageByClientMsgNo(nowId, { metadata: { upload_status: 'error', error_text: errorMessage } });
        showApiError(showToast, err);
      });
    }
    // Clear previews after triggering sends
    setPastedItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pastedItems, channelId, channelType, user?.id, addMessage, updateConversationLastMessage, moveConversationToTop, updateMessageByClientMsgNo, isConnected, sendWsMessage, showToast, showError, visitorExtra?.platform_type]);

  // Send selected files (each as a separate message)
  const sendSelectedFilesOnly = useCallback(async (): Promise<void> => {
    const items = [...selectedFiles];
    if (!items.length) return;

    if (!channelId || typeof channelType !== 'number') {
      showError(
        t('chat.input.errors.noConversationTitle', 'Please select a conversation'),
        t('chat.input.errors.noConversationDesc.file', 'Please select a conversation before sending files')
      );
      return;
    }

    for (const it of items) {
      const f = it.file;
      const nowId = `local-file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const localMessage: Message = {
        id: nowId,
        type: 'staff',
        content: '[File]',
        timestamp: new Date().toISOString(),
        messageId: nowId,
        clientMsgNo: nowId,
        messageSeq: 0,
        fromUid: user?.id ? `${user.id}-staff` : 'staff',
        channelId: channelId,
        channelType: channelType,
        payloadType: MessagePayloadType.FILE,
        metadata: {
          isLocal: true,
          file_name: f.name,
          file_size: f.size,
          upload_status: 'uploading',
          upload_progress: 0,
          file: f as any,
        }
      };

      addMessage(localMessage);
      updateConversationLastMessage(channelId, channelType, localMessage);
      moveConversationToTop(channelId, channelType);

      await uploadChatFileWithProgress(f, channelId, channelType, {
        onProgress: (p) => {
          updateMessageByClientMsgNo(nowId, {
            metadata: {
              upload_progress: p.progress,
              upload_status: p.status,
            }
          });
        }
      }).then(async (res) => {
        const fileUrl = toAbsoluteApiUrl(res.file_url);
        updateMessageByClientMsgNo(nowId, {
          metadata: {
            file_url: fileUrl,
            upload_progress: 100,
            upload_status: 'completed',
          }
        });

        const payload = {
          type: MessagePayloadType.FILE,
          content: '[File]',
          url: fileUrl,
          name: f.name,
          size: f.size,
          timestamp: Date.now(),
        } as any;

        try {
          if (visitorExtra?.platform_type && visitorExtra.platform_type !== PlatformType.WEBSITE) {
            try {
              await chatMessagesApiService.staffSendPlatformMessage({
                channel_id: channelId,
                channel_type: channelType,
                payload,
                client_msg_no: nowId,
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : t('chat.input.errors.platformFailed', 'Platform message send failed, please try again later');
              updateMessageByClientMsgNo(nowId, { metadata: { platform_send_error: true, error_text: errMsg } });
              showApiError(showToast, err);
              return;
            }
          }
          if (!isConnected) throw new Error(t('chat.input.errors.websocketNotConnected.file', 'WebSocket not connected, cannot send file message'));
          await sendWsMessage(channelId, channelType, payload, nowId);
          updateMessageByClientMsgNo(nowId, { metadata: { ws_sent: true, ws_send_error: false } });
        } catch (err) {
          const errMsg = getErrorMessage(err, t, 'chat.input.errors.websocketFailed', 'WebSocket send failed, please check your network connection');
          updateMessageByClientMsgNo(nowId, { metadata: { ws_send_error: true, error_text: errMsg } });
          showApiError(showToast, err);
        }
      }).catch((err) => {
        const errorMessage = getErrorMessage(err);
        updateMessageByClientMsgNo(nowId, { metadata: { upload_status: 'error', error_text: errorMessage } });
        showApiError(showToast, err);
      });
    }

    // Clear previews after triggering sends
    setSelectedFiles([]);
  }, [selectedFiles, channelId, channelType, user?.id, addMessage, updateConversationLastMessage, moveConversationToTop, updateMessageByClientMsgNo, isConnected, sendWsMessage, showToast, showError, visitorExtra?.platform_type]);

  // Send rich text message with file attachment (text + file)
  const sendRichTextWithFile = useCallback(async (): Promise<void> => {
    const textContent = message.trim();
    const fileItem = selectedFiles[0];
    if (!fileItem || !textContent) return;

    if (!channelId || typeof channelType !== 'number') {
      showError(
        t('chat.input.errors.noConversationTitle', 'Please select a conversation'),
        t('chat.input.errors.noConversationDesc.message', 'Please select a conversation before sending messages')
      );
      return;
    }

    const nowId = `local-rich-file-${Date.now()}`;
    const f = fileItem.file;

    const localMessage: Message = {
      id: nowId,
      type: 'staff',
      content: textContent,
      timestamp: new Date().toISOString(),
      messageId: nowId,
      clientMsgNo: nowId,
      messageSeq: 0,
      fromUid: user?.id ? `${user.id}-staff` : 'staff',
      channelId: channelId,
      channelType: channelType,
      payloadType: MessagePayloadType.RICH_TEXT,
      metadata: {
        isLocal: true,
        file_name: f.name,
        file_size: f.size,
        upload_status: 'uploading',
        upload_progress: 0,
        file: f as any,
      }
    };

    addMessage(localMessage);
    updateConversationLastMessage(channelId, channelType, localMessage);
    moveConversationToTop(channelId, channelType);

    try {
      const res = await uploadChatFileWithProgress(f, channelId, channelType, {
        onProgress: (p) => {
          updateMessageByClientMsgNo(nowId, {
            metadata: {
              upload_progress: p.progress,
              upload_status: p.status,
            }
          });
        }
      });

      const fileUrl = toAbsoluteApiUrl(res.file_url);
      updateMessageByClientMsgNo(nowId, {
        metadata: {
          file_url: fileUrl,
          upload_progress: 100,
          upload_status: 'completed',
        }
      });

      const payload = {
        type: MessagePayloadType.RICH_TEXT,
        content: textContent,
        images: [],
        file: {
          url: fileUrl,
          name: f.name,
          size: f.size,
        },
        timestamp: Date.now(),
      } as any;

      try {
        if (visitorExtra?.platform_type && visitorExtra.platform_type !== PlatformType.WEBSITE) {
          try {
            await chatMessagesApiService.staffSendPlatformMessage({
              channel_id: channelId,
              channel_type: channelType,
              payload,
              client_msg_no: nowId,
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : t('chat.input.errors.platformFailed', 'Platform message send failed, please try again later');
            updateMessageByClientMsgNo(nowId, { metadata: { platform_send_error: true, error_text: errMsg } });
            showApiError(showToast, err);
            return;
          }
        }
        if (!isConnected) throw new Error(t('chat.input.errors.websocketNotConnected.message', 'WebSocket not connected, cannot send message'));
        console.log("Sending rich text with file message via WebSocket", payload);
        await sendWsMessage(channelId, channelType, payload, nowId);
        updateMessageByClientMsgNo(nowId, { metadata: { ws_sent: true, ws_send_error: false } });
      } catch (err) {
        const errMsg = getErrorMessage(err, t, 'chat.input.errors.websocketFailed', 'WebSocket send failed, please check your network connection');
        updateMessageByClientMsgNo(nowId, { metadata: { ws_send_error: true, error_text: errMsg } });
        showApiError(showToast, err);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      updateMessageByClientMsgNo(nowId, { metadata: { upload_status: 'error', error_text: errorMessage } });
      showApiError(showToast, err);
      return;
    }

    setSelectedFiles([]);
    setMessage('');
  }, [selectedFiles, message, channelId, channelType, user?.id, addMessage, updateConversationLastMessage, moveConversationToTop, updateMessageByClientMsgNo, isConnected, sendWsMessage, showToast, showError, visitorExtra?.platform_type]);

  const sendRichTextWithImages = useCallback(async (): Promise<void> => {
    const items = [...pastedItems];
    if (!items.length) return;
    if (!channelId || typeof channelType !== 'number') {
      showError(
        t('chat.input.errors.noConversationTitle', 'Please select a conversation'),
        t('chat.input.errors.noConversationDesc.image', 'Please select a conversation before sending images')
      );
      return;
    }

    const nowId = `local-rich-${Date.now()}`;
    let imagesMeta = items.map(it => ({
      preview_url: it.previewUrl,
      width: it.width,
      height: it.height,
      file: it.file,
      upload_status: 'uploading',
      upload_progress: 0,
    }));

    const localMessage: Message = {
      id: nowId,
      type: 'staff',
      content: message.trim(),
      timestamp: new Date().toISOString(),
      messageId: nowId,
      clientMsgNo: nowId,
      messageSeq: 0,
      fromUid: user?.id ? `${user.id}-staff` : 'staff',
      channelId: channelId,
      channelType: channelType,
      payloadType: MessagePayloadType.RICH_TEXT,
      metadata: {
        isLocal: true,
        images: imagesMeta,
      }
    };

    addMessage(localMessage);
    updateConversationLastMessage(channelId, channelType, localMessage);
    moveConversationToTop(channelId, channelType);
    const finalUrls: (string | null)[] = new Array(items.length).fill(null);

    const uploadPromises = items.map((it, idx) =>
      uploadChatImageWithProgress(it.file, channelId, channelType, {


        onProgress: (p) => {
          imagesMeta = imagesMeta.map((img, i) => i === idx ? { ...img, upload_progress: p.progress, upload_status: p.status } : img);
          updateMessageByClientMsgNo(nowId, { metadata: { images: imagesMeta } });
          setPastedItems(prev => prev.map((pi, i) => i === idx ? { ...pi, progress: p.progress, status: p.status } : pi));
        }
      }).then((res) => {
        const url = toAbsoluteApiUrl(res.file_url);
        finalUrls[idx] = url;
        imagesMeta = imagesMeta.map((img, i) => i === idx ? { ...img, upload_progress: 100, upload_status: 'completed', url } : img);
        updateMessageByClientMsgNo(nowId, { metadata: { images: imagesMeta } });
      }).catch((err) => {
        const errorMessage = getErrorMessage(err);
        imagesMeta = imagesMeta.map((img, i) => i === idx ? { ...img, upload_status: 'error', error_text: errorMessage } : img);
        updateMessageByClientMsgNo(nowId, { metadata: { images: imagesMeta } });
        showApiError(showToast, err);
        throw err;
      })
    );

    try {
      await Promise.all(uploadPromises);
    } catch {
      // If any upload fails, don't send the rich text message
      return;
    }

    const imagesPayload = items.map((it, i) => ({ url: finalUrls[i] as string, width: it.width, height: it.height }));
    const payload = {
      type: MessagePayloadType.RICH_TEXT,
      content: message.trim(),
      images: imagesPayload,
      timestamp: Date.now(),
    } as any;

    try {
      if (visitorExtra?.platform_type && visitorExtra.platform_type !== PlatformType.WEBSITE) {
        try {
          await chatMessagesApiService.staffSendPlatformMessage({
            channel_id: channelId,
            channel_type: channelType,
            payload,
            client_msg_no: nowId,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : t('chat.input.errors.platformFailed', 'Platform message send failed, please try again later');
          updateMessageByClientMsgNo(nowId, { metadata: { platform_send_error: true, error_text: errMsg } });
          showApiError(showToast, err);
          return;
        }
      }
      if (!isConnected) throw new Error(t('chat.input.errors.websocketNotConnected.richText', 'WebSocket not connected, cannot send rich text message'));
      console.log("Sending rich text with images message via WebSocket", payload);
      await sendWsMessage(channelId, channelType, payload, nowId);
      updateMessageByClientMsgNo(nowId, { metadata: { ws_sent: true, ws_send_error: false } });
    } catch (err) {
      const errMsg = getErrorMessage(err, t, 'chat.input.errors.websocketFailed', 'WebSocket send failed, please check your network connection');
      updateMessageByClientMsgNo(nowId, { metadata: { ws_send_error: true, error_text: errMsg } });
      showApiError(showToast, err);
    }

    setPastedItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setMessage('');
  }, [pastedItems, channelId, channelType, user?.id, addMessage, updateConversationLastMessage, moveConversationToTop, updateMessageByClientMsgNo, isConnected, sendWsMessage, showToast, showError, message, visitorExtra?.platform_type]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(e.target.value);
  };

  // Listen for plugin actions
  useEffect(() => {
    const handleInsertText = (e: any) => {
      const { text, replace } = e.detail;
      if (replace) {
        setMessage(text);
      } else {
        setMessage(prev => (prev ? `${prev}\n${text}` : text));
      }
      textareaRef.current?.focus();
    };

    const handleSendMessageAction = (e: any) => {
      const { content } = e.detail;
      onSendMessage?.(content);
    };

    window.addEventListener('tgo:insert_text', handleInsertText);
    window.addEventListener('tgo:send_message', handleSendMessageAction);
    
    return () => {
      window.removeEventListener('tgo:insert_text', handleInsertText);
      window.removeEventListener('tgo:send_message', handleSendMessageAction);
    };
  }, [onSendMessage]);

  // If visitor is in queued status, show accept button instead of input area
  if (isQueued && visitorId) {
    return (
      <footer className="relative z-10 mx-4 mb-4 mt-2 rounded-[24px] bg-gray-50 ring-1 ring-gray-100 dark:bg-gray-800/60 dark:ring-gray-700">
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('chat.input.accept.hint', 'This visitor is waiting to be accepted')}
          </p>
          <button
            onClick={handleAcceptVisitor}
            disabled={isAccepting}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(15,16,18,0.7)] transition-all duration-200 hover:-translate-y-px active:scale-95 disabled:opacity-60 dark:bg-acid-400 dark:text-ink-900"
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('chat.input.accept.accepting', 'Accepting...')}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{t('chat.input.accept.button', 'Accept Visitor')}</span>
              </>
            )}
          </button>
        </div>
      </footer>
    );
  }

  // If conversation is closed, don't show input area
  if (isClosed) {
    return (
      <footer className="relative z-10 mx-4 mb-4 mt-2 rounded-[24px] bg-gray-50 ring-1 ring-gray-100 dark:bg-gray-800/60 dark:ring-gray-700">
        <div className="flex items-center justify-center py-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('chat.input.closed', 'Conversation ended')}
          </p>
        </div>
      </footer>
    );
  }

  // If visitor is assigned to another staff, don't show input area
  // Only check when assignedStaffId exists and is not the current user
  const isNotMyVisitor = assignedStaffId && user?.id && assignedStaffId !== user.id;
  if (isNotMyVisitor) {
    const staffDisplayName = assignedStaffName || t('chat.input.otherAgent', 'another agent');
    return (
      <footer className="relative z-10 mx-4 mb-4 mt-2 rounded-[24px] bg-gray-50 ring-1 ring-gray-100 dark:bg-gray-800/60 dark:ring-gray-700">
        <div className="flex items-center justify-center py-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('chat.input.notMyVisitor', 'This visitor is assigned to {{name}}', { name: staffDisplayName })}
          </p>
        </div>
      </footer>
    );
  }

  const canSend = Boolean(message.trim() || pastedItems.length > 0 || selectedFiles.length > 0)
    && !isSending && !isSendingLocal && !isManualDisabled;

  return (
    <footer className="relative z-10 px-4 pb-4 pt-2">
      <div className={`rounded-[24px] bg-white ring-1 shadow-[0_10px_30px_-18px_rgba(15,16,18,0.35)] transition-[box-shadow,background-color] duration-300 dark:bg-gray-800 ${
        isManualDisabled
          ? 'ring-gray-100 dark:ring-gray-700'
          : 'ring-gray-200 focus-within:ring-2 focus-within:ring-acid-400 focus-within:shadow-[0_16px_40px_-20px_rgba(143,179,30,0.55)] dark:ring-gray-700'
      }`}>

      {/* Hidden file input for image selection */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} disabled={isManualDisabled} />

      {/* Hidden file input for document/file selection */}
      <input
        ref={fileDocInputRef}
        type="file"
        accept=".pdf,application/pdf,.doc,application/msword,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xls,application/vnd.ms-excel,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.ppt,application/vnd.ms-powerpoint,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.txt,text/plain,.csv,text/csv,.md,text/markdown,.zip,application/zip,.rar,application/x-rar-compressed,.7z,application/x-7z-compressed"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isManualDisabled}
      />

      {showEmoji && (
        <EmojiPickerPopover
          anchorRef={emojiBtnRef}

          onSelect={(emoji) => { insertEmoji(emoji); setShowEmoji(false); }}
          onClose={() => setShowEmoji(false)}
        />
      )}
      {showScreenshotTip && (
        <>
          {createPortal(
            <div className="fixed inset-0 z-[999]" onClick={() => setShowScreenshotTip(false)} aria-hidden="true" />,
            document.body
          )}
          {createPortal(
            <div
              className="animate-in fade-in zoom-in-95 fixed z-[1000] w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700"
              style={{ top: screenshotTipPos.top, left: screenshotTipPos.left, width: TIP_WIDTH }}
              role="dialog"
              aria-label={t('chat.input.screenshotTip.aria', 'Screenshot send tip')}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('chat.input.screenshotTip.title', 'Screenshot Send Tip')}</span>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label={t('common.close', 'Close')}
                    onClick={() => setShowScreenshotTip(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  <p>{t('chat.input.screenshotTip.line1', 'You can use QQ, WeChat, or system screenshot tools to take a screenshot,')}</p>
                  <p>
                    {t('chat.input.screenshotTip.line2.prefix', 'then press')}
                    <span className="mx-1 inline-block font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      {isMac ? '⌘ + V' : 'Ctrl + V'}
                    </span>
                    {isMac && (
                      <>
                        {t('common.or', 'or')}
                        <span className="ml-1 inline-block font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">Cmd + V</span>
                      </>
                    )}
                    {t('chat.input.screenshotTip.line2.suffix', 'in the message input box to paste and send the image')}
                  </p>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* Selected files preview (documents) */}
      {selectedFiles.length > 0 && (
        <div className="px-3 pt-3">
          <ul className="space-y-2">
            {selectedFiles.map((sf) => (
              <li key={sf.id} className="tgo-fade-up flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-gray-900 px-3 py-2">
                <div className="flex items-center space-x-3 min-w-0">
                  {getFileIcon(sf.file.name, 'w-5 h-5')}
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate max-w-[280px]">{sf.file.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatBytes(sf.file.size)}</span>
                </div>
                <button
                  onClick={() => removeSelectedFile(sf.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 text-sm transition-colors"
                  aria-label={t('chat.input.file.remove', 'Remove file')}
                  title={t('chat.input.file.remove', 'Remove file')}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pasted images preview (multiple) */}
      {pastedItems.length > 0 && (
        <div className="px-3 pt-3">
          {(() => {
            const count = pastedItems.length;
            const gridColsClass = count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-3';
            const getGridItemClass = (idx: number): string => {
              if (count >= 3) {
                const remainder = count % 3;
                if (remainder === 1 && idx === count - 1) return 'col-start-2'; // 4/7 center single
                // 5/8: left-align last row (no override)
              }
              return '';
            };
            return (
              <div className={`grid ${gridColsClass} gap-2 w-fit`}>
                {pastedItems.map((it, idx) => (
                  <div key={idx} className={`tgo-pop relative rounded-2xl bg-white dark:bg-gray-900 ${getGridItemClass(idx)}`}>
                    <img src={it.previewUrl} alt={t('chat.input.preview.imageAlt', 'Preview image {{index}}', { index: idx + 1 })} className="w-[100px] h-[100px] rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
                    {/* Progress overlay */}
                    {it.status && it.status !== 'idle' && it.status !== 'completed' && (
                      <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs">{Math.round(it.progress || 0)}%</span>
                      </div>
                    )}
                    {it.status === 'error' && (
                      <div className="absolute inset-0 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-700 text-xs text-center px-1 leading-5">
                        {t('chat.input.upload.failed', 'Upload failed')}
                      </div>
                    )}
                    <button
                      onClick={() => removePastedItem(idx)}
                      className="absolute -top-2 -right-2 bg-ink-900 text-white rounded-full w-6 h-6 leading-6 text-center text-xs shadow-md hover:scale-110 transition-transform"
                      aria-label={t('chat.input.preview.removeAria', 'Remove preview')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Message input */}
      <textarea
        ref={textareaRef}
        placeholder={isManualDisabled ? t('chat.input.disabled.placeholder', 'AI assistant enabled, manual input disabled') : t('chat.input.placeholder', 'Type a message...')}
        rows={2}
        value={message}
        onChange={handleMessageChange}
        onKeyDown={handleKeyPress}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        readOnly={isSending || isSendingLocal || isManualDisabled}
        disabled={isManualDisabled}
        title={isManualDisabled ? t('chat.input.disabled.placeholder', 'AI assistant enabled, manual input disabled') : undefined}
        className={`block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-500 ${
          isSending || isSendingLocal || isManualDisabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />

      {/* Toolbar + send controls */}
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
        <div className="flex items-center gap-0.5">
          <button
            ref={emojiBtnRef}
            onClick={() => { if (isManualDisabled) return; setShowEmoji(v => !v); }}
            disabled={isManualDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-ink-900 dark:hover:bg-gray-700 dark:hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('chat.input.emoji.aria', 'Open emoji picker')}
            title={isManualDisabled ? t('chat.input.disabled.tooltip', 'AI assistant enabled, manual input disabled') : t('chat.input.emoji.title', 'Insert emoji')}
          >
            <Smile className="w-[18px] h-[18px]" />
          </button>
          <button
            ref={screenshotBtnRef}
            onClick={() => { if (isManualDisabled) return; handleClickScreenshotBtn(); }}
            disabled={isManualDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-ink-900 dark:hover:bg-gray-700 dark:hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('chat.input.screenshot.aria', 'Screenshot paste instructions')}
            title={isManualDisabled ? t('chat.input.disabled.tooltip', 'AI assistant enabled, manual input disabled') : t('chat.input.screenshot.title', 'Screenshot')}
          >
            <Scissors className="w-[18px] h-[18px]" />
          </button>
          <button onClick={handleClickImageBtn} disabled={isManualDisabled} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-ink-900 dark:hover:bg-gray-700 dark:hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" aria-label={t('chat.input.image.aria', 'Upload image')} title={isManualDisabled ? t('chat.input.disabled.tooltip', 'AI assistant enabled, manual input disabled') : t('chat.input.image.title', 'Send image')}>
            <ImageIcon className="w-[18px] h-[18px]" />
          </button>
          <button onClick={handleClickFileBtn} disabled={isManualDisabled} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-ink-900 dark:hover:bg-gray-700 dark:hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" aria-label={t('chat.input.file.aria', 'Upload file')} title={isManualDisabled ? t('chat.input.disabled.tooltip', 'AI assistant enabled, manual input disabled') : t('chat.input.file.title', 'Send file')}>
            <Folder className="w-[18px] h-[18px]" />
          </button>

          <ChatToolbarPluginButtons
            disabled={isManualDisabled}
            context={{
              extension_type: 'chat_toolbar',
              visitor_id: visitorId,
              channel_id: channelId,
              channel_type: channelType,
              platform_type: visitorExtra?.platform_type,
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-gray-400 dark:text-gray-500 xl:inline">
            {t('chat.input.shortcuts.sendWithHint', 'Enter to send • {{hint}}', { hint: newlineHint })}
          </span>

          {/* AI assistant toggle - not shown in agent conversations */}
          {!isAIChat && (
            <div
              className={`flex h-9 items-center gap-2 rounded-full pl-3 pr-1.5 transition-colors duration-300 ${isAIEnabled ? 'bg-acid-200/70 dark:bg-acid-400/15' : 'bg-gray-100 dark:bg-gray-700/60'}`}
              title={isAIEnabled ? t('chat.input.ai.enabled', 'AI enabled') : t('chat.input.ai.disabled', 'AI disabled')}
            >
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 select-none">{t('chat.input.ai.label', 'AI Assistant')}</span>
              <Toggle
                aria-label={t('chat.input.ai.toggleAria', 'Toggle AI assistant')}
                checked={isAIEnabled}
                onChange={handleChangeAI}
                disabled={!visitorId || isTogglingAI}
              />
            </div>
          )}

          {isStreamingInProgress ? (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-500 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-orange-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 dark:bg-orange-600 dark:hover:bg-orange-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCancelStream}
              title={t('chat.input.streaming.pauseTooltip', 'Pause streaming message')}
            >
              <Pause className="w-4 h-4" />
              <span>{t('chat.input.streaming.pause', 'Pause')}</span>
            </button>
          ) : (
            <button
              className={`group inline-flex h-9 items-center gap-2 rounded-full pl-4 pr-1 text-sm font-medium transition-all duration-300 focus:outline-none ${
                canSend
                  ? 'bg-ink-900 text-white shadow-[0_10px_22px_-12px_rgba(15,16,18,0.8)] hover:-translate-y-px active:scale-95 dark:bg-acid-400 dark:text-ink-900'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSend}
              disabled={!canSend}
              title={isManualDisabled ? t('chat.input.disabled.cannotSendTooltip', 'AI assistant enabled, manual send disabled') : undefined}
            >
              <span>{isSending || isSendingLocal ? t('chat.input.send.sending', 'Sending...') : t('chat.input.send.label', 'Send')}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
                canSend ? 'bg-acid-400 text-ink-900 group-hover:translate-x-0.5 dark:bg-ink-900 dark:text-acid-400' : 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-400'
              }`}>
                {isSending || isSendingLocal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </span>
            </button>
          )}
        </div>
      </div>
      </div>
    </footer>
  );
};

export default MessageInput;
