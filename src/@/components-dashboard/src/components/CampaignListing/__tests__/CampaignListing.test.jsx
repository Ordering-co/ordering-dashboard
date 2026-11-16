/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign CA-B1 (M-CA5, M-CA8, decision 2): filters narrow the request, outcomes instead of silence
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token' },
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

import { CampaignListing } from '..'

const PAGINATION = { current_page: 1, total_pages: 1, total: 2, page_size: 10, from: 1, to: 2 }
const makeCampaigns = () => [
  { id: 1, name: 'Welcome', contact_type: 'email', status: 'sent' },
  { id: 2, name: 'Promo', contact_type: 'sms', status: 'pending' }
]
const listResponse = (result = makeCampaigns()) => ({ json: async () => ({ error: false, result, pagination: PAGINATION }) })

const BASE = 'https://api.test/marketing_campaigns?page=1&page_size=10'
const whereOf = (url) => {
  const raw = new URL(url).searchParams.get('where')
  return raw ? JSON.parse(raw) : null
}
const lastUrl = () => mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1][0]
const callCount = () => mocks.fetch.mock.calls.length

const renderListing = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<CampaignListing UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.campaignList.campaigns).toHaveLength(2))
  return ui
}

describe('CampaignListing · request filters (CA-B1 / decision 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(async () => listResponse())
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pins today: no search and no filters send the URL without where, once', async () => {
    await renderListing()
    expect(callCount()).toBe(1)
    expect(lastUrl()).toBe(BASE)
  })

  it('passes filterValues to the UI', async () => {
    const ui = await renderListing()
    expect(ui.current.filterValues).toEqual({ clear: false, changes: {} })
    await act(async () => { ui.current.setFilterValues({ clear: false, changes: { status: ['sent'] } }) })
    expect(ui.current.filterValues).toEqual({ clear: false, changes: { status: ['sent'] } })
  })

  it('contact_type becomes one OR group of equalities inside the top-level AND', async () => {
    const ui = await renderListing()
    await act(async () => { ui.current.setFilterValues({ changes: { contact_type: ['email', 'notification'] } }) })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl())).toEqual({
      conector: 'AND',
      conditions: [{
        conector: 'OR',
        conditions: [
          { attribute: 'contact_type', value: 'email' },
          { attribute: 'contact_type', value: 'notification' }
        ]
      }]
    })
    expect(lastUrl()).toContain('page=1&page_size=10')
  })

  it('adds one group per non-empty attribute, ignores empty arrays and unknown keys', async () => {
    const ui = await renderListing()
    await act(async () => {
      ui.current.setFilterValues({
        changes: { contact_type: ['email', 'notification'], audience_type: [], status: ['scheduled'], bogus: ['x'] }
      })
    })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl()).conditions).toEqual([
      { conector: 'OR', conditions: [{ attribute: 'contact_type', value: 'email' }, { attribute: 'contact_type', value: 'notification' }] },
      { conector: 'OR', conditions: [{ attribute: 'status', value: 'scheduled' }] }
    ])
  })

  it('a filter change while a search is set sends ONE request with the search group and the filter groups', async () => {
    const ui = await renderListing()
    await act(async () => { ui.current.handleChangeSearch('promo') })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl()).conditions).toHaveLength(1)

    await act(async () => {
      ui.current.setFilterValues({ changes: { contact_type: ['email', 'notification'], status: ['scheduled'] } })
    })
    await waitFor(() => expect(callCount()).toBe(3))
    const where = whereOf(lastUrl())
    expect(where.conector).toBe('AND')
    expect(where.conditions).toHaveLength(3)
    expect(where.conditions[0].conditions.map(item => item.attribute)).toEqual(['name', 'contact_type'])
    expect(where.conditions[1].conditions).toHaveLength(2)
    expect(where.conditions[2].conditions).toEqual([{ attribute: 'status', value: 'scheduled' }])
    // no extra request trails behind
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(callCount()).toBe(3)
  })

  it('clear: true resets to the URL without where', async () => {
    const ui = await renderListing()
    await act(async () => { ui.current.setFilterValues({ changes: { contact_type: ['email'] } }) })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl())).not.toBeNull()

    await act(async () => { ui.current.setFilterValues({ clear: true, changes: {} }) })
    await waitFor(() => expect(callCount()).toBe(3))
    expect(lastUrl()).toBe(BASE)
  })

  it('does not lose a filter change made while the first load is still running (auditor #8)', async () => {
    let releaseFirst
    mocks.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { releaseFirst = () => resolve(listResponse()) }))
      .mockImplementation(async () => listResponse([{ id: 9, name: 'Filtered', contact_type: 'email', status: 'sent' }]))
    vi.stubGlobal('fetch', mocks.fetch)

    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    render(<CampaignListing UIComponent={UIComponent} />)
    await waitFor(() => expect(callCount()).toBe(1))
    expect(ui.current.campaignList.loading).toBe(true)

    await act(async () => { ui.current.setFilterValues({ changes: { contact_type: ['email'] } }) })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl())).not.toBeNull()
    await waitFor(() => expect(ui.current.campaignList.campaigns.map(item => item.id)).toEqual([9]))

    // the older response arrives late and must be ignored
    await act(async () => { releaseFirst() })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(ui.current.campaignList.campaigns.map(item => item.id)).toEqual([9])
    expect(ui.current.campaignList.loading).toBe(false)
  })

  it('does not lose a search change made while a load is running', async () => {
    let releaseFirst
    mocks.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { releaseFirst = () => resolve(listResponse()) }))
      .mockImplementation(async () => listResponse([{ id: 7, name: 'Promo', contact_type: 'sms', status: 'pending' }]))
    vi.stubGlobal('fetch', mocks.fetch)

    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    render(<CampaignListing UIComponent={UIComponent} />)
    await waitFor(() => expect(callCount()).toBe(1))

    await act(async () => { ui.current.handleChangeSearch('promo') })
    await waitFor(() => expect(callCount()).toBe(2))
    expect(whereOf(lastUrl())).not.toBeNull()
    await act(async () => { releaseFirst() })
    await waitFor(() => expect(ui.current.campaignList.campaigns.map(item => item.id)).toEqual([7]))
  })
})

