/**
 * Action URI parsing and handling
 * 
 * Supported protocols:
 * - url://  open an external link
 * - msg://  send a message to the chat
 * - copy:// copy to the clipboard
 */

import i18n from '../i18n';

const t = i18n.t.bind(i18n);

/**
 * Action protocol type
 */
export type ActionProtocol = 'url' | 'msg' | 'copy';

/**
 * Parsed Action URI
 */
export interface ParsedActionURI {
  /** Protocol type */
  protocol: ActionProtocol | string;
  /** Content part */
  content: string;
  /** Original URI */
  raw: string;
  /** Whether this is a valid Action URI */
  isValid: boolean;
}

/**
 * Action URI regular expression
 */
const ACTION_URI_REGEX = /^([a-z]+):\/\/(.*)$/i;

/**
 * List of valid protocols
 */
const VALID_PROTOCOLS: ActionProtocol[] = ['url', 'msg', 'copy'];

/**
 * Parse an Action URI
 * @param uri Action URI string
 * @returns Parse result
 */
export function parseActionURI(uri: string): ParsedActionURI {
  if (!uri) {
    return { protocol: '', content: '', raw: uri, isValid: false };
  }

  const match = uri.match(ACTION_URI_REGEX);

  if (!match) {
    return { protocol: '', content: '', raw: uri, isValid: false };
  }

  const [, protocol, content] = match;
  const normalizedProtocol = protocol.toLowerCase();

  return {
    protocol: normalizedProtocol,
    content: content || '',
    raw: uri,
    isValid: VALID_PROTOCOLS.includes(normalizedProtocol as ActionProtocol),
  };
}

/**
 * Build an Action URI
 * @param protocol Protocol type
 * @param content Content
 * @returns Action URI string
 */
export function buildActionURI(protocol: ActionProtocol, content: string): string {
  return `${protocol}://${content}`;
}

/**
 * Check whether a string is a valid Action URI
 * @param uri URI string
 */
export function isValidActionURI(uri: string): boolean {
  return parseActionURI(uri).isValid;
}

/**
 * Action handling result
 */
export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Action handler configuration
 */
export interface ActionHandlerConfig {
  /** Callback for sending a message */
  onSendMessage?: (message: string) => void;
  /** Callback for a successful copy */
  onCopySuccess?: (text: string) => void;
  /** Callback for a failed copy */
  onCopyError?: (error: Error) => void;
  /** Callback before opening a link (return false to block it) */
  onBeforeOpenUrl?: (url: string) => boolean;
  /** Callback for unknown protocols */
  onUnknownProtocol?: (uri: ParsedActionURI) => void;
}

/**
 * Execute an Action
 * @param uri Action URI
 * @param config Handler configuration
 * @returns Handling result
 */
export async function executeAction(
  uri: string,
  config: ActionHandlerConfig = {}
): Promise<ActionResult> {
  const parsed = parseActionURI(uri);

  if (!parsed.isValid) {
    // Try to handle it as the legacy format (a bare action name)
    config.onUnknownProtocol?.(parsed);
    return {
      success: false,
      error: t('actions.invalid', { uri }),
    };
  }

  switch (parsed.protocol as ActionProtocol) {
    case 'url': {
      // Open an external link
      const url = parsed.content;
      if (config.onBeforeOpenUrl && !config.onBeforeOpenUrl(url)) {
        return { success: false, message: t('actions.blocked') };
      }
      try {
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          console.warn('[executeAction] Popup may have been blocked');
        }
        return { success: true, message: t('actions.opened', { url }) };
      } catch (error) {
        console.error('[executeAction] Failed to open URL:', error);
        return { success: false, error: t('actions.openFailed', { error: String(error) }) };
      }
    }

    case 'msg': {
      // Send a message to the chat
      const message = decodeURIComponent(parsed.content);
      if (config.onSendMessage) {
        config.onSendMessage(message);
        return { success: true, message: t('actions.sent') };
      }
      return { success: false, error: t('actions.noSender') };
    }

    case 'copy': {
      // Copy to the clipboard
      const text = decodeURIComponent(parsed.content);
      try {
        await navigator.clipboard.writeText(text);
        config.onCopySuccess?.(text);
        return { success: true, message: t('actions.copied', { text }) };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        config.onCopyError?.(err);
        return { success: false, error: t('actions.copyFailed', { error: err.message }) };
      }
    }

    default:
      config.onUnknownProtocol?.(parsed);
      return { success: false, error: t('actions.unknownProtocol', { protocol: parsed.protocol }) };
  }
}

/**
 * Create an Action handler
 * Used by components to handle Widget action button clicks
 */
export function createActionHandler(config: ActionHandlerConfig = {}) {
  return async (actionUri: string): Promise<ActionResult> => {
    return executeAction(actionUri, config);
  };
}
