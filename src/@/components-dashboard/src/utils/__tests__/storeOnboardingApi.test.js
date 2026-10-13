import { describe, it, expect, vi } from 'vitest'
import { createOnboardingApi } from '../storeOnboardingApi'
import { createDraft } from '../storeOnboarding'

const validDraft = () => {
  const d = createDraft('owner@example.com')
  Object.assign(d.form, { name: 'My restaurant', phone: '5551234567', address: 'Main street', location: { lat: 19, lng: -99 } })
  d.form.orderTypes = [1, 2]
  d.form.zone.name = 'Delivery'
  d.form.categories = [{ key: 'c1', name: 'Pizzas', products: [{ key: 'p1', name: 'Margarita', price: '149' }] }]
  return d
}
const fakeServer = (autoDefaults = false) => {
  const calls = []; const stores = []; const sites = []; const resources = new Map(); let id = 10; let failPath; let lostPath
  const configs = [{ id: 1, key: 'order_types_allowed', value: '1|2|3|4|5' }, { id: 2, key: 'default_order_type', value: 'delivery' }]
  const paymethods = [{ id: 42, gateway: 'cash', enabled: true }, { id: 76, gateway: 'card_delivery', enabled: true }, { id: 100, gateway: 'stripe', enabled: true }]
  const fetcher = vi.fn(async (url, options = {}) => {
    const u = new URL(url); const path = u.pathname.replace('/api', ''); const method = options.method || 'GET'; const body = options.body && JSON.parse(options.body)
    calls.push({ path, method, body, url })
    if (path === failPath && method !== 'GET') { failPath = null; throw new Error('network') }
    let result
    if (method === 'GET') {
      if (path === '/business') {
        result = stores.filter(s => u.searchParams.get('mode') === 'dashboard' || s.enabled)
        const where = JSON.parse(u.searchParams.get('where') || '[]')
        for (const w of where) result = result.filter(s => s[w.attribute] === w.value)
      } else if (/^\/business\/\d+$/.test(path)) result = stores.find(s => s.id === Number(path.split('/')[2]) && (u.searchParams.get('mode') === 'dashboard' || s.enabled))
      else if (path === '/paymethods') result = paymethods
      else if (path === '/configs') result = configs
      else if (path === '/sites') result = sites
      else result = resources.get(path) || []
    } else if (method === 'POST' && /^\/sites\/\d+\/themes\/\d+$/.test(path)) {
      result = resources.get(path.slice(0, path.lastIndexOf('/'))).find(theme => Number(theme.theme_id) === Number(path.split('/').at(-1)))
      result.values = JSON.parse(body.values)
    } else if (path === '/business') {
      result = { ...body, id: id++ }; stores.push(result)
      if (autoDefaults) {
        resources.set(`/business/${result.id}/deliveryzones`, [{ id: id++, name: 'Everywhere', type: 4, price: 0, minimum: 0, enabled: true, hidden: 'preserve' }])
        resources.set(`/business/${result.id}/paymethods`, [{ id: id++, paymethod_id: 42, enabled: true, allowed_order_types: null, hidden: 'preserve' }, { id: id++, paymethod_id: 100, enabled: true }])
      }
    } else if (/^\/business\/\d+$/.test(path)) { result = stores.find(s => s.id === Number(path.split('/')[2])); Object.assign(result, body) } else if (path.startsWith('/configs/')) { result = configs.find(c => c.id === Number(path.split('/')[2])); Object.assign(result, body) } else if (method === 'PUT' && /\/\d+$/.test(path)) {
      const base = path.slice(0, path.lastIndexOf('/'))
      result = resources.get(base)?.find(r => r.id === Number(path.split('/').at(-1)))
      Object.assign(result, body)
    } else { result = { ...body, id: id++ }; resources.set(path, [...(resources.get(path) || []), result]) }
    if (path === lostPath && method !== 'GET') { lostPath = null; throw new Error('response lost after server saved') }
    return { ok: true, status: 200, json: async () => ({ error: false, result }) }
  })
  return { fetcher, calls, stores, sites, resources, configs, fail: p => { failPath = p }, lose: p => { lostPath = p } }
}