describe('CampaignListing · outcomes (CA-B1 / M-CA5 / inventory 8.18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(async () => listResponse())
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('handleUpdateCampaign resolves { ok: true, error: null }, updates the row without mutating the old item, keeps the toasts', async () => {
    const ui = await renderListing()
    const previousList = ui.current.campaignList.campaigns
    const previousItem = previousList[0]
    mocks.fetch.mockImplementationOnce(async () => ({ json: async () => ({ error: false, result: { id: 1, name: 'Renamed' } }) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateCampaign(1, { name: 'Renamed' }) })

    expect(outcome).toEqual({ ok: true, error: null })
    const [url, options] = mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1]
    expect(url).toBe('https://api.test/marketing_campaigns/1')
    expect(options.method).toBe('PUT')
    expect(options.body).toBe(JSON.stringify({ name: 'Renamed' }))
    expect(ui.current.campaignList.campaigns[0]).toMatchObject({ id: 1, name: 'Renamed', contact_type: 'email' })
    expect(ui.current.campaignList.campaigns[1]).toEqual(previousList[1])
    expect(previousItem.name).toBe('Welcome')
    expect(previousList[0]).toBe(previousItem)
    expect(ui.current.campaignList.campaigns).not.toBe(previousList)
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Campaign saved')
  })

  it('handleUpdateCampaign resolves { ok: false, error } on an API error and leaves the list unchanged', async () => {
    const ui = await renderListing()
    const before = ui.current.campaignList.campaigns
    mocks.fetch.mockImplementationOnce(async () => ({ json: async () => ({ error: true, result: ['Not allowed'] }) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateCampaign(1, { name: 'Renamed' }) })

    expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.current.campaignList.campaigns).toBe(before)
    expect(ui.current.campaignList.campaigns[0].name).toBe('Welcome')
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Campaign saved')
  })

  it('handleUpdateCampaign resolves { ok: false, error: [message] } when the request throws', async () => {
    const ui = await renderListing()
    mocks.fetch.mockImplementationOnce(async () => { throw new Error('network down') })

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateCampaign(1, { enabled: false }) })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.campaignList.campaigns[0].name).toBe('Welcome')
  })

  it('handleSuccessAddCampaign updates totalItems (and to), not total', async () => {
    const ui = await renderListing()
    expect(ui.current.paginationProps.totalItems).toBe(2)

    await act(async () => { ui.current.handleSuccessAddCampaign({ id: 3, name: 'New' }) })

    expect(ui.current.paginationProps.totalItems).toBe(3)
    expect(ui.current.paginationProps.to).toBe(3)
    expect(ui.current.paginationProps.total).toBeUndefined()
    expect(ui.current.campaignList.campaigns.map(item => item.id)).toEqual([1, 2, 3])
  })
})
