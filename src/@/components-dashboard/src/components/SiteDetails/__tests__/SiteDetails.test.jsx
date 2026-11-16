/* eslint-disable import/first */
// redesign (lot A): the site details controller (used only by /ordering-products).
//  - `handleUpdateSite` / `handleAddSite` / `handleDeleteSite` return `{ error, result }`;
//  - `options.inlineError`: no LOADING toast and no `formState.error` (the UI says the reason); the success toasts stay;
//  - `resetChanges()` clears the pending changes ("Discard").
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

import { SiteDetails } from '../index'

const SITE = { id: 7, name: 'Kiosk', code: 'kiosk' }
const OTHER = { id: 8, name: 'Web', code: 'web' }

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

let ui
const draw = async (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(<SiteDetails UIComponent={UI} site={SITE} sitesList={[{ ...SITE }, { ...OTHER }]} {...props} />)
  await waitFor(() => expect(ui).not.toBeNull())
}

beforeEach(() => {
  mocks.showToast.mockReset()
  global.fetch = vi.fn()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SiteDetails controller · handleUpdateSite', () => {
  it('success returns { error:false, result } and calls handleSuccessUpdateSites', async () => {
    const saved = { ...SITE, name: 'Kiosk 2' }
    global.fetch.mockImplementation(() => answer({ error: false, result: saved }))
    const handleSuccessUpdateSites = vi.fn()
    await draw({ handleSuccessUpdateSites })
    let out
    await act(async () => { out = await ui.handleUpdateSite({ name: 'Kiosk 2' }) })
    expect(out).toEqual({ error: false, result: saved })
    expect(handleSuccessUpdateSites).toHaveBeenCalledTimes(1)
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/sites/7')
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Site saved']])
    expect(ui.siteState.site).toEqual(saved)
  })

  it('uses formState.changes when the first argument is not an object', async () => {
    global.fetch.mockImplementation(() => answer({ error: false, result: SITE }))
    await draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'From form' } }) })
    await waitFor(() => expect(ui.formState.changes).toEqual({ name: 'From form' }))
    await act(async () => { await ui.handleUpdateSite() })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ name: 'From form' })
  })

  it('as before: an API error shows LOADING and fills formState.error', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Name taken'] }))
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSite({ name: 'x' }) })
    expect(out).toEqual({ error: true, result: ['Name taken'] })
    expect(toasts()).toEqual([['info', 'Loading']])
    expect(ui.formState.error).toEqual(['Name taken'])
    expect(ui.formState.loading).toBe(false)
  })

  it('inlineError: an API error returns the reason, no Info toast, formState.error stays null', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Name taken'] }))
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSite({ name: 'x' }, { inlineError: true }) })
    expect(out).toEqual({ error: true, result: ['Name taken'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.error).toBeNull()
    expect(ui.formState.loading).toBe(false)
  })

  it('inlineError: a request that throws returns { error:true, result:[message] } and no toast', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    await draw()
    let out
    await act(async () => { out = await ui.handleUpdateSite({ name: 'x' }, { inlineError: true }) })
    expect(out).toEqual({ error: true, result: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.error).toBeNull()
  })

  it('as before: a request that throws fills formState.error', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    await draw()
    await act(async () => { await ui.handleUpdateSite({ name: 'x' }) })
    expect(ui.formState.error).toEqual(['Network down'])
  })

  it('inlineError: the success toast stays and the Info toast is skipped', async () => {
    global.fetch.mockImplementation(() => answer({ error: false, result: SITE }))
    await draw()
    await act(async () => { await ui.handleUpdateSite({ name: 'x' }, { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Site saved']])
  })
})

describe('SiteDetails controller · handleAddSite', () => {
  it('success returns { error:false, result }, adds to the list and closes', async () => {
    const created = { id: 9, name: 'New' }
    global.fetch.mockImplementation(() => answer({ error: false, result: created }))
    const handleSuccessUpdateSites = vi.fn()
    const onClose = vi.fn()
    await draw({ site: undefined, handleSuccessUpdateSites, onClose })
    let out
    await act(async () => { out = await ui.handleAddSite({ name: 'New' }) })
    expect(out).toEqual({ error: false, result: created })
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/sites')
    expect(handleSuccessUpdateSites).toHaveBeenCalledWith([{ ...SITE }, { ...OTHER }, created])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Site added']])
  })

  // redesign J5 row 47 (ordering-products P-1, ): the page can keep the new site open instead of closing
  it('with onSiteAdded, a success hands it the created site and does not close', async () => {
    const created = { id: 9, name: 'New' }
    global.fetch.mockImplementation(() => answer({ error: false, result: created }))
    const onClose = vi.fn()
    const onSiteAdded = vi.fn()
    await draw({ site: undefined, onClose, onSiteAdded })
    await act(async () => { await ui.handleAddSite({ name: 'New' }) })
    expect(onSiteAdded).toHaveBeenCalledWith(created)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('inlineError: an API error returns the reason, no Info toast, formState.error stays null', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Code in use'] }))
    const onClose = vi.fn()
    await draw({ site: undefined, onClose })
    let out
    await act(async () => { out = await ui.handleAddSite({ name: 'New' }, { inlineError: true }) })
    expect(out).toEqual({ error: true, result: ['Code in use'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.error).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('as before: an API error fills formState.error', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Code in use'] }))
    await draw({ site: undefined })
    await act(async () => { await ui.handleAddSite({ name: 'New' }) })
    expect(ui.formState.error).toEqual(['Code in use'])
    expect(toasts()).toEqual([['info', 'Loading']])
  })
})

describe('SiteDetails controller · handleDeleteSite', () => {
  it('success returns { error:false, result }, removes from the list and closes', async () => {
    global.fetch.mockImplementation(() => answer({ error: false, result: 'ok' }))
    const handleSuccessUpdateSites = vi.fn()
    const onClose = vi.fn()
    await draw({ handleSuccessUpdateSites, onClose })
    let out
    await act(async () => { out = await ui.handleDeleteSite() })
    expect(out).toEqual({ error: false, result: 'ok' })
    expect(global.fetch.mock.calls[0][1].method).toBe('DELETE')
    expect(handleSuccessUpdateSites).toHaveBeenCalledWith([{ ...OTHER }])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Site deleted']])
  })

  it('inlineError: an API error returns the reason, no Info toast, formState.error stays null', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Site in use'] }))
    const onClose = vi.fn()
    await draw({ onClose })
    let out
    await act(async () => { out = await ui.handleDeleteSite({ inlineError: true }) })
    expect(out).toEqual({ error: true, result: ['Site in use'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.error).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('as before: an API error fills formState.error', async () => {
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Site in use'] }))
    await draw()
    await act(async () => { await ui.handleDeleteSite() })
    expect(ui.formState.error).toEqual(['Site in use'])
  })
})

describe('SiteDetails controller · resetChanges', () => {
  it('empties the pending changes', async () => {
    await draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    await waitFor(() => expect(ui.formState.changes).toEqual({ name: 'Draft' }))
    act(() => { ui.resetChanges() })
    expect(ui.formState).toEqual({ loading: false, changes: {}, error: null })
  })
})
