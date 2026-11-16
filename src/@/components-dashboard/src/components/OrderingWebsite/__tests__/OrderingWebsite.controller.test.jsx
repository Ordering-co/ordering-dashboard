/* eslint-disable import/first */
// redesign ordering-website B2 (OW-01 / OW-02 / OW-12): the OrderingWebsite controller saves without losing data.
//  - OW-01: each Save sends its own draft on top of the LAST SAVED state, never the other tab's draft;
//    in the store white label `single_store` + `business_slug` always go with the forced values;
//  - OW-02: the site POST inside the save is read: an error shows, skips the theme POST and says no success;
//  - OW-12: the socket, the domain dialog (`setSite`) and "Remove custom domain" do not overwrite unsaved fields.
// Same requests and endpoints as main: only POST {root}/sites/{id} and POST {root}/sites/{id}/themes/{themeId}.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const chain = {}
  ;['businesses', 'select', 'where', 'asDashboard'].forEach((key) => { chain[key] = () => chain })
  chain.get = () => Promise.resolve({ content: { error: false, result: [] } })
  const ordering = { root: 'https://api.test', project: 'demo', setAccessToken: () => chain }
  return {
    showToast: vi.fn(),
    apiState: [ordering, { configurations: { subdomain: 'ordering' } }],
    session: [{ token: 'test-token', user: { id: 1, level: 0 } }],
    socket: null
  }
})

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => mocks.session
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => mocks.apiState
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => mocks.socket,
  useSocketInstance: () => null
}))

import { OrderingWebsite } from '../index'
import { countChanges } from '../../../ui/src/components/MyProducts/OrderingWebsite/SectionsEditor/themeDraft'

const ROOT = 'https://api.test'
const clone = (value) => JSON.parse(JSON.stringify(value))
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const SITE = { id: 5, code: 'ordering-website', name: 'Site', description: 'Desc', domain: 'old.com', type: 'ordering_website' }
const savedThemeValues = () => ({
  general: { components: { buttons: { color: '#111111', borderRadius: '4', buttonTextColor: '#ffffff' }, fonts: { primary: 'Inter' } } },
  my_products: {
    components: {
      website_theme: { components: { type: 'multi_store', business_slug: '' } },
      website_settings: { components: { values: { title: 'Saved title' } } },
      images: { components: { homepage_image_fullscreen: false } }
    }
  },
  order_types: { components: { catering_delivery: {}, catering_pickup: {} } },
  smart_banner_settings: { enabled: false },
  theme_settings: { components: { values: { homepage_content: '', footer_content: '' } } }
})
const THEME_ROW = () => ({ id: 1, theme_id: 9, site_id: 5, values: savedThemeValues(), theme: { values_default: {} } })

let ui
let routes
let calls
let handlers

const baseRoutes = () => ({
  'GET /sites': () => answer({ error: false, result: [clone(SITE)] }),
  'GET /sites/5': () => answer({ error: false, result: clone(SITE) }),
  'GET /sites/5/themes': () => answer({ error: false, result: [THEME_ROW()] }),
  'GET /themes': () => answer({ error: false, result: [{ id: 9, values_default: {} }] }),
  'GET /franchises': () => answer({ error: false, result: [] }),
  'POST /sites/5': (options) => answer({ error: false, result: { ...clone(SITE), ...JSON.parse(options.body) } }),
  'POST /sites/5/themes/9': (options) => answer({ error: false, result: { id: 1, values: JSON.parse(JSON.parse(options.body).values) } })
})

const installFetch = () => {
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const path = url.split('?')[0].replace(ROOT, '')
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : null })
    const handler = routes[`${method} ${path}`]
    if (handler) return handler(options)
    return answer({ error: false, result: [] })
  }))
}

const draw = async (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(<OrderingWebsite UIComponent={UI} appId='ordering-website' {...props} />)
  await waitFor(() => {
    expect(ui.site).toBeTruthy()
    expect(ui.themeValues.website_theme).toBeTruthy()
    expect(ui.advancedValues.my_products).toBeTruthy()
  })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  handlers = {}
  mocks.socket = {
    on: vi.fn((event, fn) => { handlers[event] = fn }),
    off: vi.fn((event, fn) => { if (handlers[event] === fn) delete handlers[event] }),
    join: vi.fn(),
    leave: vi.fn()
  }
  routes = baseRoutes()
  calls = []
  installFetch()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])
const posts = () => calls.filter((call) => call.method === 'POST')
const sitePosts = () => posts().filter((call) => call.path === '/sites/5')
const themePosts = () => posts().filter((call) => call.path === '/sites/5/themes/9')
const sentValues = (call) => JSON.parse(call.body.values)

const editSite = (name, value) => act(async () => { ui.handleChangeInput({ target: { name, value } }) })
const editBasic = (draft) => act(async () => { ui.setThemeValues(draft) })
const editAdvanced = (draft) => act(async () => { ui.setAdvancedValues(draft) })
const save = async (run) => {
  let result
  await act(async () => { result = await run() })
  return result
}

// Basic draft: one field of `my_products.components` changed. Advanced draft: a colour and a my_products edit.
const basicDraft = () => {
  const draft = clone(ui.themeValues)
  draft.website_settings.components.values.title = 'Basic draft title'
  return draft
}
const advancedDraft = () => {
  const draft = clone(ui.advancedValues)
  draft.general.components.buttons.color = '#ff0000'
  draft.my_products.components.website_settings.components.values.title = 'Advanced draft title'
  draft.my_products.components.images.components.homepage_image_fullscreen = true
  return draft
}

