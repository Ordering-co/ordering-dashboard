/* eslint-disable import/first */
// redesign (lot A): smoke test that pins what the sites list controller does today (no behavior change).
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))

import { SitesList } from '../index'

const SITES = [{ id: 1, name: 'Kiosk' }, { id: 2, name: 'Web' }]
const PAGINATION = { current_page: 1, page_size: 10, total: 2, total_pages: 1, from: 1, to: 2 }

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const urls = () => global.fetch.mock.calls.map(([url]) => url)

let ui
const draw = async (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(<SitesList UIComponent={UI} {...props} />)
  await waitFor(() => expect(ui.sitesListState.sites).toHaveLength(2))
}

beforeEach(() => {
  global.fetch = vi.fn(() => answer({ error: false, result: SITES, pagination: PAGINATION }))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SitesList controller (smoke)', () => {
  it('getSites(1, 10) requests /sites?page=1&page_size=10 and paginationProps takes total, from and to', async () => {
    await draw()
    await act(async () => { await ui.getSites(1, 10) })
    expect(urls()).toContain('https://api.test/sites?page=1&page_size=10')
    expect(ui.paginationProps).toMatchObject({ currentPage: 1, totalPages: 1, totalItems: 2, from: 1, to: 2 })
  })

  it('onSearch("kiosk") requests with a where on name and description', async () => {
    await draw({ isSearchByName: true, isSearchByDescription: true })
    global.fetch.mockClear()
    act(() => { ui.onSearch('kiosk') })
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const url = urls()[0]
    expect(url.startsWith('https://api.test/sites?page=1&page_size=10&&where=')).toBe(true)
    const where = JSON.parse(url.split('&&where=')[1])
    expect(where.conector).toBe('AND')
    expect(where.conditions).toEqual([{
      conector: 'OR',
      conditions: [
        { attribute: 'name', value: { condition: 'ilike', value: '%25kiosk%25' } },
        { attribute: 'description', value: { condition: 'ilike', value: '%25kiosk%25' } }
      ]
    }])
  })

  it('an API error leaves sitesListState.error and keeps the loaded sites', async () => {
    await draw()
    global.fetch.mockImplementation(() => answer({ error: true, result: ['Not allowed'] }))
    await act(async () => { await ui.getSites(1, 10) })
    expect(ui.sitesListState.error).toEqual(['Not allowed'])
    expect(ui.sitesListState.loading).toBe(false)
  })

  // redesign (Q-01): a search that arrives while the previous one loads is not lost
  it('Q-01: a second search typed while the first one loads is requested when the first ends, and its list stays', async () => {
    await draw({ isSearchByName: true })
    const pending = []
    global.fetch.mockClear()
    global.fetch.mockImplementation(() => new Promise(resolve => { pending.push(resolve) }))
    const reply = (resolve, sites) => resolve({ json: () => Promise.resolve({ error: false, result: sites, pagination: { ...PAGINATION, total: sites.length, to: sites.length } }) })
    const whereOf = (url) => JSON.parse(url.split('&&where=')[1]).conditions[0].conditions[0].value.value

    act(() => { ui.onSearch('call') })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(whereOf(urls()[0])).toBe('%25call%25')

    // the second search arrives while the first is still loading: no request yet (the controller does not stack them)
    act(() => { ui.onSearch('kioskcall') })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => { reply(pending[0], [{ id: 8, name: 'call' }]) })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(whereOf(urls()[1])).toBe('%25kioskcall%25')
    expect(urls()[1]).toContain('page=1&page_size=10')

    await act(async () => { reply(pending[1], [{ id: 9, name: 'kioskcall' }]) })
    await waitFor(() => expect(ui.sitesListState.sites).toEqual([{ id: 9, name: 'kioskcall' }]))
    expect(ui.sitesListState.loading).toBe(false)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('Q-01: without a race a search makes one request and the list is not requested again', async () => {
    await draw({ isSearchByName: true })
    global.fetch.mockClear()
    act(() => { ui.onSearch('kiosk') })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ui.sitesListState.loading).toBe(false))
    await act(async () => { await Promise.resolve() })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('handleSuccessUpdateSites replaces the sites', async () => {
    await draw()
    act(() => { ui.handleSuccessUpdateSites([{ id: 3 }]) })
    expect(ui.sitesListState.sites).toEqual([{ id: 3 }])
  })
})
