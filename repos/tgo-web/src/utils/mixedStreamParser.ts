import { createMixedStreamParser, type MixedStreamParser } from '@json-render/core';

type MixedStreamCallbacks = Parameters<typeof createMixedStreamParser>[0];

/**
 * Wraps `createMixedStreamParser` so blank lines in the text stream survive.
 *
 * The upstream parser skips empty lines, which collapses Markdown paragraph
 * breaks: a paragraph after a list or blockquote gets glued onto the last
 * item. This wrapper splits lines itself, reports blank lines (outside spec
 * fences) as empty text, and feeds every other line through unchanged.
 */
export function createBlankLinePreservingParser(callbacks: MixedStreamCallbacks): MixedStreamParser {
  const inner = createMixedStreamParser(callbacks);
  let buffer = '';
  let inSpecFence = false;

  const processLine = (line: string): void => {
    const trimmed = line.trim();
    if (!inSpecFence && trimmed.startsWith('```spec')) {
      inSpecFence = true;
    } else if (inSpecFence && trimmed === '```') {
      inSpecFence = false;
    } else if (!trimmed) {
      if (!inSpecFence) callbacks.onText('');
      return;
    }
    inner.push(`${line}\n`);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(processLine);
    },
    flush() {
      if (buffer.trim()) inner.push(buffer);
      buffer = '';
      inner.flush();
    },
  };
}