describe('OW-01 · each Save sends its own draft on the last saved state', () => {
  it('1 · Basic after editing Advanced: the my_products of Basic and the rest as saved (not the Advanced draft)', async () => {
    await draw()
    await editAdvanced(advancedDraft())
    await editBasic(basicDraft())

    const result = await save(() => ui.handleUpdateSiteTheme())

    expect(themePosts()).toHaveLength(1)
    const values = sentValues(themePosts()[0])
    expect(values.my_products.components.website_settings.components.values.title).toBe('Basic draft title')
    expect(values.my_products.components.images.components.homepage_image_fullscreen).toBe(false)
    expect(values.general.components.buttons.color).toBe('#111111')
    expect(values.general).toEqual(savedThemeValues().general)
    // the Advanced draft is not stepped on: only its my_products follows what Basic saved
    expect(ui.advancedValues.general.components.buttons.color).toBe('#ff0000')
    expect(ui.advancedValues.my_products.components.website_settings.components.values.title).toBe('Basic draft title')
    expect(result).toEqual({ ok: true })
  })

  it('2 · Advanced after editing Basic: the Advanced draft with the SAVED my_products and its homepage_image_fullscreen', async () => {
    await draw()
    await editBasic(basicDraft())
    await editAdvanced(advancedDraft())

    const result = await save(() => ui.handleUpdateSiteTheme(ui.advancedValues))

    const values = sentValues(themePosts()[0])
    expect(values.general.components.buttons.color).toBe('#ff0000')
    expect(values.my_products.components.website_settings.components.values.title).toBe('Saved title')
    expect(values.my_products.components.images.components.homepage_image_fullscreen).toBe(true)
    expect(result).toEqual({ ok: true })
  })

  it('2 · saving Basic first and then Advanced: what Basic saved stays in the second body', async () => {
    // the server answers without `values`: the Advanced draft loaded earlier is stale
    routes['POST /sites/5/themes/9'] = () => answer({ error: false, result: { id: 1 } })
    await draw()
    await editBasic(basicDraft())
    await save(() => ui.handleUpdateSiteTheme())
    await editAdvanced({ ...ui.advancedValues, general: advancedDraft().general })

    await save(() => ui.handleUpdateSiteTheme(ui.advancedValues))

    expect(themePosts()).toHaveLength(2)
    const second = sentValues(themePosts()[1])
    expect(second.my_products.components.website_settings.components.values.title).toBe('Basic draft title')
    // and the Advanced draft is what Advanced sends for the rest
    expect(second.general.components.buttons.color).toBe('#ff0000')
  })

  it('2 · saving Advanced (fullscreen on) and then Basic without touching it: Basic does not put the old value back', async () => {
    await draw()
    const savedBefore = ui.themeValues?.images?.components?.homepage_image_fullscreen
    await editAdvanced(advancedDraft())
    await save(() => ui.handleUpdateSiteTheme(ui.advancedValues))
    expect(sentValues(themePosts()[0]).my_products.components.images.components.homepage_image_fullscreen).toBe(true)
    expect(savedBefore).not.toBe(true)

    await save(() => ui.handleUpdateSiteTheme())

    expect(sentValues(themePosts()[1]).my_products.components.images.components.homepage_image_fullscreen).toBe(true)
  })

  it('3 · forcedSiteId + business.slug: Advanced and Basic send single_store + business_slug and empty buttons', async () => {
    await draw({ forcedSiteId: 5, appId: undefined, business: { slug: 'store-x' } })
    await editAdvanced(advancedDraft())

    await save(() => ui.handleUpdateSiteTheme(ui.advancedValues))

    const advanced = sentValues(themePosts()[0])
    expect(advanced.my_products.components.website_theme.components.type).toBe('single_store')
    expect(advanced.my_products.components.website_theme.components.business_slug).toBe('store-x')
    expect(advanced.general.components.buttons).toEqual({ color: '', borderRadius: '', buttonTextColor: '' })

    await save(() => ui.handleUpdateSiteTheme())

    const basic = sentValues(themePosts()[1])
    expect(basic.my_products.components.website_theme.components.type).toBe('single_store')
    expect(basic.my_products.components.website_theme.components.business_slug).toBe('store-x')
    expect(basic.general.components.buttons).toEqual({ color: '', borderRadius: '', buttonTextColor: '' })
    // the forced values never come from the draft
    expect(posts().every((call) => call.path === '/sites/5/themes/9')).toBe(true)
  })

  it('3 · without forcedSiteId nothing is forced and the buttons are kept', async () => {
    await draw({ business: { slug: 'store-x' } })
    await save(() => ui.handleUpdateSiteTheme())

    const values = sentValues(themePosts()[0])
    expect(values.my_products.components.website_theme.components.type).toBe('multi_store')
    expect(values.my_products.components.website_theme.components.business_slug).toBe('')
    expect(values.general.components.buttons.color).toBe('#111111')
  })

  it('4 · franchise (type franchiseweb + disableReplaceCode): the load writes nothing and Basic saves in the same endpoints', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [{ ...SITE, code: 'fr-site', type: 'ordering_website' }] })
    await draw({ appId: 'fr-site', type: 'franchiseweb', disableReplaceCode: true })

    expect(posts()).toHaveLength(0)
    expect(ui.site.type).toBe('franchiseweb')

    await editBasic(basicDraft())
    const result = await save(() => ui.handleUpdateSiteTheme())

    expect(posts().map((call) => `${call.method} ${call.path}`)).toEqual(['POST /sites/5/themes/9'])
    expect(sentValues(themePosts()[0]).my_products.components.website_settings.components.values.title).toBe('Basic draft title')
    expect(result).toEqual({ ok: true })
  })

  it('10 · handleSaveAll mixes both drafts and takes homepage_image_fullscreen from themeValues', async () => {
    await draw()
    const advanced = advancedDraft()
    const basic = basicDraft()
    basic.images.components.homepage_image_fullscreen = false
    await editAdvanced(advanced)
    await editBasic(basic)

    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: true })
    expect(themePosts()).toHaveLength(1)
    const values = sentValues(themePosts()[0])
    expect(values.general.components.buttons.color).toBe('#ff0000')
    expect(values.order_types).toEqual(savedThemeValues().order_types)
    expect(values.my_products.components).toEqual(basic)
    // the Advanced my_products.components.images value (true) is not the one that goes
    expect(values.my_products.components.images.components.homepage_image_fullscreen).toBe(false)
    expect(ui.savedValues).toEqual(values)
  })

  it('10 · an answer whose `values` is the JSON text sent is not spread into advancedValues character by character', async () => {
    routes['POST /sites/5/themes/9'] = (options) => answer({ error: false, result: { id: 1, values: JSON.parse(options.body).values } })
    await draw()
    await editAdvanced(advancedDraft())

    await save(() => ui.handleSaveAll())

    expect(Object.keys(ui.advancedValues)).not.toContain('0')
    expect(ui.advancedValues.general.components.buttons.color).toBe('#ff0000')
    expect(ui.advancedValues).toEqual(ui.savedValues)
  })

  it('10 · discardChanges goes back to what is saved (themeValues, advancedValues, site and changes)', async () => {
    await draw()
    await editBasic(basicDraft())
    await save(() => ui.handleSaveAll())
    const saved = clone(ui.savedValues)
    expect(saved.my_products.components.website_settings.components.values.title).toBe('Basic draft title')

    await editBasic({ ...ui.themeValues, extra: { components: { x: 1 } } })
    await editAdvanced({ ...ui.advancedValues, general: advancedDraft().general })
    await editSite('name', 'Dirty name')
    expect(ui.site.name).toBe('Dirty name')

    await act(async () => { ui.discardChanges() })

    expect(ui.themeValues).toEqual(saved.my_products.components)
    expect(ui.advancedValues).toEqual(saved)
    expect(ui.site.name).toBe('Site')
    expect(ui.formState).toEqual({ loading: false, changes: {}, error: null })
  })

  it('exposes `saving` while a theme save runs', async () => {
    let release
    routes['POST /sites/5/themes/9'] = () => new Promise((resolve) => { release = () => resolve({ json: () => Promise.resolve({ error: false, result: { id: 1 } }) }) })
    await draw()
    expect(ui.saving).toBe(false)

    let pending
    await act(async () => { pending = ui.handleUpdateSiteTheme() })
    await waitFor(() => expect(ui.saving).toBe(true))
    await act(async () => { release(); await pending })

    expect(ui.saving).toBe(false)
  })
})

