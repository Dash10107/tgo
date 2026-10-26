/**
 * Action URI parsing and handling
 * 
 * Supported protocols:
 * - url://  open an external link
 * - msg://  send a message to the chat
 * - copy:// copy to the clipboard
 */

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
  console.log('[executeAction] Processing URI:', uri);
  const parsed = parseActionURI(uri);
  console.log('[executeAction] Parsed:', parsed);

  if (!parsed.isValid) {
    // Try to handle it as the legacy format (a bare action name)
    console.warn('[executeAction] Invalid URI, calling onUnknownProtocol');
    config.onUnknownProtocol?.(parsed);
    return {
      success: false,
      error: `Invalid Action URI: ${uri}`,
    };
  }

  switch (parsed.protocol as ActionProtocol) {
    case 'url': {
      // Open an external link
      const url = parsed.content;
      console.log('[executeAction] Opening URL:', url);
      if (config.onBeforeOpenUrl && !config.onBeforeOpenUrl(url)) {
        return { success: false, message: 'Link opening was blocked' };
      }
      try {
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        console.log('[executeAction] window.open result:', newWindow ? 'success' : 'blocked');
        if (!newWindow) {
          console.warn('[executeAction] Popup may have been blocked');
        }
        return { success: true, message: `Opened link: ${url}` };
      } catch (error) {
        console.error('[executeAction] Failed to open URL:', error);
        return { success: false, error: `Unable to open link: ${error}` };
      }
    }

    case 'msg': {
      // Send a message to the chat
      const message = decodeURIComponent(parsed.content);
      console.log('[executeAction] Sending message:', message);
      if (config.onSendMessage) {
        config.onSendMessage(message);
        return { success: true, message: `Message sent` };
      }
      console.warn('[executeAction] onSendMessage not configured');
      return { success: false, error: 'No message handler configured' };
    }

    case 'copy': {
      // Copy to the clipboard
      const text = decodeURIComponent(parsed.content);
      console.log('[executeAction] Copying text:', text);
      try {
        await navigator.clipboard.writeText(text);
        console.log('[executeAction] Copy success');
        config.onCopySuccess?.(text);
        return { success: true, message: `Copied: ${text}` };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('[executeAction] Copy failed:', err);
        config.onCopyError?.(err);
        return { success: false, error: `Copy failed: ${err.message}` };
      }
    }

    default:
      console.warn('[executeAction] Unknown protocol:', parsed.protocol);
      config.onUnknownProtocol?.(parsed);
      return { success: false, error: `Unknown protocol: ${parsed.protocol}` };
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

