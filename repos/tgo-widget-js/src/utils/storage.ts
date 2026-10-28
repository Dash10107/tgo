// Small localStorage JSON helpers with optional expiry
// Falls back to in-memory storage when localStorage is unavailable, e.g. inside a
// cross-site iframe with third-party storage blocked (Safari ITP, Chrome privacy settings).

export type Stored<T> = { v: T; e?: number } // e: expiresAt epoch ms

const memory = new Map<string, string>()

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const ls = window.localStorage
    const probe = '__tgo_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return {
      getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
      setItem: (k: string, v: string) => { memory.set(k, v) },
      removeItem: (k: string) => { memory.delete(k) },
    }
  }
}

export function setJSON<T>(key: string, value: T, ttlMs?: number) {
  const rec: Stored<T> = { v: value }
  if (ttlMs && ttlMs > 0) {
    rec.e = Date.now() + ttlMs
  }
  try { backend().setItem(key, JSON.stringify(rec)) } catch { memory.set(key, JSON.stringify(rec)) }
}

export function getJSON<T>(key: string): T | null {
  const store = backend()
  let raw: string | null = null
  try { raw = store.getItem(key) ?? memory.get(key) ?? null } catch { raw = memory.get(key) ?? null }
  if (!raw) return null
  try {
    const rec = JSON.parse(raw) as Stored<T>
    if (rec && typeof rec === 'object') {
      if (rec.e && Date.now() > rec.e) {
        remove(key)
        return null
      }
      return rec.v as T
    }
  } catch (_) {
    // corrupted; clear
    remove(key)
  }
  return null
}

export function remove(key: string) {
  memory.delete(key)
  try { backend().removeItem(key) } catch {}
}