describe('OW-02 · the site POST inside the save is read', () => {
  it('5 · site POST with error: error toast, no theme POST, no success toast, changes intact, { ok: false }', async () => {
    routes['POST /sites/5'] = () => answer({ error: true, result: ['Slug taken'] })
    await draw()
    await editSite('name', 'New name')
    mocks.showToast.mockReset()

    const result = await save(() => ui.handleUpdateSiteTheme())

    expect(result).toMatchObject({ ok: false })
    expect(sitePosts()).toHaveLength(1)
    expect(themePosts()).toHaveLength(0)
    expect(toasts()).toContainEqual(['error', ['Slug taken']])
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(ui.formState.changes).toEqual({ name: 'New name' })
    expect(ui.site.name).toBe('New name')
  })

  it('5 · site POST that throws: the error shows and the theme is not posted', async () => {
    routes['POST /sites/5'] = () => Promise.reject(new Error('Network down'))
    await draw()
    await editSite('name', 'New name')
    mocks.showToast.mockReset()

    const result = await save(() => ui.handleSaveAll())

    expect(result).toMatchObject({ ok: false })
    expect(themePosts()).toHaveLength(0)
    expect(toasts()).toContainEqual(['error', 'Network down'])
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(ui.formState.changes).toEqual({ name: 'New name' })
  })

  it('5 · theme POST with error: error toast and { ok: false }', async () => {
    routes['POST /sites/5/themes/9'] = () => answer({ error: true, result: ['Invalid values'] })
    await draw()
    mocks.showToast.mockReset()

    const result = await save(() => ui.handleUpdateSiteTheme())

    expect(result).toMatchObject({ ok: false })
    expect(toasts()).toContainEqual(['error', ['Invalid values']])
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(ui.saving).toBe(false)
  })

  it('6 · site POST ok: changes are cleared and a second Save does not resend `name`', async () => {
    await draw()
    await editSite('name', 'New name')

    const first = await save(() => ui.handleUpdateSiteTheme())

    expect(sitePosts()).toHaveLength(1)
    expect(sitePosts()[0].body).toEqual({ name: 'New name' })
    expect(ui.formState).toEqual({ loading: false, changes: {}, error: null })
    expect(ui.site.name).toBe('New name')
    expect(ui.savedSite.name).toBe('New name')

    await save(() => ui.handleUpdateSiteTheme())

    expect(sitePosts()).toHaveLength(1)
    expect(themePosts()).toHaveLength(2)
    expect(first).toEqual({ ok: true })
  })
})

