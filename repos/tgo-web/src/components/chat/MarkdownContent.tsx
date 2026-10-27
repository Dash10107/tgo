import React, { useCallback, useMemo } from 'react';
import { Marked, RendererObject, RendererThis, Tokens } from 'marked';
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js/lib/core';
// Import only commonly used languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import plaintext from 'highlight.js/lib/languages/plaintext';
import DOMPurify from 'dompurify';
import i18n from '@/i18n';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('c#', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('plaintext', plaintext);

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Callback for sending a message (used by the msg:// protocol) */
  onSendMessage?: (message: string) => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeHref = (href?: string | null): string => {
  if (!href) return '';
  const trimmed = href.trim();

  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, 'http://localhost');
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return trimmed;
    }
  } catch {
    if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('/')) {
      return trimmed;
    }
  }

  return '#';
};

/** Inline-align style for a table cell */
const alignStyle = (align: Tokens.Table['align'][number]): string =>
  align ? ` style="text-align:${align}"` : '';

/*
 * The renderer emits semantic `md-*` classes; all visual styling lives in
 * styles/markdown.css so chat bubbles, modals and the accent bubble can theme
 * the same markup differently.
 */
const renderer: RendererObject = {
  heading(this: RendererThis, { tokens, depth }: Tokens.Heading) {
    const html = this.parser.parseInline(tokens);
    return `<h${depth} class="md-h md-h${depth}">${html}</h${depth}>`;
  },
  link(this: RendererThis, { href, title, tokens }: Tokens.Link) {
    const html = this.parser.parseInline(tokens);
    const safeHref = sanitizeHref(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${escapeHtml(safeHref)}"${titleAttr} target="_blank" rel="noopener noreferrer" class="md-link">${html}</a>`;
  },
  list(this: RendererThis, token: Tokens.List) {
    const itemsHtml = token.items
      .map(item => {
        const rawContent = this.parser.parse(item.tokens);
        const trimmed = rawContent.trim();
        const singleParagraphMatch = trimmed.match(/^<p>([\s\S]*)<\/p>$/);
        const content = singleParagraphMatch ? singleParagraphMatch[1].trim() : trimmed;

        if (item.task) {
          return `<li class="md-task" data-checked="${item.checked ? 'true' : 'false'}"><span class="md-task-box" aria-hidden="true"></span><div class="md-item-body">${content}</div></li>`;
        }
        const itemClass = token.ordered ? 'md-step' : 'md-bullet';
        return `<li class="${itemClass}"><div class="md-item-body">${content}</div></li>`;
      })
      .join('');

    if (token.ordered) {
      // Ordered lists render as a numbered step timeline driven by a CSS counter
      const start = typeof token.start === 'number' ? token.start : 1;
      const counterStyle = start !== 1 ? ` style="counter-reset: md-step ${start - 1}"` : '';
      return `<ol class="md-steps"${counterStyle}>${itemsHtml}</ol>`;
    }
    return `<ul class="md-list">${itemsHtml}</ul>`;
  },
  blockquote(this: RendererThis, { tokens }: Tokens.Blockquote) {
    const html = this.parser.parse(tokens);
    return `<blockquote class="md-callout">${html}</blockquote>`;
  },
  hr() {
    return '<hr class="md-hr" />';
  },
  code({ text, lang, escaped }: Tokens.Code) {
    const language = (lang || '').trim().split(/\s+/)[0] || '';
    const body = escaped ? text : escapeHtml(text);
    const copyLabel = escapeHtml(i18n.t('chat.messages.copyCode', 'Copy'));
    const copiedLabel = escapeHtml(i18n.t('chat.messages.copiedCode', 'Copied'));
    const langClass = language ? ` language-${escapeHtml(language)}` : '';
    return `<div class="md-code"><div class="md-code-head"><span class="md-code-lang">${escapeHtml(language || 'code')}</span><button type="button" class="md-code-copy" data-md-copy="true" data-copy-label="${copyLabel}" data-copied-label="${copiedLabel}">${copyLabel}</button></div><pre><code class="hljs${langClass}">${body}</code></pre></div>`;
  },
  table(this: RendererThis, token: Tokens.Table) {
    const headerRow = token.header
      .map((cell, index) => `<th${alignStyle(token.align[index])}>${this.parser.parseInline(cell.tokens)}</th>`)
      .join('');

    const bodyRows = token.rows
      .map(row => {
        const cells = row
          .map((cell, index) => `<td${alignStyle(token.align[index])}>${this.parser.parseInline(cell.tokens)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const headerSection = headerRow ? `<thead><tr>${headerRow}</tr></thead>` : '';
    return `<div class="md-table-wrap"><table class="md-table">${headerSection}<tbody>${bodyRows}</tbody></table></div>`;
  },
  strong(this: RendererThis, { tokens }: Tokens.Strong) {
    return `<strong class="md-strong">${this.parser.parseInline(tokens)}</strong>`;
  },
  em(this: RendererThis, { tokens }: Tokens.Em) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  },
  del(this: RendererThis, { tokens }: Tokens.Del) {
    return `<del class="md-del">${this.parser.parseInline(tokens)}</del>`;
  },
  image(this: RendererThis, { href, title, text }: Tokens.Image) {
    const safeSrc = sanitizeHref(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(text || '')}"${titleAttr} class="md-img" loading="lazy" />`;
  }
};

// marked.use({gfm: true, breaks: false });

const marked = new Marked(markedHighlight({
  emptyLangClass: 'hljs',
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

marked.use({
    renderer,
    gfm: true,
});


const MARKDOWN_CACHE_LIMIT = 200;
const markdownCache = new Map<string, string>();

/**
 * Pre-process markdown to handle incomplete/streaming content
 * This helps prevent rendering issues with unterminated code blocks, etc.
 */
const preprocessStreamingMarkdown = (markdown: string): string => {
  if (!markdown) return '';

  let processed = markdown;

  // Remove leading whitespace from the start of content to prevent
  // it being interpreted as an indented code block (4+ spaces = code block in Markdown)
  // But preserve intentional code blocks (those starting with ```)
  processed = processed.replace(/^[ \t]+/gm, (match, offset) => {
    // Check if this line is inside a fenced code block
    const before = processed.substring(0, offset);
    const fenceMatches = before.match(/^(`{3,}|~{3,})/gm) || [];
    // If odd number of fences before this line, we're inside a code block - preserve spaces
    if (fenceMatches.length % 2 !== 0) {
      return match;
    }
    // Otherwise, trim leading spaces to prevent indented code block interpretation
    // Keep up to 3 spaces (Markdown allows up to 3 for normal content)
    return match.length > 3 ? '   ' : match;
  });

  // Count code fence occurrences (``` or ~~~)
  const codeBlockMatches = processed.match(/^(`{3,}|~{3,})/gm) || [];
  const codeBlockCount = codeBlockMatches.length;

  // If odd number of code fences, the last code block is unclosed - close it
  if (codeBlockCount % 2 !== 0) {
    // Find the last code fence to determine which type to use for closing
    const lastFenceMatch = processed.match(/(`{3,}|~{3,})(?!.*(`{3,}|~{3,}))/s);
    const closingFence = lastFenceMatch ? lastFenceMatch[1].charAt(0).repeat(3) : '```';
    processed = processed + '\n' + closingFence;
  }

  // Handle unclosed inline code (backticks)
  // Count single backticks not part of code fences
  const inlineCodePattern = /(?<!`)`(?!`)/g;
  const inlineMatches = processed.match(inlineCodePattern) || [];
  if (inlineMatches.length % 2 !== 0) {
    processed = processed + '`';
  }

  return processed;
};

const renderMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  // Pre-process for streaming content
  const processedMarkdown = preprocessStreamingMarkdown(markdown);

  const cacheKey = processedMarkdown;
  const cached = markdownCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const parsed = marked.parse(processedMarkdown) as string;
  const sanitized: string = typeof window !== 'undefined'
    ? DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } }) as string
    : parsed;

  markdownCache.set(cacheKey, sanitized);
  if (markdownCache.size > MARKDOWN_CACHE_LIMIT) {
    const firstKey = markdownCache.keys().next().value;
    if (firstKey) {
      markdownCache.delete(firstKey);
    }
  }

  return sanitized;
};

/** Copy the code block that owns a clicked `md-code-copy` button */
const handleCodeCopy = (button: HTMLElement): void => {
  const code = button.closest('.md-code')?.querySelector('pre code');
  if (!code || !navigator.clipboard) return;
  void navigator.clipboard.writeText(code.textContent ?? '').then(() => {
    button.textContent = button.dataset.copiedLabel ?? '';
    button.dataset.copied = 'true';
    window.setTimeout(() => {
      button.textContent = button.dataset.copyLabel ?? '';
      delete button.dataset.copied;
    }, 1600);
  }).catch((err: unknown) => console.warn('Copy code failed', err));
};

/**
 * Markdown Content Renderer Component
 * Renders markdown content using Marked with caching and sanitization for performance & safety
 */
const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  const html = useMemo(() => {
    return renderMarkdownToHtml(content || '');
  }, [content]);

  // Delegated handler: code-block copy buttons live inside the sanitized HTML
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-md-copy]');
    if (button) handleCodeCopy(button);
  }, []);

  const combinedClassName = className
    ? `markdown-content ${className}`.trim()
    : 'markdown-content';

  return (
    <div
      className={combinedClassName}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownContent;
