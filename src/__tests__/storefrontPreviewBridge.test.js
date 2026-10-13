import { it, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { storefrontPreviewBridge } from '../../scripts/storefrontPreviewBridge.mjs'
const make = () => {
  const dom = new JSDOM('<html><head></head><body></body></html>', { url: 'http://127.0.0.1:3200/store/onboarding_preview', runScripts: 'outside-only' })
  const win = dom.window
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: false, result: { values: { third_party_code: { body: '<script>secret()</script>' } } } })))
  Object.assign(win, { fetch: fetcher, Response, AbortController })
  win.eval(`(${storefrontPreviewBridge.toString()})(${JSON.stringify({ parentOrigin: 'http://127.0.0.1:3012', channel: 'test-channel', project: 'tenant', modules: ['/assets/native.js'] })})`)
  const business = { id: 987654321, slug: 'onboarding_preview', name: 'Restaurant', categories: [], products: [], types: [1], location: { lat: 0, lng: 0 } }
  const init = extra => win.dispatchEvent(new win.MessageEvent('message', { origin: 'http://127.0.0.1:3012', source: win.parent, data: { channel: 'test-channel', type: 'INIT', business, color: '#abcdef' }, ...extra }))
  return { dom, win, init, business, fetcher }
}
it('starts installed modules only after an owned handshake and keeps storage ephemeral', () => {
  const { dom, win, init } = make()
  init({ origin: 'https://evil.test' })
  expect(win.document.querySelector('script')).toBeNull()
  init(); init()
  expect(win.document.querySelectorAll('script')).toHaveLength(1)
  expect(win.localStorage.getItem('project')).toBe('tenant')
  expect(win.localStorage.getItem('token')).toBeNull()
  win.dispatchEvent(new win.Event('pagehide'))
  dom.window.close()
})
it('adapts native XHR business reads from memory and blocks every remote mutation and cross-project read', async () => {
  const { dom, win, init, business, fetcher } = make(); init()
  const result = await new Promise(resolve => {
    const xhr = new win.XMLHttpRequest()
    xhr.open('GET', 'https://api.orderingplus.com/v400/es/tenant/business/onboarding_preview')
    xhr.setRequestHeader('Authorization', 'must-not-forward')
    xhr.onload = function () { resolve(JSON.parse(this.response)) }
    xhr.send()
  })
  expect(result.result).toEqual(business)
  for (const method of ['POST', 'PUT', 'DELETE']) expect((await win.fetch('https://api.orderingplus.com/v400/es/tenant/orders', { method })).status).toBe(403)
  expect((await win.fetch('https://api.orderingplus.com/v400/es/other/business')).status).toBe(403)
  expect((await win.fetch('https://api.orderingplus.com/v400/es/_/current')).status).toBe(200)
  expect(fetcher).not.toHaveBeenCalled()
  win.dispatchEvent(new win.Event('pagehide'))
  dom.window.close()
})
it('keeps locale, selected color and installed theme while removing third-party scripts', async () => {
  const { dom, win, init, fetcher } = make(); init()
  const response = await win.fetch('https://api.orderingplus.com/v400/es/tenant/theme')
  const values = (await response.json()).result.values
  expect(values.my_products.components.theme_settings.components.style.primary_btn_color).toBe('#abcdef')
  expect(values.third_party_code).toBeUndefined()
  expect(fetcher.mock.calls[0][0]).toContain('lang=es')
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers')
  win.dispatchEvent(new win.Event('pagehide'))
  dom.window.close()
})

it('serves a complete native category page for empty and populated draft menus without upstream reads', async () => {
  const { dom, win, init, business, fetcher } = make(); init()
  const root = `https://api.orderingplus.com/v400/es/tenant/business/${business.id}`
  const empty = await (await win.fetch(`${root}/categories?page=1&page_size=20`)).json()
  expect(empty).toEqual({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } })
  business.categories.push({ id: 1000, name: 'Meals', products: [{ id: 100000, name: 'Pizza', category_id: 1000 }] }, { id: 1001, name: 'Drinks', products: [{ id: 100001, name: 'Lemonade', category_id: 1001 }] })
  business.products = business.categories.flatMap(category => category.products)
  const populated = await (await win.fetch(`${root}/categories?page=1&page_size=20`)).json()
  expect(populated.result).toEqual(business.categories)
  expect(populated.pagination).toEqual({ current_page: 1, total_pages: 1, total: 2 })
  const products = await (await win.fetch(`${root}/categories/1001/products`)).json()
  expect(products.result).toEqual(business.categories[1].products)
  expect(fetcher).not.toHaveBeenCalled()
  win.dispatchEvent(new win.Event('pagehide')); dom.window.close()
})
it('delivers native XHR completion in a later task and cancels the queued callback on abort', async () => {
  const { dom, win, init } = make(); init()
  const tasks = []
  win.setTimeout = vi.fn(callback => { tasks.push(callback); return tasks.length })
  win.clearTimeout = vi.fn()
  const xhr = new win.XMLHttpRequest()
  xhr.open('GET', 'https://api.orderingplus.com/v400/es/tenant/business/onboarding_preview')
  xhr.onload = vi.fn()
  xhr.send()
  await vi.waitFor(() => expect(win.setTimeout).toHaveBeenCalledOnce())
  expect(xhr.onload).not.toHaveBeenCalled()
  tasks[0]()
  expect(xhr.onload).toHaveBeenCalledOnce()
  xhr.open('GET', 'https://api.orderingplus.com/v400/es/tenant/business/onboarding_preview')
  xhr.send()
  await vi.waitFor(() => expect(win.setTimeout).toHaveBeenCalledTimes(2))
  xhr.abort(); tasks[1]()
  expect(xhr.onload).toHaveBeenCalledOnce()
  expect(win.clearTimeout).toHaveBeenCalled()
  win.dispatchEvent(new win.Event('pagehide')); dom.window.close()
})