describe('OW-12 · what comes from the server does not step on unsaved fields', () => {
  it('7 · socket sites_update with an unsaved `name`: `name` stays, `domain` is updated', async () => {
    await draw()
    await editSite('name', 'Local name')

    await act(async () => { handlers.sites_update({ id: 5, name: 'Server name', domain: 'new.com' }) })

    expect(ui.site.name).toBe('Local name')
    expect(ui.site.domain).toBe('new.com')
    expect(ui.savedSite.name).toBe('Server name')
    expect(ui.savedSite.domain).toBe('new.com')
  })

  it('7 · socket sites_update for another site is ignored', async () => {
    await draw()

    await act(async () => { handlers.sites_update({ id: 99, name: 'Other', domain: 'other.com' }) })

    expect(ui.site.name).toBe('Site')
    expect(ui.site.domain).toBe('old.com')
  })

  it('8 · the setSite the UI receives (domain dialog) keeps the unsaved `description`', async () => {
    await draw()
    await editSite('description', 'Local description')

    await act(async () => { ui.setSite({ ...ui.site, description: 'Server description', domain: 'dialog.com' }) })

    expect(ui.site.description).toBe('Local description')
    expect(ui.site.domain).toBe('dialog.com')
    expect(ui.savedSite.domain).toBe('dialog.com')
    expect(ui.savedSite.description).toBe('Desc')
    expect(ui.formState.changes).toEqual({ description: 'Local description' })
  })

  it('8 · the setSite the UI receives also takes a function, like setState', async () => {
    await draw()
    await editSite('description', 'Local description')

    await act(async () => { ui.setSite((prev) => ({ ...prev, description: 'Server description', domain: null })) })

    expect(ui.site.description).toBe('Local description')
    expect(ui.site.domain).toBeNull()
  })

  it('9 · handleUpdateSite({ domain: null }) with an unsaved `description`: the site keeps it and changes still have it', async () => {
    routes['POST /sites/5'] = () => answer({ error: false, result: { ...clone(SITE), domain: null } })
    await draw()
    await editSite('description', 'Local description')

    await act(async () => { await ui.handleUpdateSite({ domain: null }) })

    expect(sitePosts()).toHaveLength(1)
    expect(sitePosts()[0].body).toEqual({ domain: null })
    expect(ui.site.domain).toBeNull()
    expect(ui.site.description).toBe('Local description')
    expect(ui.formState.changes).toEqual({ description: 'Local description' })
    expect(ui.savedSite.domain).toBeNull()
    expect(ui.savedSite.description).toBe('Desc')
  })

  it('9 · the dashboard Save (no payload) still sends formState.changes and clears them', async () => {
    await draw()
    await editSite('description', 'Local description')

    await act(async () => { await ui.handleUpdateSite() })

    expect(sitePosts()).toHaveLength(1)
    expect(sitePosts()[0].body).toEqual({ description: 'Local description' })
    expect(ui.formState.changes).toEqual({})
    expect(ui.site.description).toBe('Local description')
  })
})

describe('Endpoints are the same as main', () => {
  it('11 · the saves only POST {root}/sites/{id} and {root}/sites/{id}/themes/{themeId}', async () => {
    await draw()
    await editSite('name', 'New name')
    await save(() => ui.handleUpdateSiteTheme())
    await editSite('description', 'New description')
    await save(() => ui.handleUpdateSiteTheme(ui.advancedValues))
    await editSite('name', 'Newer name')
    await save(() => ui.handleSaveAll())

    expect(posts().map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /sites/5',
      'POST /sites/5/themes/9',
      'POST /sites/5',
      'POST /sites/5/themes/9',
      'POST /sites/5',
      'POST /sites/5/themes/9'
    ])
    const theme = themePosts()[0].body
    expect(Object.keys(theme)).toEqual(['values'])
    expect(typeof theme.values).toBe('string')
  })
})

