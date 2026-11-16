/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign AB-B1 (M-AB03, M-AB08): outcome of the save, loading released on a throw, a link type created elsewhere is kept
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token', user: { level: 0 } },
  ordering: { root: 'https://api.test' },
  fetch: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BannerImageDetails } from '..'

const json = (body) => ({ json: async () => body })

const route = async () => json({ error: false, result: [], pagination: { current_page: 1 } })

const renderImage = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<BannerImageDetails UIComponent={UIComponent} bannerId={1} {...props} />)
  await waitFor(() => expect(ui.current.businessList.loading).toBe(false))
  return ui
}

const existing = (action) => ({ id: 10, type: 'image', file: 'a.png', action })

describe('BannerImageDetails · handleSaveImage (AB-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a throw leaves loading: false, shows the error and resolves { ok: false, error } (M-AB08)', async () => {
    const handleUpdateBannerItem = vi.fn(async () => { throw new Error('Network down') })
    const ui = await renderImage({ image: existing({ type: 'business', business_id: 4 }), handleUpdateBannerItem })
    await waitFor(() => expect(ui.current.selectedBusinessId).toBe(4))
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.current.imageState.loading).toBe(false)
    expect(ui.current.imageState.error).toEqual(['Network down'])
  })

  it('an existing image with action.type "url" saves without an action key (M-AB03) and resolves the result', async () => {
    const handleUpdateBannerItem = vi.fn(async () => ({ error: false, result: { id: 10, type: 'image' } }))
    const ui = await renderImage({ image: existing({ type: 'url', url: 'https://example.com' }), handleUpdateBannerItem })
    expect(ui.current.selectedLinkType).toBe('url')
    await act(async () => { ui.current.handleChangeItem({ image: 'data:image/png;base64,AAA' }) })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome).toEqual({ ok: true, error: null, result: { id: 10, type: 'image' } })
    const [payload, itemId, isReturn] = handleUpdateBannerItem.mock.calls[0]
    expect(payload).toEqual({ image: 'data:image/png;base64,AAA' })
    expect(Object.keys(payload)).not.toContain('action')
    expect(itemId).toBe(10)
    expect(isReturn).toBe(true)
    expect(ui.current.imageState).toEqual({ loading: false, image: { id: 10, type: 'image' }, error: null })
  })

  it('an existing image with a business link sends today\'s action string', async () => {
    const handleUpdateBannerItem = vi.fn(async () => ({ error: false, result: { id: 10, type: 'image' } }))
    const ui = await renderImage({ image: existing({ type: 'business', business_id: 4 }), handleUpdateBannerItem })
    await waitFor(() => expect(ui.current.selectedBusinessId).toBe(4))
    await act(async () => { await ui.current.handleSaveImage() })
    const [payload] = handleUpdateBannerItem.mock.calls[0]
    expect(payload.action).toBe(JSON.stringify({ type: 'business', business_id: 4 }))
  })

  // P13: an existing image without a link opens on «No link»; a new one still has to choose
  it('with no link type at all the validation stays as today and nothing is saved', async () => {
    const ui = await renderImage({ image: null })
    await act(async () => { ui.current.handleChangeItem({ image: 'data:image/png;base64,AAA', type: 'image' }) })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toEqual(['The link type is required'])
    expect(mocks.fetch.mock.calls.some(([, request]) => request?.method === 'POST')).toBe(false)
    expect(ui.current.imageState.loading).toBe(false)
    expect(ui.current.imageState.error).toEqual(['The link type is required'])
  })

  it('the business and product validations resolve { ok: false, error } too', async () => {
    const handleUpdateBannerItem = vi.fn()
    const ui = await renderImage({ image: existing({ type: 'business' }), handleUpdateBannerItem })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome.ok).toBe(false)
    expect(Array.isArray(outcome.error)).toBe(true)
    expect(handleUpdateBannerItem).not.toHaveBeenCalled()
  })

  it('an API error from the update resolves { ok: false, error } with the API result', async () => {
    const handleUpdateBannerItem = vi.fn(async () => ({ error: true, result: ['Bad image'] }))
    const ui = await renderImage({ image: existing({ type: 'url' }), handleUpdateBannerItem })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome).toEqual({ ok: false, error: ['Bad image'] })
    expect(ui.current.imageState.loading).toBe(false)
    expect(ui.current.imageState.error).toEqual(['Bad image'])
  })

  it('a new image without a file resolves { ok: false, error }', async () => {
    const ui = await renderImage({ image: null })
    await act(async () => { ui.current.setSelectedLinkType('business') })
    await act(async () => { ui.current.setSelectedBusinessId(4) })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome.ok).toBe(false)
    expect(Array.isArray(outcome.error)).toBe(true)
  })
})

// P13: api-core takes a banner item without `action` (nullable|json, checked only when sent), so a link is optional. Sent,
// it must have a type; left out on an edit, the stored link stays. «No link» therefore leaves the key out.
describe('BannerImageDetails · «No link» (P13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds an image without an action key when «No link» is chosen', async () => {
    const ui = await renderImage()
    expect(ui.current.selectedLinkType).toBe(null)
    await act(async () => {
      ui.current.setSelectedLinkType('none')
      ui.current.handleChangeItem({ image: 'data:image/png;base64,AAA', type: 'image' })
    })
    let outcome
    await act(async () => { outcome = await ui.current.handleSaveImage() })
    expect(outcome.ok).toBe(true)
    const [url, request] = mocks.fetch.mock.calls.find(([url, request]) => request?.method === 'POST')
    expect(url).toBe('https://api.test/banners/1/items')
    expect(JSON.parse(request.body)).toEqual({ image: 'data:image/png;base64,AAA', type: 'image' })
  })

  it('opens an existing image without a link on «No link», and saves it without an action key', async () => {
    const handleUpdateBannerItem = vi.fn(async () => ({ error: false, result: { id: 10, type: 'image' } }))
    const ui = await renderImage({ image: existing(null), handleUpdateBannerItem })
    expect(ui.current.selectedLinkType).toBe('none')
    await act(async () => { await ui.current.handleSaveImage() })
    expect(Object.keys(handleUpdateBannerItem.mock.calls[0][0])).not.toContain('action')
  })
})
