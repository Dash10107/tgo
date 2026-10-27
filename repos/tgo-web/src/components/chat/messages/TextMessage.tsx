import React from 'react';
import MarkdownContent from '../MarkdownContent';
import type { Message } from '@/types';
import { MessagePayloadType } from '@/types';

/**
 * Streaming cursor animation component
 */
const StreamingCursor: React.FC<{ onAccent?: boolean }> = ({ onAccent }) => (
  <span
    className={`inline-block w-1.5 h-4 ml-0.5 rounded-full animate-pulse ${
      onAccent ? 'bg-ink-900/70' : 'bg-acid-500'
    }`}
    style={{ verticalAlign: 'text-bottom' }}
  />
);

/**
 * TextMessage renders plain text messages.
 */
export interface MessageComponentProps {
  message: Message;
  isStaff: boolean; // true for staff (right), false for visitor (left)
  /** Callback for sending a message (used by the msg:// protocol in Widgets) */
  onSendMessage?: (message: string) => void;
}

/** Strip ```spec fences from text to prevent leaking raw JSON patches if fences reach TextMessage. */
function stripSpecFences(text: string): string {
  return text.replace(/```spec[\s\S]*?```/g, '').replace(/```spec[\s\S]*/g, '').trim();
}

const TextMessage: React.FC<MessageComponentProps> = ({ message, isStaff, onSendMessage }) => {
  const typedPayload = message.payload as any | undefined;
  // Prefer message.content for streaming updates; fall back to payload content
  const rawContent: string =
    (typeof message.content === 'string' && message.content.length > 0)
      ? message.content
      : ((typedPayload?.type === MessagePayloadType.TEXT && typeof typedPayload?.content === 'string')
          ? typedPayload.content
          : '');
  // Safety net: strip spec fences if they somehow leak into TextMessage rendering
  const textContent = rawContent.includes('```spec') ? stripSpecFences(rawContent) : rawContent;

  // Render streamed markdown only when has_stream_data flag exists
  const hasStreamData = Boolean(message.metadata?.has_stream_data);
  const shouldRenderMarkdown = hasStreamData;

  // Check if message is still streaming (AI response in progress)
  const isStreaming = Boolean(message.metadata?.is_streaming);

  const hasLink = (message as any).hasLink;


  if (isStaff) {
    return (
      <div className="inline-block tgo-bubble tgo-bubble-out overflow-hidden">
        {shouldRenderMarkdown ? (
          <>
            <MarkdownContent content={textContent} className="text-sm markdown-on-accent" onSendMessage={onSendMessage} />
            {isStreaming && <StreamingCursor onAccent />}
          </>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">
            {hasLink ? (
              <>
                {textContent.split('Headphone connection guide')[0]}
                <a href="#" className="underline">Headphone connection guide</a>
              </>
            ) : (
              textContent
            )}
            {isStreaming && <StreamingCursor onAccent />}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="inline-block tgo-bubble tgo-bubble-in overflow-hidden">
      {shouldRenderMarkdown ? (
        <>
          <MarkdownContent content={textContent} className="text-sm dark:text-gray-200" onSendMessage={onSendMessage} />
          {isStreaming && <StreamingCursor />}
        </>
      ) : (
        <p className="text-sm text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">
          {textContent}
          {isStreaming && <StreamingCursor />}
        </p>
      )}
    </div>
  );
};

export default TextMessage;

