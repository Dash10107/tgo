import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MessagePayloadType, PlatformType, isSystemMessageType, type Message, type PayloadSystem } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { StreamEndReason } from '@/stores/chatStore';
import { useChannelDisplay } from '@/hooks/useChannelDisplay';
import { getPlatformIconComponent, getPlatformLabel, toPlatformType, getPlatformColor } from '@/utils/platformUtils';

import AIInfoCard from './AIInfoCard';
import ReplySuggestions from './ReplySuggestions';
import { ChatAvatar } from './ChatAvatar';

import TextMessage from './messages/TextMessage';
import ImageMessage from './messages/ImageMessage';
import FileMessage from './messages/FileMessage';
import RichTextMessage from './messages/RichTextMessage';
import JSONRenderMessage from './messages/JSONRenderMessage';
import LoadingMessage from './messages/LoadingMessage';
import AIErrorMessage from './messages/AIErrorMessage';
import SystemMessage from './messages/SystemMessage';

interface ChatMessageProps {
  message: Message;
  onSuggestionClick?: (suggestion: string) => void;
  /** Callback for sending a message (used by the msg:// protocol in Widgets) */
  onSendMessage?: (message: string) => void;
}

/**
 * Renders the appropriate message content component based on message type
 */
const MessageContent: React.FC<{
  message: Message;
  isStaff: boolean;
  streamError: boolean;
  streamErrorText: string;
  isStreamLoading: boolean;
  isStreamEmpty: boolean;
  emptyStreamText: string;
  isRichText: boolean;
  isImage: boolean;
  isFile: boolean;
  isJSONRender: boolean;
  onSendMessage?: (message: string) => void;
}> = ({ message, isStaff, streamError, streamErrorText, isStreamLoading, isStreamEmpty, emptyStreamText, isRichText, isImage, isFile, isJSONRender, onSendMessage }) => {
  if (streamError) return <AIErrorMessage isStaff={isStaff} errorText={streamErrorText} />;
  if (isStreamLoading) return <LoadingMessage isStaff={isStaff} />;
  if (isStreamEmpty) return <TextMessage message={{ ...message, content: emptyStreamText }} isStaff={isStaff} />;
  if (isJSONRender) return <JSONRenderMessage message={message} isStaff={isStaff} onSendMessage={onSendMessage} />;
  if (isRichText) return <RichTextMessage message={message} isStaff={isStaff} onSendMessage={onSendMessage} />;
  if (isImage) return <ImageMessage message={message} isStaff={isStaff} />;
  if (isFile) return <FileMessage message={message} isStaff={isStaff} />;
  return <TextMessage message={message} isStaff={isStaff} onSendMessage={onSendMessage} />;
};

/**
 * Individual chat message component
 */
