/* eslint-disable import/first */
// the Channel filter of /connect/sales-channels adds a `third_party_integrations` condition to the admin
// request (GET /backoffice/businesses?where=) when the page turns it on (salesChannelsFilterEnabled, sales channels only). It
// must sit beside the other conditions (search, status, type), and never reach the request of the other kinds.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => mocks.session
}))
vi.mock('../../../contexts/ApiContext', () => ({
  // the admin branch (session.user.level === 0) never touches the SDK chain: only `root` is read
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

import { PosMenuBusinessList } from '../index'

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })
const emptyPage = { error: false, result: [], pagination: { current_page: 1, page_size: 10, total_pages: 0, total: 0 } }

// the request has no encodeURIComponent of its own around `where` (getBusinesses): everything from `&where=` to the
// end of the URL is the raw JSON, so it is read back the same way, with no URL/URLSearchParams decoding in between
const whereOf = (url) => {
  const match = url.match(/&where=(.+)$/)
  return match ? JSON.parse(match[1]) : null
}
const hasChannel = (where, id) => !!where?.conditions?.some(condition => (
  condition.attribute === 'third_party_integrations' &&
  condition.conditions?.some(inner => inner.attribute === 'third_party_integration_id' && inner.value?.includes(id))
))
// getInActiveBusinesses probes the same admin route (`enabled: false`) on every list change; the list's own calls are
// the rest (as DashboardBusinessList.requests.test.jsx tells them apart)
const isInactiveProbe = (url) => !!whereOf(url)?.conditions?.some(condition => condition.attribute === 'enabled' && condition.value === false)
const listCallsOf = (urls) => urls.filter(url => !isInactiveProbe(url))

describe('PosMenuBusinessList · Channel filter, admin route', () => {
  let fetchMock
  let businessesCalls

  beforeEach(() => {
    controller = null
    businessesCalls = []
    fetchMock = vi.fn((url) => {
      if (url.includes('/backoffice/businesses')) {
        businessesCalls.push(url)
        return json(emptyPage)
      }
      return json({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const mount = async (props = {}) => {
    render(<PosMenuBusinessList UIComponent={UI} integrationType='sales_channel' {...props} />)
    await waitFor(() => expect(controller).not.toBeNull())
    await act(async () => {})
  }

  it('off: the first request carries no channel condition even with a defaultChannel', async () => {
    await mount({ salesChannelsFilterEnabled: false, defaultChannel: 100 })

    expect(listCallsOf(businessesCalls)).toHaveLength(1)
    expect(hasChannel(whereOf(listCallsOf(businessesCalls)[0]), 100)).toBe(false)
    expect(controller.channelFilterSelected).toBeNull()
  })

  it('off: picking a channel through handleChangeChannelFilter still adds nothing to the where', async () => {
    await mount({ salesChannelsFilterEnabled: false })
    businessesCalls = []

    await act(async () => { controller.handleChangeChannelFilter(100) })
    await waitFor(() => expect(businessesCalls.length).toBeGreaterThan(0))

    expect(businessesCalls.every(url => !hasChannel(whereOf(url), 100))).toBe(true)
  })

  it('on: no channel chosen is no condition; only the default active-state one applies', async () => {
    await mount({ salesChannelsFilterEnabled: true })

    const where = whereOf(listCallsOf(businessesCalls)[0])
    expect(hasChannel(where, 100)).toBe(false)
    expect(where.conditions).toEqual([{ attribute: 'enabled', value: true }])
  })

  it('on: a defaultChannel starts the first request already filtered by that channel', async () => {
    await mount({ salesChannelsFilterEnabled: true, defaultChannel: 100 })

    expect(listCallsOf(businessesCalls)).toHaveLength(1)
    expect(hasChannel(whereOf(listCallsOf(businessesCalls)[0]), 100)).toBe(true)
    expect(controller.channelFilterSelected).toBe(100)
  })

  it('on: picking a channel reloads from page 1 and joins the search and status conditions already applied', async () => {
    await mount({ salesChannelsFilterEnabled: true, isSearchByBusinessName: true })
    businessesCalls = []

    await act(async () => { controller.onSearch('taco') })
    await waitFor(() => expect(businessesCalls.length).toBeGreaterThan(0))
    businessesCalls = []

    await act(async () => { controller.handleChangeChannelFilter(100) })
    await waitFor(() => expect(businessesCalls.length).toBeGreaterThan(0))

    const where = whereOf(businessesCalls.at(-1))
    expect(hasChannel(where, 100)).toBe(true)
    expect(where.conditions.some(condition => condition.attribute === 'enabled')).toBe(true)
    expect(where.conditions.some(condition => condition.conector === 'OR')).toBe(true) // the name search
    expect(new URL(businessesCalls.at(-1)).searchParams.get('page')).toBe('1')
  })

  it('on: clearing the channel (null) drops the condition and reloads', async () => {
    await mount({ salesChannelsFilterEnabled: true, defaultChannel: 100 })
    businessesCalls = []

    await act(async () => { controller.handleChangeChannelFilter(null) })
    await waitFor(() => expect(businessesCalls.length).toBeGreaterThan(0))

    expect(hasChannel(whereOf(businessesCalls.at(-1)), 100)).toBe(false)
    expect(controller.channelFilterSelected).toBeNull()
  })

  it('on: picking the channel already selected does not ask again', async () => {
    await mount({ salesChannelsFilterEnabled: true, defaultChannel: 100 })
    businessesCalls = []

    await act(async () => { controller.handleChangeChannelFilter(100) })

    expect(businessesCalls).toHaveLength(0)
  })
})