describe('store onboarding API publication', () => {
  it('publishes native category and product images and descriptions, including a lost-response retry', async () => {
    const s = fakeServer(); const d = validDraft()
    const image = 'data:image/png;base64,aW1hZ2U='
    Object.assign(d.form.categories[0], { image, header: image, description: 'Fresh food' })
    Object.assign(d.form.categories[0].products[0], { images: image, description: 'Tomato and cheese' })
    const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
    s.lose('/business/10/categories')
    await expect(api.publish(d, 9, () => {})).rejects.toThrow()
    await api.publish(d, 9, () => {})
    const category = s.calls.filter(c => c.method === 'POST' && c.path.endsWith('/categories'))
    expect(category).toHaveLength(1)
    expect(category[0].body).toMatchObject({ image, header: image, description: 'Fresh food' })
    expect(s.calls.find(c => c.method === 'POST' && c.path.endsWith('/products')).body).toMatchObject({ images: image, description: 'Tomato and cheese', price: 149 })
    expect(s.stores[0].enabled).toBe(true)
  })

  it('reconciles missing checkpointed menu resources before resuming activation', async () => {
    for (const deleted of ['product', 'category']) {
      const s = fakeServer(); const d = validDraft(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
      s.fail('/configs/1')
      await expect(api.publish(d, 9, () => {})).rejects.toThrow()
      expect(s.stores[0].enabled).toBe(false)
      const categoryPath = '/business/10/categories'
      const productPath = `${categoryPath}/${d.journal.categories.c1}/products`
      s.resources.set(deleted === 'category' ? categoryPath : productPath, [])
      if (deleted === 'category') s.resources.delete(productPath)
      await api.publish(d, 9, () => {})
      expect(s.resources.get(categoryPath)).toHaveLength(1)
      expect(s.resources.get(`${categoryPath}/${d.journal.categories.c1}/products`)).toHaveLength(1)
      expect(s.stores[0].enabled).toBe(true)
      expect(s.stores).toHaveLength(1)
    }
  })
  it('reconciles API-created Everywhere and payment defaults with the exact selected options', async () => {
    const s = fakeServer(true); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft()
    d.form.zone = { type: 1, name: 'Nearby', minimum: '0', price: '3', data: { center: { lat: 19, lng: -99 }, radio: 3 } }
    d.form.payments = ['card_delivery']
    await api.publish(d, 9, () => {})
    const zones = s.resources.get('/business/10/deliveryzones').filter(z => z.enabled)
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ type: 1, name: 'Nearby', minimum: 0, price: 3, hidden: 'preserve' })
    const payments = s.resources.get('/business/10/paymethods').filter(p => p.enabled)
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ paymethod_id: 76, sandbox: false, allowed_order_types: '[1,2]' })
  })
  it('disables API defaults for pickup-only and preserves hidden values on selected default cash', async () => {
    const s = fakeServer(true); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft()
    d.form.orderTypes = [2]
    await api.publish(d, 9, () => {})
    expect(s.resources.get('/business/10/deliveryzones').some(z => z.enabled)).toBe(false)
    expect(s.resources.get('/business/10/paymethods').find(p => p.paymethod_id === 42)).toMatchObject({ enabled: true, sandbox: false, allowed_order_types: '[2]', hidden: 'preserve' })
    expect(s.calls.filter(c => c.method !== 'GET').at(-1).body).toEqual({ enabled: true })
  })
  it('uses the API underscore slug format for the store, categories and products', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
    await api.publish(validDraft(), 9, () => {})
    for (const call of s.calls.filter(c => c.body?.slug)) expect(call.body.slug).toMatch(/^[a-z0-9_]+$/)
  })
  it('accepts virtual config IDs and requires numeric IDs only for saved resources', async () => {
    const fetcher = async url => ({ ok: true, status: 200, json: async () => ({ error: false, result: new URL(url).pathname.endsWith('/configs') ? [{ id: 'plan_pro', key: 'plan_pro', value: 'false' }] : [{ id: 1, gateway: 'cash', enabled: true }] }) })
    const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher })
    expect((await api.bootstrap()).configs.plan_pro.value).toBe('false')
  })
  it('discovers stores without an enabled filter and treats inactive stores as existing', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
    expect(await api.discover(null)).toBe(true)
    s.stores.push({ id: 1, enabled: false })
    expect(await api.discover(null)).toBe(false)
    expect(s.calls[0].url).not.toContain('enabled')
  })
  it('does not confuse an API/HTTP/malformed response with zero stores', async () => {
    for (const response of [{ ok: false, status: 500, json: async () => ({}) }, { ok: true, json: async () => ({ error: true, result: [] }) }, { ok: true, json: async () => ({ error: false, result: null }) }]) {
      const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: async () => response })
      await expect(api.discover(null)).rejects.toThrow()
    }
  })
  it('creates all resources before activating and resolves payments by gateway', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft(); d.form.payments = ['card_delivery']
    await api.publish(d, 9, () => {})
    const writes = s.calls.filter(c => c.method !== 'GET')
    expect(writes[0].body.enabled).toBe(false)
    expect(writes.at(-1)).toMatchObject({ path: '/business/10', body: { enabled: true } })
    expect(writes.find(c => c.path.endsWith('/paymethods')).body).toMatchObject({ paymethod_id: 76, allowed_order_types: '[1,2]' })
    expect(writes.find(c => c.path.endsWith('/deliveryzones')).body).toMatchObject({ type: 4, price: 0, minimum: 0 })
    expect(writes.find(c => c.path === '/configs/1').body.value).toBe('1|2')
    expect(d.journal.published).toBe(true)
  })
  it('recovers a lost creation response and interrupted product write without duplicate stores/categories', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft(); s.lose('/business')
    await expect(api.publish(d, 9, () => {})).rejects.toThrow()
    expect(s.stores).toHaveLength(1)
    s.lose('/business/10/categories/13/products')

    await expect(api.publish(d, 9, () => {})).rejects.toThrow()
    await api.publish(d, 9, () => {})
    expect(s.stores).toHaveLength(1)
    expect(s.calls.filter(c => c.path === '/business' && c.method === 'POST')).toHaveLength(1)
    expect(s.calls.filter(c => c.path === '/business/10/categories' && c.method === 'POST')).toHaveLength(1)
  })
  it('keeps a partially written store disabled and resumes without adding its payment twice', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft()
    s.fail('/business/10/categories')
    await expect(api.publish(d, 9, () => {})).rejects.toThrow()
    expect(s.stores[0].enabled).toBe(false)
    expect(await api.discover(d)).toBe(true)
    await api.publish(d, 9, () => {})
    expect(s.calls.filter(c => c.path === '/business/10/paymethods' && c.method === 'POST')).toHaveLength(1)
    expect(s.stores[0].enabled).toBe(true)
  })
  it('omits the delivery zone for pickup-only and rejects unavailable offline payment methods', async () => {
    const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const d = validDraft(); d.form.orderTypes = [2]
    await api.publish(d, 9, () => {})
    expect(s.calls.some(c => c.path.endsWith('/deliveryzones') && c.method !== 'GET')).toBe(false)
    const bad = validDraft(); bad.form.payments = ['stripe']
    await expect(api.publish(bad, 9, () => {})).rejects.toThrow()
  })
  it('refuses to create another store when one was added outside this browser during setup', async () => {
    const s = fakeServer(); s.stores.push({ id: 1, enabled: true, slug: 'existing' })
    const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
    await expect(api.publish(validDraft(), 9, () => {})).rejects.toThrow()
    expect(s.calls.filter(c => c.method !== 'GET')).toHaveLength(0)
  })
})

