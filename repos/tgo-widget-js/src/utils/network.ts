/* Network address helpers.
 * The backend often advertises addresses meant for the machine it runs on
 * (e.g. `localhost:5200`, `http://localhost:8000`). When the widget is opened
 * from another device or embedded on a remote site, those loopback hosts point
 * at the visitor's own machine. These helpers normalize such addresses so the
 * widget keeps working wherever it is embedded.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export function isLoopbackHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  return LOOPBACK_HOSTS.has(h) || h.endsWith('.localhost') || /^127\./.test(h)
}

function currentLocation(): Location | null {
  return typeof window !== 'undefined' && window.location ? window.location : null
}

/**
 * Resolve the API base URL.
 * - Relative paths ("/api") are resolved against the current origin.
 * - A loopback host is swapped for the host the widget itself was loaded from
 *   when that host is not loopback (e.g. widget opened via LAN IP or a tunnel).
 * Returns the URL without a trailing slash.
 */
export function resolveApiBase(raw: string | null | undefined): string | undefined {
  const value = (raw || '').trim()
  if (!value) return undefined
  const loc = currentLocation()
  try {
    const url = new URL(value, loc?.href)
    if (loc && isLoopbackHost(url.hostname) && !isLoopbackHost(loc.hostname) && /^https?:$/.test(loc.protocol)) {
      url.hostname = loc.hostname
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    return value.replace(/\/+$/, '')
  }
}

/**
 * Turn a WuKongIM route address into a usable WebSocket URL.
 * - Adds a ws:// or wss:// scheme when missing (route may return "host:port").
 * - Maps http(s):// to ws(s)://.
 * - Upgrades ws:// to wss:// on HTTPS pages for non-loopback hosts (mixed content would be blocked).
 * - Swaps a loopback host for the API host when the API is not on loopback.
 */
export function normalizeWsUrl(addr: string, apiBase?: string): string {
  let value = String(addr || '').trim()
  if (!value) throw new Error('empty ws address')

  const loc = currentLocation()
  const pageIsHttps = loc?.protocol === 'https:'

  if (/^https?:\/\//i.test(value)) value = value.replace(/^http/i, 'ws')
  else if (value.startsWith('//')) value = (pageIsHttps ? 'wss:' : 'ws:') + value
  else if (!/^wss?:\/\//i.test(value)) value = (pageIsHttps ? 'wss://' : 'ws://') + value

  const url = new URL(value)

  let apiHost: string | null = null
  try { apiHost = apiBase ? new URL(apiBase, loc?.href).hostname : null } catch { apiHost = null }
  if (apiHost && isLoopbackHost(url.hostname) && !isLoopbackHost(apiHost)) {
    url.hostname = apiHost
  }

  if (pageIsHttps && url.protocol === 'ws:' && !isLoopbackHost(url.hostname)) {
    url.protocol = 'wss:'
  }

  // URL serialization adds a trailing "/" for bare hosts; WuKongIM accepts either, keep it clean.
  const out = url.toString()
  return url.pathname === '/' && !url.search && !url.hash ? out.replace(/\/$/, '') : out
}
