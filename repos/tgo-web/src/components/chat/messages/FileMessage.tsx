import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { Message } from '@/types';
import { MessagePayloadType } from '@/types';
import { uploadChatFileWithProgress } from '@/services/chatUploadApi';
import { toAbsoluteApiUrl } from '@/utils/url';
import { useWuKongIMWebSocket } from '@/hooks/useWuKongIMWebSocket';
import { useChatStore } from '@/stores/chatStore';
import { useToast } from '@/hooks/useToast';
import { showApiError } from '@/utils/toastHelpers';
import { getFileIcon } from '@/utils/fileIcons';
import { formatBytes } from '@/utils/format';

/**
 * FileMessage renders file/document messages with upload progress and retry.
 */
export interface MessageComponentProps {
  message: Message;
  isStaff: boolean;
}

const FileMessage: React.FC<MessageComponentProps> = ({ message, isStaff }) => {
  const { t } = useTranslation();
  const typedPayload = message.payload as any | undefined;

  const fileUrl = ((typedPayload?.type === MessagePayloadType.FILE && (typedPayload as any)?.url) || (message.metadata as any)?.file_url || '') as string;
  const fileName = ((typedPayload?.type === MessagePayloadType.FILE && (typedPayload as any)?.name) || (message.metadata as any)?.file_name || '[File]') as string;
  const fileSize = ((typedPayload?.type === MessagePayloadType.FILE && (typedPayload as any)?.size) || (message.metadata as any)?.file_size) as number | undefined;

  const fileUploading = message.metadata?.upload_status === 'uploading';
  const fileUploadProgress = typeof message.metadata?.upload_progress === 'number' ? (message.metadata!.upload_progress as number) : undefined;
  const fileUploadError = message.metadata?.upload_status === 'error';

  const updateMessageByClientMsgNo = useChatStore(state => state.updateMessageByClientMsgNo);
  const { sendMessage: sendWsMessage, isConnected } = useWuKongIMWebSocket();
  const { showToast } = useToast();

  const retryFileUpload = React.useCallback(async () => {
    const f: File | undefined = (message.metadata as any)?.file;
    if (!f || !message.channelId || typeof message.channelType !== 'number') return;
    const clientKey = message.clientMsgNo || message.id;

    // mark uploading
    updateMessageByClientMsgNo(clientKey, { metadata: { upload_status: 'uploading', upload_progress: 0 } });
    try {
      await uploadChatFileWithProgress(f, message.channelId, message.channelType, {
        onProgress: (p) => {
          updateMessageByClientMsgNo(clientKey, { metadata: { upload_progress: p.progress, upload_status: p.status } });
        }
      }).then(async (res) => {
        const url = toAbsoluteApiUrl(res.file_url);
        const name = (message.metadata as any)?.file_name || f.name;
        const size = (message.metadata as any)?.file_size || f.size;
        updateMessageByClientMsgNo(clientKey, { metadata: { file_url: url, upload_progress: 100, upload_status: 'completed' } });
        // try send via WS
        const payload: any = { type: MessagePayloadType.FILE, content: '[File]', url, name, size, timestamp: Date.now() };
        try {
          if (!isConnected) throw new Error('WebSocket is not connected; cannot send the file message');
          await sendWsMessage(message.channelId as string, message.channelType as number, payload, clientKey);
          updateMessageByClientMsgNo(clientKey, { metadata: { ws_sent: true, ws_send_error: false } });
        } catch (err) {
          updateMessageByClientMsgNo(clientKey, { metadata: { ws_send_error: true } });
          showApiError?.(showToast, err as any);
        }
      }).catch((err) => {
        updateMessageByClientMsgNo(clientKey, { metadata: { upload_status: 'error' } });
        showApiError?.(showToast, err);
      });
    } catch (e) {
      // no-op handled
    }
  }, [message.metadata, message.channelId, message.channelType, message.clientMsgNo, message.id, isConnected, sendWsMessage, updateMessageByClientMsgNo, showToast]);

  const wrapperClass = isStaff
    ? 'group bg-acid-300 dark:bg-acid-400 p-3 rounded-3xl rounded-br-lg shadow-[0_14px_30px_-20px_rgb(107_136_23/0.9)] w-[290px] max-w-xs cursor-pointer transition-transform duration-200 hover:-translate-y-0.5'
    : 'group tgo-bubble-in p-3 w-[290px] max-w-xs cursor-pointer transition-transform duration-200 hover:-translate-y-0.5';

  return (
    <div
      className={wrapperClass}
      role="button"
      aria-label={t('chat.messages.file.aria', 'File')}
      onClick={() => {
        if (fileUploadError) {
          retryFileUpload();
        } else if (fileUrl && !fileUploading) {
          window.open(fileUrl, '_blank');
        }
      }}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isStaff ? 'bg-white/70 dark:bg-ink-900/10' : 'bg-gray-50 dark:bg-gray-800'}`}>
          {getFileIcon(fileName, 'w-6 h-6', 24)}
        </span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${isStaff ? 'text-ink-900' : 'text-gray-800 dark:text-gray-200'}`}>{fileName || t('chat.messages.file.placeholder', '[File]')}</div>
          <div className={`text-xs ${isStaff ? 'text-ink-900/60' : 'text-gray-500 dark:text-gray-400'}`}>
            {fileUploadError ? t('chat.messages.file.uploadFailedRetry', 'Upload failed, click to retry') : (fileUploading ? t('chat.messages.file.uploadingWithPercent', 'Uploading {{percent}}%', { percent: fileUploadProgress ?? 0 }) : formatBytes(fileSize))}
          </div>
        </div>
        {fileUrl && !fileUploading && !fileUploadError ? (
          <span
            aria-label={t('chat.messages.file.download', 'Download')}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isStaff ? 'bg-ink-900 text-acid-400' : 'bg-gray-100 text-gray-600 group-hover:bg-acid-300 group-hover:text-ink-900 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            <Download className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default FileMessage;

