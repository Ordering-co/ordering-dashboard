/* eslint-disable import/first */
// the same Channel filter as PosMenuBusinessList.salesChannelsFilter.test.jsx, on the SDK route
// (`ordering.businesses()...where().get()`) a non-admin session uses instead of GET /backoffice/businesses.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  session: { token: 'test-token', user: { level: 2 } },
  calls: []
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mockState.session] }))
vi.mock('../../../contexts/ApiContext', () => {
  // the SDK chain of `ordering.businesses()...get()` (as DashboardBusinessList.requests.test.jsx): each `.where()`
  // records the `where` the next `.get()` resolves under, so the test can tell the list calls from the inactive probe
  const chain = {
    root: 'https://api.test/v400/en/demo',
    project: 'demo',
    setAccessToken: () => chain,
    businesses: () => chain,
    select: () => chain,
    asDashboard: () => chain,
    where: (where) => { chain.lastWhere = where; return chain },
    get: async () => {
      mockState.calls.push(chain.lastWhere)
      return { content: { error: false, result: [], pagination: { current_page: 1, page_size: 10, total_pages: 0, total: 0 } } }
    }
  }
  return { useApi: () => [chain] }
})
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

// the Active tab's own request (`enabled: true`) versus the inactive probe (`enabled: false`, getInActiveBusinesses)
const isInactiveProbe = (where) => !!where?.conditions?.some(condition => condition.attribute === 'enabled' && condition.value === false)
const listCalls = () => mockState.calls.filter(where => !isInactiveProbe(where))
const hasChannel = (where, id) => !!where?.conditions?.some(condition => (
  condition.attribute === 'third_party_integrations' &&
  condition.conditions?.some(inner => inner.attribute === 'third_party_integration_id' && inner.value?.includes(id))
))

describe('PosMenuBusinessList · Channel filter, SDK route', () => {
  beforeEach(() => {
    controller = null
    mockState.calls = []
  })
  afterEach(() => vi.unstubAllGlobals())

  const mount = async (props = {}) => {
    render(<PosMenuBusinessList UIComponent={UI} integrationType='sales_channel' asDashboard skipIntegrations {...props} />)
    await waitFor(() => expect(controller).not.toBeNull())
    await act(async () => {})
  }

  it('off: never adds the condition, even with a defaultChannel', async () => {
    await mount({ salesChannelsFilterEnabled: false, defaultChannel: 100 })

    expect(listCalls()).toHaveLength(1)
    expect(hasChannel(listCalls()[0], 100)).toBe(false)
  })

  it('on: a defaultChannel starts the list already filtered by it', async () => {
    await mount({ salesChannelsFilterEnabled: true, defaultChannel: 100 })

    expect(listCalls()).toHaveLength(1)
    expect(hasChannel(listCalls()[0], 100)).toBe(true)
  })

  it('on: picking a channel joins the status condition already applied (asDashboard route)', async () => {
    await mount({ salesChannelsFilterEnabled: true })
    mockState.calls = []

    await act(async () => { controller.handleChangeChannelFilter(100) })
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0))

    const where = listCalls().at(-1)
    expect(hasChannel(where, 100)).toBe(true)
    expect(where.conditions.some(condition => condition.attribute === 'enabled' && condition.value === true)).toBe(true)
  })

  it('on: clearing the channel drops the condition', async () => {
    await mount({ salesChannelsFilterEnabled: true, defaultChannel: 100 })
    mockState.calls = []

    await act(async () => { controller.handleChangeChannelFilter(null) })
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0))

    expect(hasChannel(listCalls().at(-1), 100)).toBe(false)
  })
})