// redesign ordering-website-2 (OW2-01): /my-products/ordering-website-2 mounts this controller with
// appId = type = 'web_marketplace_26' and no disableReplaceCode. Its three load branches are main's, pinned here.
describe('/my-products/ordering-website-2 · load with type, no disableReplaceCode', () => {
  const W26 = 'web_marketplace_26'
  const w26Site = (extra = {}) => ({ ...clone(SITE), code: W26, type: W26, ...extra })
  const drawW26 = () => draw({ appId: W26, type: W26 })

  it('a · the site already has that code and type: the load writes nothing and the save goes to that site', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [{ ...clone(SITE), id: 34, code: 'website', type: null }, w26Site()] })
    await drawW26()

    expect(posts()).toHaveLength(0)
    expect(ui.site).toMatchObject({ id: 5, code: W26, type: W26 })

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: true })
    expect(posts().map((call) => `${call.method} ${call.path}`)).toEqual(['POST /sites/5', 'POST /sites/5/themes/9'])
    expect(sitePosts()[0].body).toEqual({ name: 'Marketplace 26' })
  })

  const bootW26 = () => render(<OrderingWebsite UIComponent={(uiProps) => { ui = uiProps; return null }} appId={W26} type={W26} />)
  const steps = () => posts().map((call) => `${call.method} ${call.path}`)
  // the synthetic API for the site: what is posted is kept, so a later answer does not undo an earlier write
  const statefulSite = (initial) => {
    let current = clone(initial)
    routes['POST /sites/5'] = (options) => {
      current = { ...current, ...JSON.parse(options.body) }
      return answer({ error: false, result: clone(current) })
    }
  }

  // (K-4): opening this page only reads, like /my-products/dashboard. What main wrote on load (rename the
  // site found, or create it) waits in the controller and the first save writes it through `ensureSite`, before the theme.
  it('b · a site has the type with another code: opening writes nothing and loads its theme; the first save renames it once, then saves the theme', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ code: 'old-code' })] })
    statefulSite(w26Site({ code: 'old-code' }))
    bootW26()

    await waitFor(() => expect(ui.savedValues).not.toBeNull())
    expect(posts()).toEqual([])
    expect(ui.site).toMatchObject({ id: 5, code: 'old-code', type: W26 })
    expect(calls.filter((call) => call.path === '/sites/5/themes').map((call) => call.method)).toEqual(['GET'])
    expect(ui.orderingTheme.themes).toHaveLength(1)
    expect(ui.orderingTheme.loading).toBe(false)
    expect(ui.savedValues.my_products.components.website_settings.components.values.title).toBe('Saved title')

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: true })
    expect(steps()).toEqual(['POST /sites/5', 'POST /sites/5', 'POST /sites/5/themes/9'])
    expect(posts()[0].body).toEqual({ type: W26, code: W26 })
    expect(posts()[1].body).toEqual({ name: 'Marketplace 26' })
    expect(ui.site).toMatchObject({ id: 5, code: W26, type: W26, name: 'Marketplace 26' })
    expect(ui.savedSite).toMatchObject({ code: W26, type: W26 })

    // already fixed: the next save does not rename again
    calls.length = 0
    await editSite('description', 'Another')
    await save(() => ui.handleSaveAll())
    expect(posts().map((call) => call.body)).toEqual([{ description: 'Another' }, expect.objectContaining({ values: expect.any(String) })])
  })

  it('b · a site has the code with another type: opening writes nothing; the first save renames it once and saves the theme', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ type: null })] })
    statefulSite(w26Site({ type: null }))
    bootW26()

    await waitFor(() => expect(ui.savedValues).not.toBeNull())
    expect(posts()).toEqual([])
    expect(ui.site).toMatchObject({ id: 5, code: W26, type: null })
    expect(calls.filter((call) => call.path === '/sites/5/themes').map((call) => call.method)).toEqual(['GET'])
    expect(ui.orderingTheme.themes).toHaveLength(1)

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: true })
    expect(steps()).toEqual(['POST /sites/5', 'POST /sites/5', 'POST /sites/5/themes/9'])
    expect(posts()[0].body).toEqual({ type: W26, code: W26 })
    expect(ui.site).toMatchObject({ id: 5, code: W26, type: W26 })
  })

  it('b · the brand Save (handleUpdateSite) renames first too, and the domain dialog can ask for the site with ensureSite (one write)', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ code: 'old-code' })] })
    statefulSite(w26Site({ code: 'old-code' }))
    bootW26()
    await waitFor(() => expect(ui.savedValues).not.toBeNull())

    let sites
    await act(async () => { sites = await Promise.all([ui.ensureSite(), ui.ensureSite()]) })
    expect(posts()).toEqual([{ method: 'POST', path: '/sites/5', body: { type: W26, code: W26 } }])
    expect(sites[0]).toMatchObject({ id: 5, code: W26 })
    expect(sites[1]).toBe(sites[0])
    await act(async () => { await ui.ensureSite() })
    expect(posts()).toHaveLength(1)
  })

  it('b · the brand Save (handleUpdateSite): the rename goes before the site changes', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ code: 'old-code' })] })
    statefulSite(w26Site({ code: 'old-code' }))
    bootW26()
    await waitFor(() => expect(ui.savedValues).not.toBeNull())

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleUpdateSite())

    expect(result).toBe(true)
    expect(posts().map((call) => call.body)).toEqual([{ type: W26, code: W26 }, { name: 'Marketplace 26' }])
    expect(ui.site).toMatchObject({ code: W26, name: 'Marketplace 26' })
  })

  it('b · the rename is refused on save: the error shows, nothing else is posted and the changes stay', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ code: 'old-code' })] })
    routes['POST /sites/5'] = () => answer({ error: true, result: ['No rename'] })
    bootW26()

    await waitFor(() => expect(ui.savedValues).not.toBeNull())
    expect(posts()).toEqual([])
    expect(ui.site).toMatchObject({ id: 5, code: 'old-code', type: W26 })
    expect(ui.orderingTheme.themes).toHaveLength(1)

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: false, error: ['No rename'] })
    expect(posts()).toEqual([{ method: 'POST', path: '/sites/5', body: { type: W26, code: W26 } }])
    expect(toasts()).toContainEqual(['error', ['No rename']])
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(ui.formState.changes).toEqual({ name: 'Marketplace 26' })

    // the brand Save says the same
    mocks.showToast.mockClear()
    const brand = await save(() => ui.handleUpdateSite())
    expect(brand).toBe(false)
    expect(toasts()).toContainEqual(['error', ['No rename']])
    expect(posts().every((call) => call.body.type === W26 && call.body.code === W26)).toBe(true)
  })

  it('OW2-04 · with no theme loaded (its request failed, and there is no default to assign), Save sends nothing, not even the rename, and does not say it saved', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [w26Site({ code: 'old-code' })] })
    routes['GET /sites/5/themes'] = () => answer({ error: true, result: ['No themes'] })
    routes['GET /themes'] = () => answer({ error: false, result: [] })
    bootW26()
    await waitFor(() => expect(ui.site).toMatchObject({ id: 5, type: W26 }))
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    expect(posts()).toHaveLength(0)
    calls.length = 0

    await editSite('name', 'Marketplace 26')
    const result = await save(() => ui.handleSaveAll())

    expect(posts()).toHaveLength(0)
    expect(result.ok).toBe(false)
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(ui.formState.changes).toEqual({ name: 'Marketplace 26' })
  })

  describe('c · no site with that code or type', () => {
    const DEFAULT_TITLE = 'Default title'
    const defaults = () => {
      const values = savedThemeValues()
      values.my_products.components.website_settings.components.values.title = DEFAULT_TITLE
      return values
    }
    // what the editor shows for a site to create: the defaults, with this project's default domain
    const shown = () => {
      const values = defaults()
      values.my_products.components.website_settings.components.values.default_domain = 'https://demo.ordering.com'
      return values
    }
    const routesForCreate = () => {
      routes['GET /sites'] = () => answer({ error: false, result: [{ ...clone(SITE), id: 34, code: 'website', type: null }] })
      routes['GET /themes'] = () => answer({ error: false, result: [{ id: 9, values_default: defaults() }] })
      routes['POST /sites'] = () => answer({ error: false, result: w26Site() })
      routes['POST /sites/5/themes'] = (options) => answer({
        error: false,
        result: { id: 1, theme_id: 9, site_id: 5, values: JSON.parse(JSON.parse(options.body).values) }
      })
      statefulSite(w26Site())
    }

    it('opening writes nothing: no site yet, the editor shows the theme defaults and nothing is saved', async () => {
      routesForCreate()
      bootW26()

      await waitFor(() => expect(ui.themesList.themes).toHaveLength(1))
      await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())

      expect(posts()).toEqual([])
      expect(ui.site).toBeNull()
      // the saved base of the theme is the defaults the editor shows, so a theme change counts and Save appears
      expect(ui.savedValues).toEqual(shown())
      expect(ui.themeValues.website_settings.components.values.title).toBe(DEFAULT_TITLE)
      expect(ui.advancedValues.my_products.components.website_settings.components.values.title).toBe(DEFAULT_TITLE)
    })

    const countOf = () => countChanges({
      themeValues: ui.themeValues,
      savedThemeValues: ui.savedValues?.my_products?.components,
      advancedValues: ui.advancedValues,
      savedValues: ui.savedValues,
      siteChanges: ui.formState.changes,
      savedSite: ui.savedSite
    }).count

    it('changing ONLY a theme value counts as a change, Discard goes back to the defaults, and Save creates, assigns the theme and saves', async () => {
      routesForCreate()
      bootW26()
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())
      await waitFor(() => expect(ui.savedValues).not.toBeNull())

      expect(countOf()).toBe(0)
      const draft = clone(ui.themeValues)
      draft.images = { components: { logo: 'https://img.test/logo.png' } }
      await editBasic(draft)
      expect(ui.savedValues).toEqual(shown())
      expect(countOf()).toBeGreaterThan(0)

      const advanced = clone(ui.advancedValues)
      advanced.business_view = { components: { changed: true } }
      await act(async () => { ui.setAdvancedValues(advanced) })
      expect(countOf()).toBeGreaterThan(1)

      await act(async () => { ui.discardChanges() })
      expect(countOf()).toBe(0)
      expect(ui.themeValues).toEqual(shown().my_products.components)

      await editBasic(draft)
      const result = await save(() => ui.handleSaveAll())
      expect(result).toEqual({ ok: true })
      expect(steps()).toEqual(['POST /sites', 'POST /sites/5/themes', 'POST /sites/5/themes/9'])
      expect(sentValues(posts()[2]).my_products.components.images.components.logo).toBe('https://img.test/logo.png')
      expect(countOf()).toBe(0)
    })

    it('the first save creates the site, assigns the default theme and saves the draft on it', async () => {
      routesForCreate()
      bootW26()
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())

      await editSite('name', 'Marketplace 26')
      const draft = clone(ui.themeValues)
      draft.website_settings.components.values.title = 'My title'
      await editBasic(draft)
      const result = await save(() => ui.handleSaveAll())

      expect(result).toEqual({ ok: true })
      expect(steps()).toEqual(['POST /sites', 'POST /sites/5/themes', 'POST /sites/5', 'POST /sites/5/themes/9'])
      expect(posts()[0].body).toEqual({ code: W26, name: 'ordering', type: W26 })
      expect(posts()[1].body.theme_id).toBe(9)
      expect(JSON.parse(posts()[1].body.values).my_products.components.website_settings.components.values.title).toBe(DEFAULT_TITLE)
      expect(posts()[2].body).toEqual({ name: 'Marketplace 26' })
      expect(sentValues(posts()[3]).my_products.components.website_settings.components.values.title).toBe('My title')
      expect(ui.site).toMatchObject({ id: 5, code: W26, type: W26, name: 'Marketplace 26' })
      expect(ui.orderingTheme.themes[0]).toMatchObject({ theme_id: 9, site_id: 5 })
      expect(ui.savedValues.my_products.components.website_settings.components.values.title).toBe('My title')
      expect(ui.themeValues.website_settings.components.values.title).toBe('My title')

      // created: the next save goes to that site and theme
      calls.length = 0
      await editSite('description', 'Another')
      await save(() => ui.handleSaveAll())
      expect(steps()).toEqual(['POST /sites/5', 'POST /sites/5/themes/9'])
    })

    it('the brand Save (handleUpdateSite) creates the site first and then sends the changes to it; ensureSite creates it once', async () => {
      routesForCreate()
      bootW26()
      await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())

      await editSite('name', 'Marketplace 26')
      const result = await save(() => ui.handleUpdateSite())

      expect(result).toBe(true)
      expect(steps()).toEqual(['POST /sites', 'POST /sites/5'])
      expect(posts()[1].body).toEqual({ name: 'Marketplace 26' })

      calls.length = 0
      await act(async () => { await Promise.all([ui.ensureSite(), ui.ensureSite()]) })
      expect(posts()).toEqual([])
    })

    it('a double ensureSite creates the site once', async () => {
      routesForCreate()
      bootW26()
      await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))

      let sites
      await act(async () => { sites = await Promise.all([ui.ensureSite(), ui.ensureSite()]) })

      expect(steps()).toEqual(['POST /sites'])
      expect(sites[0]).toMatchObject({ id: 5, code: W26 })
      expect(ui.site).toMatchObject({ id: 5, code: W26 })
    })

    it('the create is refused: the error shows, nothing else is posted and the draft stays', async () => {
      routesForCreate()
      routes['POST /sites'] = () => answer({ error: true, result: ['No create'] })
      bootW26()
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())

      await editSite('name', 'Marketplace 26')
      const result = await save(() => ui.handleSaveAll())

      expect(result).toEqual({ ok: false, error: ['No create'] })
      expect(steps()).toEqual(['POST /sites'])
      expect(toasts()).toContainEqual(['error', ['No create']])
      expect(ui.formState.changes).toEqual({ name: 'Marketplace 26' })
      expect(ui.site).toMatchObject({ name: 'Marketplace 26' })
    })

    it('the site is created but the default theme is refused: the error shows, and the next save assigns it without creating the site again', async () => {
      routesForCreate()
      const assign = routes['POST /sites/5/themes']
      routes['POST /sites/5/themes'] = () => answer({ error: true, result: ['No theme'] })
      bootW26()
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())

      await editSite('name', 'Marketplace 26')
      const first = await save(() => ui.handleSaveAll())

      expect(first.ok).toBe(false)
      expect(steps()).toEqual(['POST /sites', 'POST /sites/5/themes'])
      expect(toasts()).toContainEqual(['error', ['No theme']])
      expect(ui.formState.changes).toEqual({ name: 'Marketplace 26' })

      routes['POST /sites/5/themes'] = assign
      calls.length = 0
      const second = await save(() => ui.handleSaveAll())

      expect(second).toEqual({ ok: true })
      expect(steps()).toEqual(['POST /sites/5/themes', 'POST /sites/5', 'POST /sites/5/themes/9'])
    })

    it('discard goes back to the theme defaults, not to an empty editor', async () => {
      routesForCreate()
      bootW26()
      await waitFor(() => expect(ui.themeValues.website_settings).toBeTruthy())
      const draft = clone(ui.themeValues)
      draft.website_settings.components.values.title = 'My title'
      await editBasic(draft)

      await act(async () => { ui.discardChanges() })

      expect(ui.themeValues.website_settings.components.values.title).toBe(DEFAULT_TITLE)
      expect(posts()).toEqual([])
    })
  })
})

