/* eslint-disable import/first */
// redesign my-products-dashboard (D2 / D3 / D5): the brand controller behind /my-products/dashboard.
//  - load: never writes. When there is no brand site, or the one found has another code or type, main created or fixed
//    it on load; now that waits for the first save (or the first custom-domain save, through `ensureSite`);
//  - Save sends the pending name/description to the brand site only;
//  - DB-01: "Remove custom domain" ({ domain: null }) is sent as is, keeps unsaved fields and says it was removed;
//  - DB-02: the save is marked in flight (formState.loading) until it answers;
//  - R1-01: the `setSite` the UI hands to the domain dialog (after its own write) keeps unsaved name/description.
//  - D-81 part B: the editor can ask «Keep editing · Save · Discard» before a way out. For that the controller answers
//    `handleUpdateSite()` with `{ ok, error? }`, gives `savedSite` (what the server has) and `discardChanges()` (back to it).
// Same endpoints as main: GET /sites, POST /sites, POST /sites/{id}.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  apiState: [{ root: 'https://api.test', project: 'demo' }, {}],
  session: [{ token: 'test-token', user: { id: 1, level: 0 } }]
}))

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

import { Dashboard } from '../index'

const ROOT = 'https://api.test'
const clone = (value) => JSON.parse(JSON.stringify(value))
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const BRAND = { id: 166, code: 'web_dashboard_x', type: 'dashboardweb', name: 'Ordering Dashboard', description: '', domain: 'admin.brand.com', deployment_provider: 'cloudflare' }
const WEBSITE = { id: 34, code: 'website', type: null, name: 'Marketplace Website' }

let ui
let routes
let calls

const writes = () => calls.filter((call) => call.method !== 'GET')

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

const mount = () => render(
  <Dashboard
    appId='web_dashboard_x'
    type='dashboardweb'
    isDashboard
    UIComponent={(props) => { ui = props; return null }}
  />
)

const loaded = async () => {
  mount()
  await waitFor(() => expect(ui.site?.id).toBe(BRAND.id))
}