const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSuggestionClick, onSendMessage }) => {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const currentUid = React.useMemo(() => (user?.id ? `${user.id}-staff` : null), [user?.id]);

  const meta: any = message.metadata || {};
  const typedPayload = message.payload as any | undefined;

  // Message type flags
  // System message: message.type === 'system' or payload.type is in the 1000-2000 range
  const payloadType = typedPayload?.type ?? message.payloadType;
  const isSystemMessage = message.type === 'system' || (typeof payloadType === 'number' && isSystemMessageType(payloadType));
  const isOwnMessage = currentUid ? message.fromUid === currentUid : false;

  // Error state detection
  const platformSendError = Boolean(meta.platform_send_error);
  const wsSendError = Boolean(meta.ws_send_error);
  const uploadError = meta.upload_status === 'error';
  const hasSendError = platformSendError || wsSendError || uploadError;

  // Stream error: end=1 and end_reason > 0 (Timeout/Error/Cancelled/Force) OR has error message
  const streamEndReasonNum = typeof meta.stream_end_reason === 'string'
    ? parseInt(meta.stream_end_reason, 10)
    : (typeof meta.stream_end_reason === 'number' ? meta.stream_end_reason : 0);
  const hasStreamEndError = meta.stream_end === 1 && meta.stream_end_reason != null && meta.stream_end_reason !== '' && streamEndReasonNum > 0;
  // Also check for error message from ___TextMessageEnd event or offline API
  const hasErrorMessage = Boolean(meta.error && typeof meta.error === 'string' && meta.error.trim() !== '');
  const streamError = hasStreamEndError || hasErrorMessage;
  const hasError = hasSendError || streamError;

  // Get AI stream error text based on end reason or error message
  const getStreamErrorText = (): string => {
    // If there's a specific error message from the stream end event or API, use it
    if (hasErrorMessage) {
      return meta.error;
    }
    
    // Otherwise, use generic error messages based on end reason
    switch (streamEndReasonNum) {
      case StreamEndReason.TIMEOUT:
        return t('chat.messages.stream.timeout', 'AI response timed out');
      case StreamEndReason.ERROR:
        return t('chat.messages.stream.error', 'AI response generation failed');
      case StreamEndReason.CANCELLED:
        return t('chat.messages.stream.cancelled', 'AI response cancelled');
      case StreamEndReason.FORCE:
        return t('chat.messages.stream.force', 'AI response forcefully terminated');
      default:
        return t('chat.messages.stream.error', 'AI response generation failed');
    }
  };

  // Get send error text for error icon popup
  const getSendErrorText = (): string => {
    if (typeof meta.error_text === 'string' && meta.error_text.trim().length > 0) {
      return meta.error_text;
    }
    if (platformSendError) return t('chat.input.errors.platformFailed', 'Platform message send failed, please try again later');
    if (wsSendError) return t('chat.input.errors.websocketFailed', 'WebSocket send failed, please check network connection');
    if (uploadError) {
      const isImageMsg = message.payloadType === MessagePayloadType.IMAGE || Boolean(meta.image_url || meta.image_preview_url);
      return isImageMsg ? t('chat.messages.image.uploadFailed', 'Upload failed') : t('chat.input.upload.failed', 'Upload failed');
    }
    return '';
  };

  const [errorOpen, setErrorOpen] = React.useState(false);
  const isSending = Boolean(meta.isLocal) && !hasError && meta.ws_sent !== true;

  // Message type detection
  const isRichText = typedPayload?.type === MessagePayloadType.RICH_TEXT || message.payloadType === MessagePayloadType.RICH_TEXT || Array.isArray(meta.images);
  const isImage = typedPayload?.type === MessagePayloadType.IMAGE || message.payloadType === MessagePayloadType.IMAGE || Boolean(meta.image_url || meta.image_preview_url);
  const isFile = typedPayload?.type === MessagePayloadType.FILE || message.payloadType === MessagePayloadType.FILE || Boolean(meta.file_url || meta.file_name);
  const isJSONRender = Boolean(meta.ui_parts && Array.isArray(meta.ui_parts) && meta.ui_parts.length > 0);
  const isStreamType = typedPayload?.type === MessagePayloadType.STREAM || message.payloadType === MessagePayloadType.STREAM;

  // Stream loading: only show loading if stream type AND no content AND not ended (end !== 1)
  // Once end=1, the stream is complete regardless of end_reason
  const isStreamEnded = meta.stream_end === 1;
  // Content before the first chunk is the anchor placeholder ("AI is thinking..."), not a real reply
  const hasStreamedContent = meta.stream_started === true && Boolean(message.content?.trim());
  const isStreamLoading = isStreamType && !meta.has_stream_data && !hasStreamedContent && !hasError && !isStreamEnded;
  // Stream ended without any streamed content: show a friendly fallback instead of the anchor placeholder
  const isStreamEmpty = isStreamType && isStreamEnded && !meta.has_stream_data && !isJSONRender && !hasError;
  const emptyStreamText = t('chat.messages.noResponse', "Sorry, I couldn't put together an answer for that. Could you rephrase your question, or ask to talk with a human agent?");

  // Sender channel info - use fromUid as the sender's channel ID
  // This is different from message.channelId which is the conversation channel
  const senderChannelId = message.fromUid;
  const senderChannelType = 1; // Person-to-person channel type
  
  // For avatar color consistency with chat list, use message.channelId for non-own messages (visitors)
  // This ensures visitor avatar color matches the conversation list item
  const colorSeedChannelId = isOwnMessage ? senderChannelId : (senderChannelId || message.channelId );

  // Use unified hook for sender display info
  // Priority: message.fromInfo > channelStore cache > fallback
  const {
    name: channelName,
    avatar: channelAvatar,
    extra: channelExtra,
  } = useChannelDisplay({
    channelId: senderChannelId,
    channelType: senderChannelType,
    overrideName: message.fromInfo?.name,
    overrideAvatar: message.fromInfo?.avatar || message.avatar,
    skipFetch: false,
  });
  
  // Display info with staff fallback
  const displayName = isOwnMessage
    ? (message.fromInfo?.name || t('chat.header.staffFallback', 'Agent'))
    : channelName;
  const displayAvatar = channelAvatar;

  // System message - payload.type is in the 1000-2000 range
  if (isSystemMessage) {
    // If there is a payload in the system message format, use the SystemMessage component
    if (typedPayload && typeof payloadType === 'number' && isSystemMessageType(payloadType)) {
      return <SystemMessage payload={typedPayload as PayloadSystem} />;
    }
    // Compatible with the legacy simple system message format
    return (
      <div className="flex justify-center my-3">
        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100/80 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
          {message.content}
        </div>
      </div>
    );
  }

  // Get platform icon for visitor messages
  const getPlatformIcon = () => {
    const fromInfoExtra: any = message.fromInfo?.extra;
    const extraType: PlatformType | undefined = fromInfoExtra?.platform_type;
    const cacheExtra: any = channelExtra;
    const cacheType: PlatformType | undefined = cacheExtra?.platform_type;
    const type = extraType ?? cacheType ?? toPlatformType(message.platform);
    const IconComp = getPlatformIconComponent(type);
    const label = getPlatformLabel(type);
    return (
      <span title={label}>
        <IconComp size={14} className={`w-3.5 h-3.5 inline-block ml-1 -mt-0.5 ${getPlatformColor(type)}`} />
      </span>
    );
  };


  // Visitor/AI message (left side)
  if (!isOwnMessage) {
    return (
      <div className="tgo-msg-left flex flex-col items-start max-w-[85%]">
        <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1.5 ml-10">
          {displayName} {getPlatformIcon()}
        </div>
        <div className="flex items-end space-x-2">
          <ChatAvatar
            displayName={displayName}
            displayAvatar={displayAvatar}
            colorSeed={colorSeedChannelId}
            sizePx={32} // keep existing 8x8 size
            wrapperClassName="relative flex-shrink-0 self-end"
          />
          <MessageContent
            message={message}
            isStaff={false}
            streamError={streamError}
            streamErrorText={getStreamErrorText()}
            isStreamLoading={isStreamLoading}
            isStreamEmpty={isStreamEmpty}
            emptyStreamText={emptyStreamText}
            isRichText={isRichText}
            isImage={isImage}
            isFile={isFile}
            isJSONRender={isJSONRender}
            onSendMessage={onSendMessage}
          />
        </div>
        <AIInfoCard aiInfo={message.aiInfo} />
        <ReplySuggestions suggestions={(message as any).suggestions} onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  // Own message (right side)
  return (
    <div className="tgo-msg-right flex flex-col items-end ml-auto max-w-[85%]">
      <div className="flex items-start flex-row-reverse mt-1">
        <MessageContent
          message={message}
          isStaff={true}
          streamError={streamError}
          streamErrorText={getStreamErrorText()}
          isStreamLoading={isStreamLoading}
          isStreamEmpty={isStreamEmpty}
          emptyStreamText={emptyStreamText}
          isRichText={isRichText}
          isImage={isImage}
          isFile={isFile}
          isJSONRender={isJSONRender}
          onSendMessage={onSendMessage}
        />
        {isSending && (
          <div className="relative self-center text-gray-400 dark:text-gray-500 mr-2" title={t('chat.messages.sending', 'Sending...')}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {hasSendError && (
          <div
            className="relative self-center text-red-500 dark:text-red-400 cursor-pointer mr-2"
            onClick={() => setErrorOpen(v => !v)}
            title={t('chat.messages.sendFailedTitle', 'Send Failed')}
          >
            <AlertCircle className="w-5 h-5" />
            {errorOpen && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-xs rounded-xl py-2 px-3 shadow-lg z-50 w-fit min-w-[240px] max-w-[80vw] sm:max-w-md max-h-[60vh] overflow-auto whitespace-pre-wrap break-words">
                {getSendErrorText()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