it('resets a recorded store only after confirming its deletion and retains normal projects with another store', async () => {
  const s = fakeServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher }); const draft = validDraft()
  await api.publish(draft, 9, () => {})
  expect(await api.discover(draft)).toBe(true)
  s.stores.length = 0
  expect(await api.discover(draft)).toBe('reset-required')
  s.stores.push({ id: 99, enabled: true })
  expect(await api.discover(draft)).toBe('reset-ready')
})

it('recovers an HTTP 500 error envelope after the store was committed', async () => {
  const s = fakeServer(); const d = validDraft()
  let lost = false
  const fetcher = async (url, options) => {
    const response = await s.fetcher(url, options)
    if (new URL(url).pathname === '/api/business' && options.method === 'POST' && !lost) {
      lost = true
      return { ok: false, status: 500, json: async () => ({ error: true, result: null }) }
    }
    return response
  }
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher })
  await expect(api.publish(d, 9, () => {})).rejects.toThrow()
  expect(s.stores).toHaveLength(1)
  expect(s.stores[0].enabled).toBe(false)
  await api.publish(d, 9, () => {})
  expect(s.stores).toHaveLength(1)
  expect(s.stores[0].enabled).toBe(true)
})
it('refuses duplicate malformed menu identity keys before creating the store', async () => {
  const s = fakeServer(); const d = validDraft()
  d.form.categories[0].products.push({ ...d.form.categories[0].products[0], price: '22' })
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
  await expect(api.publish(d, 9, () => {})).rejects.toThrow('invalid_form')
  expect(s.stores).toHaveLength(0)
})

