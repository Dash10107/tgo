import type { CSSProperties, ReactNode } from 'react'

/**
 * Minimal inline-markdown renderer for json-render component props.
 *
 * LLMs often put `**bold**`, `*italic*` or `` `code` `` inside spec text props.
 * We render those as React elements (never raw HTML), so there is no XSS surface.
 * Keep in sync with tgo-web `src/components/chat/jsonRender/inlineMarkdown.tsx`.
 */

// Single-underscore italics are skipped on purpose: they misfire on snake_case identifiers
const INLINE_TOKEN = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|\*[^*\s][^*\n]*?\*)/g

const inlineCodeStyle: CSSProperties = {
  background: 'var(--bg-tertiary, #f3f4f6)',
  borderRadius: 4,
  padding: '1px 4px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.85em',
}

export function renderInlineMarkdown(text: string): ReactNode {
  if (!/[*_`]/.test(text)) return text

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start))

    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key++} style={{ fontWeight: 600 }}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key++} style={inlineCodeStyle}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
    }
    lastIndex = start + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const KEYCAP_DIGIT = /^\s*([0-9])️?⃣\s*/
const KEYCAP_TEN = /^\s*\u{1F51F}\s*/u
const NUMBERED_PREFIX = /^\s*(\d{1,2})[.)]\s+/
const BULLET_PREFIX = /^\s*[-•·]\s+/

export type ListMarker = { kind: 'number'; value: string } | { kind: 'bullet' }

/** Detect a leading list marker ("1️⃣", "1.", "2)", "-", "•") and return it with the remaining text. */
export function splitListMarker(text: string): { marker: ListMarker; rest: string } | null {
  const keycap = text.match(KEYCAP_DIGIT)
  if (keycap) return { marker: { kind: 'number', value: keycap[1] }, rest: text.slice(keycap[0].length) }

  const ten = text.match(KEYCAP_TEN)
  if (ten) return { marker: { kind: 'number', value: '10' }, rest: text.slice(ten[0].length) }

  const numbered = text.match(NUMBERED_PREFIX)
  if (numbered) return { marker: { kind: 'number', value: numbered[1] }, rest: text.slice(numbered[0].length) }

  const bullet = text.match(BULLET_PREFIX)
  if (bullet) return { marker: { kind: 'bullet' }, rest: text.slice(bullet[0].length) }

  return null
}

/** Strip markdown emphasis markers so plain-text heuristics (label/value split) see clean text. */
export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*|__|`/g, '')
}
