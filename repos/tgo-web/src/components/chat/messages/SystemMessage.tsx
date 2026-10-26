import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessagePayloadType, type PayloadSystem, SystemMessageExtraItem } from '@/types';

interface SystemMessageProps {
  payload: PayloadSystem;
}

/**
 * Parse a system message template, replacing placeholders such as {0}, {1} with the matching names in extra
 * @param template Template string, e.g. "You have been connected to a human agent; agent {0} will assist you"
 * @param extra Array of extra info, e.g. [{ uid: "xxx", name: "Administrator" }]
 * @returns Array of parsed content fragments
 */
function parseSystemMessageContent(
  template: string,
  extra?: SystemMessageExtraItem[]
): React.ReactNode[] {
  if (!extra || extra.length === 0) {
    return [template];
  }

  const result: React.ReactNode[] = [];
  // Match placeholders such as {0}, {1}, {2}
  const regex = /\{(\d+)\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(template)) !== null) {
    // Add the plain text before the placeholder
    if (match.index > lastIndex) {
      result.push(template.slice(lastIndex, match.index));
    }

    // Get the placeholder index
    const placeholderIndex = parseInt(match[1], 10);
    const extraItem = extra[placeholderIndex];

    if (extraItem?.name) {
      // Wrap the name in a highlight style
      result.push(
        <span
          key={`extra-${placeholderIndex}`}
          className="font-medium text-gray-600 dark:text-gray-300 mx-0.5"
        >
          {extraItem.name}
        </span>
      );
    } else {
      // If no matching extra is found, keep the original placeholder
      result.push(match[0]);
    }

    lastIndex = regex.lastIndex;
  }

  // Add the last piece of plain text
  if (lastIndex < template.length) {
    result.push(template.slice(lastIndex));
  }

  return result;
}

/**
 * System message component
 * Shows WeChat-style system notifications such as "xxx joined the group chat"
 */
const SystemMessage: React.FC<SystemMessageProps> = ({ payload }) => {
  const { t } = useTranslation();

  const localizedContent = useMemo(() => {
    const { type, extra } = payload;
    const hasExtra = extra && extra.length > 0;

    switch (type) {
      case MessagePayloadType.SYSTEM_STAFF_ASSIGNED:
        return parseSystemMessageContent(
          t('chat.messages.system.staffAssigned', 'You have been connected to customer service. Agent {0} will assist you.'),
          extra
        );
      case MessagePayloadType.SESSION_TRANSFERRED:
        return parseSystemMessageContent(
          t('chat.messages.system.sessionTransferred', 'Session transferred. Agent {0} has transferred you to Agent {1}.'),
          extra
        );
      case MessagePayloadType.SYSTEM_SESSION_CLOSED:
        if (!hasExtra) {
          return [t('chat.messages.system.sessionClosedEmpty', 'Session ended.')];
        }
        return parseSystemMessageContent(
          t('chat.messages.system.sessionClosed', 'Session ended. Agent {0} has completed the service.'),
          extra
        );
      case MessagePayloadType.MEMORY_CLEARED:
        return [t('chat.messages.system.memoryCleared', 'Memory cleared, AI will restart the conversation')];
      default:
        // Fallback to original content for unknown types
        return parseSystemMessageContent(payload.content, payload.extra);
    }
  }, [payload, t]);

  return (
    <div className="flex justify-center my-3">
      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100/80 dark:bg-gray-700/50 text-[11px] text-gray-500 dark:text-gray-400 max-w-[90%]">
        <span className="text-center leading-relaxed">
          {localizedContent}
        </span>
      </div>
    </div>
  );
};

export default SystemMessage;