it('retains recovery ownership when a recovery read fails with expired authorization', async () => {
  const s = fakeServer(); const d = validDraft(); s.lose('/business')
  const root = 'https://test.example/api'
  await expect(createOnboardingApi({ root, token: 'test', fetcher: s.fetcher }).publish(d, 9, () => {})).rejects.toThrow()
  expect(d.journal.started).toBe(true); expect(s.stores).toHaveLength(1)
  const fetcher = async (url, options) => new URL(url).pathname === '/api/business' && new URL(url).searchParams.has('where') ? { ok: false, status: 403, json: async () => ({ error: true, result: null }) } : s.fetcher(url, options)
  await expect(createOnboardingApi({ root, token: 'expired', fetcher }).publish(d, 9, () => {})).rejects.toThrow()
  expect(d.journal.started).toBe(true)
  await createOnboardingApi({ root, token: 'renewed', fetcher: s.fetcher }).publish(d, 9, () => {})
  expect(s.stores).toHaveLength(1); expect(s.stores[0].enabled).toBe(true)
})

it.each(['MX', 'PA'])('fills empty %s regional rows but preserves customized settings in the exact outbound payload', async country => {
  const s = fakeServer()
  s.configs.push({ id: 31, key: 'country_autocomplete', value: country }, { id: 32, key: 'stripe_currency', value: 'USD' }, { id: 33, key: 'format_number_currency', value: 'US$' }, { id: 34, key: 'distance_unit', value: '' }, { id: 35, key: 'default_country_code', value: '' })
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: s.fetcher })
  await api.publish(validDraft(), 9, () => {})
  const writes = s.calls.filter(c => c.method !== 'GET' && /^\/configs\/3/.test(c.path))
  expect(writes).toEqual([expect.objectContaining({ path: '/configs/35', body: { value: country } }), expect.objectContaining({ path: '/configs/34', body: { value: 'km' } })])
  expect(s.configs.find(c => c.id === 32).value).toBe('USD')
  expect(s.configs.find(c => c.id === 33).value).toBe('US$')
})