// redesign franchises-website (FW-04): what src/pages/FranchisesWebsite passes (type franchiseweb + disableReplaceCode,
// appId = ?appId= or web_franchises_x, setAppIdState from the site selector). Test 4 above covers «the matching site loads with no write».
describe('/my-products/franchises-website · franchise load and site switch', () => {
  const FR = 'web_franchises_x'
  const frSite = (overrides = {}) => ({ ...clone(SITE), code: FR, type: 'franchiseweb', name: 'Franchise website', ...overrides })
  const franchiseProps = { type: 'franchiseweb', name: 'Franchise website', isFranchise: true, disableReplaceCode: true }

  it('no site with the code: main creates it (POST /sites { code, name, type }) and never renames another franchise site', async () => {
    let created = false
    routes['GET /sites'] = () => answer({ error: false, result: created ? [frSite(), frSite({ id: 6, code: 'other-franchise', name: 'Other' })] : [frSite({ id: 6, code: 'other-franchise', name: 'Other' })] })
    routes['POST /sites'] = () => {
      created = true
      return answer({ error: false, result: frSite() })
    }
    await draw({ appId: FR, ...franchiseProps })

    expect(posts()).toEqual([{ method: 'POST', path: '/sites', body: { code: FR, name: 'Franchise website', type: 'franchiseweb' } }])
    expect(posts().some((call) => call.path === '/sites/6')).toBe(false)
    expect(ui.site).toMatchObject({ id: 5, code: FR, type: 'franchiseweb' })
  })

  // ?appId= reaches the controller as is. With `fallbackAppId` (only the franchises page passes it) a code that is not an
  // existing franchiseweb site opens the default franchise site instead: main opened the marketplace website (?appId=website) or
  // created a site for a typo.
  const WEBSITE_SITE = { id: 34, code: 'website', type: null, name: 'Marketplace Website' }
  const drawUnchecked = (props) => {
    const UI = (uiProps) => { ui = uiProps; return null }
    render(<OrderingWebsite UIComponent={UI} {...props} />)
  }

  it('· ?appId=website does not open the marketplace website: it switches to the default franchise site', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE_SITE), frSite()] })
    const setAppIdState = vi.fn()
    drawUnchecked({ appId: 'website', fallbackAppId: FR, setAppIdState, ...franchiseProps })
    await waitFor(() => expect(setAppIdState).toHaveBeenCalledWith(FR))
    expect(ui.site).toBeNull()
    expect(posts()).toEqual([])
    expect(calls.some((call) => call.path === '/sites/34/themes')).toBe(false)
  })

  it('· a code that is no site creates nothing: it switches to the default franchise site', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [frSite()] })
    const setAppIdState = vi.fn()
    drawUnchecked({ appId: 'web_franchises_typo', fallbackAppId: FR, setAppIdState, ...franchiseProps })
    await waitFor(() => expect(setAppIdState).toHaveBeenCalledWith(FR))
    expect(posts()).toEqual([])
  })

  it('· an existing franchise site in ?appId= opens as before', async () => {
    const other = frSite({ id: 6, code: 'other-franchise', name: 'Other' })
    routes['GET /sites'] = () => answer({ error: false, result: [frSite(), clone(other)] })
    routes['GET /sites/6/themes'] = () => answer({ error: false, result: [{ ...THEME_ROW(), id: 2, site_id: 6 }] })
    const setAppIdState = vi.fn()
    drawUnchecked({ appId: 'other-franchise', fallbackAppId: FR, setAppIdState, ...franchiseProps })
    await waitFor(() => expect(ui.site).toMatchObject({ id: 6, code: 'other-franchise' }))
    expect(setAppIdState).not.toHaveBeenCalled()
    expect(posts()).toEqual([])
  })

  it('· the default code itself still creates the franchise site when there is none (as main)', async () => {
    let created = false
    routes['GET /sites'] = () => answer({ error: false, result: created ? [frSite()] : [] })
    routes['POST /sites'] = () => { created = true; return answer({ error: false, result: frSite() }) }
    const setAppIdState = vi.fn()
    await draw({ appId: FR, fallbackAppId: FR, setAppIdState, ...franchiseProps })
    expect(setAppIdState).not.toHaveBeenCalled()
    expect(posts()).toEqual([{ method: 'POST', path: '/sites', body: { code: FR, name: 'Franchise website', type: 'franchiseweb' } }])
  })

  it('switching appId (the site selector) loads the other site and its theme, writes nothing, and Save goes to that site', async () => {
    const other = frSite({ id: 6, code: 'other-franchise', name: 'Other' })
    routes['GET /sites'] = () => answer({ error: false, result: [frSite(), clone(other)] })
    routes['GET /sites/6/themes'] = () => answer({ error: false, result: [{ ...THEME_ROW(), id: 2, site_id: 6 }] })
    routes['POST /sites/6'] = (options) => answer({ error: false, result: { ...clone(other), ...JSON.parse(options.body) } })
    routes['POST /sites/6/themes/9'] = (options) => answer({ error: false, result: { id: 2, values: JSON.parse(JSON.parse(options.body).values) } })
    const UI = (uiProps) => { ui = uiProps; return null }
    const view = render(<OrderingWebsite UIComponent={UI} appId={FR} {...franchiseProps} />)
    await waitFor(() => expect(ui.site).toMatchObject({ id: 5, code: FR }))

    view.rerender(<OrderingWebsite UIComponent={UI} appId='other-franchise' {...franchiseProps} />)
    await waitFor(() => expect(ui.site).toMatchObject({ id: 6, code: 'other-franchise', name: 'Other' }))
    await waitFor(() => expect(calls.some((call) => call.path === '/sites/6/themes')).toBe(true))
    expect(posts()).toHaveLength(0)

    await editSite('name', 'Other QA')
    const result = await save(() => ui.handleSaveAll())

    expect(result).toEqual({ ok: true })
    expect(posts().map((call) => `${call.method} ${call.path}`)).toEqual(['POST /sites/6', 'POST /sites/6/themes/9'])
    expect(posts()[0].body).toEqual({ name: 'Other QA' })
  })
})

