import React from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoogleActionsStores } from './index'

vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v400/en/demo' }] }))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token' }] }))

const json = (content) => ({ json: async () => content })
const status = { can_activate: true, counts: { not_activated: 5, processing: 0, ready: 1, sent: 2, skipped: 1 }, feed: null }
const page = { error: false, result: [{ id: 3, name: 'Taste Wine', google_actions: { enabled: true, status: 'ready' } }], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 1 } }
let controller
const UI = props => { controller = props; return null }

const respond = () => vi.fn(async (url) => json(url.includes('/google_actions/status') ? { error: false, result: status } : page))
const listUrl = (fetch) => new URL(fetch.mock.calls.filter(([url]) => url.includes('/backoffice/businesses?')).pop()[0])

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  controller = null
})

describe('GoogleActionsStores', () => {
  it('loads a page of stores with their Google state and passes on the shared project status', async () => {
    const fetch = respond()
    vi.stubGlobal('fetch', fetch)
    const statusState = { loading: false, data: status }
    render(<GoogleActionsStores UIComponent={UI} statusState={statusState} />)
    await waitFor(() => expect(controller.storesState.loading).toBe(false))
    expect(controller.statusState).toBe(statusState)
    // The project status is the dashboard's shared request, never this page's.
    expect(fetch.mock.calls.some(([url]) => url.includes('/google_actions/status'))).toBe(false)
    expect(controller.storesState.stores).toEqual(page.result)
    const url = listUrl(fetch)
    expect(url.searchParams.get('params')).toBe('id,name,logo,slug,city,enabled,google_actions')
    expect(JSON.parse(url.searchParams.get('where'))).toEqual({ conector: 'AND', conditions: [{ attribute: 'enabled', value: true }] })
    expect(url.searchParams.get('google_actions_status')).toBeNull()
  })

  it('filters by state, toggles it off and searches by name', async () => {
    const fetch = respond()
    vi.stubGlobal('fetch', fetch)
    render(<GoogleActionsStores UIComponent={UI} />)
    await waitFor(() => expect(controller.storesState.loading).toBe(false))

    act(() => controller.handleChangeFilter('skipped'))
    await waitFor(() => expect(listUrl(fetch).searchParams.get('google_actions_status')).toBe('skipped'))

    act(() => controller.handleChangeFilter('skipped'))
    await waitFor(() => expect(listUrl(fetch).searchParams.get('google_actions_status')).toBeNull())

    act(() => controller.handleChangeSearch('wine'))
    await waitFor(() => expect(JSON.parse(listUrl(fetch).searchParams.get('where')).conditions).toEqual([
      { attribute: 'enabled', value: true },
      { attribute: 'name', value: { condition: 'ilike', value: '%wine%' } }
    ]))
  })

  it('lists the Inactive tab', async () => {
    const fetch = respond()
    vi.stubGlobal('fetch', fetch)
    render(<GoogleActionsStores UIComponent={UI} />)
    await waitFor(() => expect(controller.storesState.loading).toBe(false))
    expect(controller.activeState).toBe(true)

    act(() => controller.handleChangeActiveState(false))
    await waitFor(() => expect(JSON.parse(listUrl(fetch).searchParams.get('where')).conditions).toEqual([
      { attribute: 'enabled', value: false }
    ]))
  })

  it('keeps the error of a failed page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => json(url.includes('/google_actions/status') ? { error: false, result: status } : { error: true, result: ['Invalid'] })))
    render(<GoogleActionsStores UIComponent={UI} />)
    await waitFor(() => expect(controller.storesState.loading).toBe(false))
    expect(controller.storesState).toEqual({ loading: false, stores: [], error: ['Invalid'] })
  })
})
