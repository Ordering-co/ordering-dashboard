/* eslint-disable import/first */
// redesign (lot A): the site theme controller (used only by /ordering-products).
//  - OP-12: `handleUpdateSiteTheme` replaces the site theme record instead of appending to the array (no "not iterable");
//  - `handleAssignTheme` / `handleUpdateSiteTheme` / `handleAddThemeGallery` return `{ error, result }`;
//  - `options.inlineError` skips the LOADING toast; `getSiteTheme` / `getThemes` are exposed for "Try again".
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { SiteTheme } from '../index'

const SITE_THEME = { id: 1, site_id: 5, theme_id: 3, values: { color: 'red' } }
const THEMES = [{ id: 3, name: 'Classic', values_default: { color: 'blue' } }, { id: 4, name: 'Bold', values_default: { color: 'black' } }]

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

let ui
// Mock per URL + method; GETs answer the site theme and the themes list unless a route overrides them.
let routes
const installFetch = () => {
  global.fetch = vi.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url.replace('https://api.test', '')}`
    if (routes[key]) return routes[key](options)
    if (key === 'GET /sites/5/themes') return answer({ error: false, result: [SITE_THEME] })
    if (key === 'GET /themes') return answer({ error: false, result: THEMES })
    return answer({ error: false, result: [] })
  })
}

const draw = async () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  render(<SiteTheme UIComponent={UI} siteId={5} />)
  await waitFor(() => {
    expect(ui.siteThemesState.loading).toBe(false)
    expect(ui.themesList.loading).toBe(false)
  })
  mocks.showToast.mockReset()
}

beforeEach(() => {
  mocks.showToast.mockReset()
  routes = {}
  installFetch()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SiteTheme controller · handleUpdateSiteTheme (OP-12)', () => {
  it('an object response replaces the record: one entry with the last values', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: false, result: { ...SITE_THEME, values: { color: 'green' } } })
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSiteTheme({ color: 'green' }) })
    expect(out.error).toBe(false)
    expect(ui.siteThemesState.result).toHaveLength(1)
    expect(ui.siteThemesState.result[0].values).toEqual({ color: 'green' })
    expect(ui.siteThemesState.result[0].theme_id).toBe(3)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Theme updated']])
  })

  it('an object response without values keeps the sent values', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: false, result: { id: 1 } })
    await draw()
    await act(async () => { await ui.handleUpdateSiteTheme({ color: 'green' }) })
    expect(ui.siteThemesState.result).toHaveLength(1)
    expect(ui.siteThemesState.result[0].theme_id).toBe(3)
    expect(ui.siteThemesState.result[0].values).toEqual({ color: 'green' })
  })

  // redesign (live check): the request sends values as JSON text; an answer that echoes them keeps an object
  it('an object response that echoes values as JSON text keeps them as an object', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: false, result: { id: 99, values: JSON.stringify({ color: 'green' }) } })
    await draw()
    await act(async () => { await ui.handleUpdateSiteTheme({ color: 'green' }) })
    expect(ui.siteThemesState.result).toHaveLength(1)
    expect(ui.siteThemesState.result[0].theme_id).toBe(3)
    expect(ui.siteThemesState.result[0].values).toEqual({ color: 'green' })
  })

  it('an array response replaces the record: one entry with the last values', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: false, result: [{ ...SITE_THEME, values: { color: 'pink' } }] })
    await draw()
    await act(async () => { await ui.handleUpdateSiteTheme({ color: 'pink' }) })
    expect(ui.siteThemesState.result).toHaveLength(1)
    expect(ui.siteThemesState.result[0].values).toEqual({ color: 'pink' })
  })

  it('an API error returns { error:true, result } and fills actionState.error', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: true, result: ['Invalid values'] })
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSiteTheme({ color: 'x' }) })
    expect(out).toEqual({ error: true, result: ['Invalid values'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['Invalid values'] })
    expect(ui.siteThemesState.result).toEqual([SITE_THEME])
  })

  it('a request that throws returns { error:true, result:[message] }', async () => {
    routes['POST /sites/5/themes/3'] = () => Promise.reject(new Error('Network down'))
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSiteTheme({ color: 'x' }) })
    expect(out).toEqual({ error: true, result: ['Network down'] })
    expect(ui.actionState.error).toEqual(['Network down'])
  })

  it('inlineError: no LOADING toast, the success toast stays', async () => {
    routes['POST /sites/5/themes/3'] = () => answer({ error: false, result: SITE_THEME })
    await draw()
    await act(async () => { await ui.handleUpdateSiteTheme({ color: 'red' }, { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Theme updated']])
  })
})

describe('SiteTheme controller · handleAssignTheme', () => {
  it('success returns { error:false, result }, toasts as before and reloads the site theme', async () => {
    routes['POST /sites/5/themes'] = () => answer({ error: false, result: SITE_THEME })
    await draw()
    act(() => { ui.handleSelectTheme(4) })
    await waitFor(() => expect(ui.selectedTheme?.id).toBe(4))
    let out
    await act(async () => { out = await ui.handleAssignTheme() })
    expect(out).toEqual({ error: false, result: SITE_THEME })
    expect(JSON.parse(global.fetch.mock.calls.find(([, o]) => o?.method === 'POST')[1].body).theme_id).toBe(4)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Theme added']])
    // the initial load plus the reload after the assignment
    const getSiteThemeCalls = () => global.fetch.mock.calls.filter(([u, o]) => u.endsWith('/sites/5/themes') && (o?.method || 'GET') === 'GET')
    await waitFor(() => expect(getSiteThemeCalls()).toHaveLength(2))
  })

  it('an API error returns { error:true, result } and fills actionState.error', async () => {
    routes['POST /sites/5/themes'] = () => answer({ error: true, result: ['Theme not found'] })
    await draw()
    let out
    await act(async () => { out = await ui.handleAssignTheme() })
    expect(out).toEqual({ error: true, result: ['Theme not found'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['Theme not found'] })
  })

  it('a request that throws returns { error:true, result:[message] }', async () => {
    routes['POST /sites/5/themes'] = () => Promise.reject(new Error('Network down'))
    await draw()
    let out
    await act(async () => { out = await ui.handleAssignTheme() })
    expect(out).toEqual({ error: true, result: ['Network down'] })
  })

  it('inlineError: no LOADING toast', async () => {
    routes['POST /sites/5/themes'] = () => answer({ error: false, result: SITE_THEME })
    await draw()
    await act(async () => { await ui.handleAssignTheme({ inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Theme added']])
  })
})

describe('SiteTheme controller · handleAddThemeGallery', () => {
  it('returns the JSON of the API', async () => {
    routes['POST /themes/3/gallery'] = () => answer({ error: false, result: { id: 11, file: 'u.png' } })
    await draw()
    let out
    await act(async () => { out = await ui.handleAddThemeGallery('data:image/png;base64,AAA') })
    expect(out).toEqual({ error: false, result: { id: 11, file: 'u.png' } })
  })

  it('a request that throws returns { error:true, result:[message] }', async () => {
    routes['POST /themes/3/gallery'] = () => Promise.reject(new Error('Network down'))
    await draw()
    let out
    await act(async () => { out = await ui.handleAddThemeGallery('data:image/png;base64,AAA') })
    expect(out).toEqual({ error: true, result: ['Network down'] })
  })
})

describe('SiteTheme controller · loaders', () => {
  it('a failed getSiteTheme leaves siteThemesState.error and can be retried from the UI', async () => {
    let fail = true
    routes['GET /sites/5/themes'] = () => (fail ? answer({ error: true, result: ['Not allowed'] }) : answer({ error: false, result: [SITE_THEME] }))
    await draw()
    expect(ui.siteThemesState).toEqual({ loading: false, result: [], error: ['Not allowed'] })
    fail = false
    await act(async () => { await ui.getSiteTheme() })
    expect(ui.siteThemesState).toEqual({ loading: false, result: [SITE_THEME], error: null })
  })

  it('exposes getThemes to retry the themes list', async () => {
    let fail = true
    routes['GET /themes'] = () => (fail ? answer({ error: true, result: ['Down'] }) : answer({ error: false, result: THEMES }))
    await draw()
    expect(ui.themesList.error).toEqual(['Down'])
    fail = false
    await act(async () => { await ui.getThemes() })
    expect(ui.themesList).toEqual({ loading: false, result: THEMES, error: null })
  })
})