// when GET /sites failed the controller answered with no error and no way to ask again (the editor drew an empty site
// whose Name took the focus and accepted nothing). It now says what failed (`orderingTheme.error`) and gives `reloadSite`.
describe('· a site that does not load says so and can be asked again', () => {
  const boot = async (props = {}) => {
    ui = null
    const UI = (uiProps) => { ui = uiProps; return null }
    render(<OrderingWebsite UIComponent={UI} appId='ordering-website' {...props} />)
    await waitFor(() => expect(ui).toBeTruthy())
  }
  const sitesGets = () => calls.filter((call) => call.method === 'GET' && call.path === '/sites')

  it('GET /sites answered with an error: the error is exposed, nothing is created and Retry loads the site', async () => {
    routes['GET /sites'] = () => answer({ error: true, result: ['Internal server error'] })
    await boot()
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    expect(ui.orderingTheme.error).toEqual(['Internal server error'])
    expect(ui.site).toBeNull()
    expect(typeof ui.reloadSite).toBe('function')
    expect(posts()).toHaveLength(0)

    routes['GET /sites'] = () => answer({ error: false, result: [clone(SITE)] })
    await act(async () => { ui.reloadSite() })
    await waitFor(() => expect(ui.site).toMatchObject({ id: 5 }))
    await waitFor(() => expect(ui.orderingTheme.themes).toHaveLength(1))
    expect(ui.orderingTheme.error).toBeNull()
    expect(sitesGets()).toHaveLength(2)
    expect(posts()).toHaveLength(0)
  })

  it('GET /sites that throws (network): the error is exposed and Retry asks again', async () => {
    routes['GET /sites'] = () => Promise.reject(new Error('Failed to fetch'))
    await boot()
    await waitFor(() => expect(ui.orderingTheme.error).toEqual(['Failed to fetch']))
    expect(ui.orderingTheme.loading).toBe(false)

    routes['GET /sites'] = () => answer({ error: false, result: [clone(SITE)] })
    await act(async () => { ui.reloadSite() })
    await waitFor(() => expect(ui.site).toMatchObject({ id: 5 }))
    expect(ui.orderingTheme.error).toBeNull()
  })

  it('a white label (forcedSiteId) that does not load: Retry asks for that site again', async () => {
    routes['GET /sites/5'] = () => answer({ error: true, result: ['Not found'] })
    await boot({ forcedSiteId: 5 })
    await waitFor(() => expect(ui.orderingTheme.error).toEqual(['Not found']))

    routes['GET /sites/5'] = () => answer({ error: false, result: clone(SITE) })
    await act(async () => { ui.reloadSite() })
    await waitFor(() => expect(ui.site).toMatchObject({ id: 5 }))
    expect(ui.orderingTheme.error).toBeNull()
    expect(calls.filter((call) => call.path === '/sites/5' && call.method === 'GET')).toHaveLength(2)
  })
})
