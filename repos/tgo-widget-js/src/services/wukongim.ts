// WuKongIM EasyJSSDK wrapper for this widget
// Requires: npm i easyjssdk
// If you prefer to use the base SDK (wukongimjssdk) later, we can swap the internals without changing callers.

import { RecvMessage, WKIM, WKIMChannelType, WKIMEvent } from 'easyjssdk'
import { normalizeWsUrl } from '../utils/network'

export type IMInitOptions = {
  apiBase: string
  uid: string
  token?: string
  // Default send target (peer uid or group id)
  target: string
  channelType?: 'person' | 'group'
}

export type IMStatus = 'connecting' | 'connected' | 'disconnected' | 'error'


export class WuKongIMService {
  private static _instance: WuKongIMService | null = null
  static get instance() {
    if (!this._instance) this._instance = new WuKongIMService()
    return this._instance
  }

  private _inited = false
  private _im: WKIM = null
  private _cfg: IMInitOptions | null = null
  private _uid: string | null = null
  // internal event binding guard and saved handlers for off()
  private _bound = false
  private _hConnect?: (r:any)=>void
  private _hDisconnect?: (i:any)=>void
  private _hError?: (e:any)=>void
  private _hMessage?: (m:any)=>void
  private _hCustom?: (e:any)=>void

  private _msgListeners = new Set<(m: RecvMessage) => void>()
  private _statusListeners = new Set<(s: IMStatus, info?: any) => void>()
  private _customListeners = new Set<(e: any) => void>()

  private _connecting: Promise<void> | null = null
  private _retryTimer: ReturnType<typeof setTimeout> | null = null
  private _retryAttempt = 0
  private _netListenersBound = false

  get isReady() { return this._inited && !!this._im && !!this._cfg }
  get isConnected() { return !!(this._im as any)?.isConnected }
  get uid() { return this._uid }

  async init(opts: IMInitOptions) {
    this._cfg = { ...opts, channelType: opts.channelType || 'person' }
    this._uid = opts.uid
    // Dynamically resolve ws address from HTTP route
    const wsAddr = await this._fetchRouteWsAddr(opts.apiBase, opts.uid, 10000)
    if (this._im && this._bound) {
      // avoid duplicate bindings on re-init (e.g., React StrictMode double effects)
      try { this._unbindInternalEvents() } catch {}
    }
    this._clearRetry()
    this._retryAttempt = 0
    this._im = WKIM.init(wsAddr, { uid: opts.uid, token: opts.token || '' })
    this._bindInternalEvents()
    this._inited = true
  }

  private _bindInternalEvents() {
    if (!this._im || this._bound) return

    this._hConnect = (result: any) => {
      this._retryAttempt = 0
      this._clearRetry()
      this._emitStatus('connected', result)
    }
    this._hDisconnect = (info: any) => { this._emitStatus('disconnected', info) }
    this._hError = (err: any) => {
      // The SDK emits "Reconnection failed." after its own retries give up; take over from there.
      if (/reconnection failed/i.test(String(err?.message || ''))) this._scheduleRetry()
      this._emitStatus('error', err)
    }
    this._hMessage = (message: any) => { this._emitMessage(message as RecvMessage) }
    this._hCustom = (ev: any) => { this._emitCustom(ev) }

    this._im.on(WKIMEvent.Connect, this._hConnect as any)
    this._im.on(WKIMEvent.Disconnect, this._hDisconnect as any)
    this._im.on(WKIMEvent.Error, this._hError as any)
    this._im.on(WKIMEvent.Message, this._hMessage as any)
    this._im.on(WKIMEvent.CustomEvent, this._hCustom as any)
    this._bound = true
  }

  private _unbindInternalEvents() {
    if (!this._im || !this._bound) return
    if (this._hConnect) this._im.off(WKIMEvent.Connect, this._hConnect as any)
    if (this._hDisconnect) this._im.off(WKIMEvent.Disconnect, this._hDisconnect as any)
    if (this._hError) this._im.off(WKIMEvent.Error, this._hError as any)
    if (this._hMessage) this._im.off(WKIMEvent.Message, this._hMessage as any)
    if (this._hCustom) this._im.off(WKIMEvent.CustomEvent, this._hCustom as any)
    this._hConnect = this._hDisconnect = this._hError = this._hMessage = this._hCustom = undefined
    this._bound = false
  }

  private _emitMessage(m: RecvMessage) { this._msgListeners.forEach(fn => { try { fn(m) } catch {} }) }
  private _emitStatus(s: IMStatus, info?: any) { this._statusListeners.forEach(fn => { try { fn(s, info) } catch {} }) }
  private _emitCustom(e: any) { this._customListeners.forEach(fn => { try { fn(e) } catch {} }) }

  onMessage(cb: (m: RecvMessage) => void) { this._msgListeners.add(cb); return () => this._msgListeners.delete(cb) }
  onStatus(cb: (s: IMStatus, info?: any) => void) { this._statusListeners.add(cb); return () => this._statusListeners.delete(cb) }
  onCustom(cb: (e:any) => void) { this._customListeners.add(cb); return () => this._customListeners.delete(cb) }