beforeEach(() => {
  ui = null
  calls = []
  mocks.showToast.mockClear()
  routes = {
    'GET /sites': () => answer({ error: false, result: [clone(WEBSITE), clone(BRAND)] }),
    'POST /sites/166': (options) => answer({ error: false, result: { ...clone(BRAND), ...JSON.parse(options.body) } })
  }
  installFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Dashboard controller (/my-products/dashboard)', () => {
  it('loads the brand site without writing when it exists', async () => {
    await loaded()
    expect(writes()).toEqual([])
    expect(ui.orderingTheme.loading).toBe(false)
  })

  it('· without a brand site, opening writes nothing; the first Save creates it and then saves the changes', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE)] })
    routes['POST /sites'] = () => answer({ error: false, result: clone(BRAND) })
    mount()
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    await act(async () => { await Promise.resolve() })
    expect(writes()).toEqual([])
    expect(ui.site).toBeNull()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([
      { method: 'POST', path: '/sites', body: { code: 'web_dashboard_x', name: 'Dashboard', type: 'dashboardweb' } },
      { method: 'POST', path: '/sites/166', body: { name: 'Brand admin' } }
    ])
    expect(ui.site.id).toBe(BRAND.id)
    expect(ui.site.name).toBe('Brand admin')
  })

  it('· a brand site with another code is shown as it is; the first Save fixes its code, then saves', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE), { ...clone(BRAND), code: 'old_dashboard' }] })
    await loaded()
    expect(writes()).toEqual([])
    expect(ui.site.code).toBe('old_dashboard')
    act(() => { ui.handleChangeInput({ target: { name: 'description', value: 'Admin' } }) })
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([
      { method: 'POST', path: '/sites/166', body: { type: 'dashboardweb', code: 'web_dashboard_x' } },
      { method: 'POST', path: '/sites/166', body: { description: 'Admin' } }
    ])
  })

  it('· the site with the code but another type is fixed on the first save, not on load', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE), { ...clone(BRAND), type: null }] })
    await loaded()
    expect(writes()).toEqual([])
    await act(async () => { await ui.ensureSite() })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { type: 'dashboardweb', code: 'web_dashboard_x' } }])
    await act(async () => { await ui.ensureSite() })
    expect(writes()).toHaveLength(1)
  })

  it('· ensureSite (the custom-domain dialog) creates the missing site once and hands it back', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE)] })
    routes['POST /sites'] = () => answer({ error: false, result: clone(BRAND) })
    mount()
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    let target
    await act(async () => { target = await ui.ensureSite() })
    expect(target.id).toBe(BRAND.id)
    expect(ui.site.id).toBe(BRAND.id)
    await act(async () => { await ui.ensureSite() })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites', body: { code: 'web_dashboard_x', name: 'Dashboard', type: 'dashboardweb' } }])
  })

  it('· two saves at once (domain dialog double click, Save + dialog) create the site only once', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE)] })
    let release
    routes['POST /sites'] = () => new Promise((resolve) => { release = () => resolve({ json: () => Promise.resolve({ error: false, result: clone(BRAND) }) }) })
    mount()
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    let first
    let second
    act(() => { first = ui.ensureSite(); second = ui.ensureSite() })
    await act(async () => { release(); await Promise.all([first, second]) })
    expect((await first).id).toBe(BRAND.id)
    expect((await second).id).toBe(BRAND.id)
    expect(writes()).toEqual([{ method: 'POST', path: '/sites', body: { code: 'web_dashboard_x', name: 'Dashboard', type: 'dashboardweb' } }])
  })

  it('· when creating the site fails, Save says so and keeps the changes', async () => {
    routes['GET /sites'] = () => answer({ error: false, result: [clone(WEBSITE)] })
    routes['POST /sites'] = () => answer({ error: true, result: ['Not allowed'] })
    mount()
    await waitFor(() => expect(ui.orderingTheme.loading).toBe(false))
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites', body: { code: 'web_dashboard_x', name: 'Dashboard', type: 'dashboardweb' } }])
    expect(mocks.showToast).toHaveBeenCalledWith('error', ['Not allowed'])
    expect(ui.formState).toEqual({ loading: false, changes: { name: 'Brand admin' }, error: null })
  })

  it('Save sends the pending name and description to the brand site only', async () => {
    await loaded()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { name: 'Brand admin' } }])
    expect(ui.formState.changes).toEqual({})
    expect(ui.site.name).toBe('Brand admin')
  })

  it('DB-01 · "Remove custom domain" sends { domain: null } and keeps unsaved fields', async () => {
    await loaded()
    act(() => { ui.handleChangeInput({ target: { name: 'description', value: 'Draft description' } }) })
    await act(async () => { await ui.handleUpdateSite({ domain: null }) })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { domain: null } }])
    expect(ui.site.domain).toBeNull()
    expect(ui.site.description).toBe('Draft description')
    expect(ui.formState.changes).toEqual({ description: 'Draft description' })
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Custom domain removed successfully')
  })

  it('DB-01 · a failed removal keeps the domain and says so', async () => {
    routes['POST /sites/166'] = () => answer({ error: true, result: ['Domain is locked'] })
    await loaded()
    await act(async () => { await ui.handleUpdateSite({ domain: null }) })
    expect(ui.site.domain).toBe('admin.brand.com')
    expect(mocks.showToast).toHaveBeenCalledWith('error', ['Domain is locked'])
    expect(mocks.showToast).not.toHaveBeenCalledWith('success', expect.anything())
  })

  it('DB-02 · the save is marked in flight until it answers', async () => {
    let release
    routes['POST /sites/166'] = (options) => new Promise((resolve) => {
      release = () => resolve({ json: () => Promise.resolve({ error: false, result: { ...clone(BRAND), ...JSON.parse(options.body) } }) })
    })
    await loaded()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
    let pending
    act(() => { pending = ui.handleUpdateSite() })
    await waitFor(() => expect(ui.formState.loading).toBe(true))
    await act(async () => { release(); await pending })
    expect(ui.formState.loading).toBe(false)
  })

  it('R1-01 · the domain dialog result does not hide an unsaved name, and Save still sends it', async () => {
    await loaded()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Unsaved brand name' } }) })
    act(() => { ui.setSite({ ...ui.site, ...clone(BRAND), domain: 'new.brand.com', ssl_status: 'pending_validation' }) })
    expect(ui.site.name).toBe('Unsaved brand name')
    expect(ui.site.domain).toBe('new.brand.com')
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { name: 'Unsaved brand name' } }])
  })

  it('R1-01 · without pending changes the dialog result is applied as is (also as a function)', async () => {
    await loaded()
    act(() => { ui.setSite((prev) => ({ ...prev, domain: 'new.brand.com' })) })
    expect(ui.site).toEqual({ ...BRAND, domain: 'new.brand.com' })
  })

  it('Save with nothing pending sends nothing', async () => {
    await loaded()
    await act(async () => { await ui.handleUpdateSite() })
    expect(writes()).toEqual([])
  })

  // redesign D-81 part B (owner, 2026-10-19): what the leave guard of the legacy editor needs from the controller
  describe('D-81 · to leave with unsaved changes', () => {
    it('savedSite is what the server has, apart from the draft being typed', async () => {
      await loaded()
      expect(ui.savedSite).toEqual(BRAND)
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Typed' } }) })
      expect(ui.site.name).toBe('Typed')
      expect(ui.savedSite).toEqual(BRAND)
    })

    it('a Save that worked answers { ok: true } and moves savedSite to what was saved', async () => {
      await loaded()
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
      let result
      await act(async () => { result = await ui.handleUpdateSite() })
      expect(result).toEqual({ ok: true })
      expect(ui.savedSite.name).toBe('Brand admin')
    })

    it('a Save the API refuses answers { ok: false } and keeps the changes and savedSite', async () => {
      routes['POST /sites/166'] = () => answer({ error: true, result: ['Name taken'] })
      await loaded()
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
      let result
      await act(async () => { result = await ui.handleUpdateSite() })
      expect(result).toEqual({ ok: false, error: ['Name taken'] })
      expect(ui.formState.changes).toEqual({ name: 'Brand admin' })
      expect(ui.site.name).toBe('Brand admin')
      expect(ui.savedSite.name).toBe(BRAND.name)
    })

    it('a Save that throws answers { ok: false } too', async () => {
      routes['POST /sites/166'] = () => Promise.reject(new Error('Network down'))
      await loaded()
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Brand admin' } }) })
      let result
      await act(async () => { result = await ui.handleUpdateSite() })
      expect(result).toEqual({ ok: false, error: 'Network down' })
      expect(ui.formState.changes).toEqual({ name: 'Brand admin' })
    })

    it('Save with nothing pending answers { ok: true } and sends nothing', async () => {
      await loaded()
      let result
      await act(async () => { result = await ui.handleUpdateSite() })
      expect(result).toEqual({ ok: true })
      expect(writes()).toEqual([])
    })

    it('discardChanges puts the site back to what the server has and clears the pending changes, without writing', async () => {
      await loaded()
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Typed' } }) })
      act(() => { ui.handleChangeInput({ target: { name: 'description', value: 'Typed too' } }) })
      act(() => { ui.discardChanges() })
      expect(ui.site).toEqual(BRAND)
      expect(ui.formState.changes).toEqual({})
      expect(writes()).toEqual([])
    })

    it('the domain dialog result moves savedSite but never over an unsaved field', async () => {
      await loaded()
      act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Typed' } }) })
      act(() => { ui.setSite({ ...ui.site, ...clone(BRAND), domain: 'new.brand.com' }) })
      expect(ui.savedSite.domain).toBe('new.brand.com')
      expect(ui.savedSite.name).toBe(BRAND.name)
      act(() => { ui.discardChanges() })
      expect(ui.site.name).toBe(BRAND.name)
      expect(ui.site.domain).toBe('new.brand.com')
    })
  })
})
