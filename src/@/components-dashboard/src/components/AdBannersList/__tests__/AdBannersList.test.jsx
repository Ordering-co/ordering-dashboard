/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign AB-B1 (M-AB03/M-AB13): handleUpdateBanner resolves an outcome; getAdBanners reaches the UI
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token' },
  ordering: { root: 'https://api.test' },
  fetch: null,
  put: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { AdBannersList } from '..'

const json = (body) => ({ json: async () => body })

const route = async (url, options = {}) => {
  if (url.endsWith('/sites')) return json({ error: false, result: [] })
  if (options.method === 'PUT') return mocks.put()
  if (url.includes('/banners?where=')) return json({ error: false, result: [{ id: 1, enabled: true, items: [] }, { id: 2, enabled: true, items: [] }] })
  return json({ error: false, result: {} })
}

const bannerRequests = () => mocks.fetch.mock.calls.filter(([url, options]) => url.includes('/banners?where=') && !options?.method?.match(/PUT/))

const renderList = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<AdBannersList UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.bannersListState.loading).toBe(false))
  return ui
}

describe('AdBannersList (AB-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.put = vi.fn(async () => json({ error: false, result: { id: 1, enabled: false } }))
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('without defaultPosition the request is GET /banners?where=[] and every banner is loaded', async () => {
    const ui = await renderList()
    const [[url]] = bannerRequests()
    expect(url).toBe('https://api.test/banners?where=[]')
    expect(ui.current.bannersListState.banners).toHaveLength(2)
  })

  it('with defaultPosition the request keeps today\'s position condition', async () => {
    await renderList({ defaultPosition: 'web_home_page' })
    const [[url]] = bannerRequests()
    expect(url).toBe(`https://api.test/banners?where=${JSON.stringify({ conditions: [{ attribute: 'position', value: 'web_home_page' }], conector: 'AND' })}`)
  })

  // redesign (row 6, P-5): /sites is read only when the legacy PageBanner opts in
  const siteRequests = () => mocks.fetch.mock.calls.filter(([url]) => url.endsWith('/sites'))

  it('does not request /sites unless loadSites is set', async () => {
    const ui = await renderList()
    expect(siteRequests()).toHaveLength(0)
    expect(ui.current.sitesState).toEqual({ loading: false, sites: [], error: null })
  })

  it('requests /sites once when loadSites is set', async () => {
    const ui = await renderList({ loadSites: true })
    await waitFor(() => expect(ui.current.sitesState.loading).toBe(false))
    expect(siteRequests()).toHaveLength(1)
  })

  it('passes getAdBanners to the UI and calling it reloads the list', async () => {
    const ui = await renderList()
    expect(typeof ui.current.getAdBanners).toBe('function')
    expect(bannerRequests()).toHaveLength(1)
    await act(async () => { await ui.current.getAdBanners() })
    expect(bannerRequests()).toHaveLength(2)
  })

  it('handleUpdateBanner resolves { ok: true, error: null, result } and keeps toasts and actionState', async () => {
    const ui = await renderList()
    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBanner({ enabled: false }, 1) })
    expect(outcome).toEqual({ ok: true, error: null, result: { id: 1, enabled: false } })
    const [, options] = mocks.fetch.mock.calls.find(([, opts]) => opts?.method === 'PUT')
    expect(options.body).toBe(JSON.stringify({ enabled: false }))
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Banner saved')
    expect(ui.current.actionState).toEqual({ loading: false, error: null })
    expect(ui.current.bannersListState.banners.find(banner => banner.id === 1).enabled).toBe(false)
  })

  it('handleUpdateBanner resolves { ok: false, error } on an API error', async () => {
    mocks.put = vi.fn(async () => json({ error: true, result: ['Not allowed'] }))
    const ui = await renderList()
    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBanner({ enabled: false }, 1) })
    expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.current.actionState).toEqual({ loading: false, error: ['Not allowed'] })
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Banner saved')
  })

  it('handleUpdateBanner resolves { ok: false, error } when the request throws', async () => {
    mocks.put = vi.fn(async () => { throw new Error('Network down') })
    const ui = await renderList()
    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBanner({ enabled: false }, 1) })
    expect(outcome).toEqual({ ok: false, error: 'Network down' })
    expect(ui.current.actionState).toEqual({ loading: false, error: 'Network down' })
  })
})