const websiteServer = () => {
  const server = fakeServer()
  server.sites.push({ id: 100, type: 'franchiseweb', code: 'website' })
  server.resources.set('/sites/100/themes', [{ id: 999, theme_id: 200, site_id: 100, values: { general: { components: { fonts: { primary: { name: 'Keep' } } } }, my_products: { components: { theme_settings: { components: { style: { primary_btn_color: '#112233', background_page: '#eeeeee' }, values: { footer_content: 'Keep footer' } } } } } } }])
  return server
}
it('loads the existing website color and publishes the chosen color with the native theme route and payload', async () => {
  const server = websiteServer(); const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' })
  expect(await api.getWebsiteAppearance()).toMatchObject({ siteId: 100, themeId: 200, color: '#112233' })
  const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 200 }
  await api.publish(draft, 9, () => {})
  const call = server.calls.find(call => call.path === '/sites/100/themes/200' && call.method === 'POST')
  expect(call).toBeTruthy()
  const values = JSON.parse(call.body.values)
  expect(values.my_products.components.theme_settings.components.style).toEqual({ primary_btn_color: '#abcdef', background_page: '#eeeeee' })
  expect(values.my_products.components.theme_settings.components.values.footer_content).toBe('Keep footer')
  expect(values.general.components.fonts.primary.name).toBe('Keep')
  expect(server.calls.indexOf(call)).toBeLessThan(server.calls.findIndex(entry => entry.method === 'POST' && entry.path === '/business/10' && entry.body.enabled === true))
})
it('does not write website colors for old drafts or when the selected color is already persisted', async () => {
  for (const color of [undefined, '#112233']) {
    const server = websiteServer(); const draft = validDraft()
    if (color) { draft.form.websiteColor = color; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 200 } } else delete draft.form.websiteColor
    await createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' }).publish(draft, 9, () => {})
    expect(server.calls.filter(call => call.path.startsWith('/sites') && call.method !== 'GET')).toHaveLength(0)
  }
})
it('keeps the store disabled after an uncertain color write and recovers without repeating the write', async () => {
  const server = websiteServer(); const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 200 }
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' })
  server.lose('/sites/100/themes/200')
  await expect(api.publish(draft, 9, () => {})).rejects.toThrow()
  expect(server.stores[0].enabled).toBe(false)
  await api.publish(draft, 9, () => {})
  expect(server.calls.filter(call => call.path === '/sites/100/themes/200' && call.method === 'POST')).toHaveLength(1)
  expect(server.stores).toHaveLength(1)
  expect(server.stores[0].enabled).toBe(true)
})
it('refuses an unavailable chosen theme before creating a store or changing website settings', async () => {
  const server = websiteServer(); const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 300 }
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' }).publish(draft, 9, () => {})).rejects.toThrow()
  expect(server.stores).toHaveLength(0)
  expect(server.calls.some(call => call.method !== 'GET')).toBe(false)
})

it('does not activate the store if the website color write reports success but is not persisted', async () => {
  const server = websiteServer(); const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 200 }
  const fetcher = async (url, options) => {
    const previous = structuredClone(server.resources.get('/sites/100/themes')[0].values)
    const response = await server.fetcher(url, options)
    if (new URL(url).pathname === '/api/sites/100/themes/200' && options.method === 'POST') server.resources.get('/sites/100/themes')[0].values = previous
    return response
  }
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher, websiteProduct: 'web_franchises_x' }).publish(draft, 9, () => {})).rejects.toThrow('website_color_unconfirmed')
  expect(server.stores[0].enabled).toBe(false)
  expect(draft.journal.published).toBe(false)
})

it('does not infer a unique website from a partial catalog or choose among multiple franchises', async () => {
  const server = websiteServer()
  server.sites.push({ id: 101, type: 'franchiseweb' })
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' }).getWebsiteAppearance()).rejects.toThrow('ambiguous_website')
  const fetcher = async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: [{ id: 100, type: 'franchiseweb' }], pagination: { current_page: 1, total_pages: 2, total: 101 } }) })
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher, websiteProduct: 'web_franchises_x' }).getWebsiteAppearance()).rejects.toThrow('incomplete_website_catalog')
})

it.each([
  { current_page: 1, total_pages: 'bogus', total: 'bogus' },
  { current_page: 1, total_pages: 0, total: 0 },
  { current_page: 1, total_pages: 1, total: 0 },
  { current_page: 1, total_pages: 1.5, total: 1 }
])('rejects invalid declared website pagination: %s', async pagination => {
  const server = websiteServer()
  const fetcher = async (url, options) => {
    const response = await server.fetcher(url, options)
    const content = await response.json()
    return { ...response, json: async () => ({ ...content, ...(new URL(url).pathname === '/api/sites' && { pagination }) }) }
  }
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher, websiteProduct: 'web_franchises_x' }).getWebsiteAppearance()).rejects.toThrow()
})

