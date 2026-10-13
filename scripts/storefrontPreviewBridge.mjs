export function storefrontPreviewBridge (config) {
  const originalFetch = window.fetch.bind(window)
  let started = false
  let business
  let color
  const storage = () => {
    const values = new Map()
    return { getItem: key => values.get(String(key)) ?? null, setItem: (key, value) => values.set(String(key), String(value)), removeItem: key => values.delete(String(key)), clear: () => values.clear(), key: index => Array.from(values.keys())[index] ?? null, get length () { return values.size } }
  }
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { value: storage(), configurable: true })
  window.localStorage.setItem('project', config.project)
  const notify = type => window.parent.postMessage({ type, channel: config.channel }, config.parentOrigin)
  const envelope = result => ({ error: false, result, pagination: { current_page: 1, total_pages: 1, total: Array.isArray(result) ? result.length : 1 } })
  const denied = () => new Response(JSON.stringify({ error: true, result: ['Read-only preview'] }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const request = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, window.location.href)
    const method = (options.method || input.method || 'GET').toUpperCase()
    if (method !== 'GET') return denied()
    if (url.origin === window.location.origin) return originalFetch(url.href, { signal: options.signal, credentials: 'omit' })
    const match = url.pathname.match(/^\/(v\d+)\/([a-z]{2}(?:-[a-z]{2})?)\/([^/]+)(\/.*)$/i)
    if (url.hostname !== 'api.orderingplus.com' || !match || url.username || url.password) return denied()
    const path = match[4]
    if (path === '/current') return json(envelope({ code: config.project }))
    if (match[3] !== config.project) return denied()
    if (path === '/business') return json(envelope([business]))
    if (path === '/business/onboarding_preview' || path === `/business/${business.id}`) return json(envelope(business))
    if (path.startsWith(`/business/${business.id}/`)) {
      if (path.endsWith('/categories')) return json(envelope(business.categories))
      if (path.endsWith('/products')) {
        const categoryId = Number(path.match(/\/categories\/(\d+)\//)?.[1])
        return json(envelope(categoryId ? business.categories.find(c => c.id === categoryId)?.products || [] : business.products))
      }
      return json(envelope([]))
    }
    if (path === '/order-options') return json(envelope({ type: business.types[0] || 1, carts: {}, address: { location: business.location }, moment: null }))
    const proxy = new URL('/__api', window.location.origin)
    proxy.searchParams.set('path', path + url.search)
    proxy.searchParams.set('lang', match[2])
    const response = await originalFetch(proxy.href, { credentials: 'omit', signal: options.signal })
    if (!response.ok) return response
    const body = await response.json()
    if (path === '/theme' && body.result?.values) {
      const values = typeof body.result.values === 'string' ? JSON.parse(body.result.values) : body.result.values
      delete values.third_party_code
      if (/^#[a-f0-9]{6}$/i.test(color)) {
        const components = (values.my_products ||= {}).components ||= {}
        const settings = (components.theme_settings ||= {}).components ||= {}
        ;(settings.style ||= {}).primary_btn_color = color
      }
      body.result.values = values
    }
    return json(body)
  }
  window.fetch = request
  const NativeXHR = window.XMLHttpRequest
  window.XMLHttpRequest = class extends NativeXHR {
    open (method, url) { this.abort(); this.previewStatus = 0; this.previewResponse = ''; this.previewMethod = method; this.previewUrl = url; this.previewController = new AbortController() }
    setRequestHeader () {}
    get status () { return this.previewStatus || 0 }
    get response () { return this.previewResponse || '' }
    get responseText () { return this.response }
    get readyState () { return this.previewStatus ? 4 : 1 }
    getResponseHeader (name) { return name.toLowerCase() === 'content-type' ? 'application/json' : null }
    getAllResponseHeaders () { return 'content-type: application/json\r\n' }
    abort () { this.previewController?.abort(); clearTimeout(this.previewTimer); this.previewTimer = undefined }
    send () {
      const controller = this.previewController
      request(this.previewUrl, { method: this.previewMethod, signal: controller.signal }).then(async response => {
        const text = await response.text()
        if (controller.signal.aborted) return
        this.previewTimer = setTimeout(() => {
          if (controller.signal.aborted || controller !== this.previewController) return
          this.previewStatus = response.status; this.previewResponse = text
          this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend'))
        }, 0)
      }).catch(() => { if (!controller.signal.aborted) this.dispatchEvent(new Event('error')) })
    }
  }
  window.open = () => null
  window.navigator.sendBeacon = () => false
  window.WebSocket = class { constructor () { this.readyState = 3 } addEventListener () {} removeEventListener () {} close () {} send () {} }
  const block = event => { if (event.target.closest?.('a,button,input,select,textarea,[role="button"]')) { event.preventDefault(); event.stopImmediatePropagation() } }
  document.addEventListener('click', block, true)
  document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation() }, true)
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape') { event.preventDefault(); notify(event.key === 'Escape' ? 'ESCAPE' : event.shiftKey ? 'FOCUS_BACK' : 'FOCUS_NEXT') } else if (event.key === 'Enter' || event.key === ' ') block(event)
  }, true)
  let rendered = false
  const observer = new MutationObserver(() => {
    if (!window.document) return
    document.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(control => { control.tabIndex = -1 })
    if (!rendered && document.querySelector('#business_name')?.textContent.trim()) { rendered = true; notify('RENDERED') }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  const receive = event => {
    if (started || event.source !== window.parent || event.origin !== config.parentOrigin || event.data?.channel !== config.channel || event.data.type !== 'INIT') return
    if (!event.data.business || event.data.business.slug !== 'onboarding_preview') return
    business = event.data.business; color = event.data.color; started = true
    for (const src of config.modules) { const script = document.createElement('script'); script.type = 'module'; script.src = src; document.head.append(script) }
  }
  window.addEventListener('message', receive)
  window.addEventListener('pagehide', () => { observer.disconnect(); window.removeEventListener('message', receive) }, { once: true })
  notify('READY')
}
