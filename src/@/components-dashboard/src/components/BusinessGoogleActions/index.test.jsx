import React from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BusinessGoogleActions } from './index'

vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v400/en/demo' }] }))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token' }] }))
const siteContext = vi.hoisted(() => ({ state: { loading: false, sites: [{ id: 1, url: 'https://taste.example.com' }] }, getSites: null }))
vi.mock('../../contexts/SiteContext', () => ({ useSite: () => [siteContext.state, { getSites: siteContext.getSites }] }))

const json = (content) => ({ json: async () => content })
const status = { business_id: 3, enabled: false, status: null, current_consent_version: '2026-11-03', feed: null }
let controller
const UI = props => { controller = props; return null }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  controller = null
})

describe('BusinessGoogleActions', () => {
  it('loads the store status', async () => {
    const fetch = vi.fn(async () => json({ error: false, result: status }))
    vi.stubGlobal('fetch', fetch)
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    expect(controller.statusState).toEqual({ loading: false, data: status, error: null })
    expect(fetch.mock.calls[0][0]).toBe('https://api.test/v400/en/demo/business/3/google_actions')
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('activates with the site and the current consent version', async () => {
    const active = { ...status, enabled: true, status: 'ready', site_id: 1 }
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ error: false, result: status }))
      .mockResolvedValueOnce(json({ error: false, result: active }))
    vi.stubGlobal('fetch', fetch)
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    let accepted
    await act(async () => { accepted = await controller.handleActivate(1) })
    expect(accepted).toBe(true)
    expect(fetch.mock.calls[1][1].method).toBe('PUT')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ enabled: true, site_id: 1, consent_version: '2026-11-03' })
    expect(controller.statusState.data).toEqual(active)
  })

  it('keeps the reason when the store cannot be sent', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ error: false, result: status }))
      .mockResolvedValueOnce(json({ error: true, result: ['The store cannot be sent to Google yet'], error_codes: ['google_actions.not_eligible'], reason: 'no_location' }))
    vi.stubGlobal('fetch', fetch)
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    let accepted
    await act(async () => { accepted = await controller.handleActivate(1) })
    expect(accepted).toBe(false)
    expect(controller.actionState).toMatchObject({ loading: false, code: 'google_actions.not_eligible', reason: 'no_location' })
    expect(controller.statusState.data).toEqual(status)
  })

  it('deactivates', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ error: false, result: { ...status, enabled: true, status: 'ready' } }))
      .mockResolvedValueOnce(json({ error: false, result: status }))
    vi.stubGlobal('fetch', fetch)
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    await act(async () => { await controller.handleDeactivate() })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ enabled: false })
    expect(controller.statusState.data.enabled).toBe(false)
  })

  it('settles a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    expect(controller.statusState).toMatchObject({ data: null, error: ['Failed to fetch'] })
  })

  it('uses the sites the dashboard already loaded, without asking for them again', async () => {
    siteContext.getSites = vi.fn()
    const fetch = vi.fn(async () => json({ error: false, result: status }))
    vi.stubGlobal('fetch', fetch)
    render(<BusinessGoogleActions businessId={3} UIComponent={UI} />)
    await waitFor(() => expect(controller.statusState.loading).toBe(false))
    act(() => controller.getSites())
    expect(controller.sitesState).toEqual({ loading: false, loaded: true, sites: siteContext.state.sites })
    expect(siteContext.getSites).not.toHaveBeenCalled()
    expect(fetch.mock.calls.some(([url]) => url.includes('/sites'))).toBe(false)
  })
})