it('does not preview marketplace while the installed franchise site is missing', async () => {
  const server = websiteServer()
  server.sites.splice(0, 1, { id: 100, code: 'website', url: 'https://tenant.orderingplus.com' })
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' })
  await expect(api.getWebsiteAppearance()).rejects.toThrow('ambiguous_website')
  expect(server.calls.some(call => call.method !== 'GET')).toBe(false)
})
it('previews the installed canonical franchise host even when its site row has no URL', async () => {
  const server = websiteServer()
  server.sites.push({ id: 101, code: 'web_marketplace_26', url: 'https://tenant.orderingplus.com' })
  const api = createOnboardingApi({ root: 'https://api.orderingplus.com/v400/en/tenant', token: 'test', fetcher: async (url, options) => server.fetcher('https://test.example/api' + new URL(url).pathname.replace('/v400/en/tenant', '') + new URL(url).search, options), websiteProduct: 'web_franchises_x' })
  expect(await api.getWebsiteAppearance()).toMatchObject({ siteId: 100, themeId: 200, preview: { url: 'https://tenant.franchises.orderingplus.com', code: 'web_franchises_x' } })
})

it('rejects a stale marketplace color target before any publication write', async () => {
  const server = websiteServer(); server.sites.push({ id: 101, code: 'website' })
  const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 101, themeId: 200 }
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' })
  await expect(api.publish(draft, 9, () => {})).rejects.toThrow('website_target_changed')
  expect(server.calls.some(call => call.method !== 'GET')).toBe(false)
})

it('applies complete catalog validation to the final website link lookup too', async () => {
  const fetcher = async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: [{ id: 100, type: 'franchiseweb' }], pagination: { current_page: 1, total_pages: 2, total: 101 } }) })
  await expect(createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher }).getWebsiteSites()).rejects.toThrow('incomplete_website_catalog')
})

it('preserves the installed franchise theme and sends its exact chosen-color payload beside an unrelated marketplace', async () => {
  const server = websiteServer(); server.sites.push({ id: 101, code: 'web_marketplace_26', url: 'https://market.example' })
  const draft = validDraft(); draft.form.websiteColor = '#abcdef'; draft.form.websiteAppearanceTarget = { siteId: 100, themeId: 200 }
  await createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher, websiteProduct: 'web_franchises_x' }).publish(draft, 9, () => {})
  const writes = server.calls.filter(call => call.path.startsWith('/sites') && call.method !== 'GET')
  expect(writes).toHaveLength(1)
  expect(writes[0].path).toBe('/sites/100/themes/200')
  const values = JSON.parse(writes[0].body.values)
  expect(values.general.components.fonts.primary.name).toBe('Keep')
  expect(values.my_products.components.theme_settings.components.style).toEqual({ primary_btn_color: '#abcdef', background_page: '#eeeeee' })
  expect(values.my_products.components.theme_settings.components.values.footer_content).toBe('Keep footer')
  expect(draft.journal.published).toBe(true)
})

it('uses canonical Delivery priority after deselecting and reselecting it behind Pickup', async () => {
  const server = fakeServer()
  const draft = validDraft(); draft.form.orderTypes = [2, 1]
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher })
  await api.publish(draft, 1, vi.fn())
  expect(server.calls.filter(c => c.path === '/configs/2' && c.method !== 'GET')).toEqual([])
})

it('waits for the durable journal checkpoint before creating a business', async () => {
  const server = fakeServer(); const draft = validDraft()
  let release
  const checkpoint = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher })
  const job = api.publish(draft, 1, checkpoint)
  try {
    await vi.waitFor(() => expect(checkpoint).toHaveBeenCalled())
    expect(server.calls.some(c => c.path === '/business' && c.method === 'POST')).toBe(false)
  } finally { release(); await job }
})

it('refuses unresolved browser image references before performing any backend mutation', async () => {
  const server = fakeServer(); const draft = validDraft(); draft.form.logo = `ordering-media:${crypto.randomUUID()}`
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher })
  await expect(api.publish(draft, 1, vi.fn())).rejects.toThrow('missing_draft_media')
  expect(server.calls.filter(c => c.method !== 'GET')).toEqual([])
})

it('does not infer a marketplace appearance without a resolved product', async () => {
  const server = fakeServer(); server.sites.push({ id: 1, code: 'web_marketplace_26', url: 'https://market.example' })
  server.resources.set('/sites/1/themes', [{ theme_id: 2, values: {} }])
  const api = createOnboardingApi({ root: 'https://test.example/api', token: 'test', fetcher: server.fetcher })
  await expect(api.getWebsiteAppearance()).rejects.toThrow('ambiguous_website')
})