  async connect() {
    if (!this._im) throw new Error('WuKongIMService not initialized')
    this._bindNetworkListeners()
    if (this.isConnected) return
    // Share one in-flight attempt: calling the SDK's connect() twice while connecting
    // replaces the first caller's promise handlers and leaves it hanging forever.
    if (this._connecting) return this._connecting
    // The SDK may be mid-reconnect on its own; wait for that instead of racing it.
    if (this._sdkConnecting()) return this._waitForConnect(10000)
    this._clearRetry()
    this._emitStatus('connecting')
    const im = this._im
    this._connecting = (async () => {
      try {
        await im.connect()
      } catch (e) {
        // The SDK only auto-reconnects after a successful first connection,
        // so keep retrying in the background ourselves.
        this._emitStatus('error', e)
        this._scheduleRetry()
        throw e
      } finally {
        this._connecting = null
      }
    })()
    return this._connecting
  }

  /** Make sure the socket is connected before sending; reconnects if needed. */
  async ensureConnected(timeoutMs = 10000): Promise<void> {
    if (!this._im) throw new Error('WuKongIMService not initialized')
    if (this.isConnected) return
    const attempt = this.connect()
    attempt.catch(() => { /* surfaced via the race below or retried in background */ })
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('IM connection timeout')), timeoutMs)
    })
    try {
      await Promise.race([attempt, timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (!this.isConnected) throw new Error('IM not connected')
  }

  private _sdkConnecting(): boolean {
    // Socket opening (0), or open (1) but still authenticating
    const im = this._im as any
    const state = im?.ws?.readyState
    return state === 0 || (state === 1 && !im?.isConnected)
  }

  private _waitForConnect(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error('IM connection timeout')) }, timeoutMs)
      const off = this.onStatus((s) => {
        if (s === 'connected') { clearTimeout(timer); off(); resolve() }
      })
    })
  }

  private _scheduleRetry() {
    if (this._retryTimer || !this._im) return
    const delay = Math.min(30000, 1000 * Math.pow(2, this._retryAttempt))
    this._retryAttempt++
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null
      if (this.isConnected) return
      this.connect().catch(() => { /* next retry already scheduled */ })
    }, delay)
  }

  private _clearRetry() {
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null }
  }

  private _bindNetworkListeners() {
    if (this._netListenersBound || typeof window === 'undefined') return
    this._netListenersBound = true
    const kick = () => {
      if (!this._im || this.isConnected) return
      this._retryAttempt = 0
      this._clearRetry()
      this.connect().catch(() => {})
    }
    window.addEventListener('online', kick)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') kick()
    })
  }

  async disconnect() {
    this._clearRetry()
    if (!this._im) return
    if (typeof this._im.disconnect === 'function') {
      try { await this._im.disconnect() } catch {}
    }
  }

  private async _fetchRouteWsAddr(apiBase: string, uid: string, timeoutMs = 10000): Promise<string> {
    try {
      const base = apiBase.endsWith('/') ? apiBase : apiBase + '/'
      let url = new URL('v1/wukongim/route', base)
      url.searchParams.set('uid', uid)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await fetch(url.toString(), { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) throw new Error(`route HTTP ${res.status}`)
      let data: any
      try { data = await res.json() } catch { throw new Error('invalid JSON') }

      // Priority 1: Use wss_addr if present and non-empty (highest priority)
      if (data?.wss_addr && typeof data.wss_addr === 'string' && data.wss_addr.trim()) {
        const wss = data.wss_addr.trim()
        return normalizeWsUrl(wss.includes('://') ? wss : `wss://${wss}`, apiBase)
      }

      // Priority 2: Fallback to existing logic
      const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
      let addr: any = data?.ws_addr ?? data?.ws ?? data?.ws_url ?? data?.wsAddr ?? data?.websocket
      if (!addr && isHttps) addr = data?.wss ?? data?.ws_addr_tls
      if (!addr || typeof addr !== 'string') throw new Error('missing ws address')
      // Route may return a bare "host:port" (no scheme); WebSocket requires a full ws(s):// URL
      return normalizeWsUrl(addr, apiBase)
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e)
      throw new Error(`[WuKongIM] route fetch failed: ${msg}`)
    }
  }

  async refreshRoute(timeoutMs = 10000): Promise<string> {
    if (!this._cfg) throw new Error('WuKongIMService not initialized')
    return this._fetchRouteWsAddr(this._cfg.apiBase, this._cfg.uid, timeoutMs)
  }


  async sendText(text: string, opts?: { to?: string; channelType?: 251; clientMsgNo?: string; header?: any }) {
    if (!this._im || !this._cfg) throw new Error('WuKongIMService not ready')
    await this.ensureConnected()
    const to = opts?.to ?? this._cfg.target
    const payload = { type: 1, content: text }
    return this._im.send(to, opts?.channelType ?? 251, payload, { clientMsgNo: opts?.clientMsgNo, header: opts?.header })
  }

  async sendPayload(payload: any, opts?: { to?: string; channelType?: 251; clientMsgNo?: string; header?: any }) {
    if (!this._im || !this._cfg) throw new Error('WuKongIMService not ready')
    await this.ensureConnected()
    const to = opts?.to ?? this._cfg.target
    return this._im.send(to, opts?.channelType ?? 251, payload, { clientMsgNo: opts?.clientMsgNo, header: opts?.header })
  }

}

export default WuKongIMService.instance

