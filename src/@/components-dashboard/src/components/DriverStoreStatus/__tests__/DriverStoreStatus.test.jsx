// (main #487), ported to the redesign: for the admin, active stores and no driver group with any of them sets
// `storesWithoutGroups`, so the page can say a driver group is needed. The redesign already reads every active store (,
// `businesses().asDashboard()`), so the flag comes from that read and no request of its own is made.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const ROOT = 'https://api.test/v400/en/demo'

const state = vi.hoisted(() => {
  const answers = { businesses: { result: [], error: false } }
  const chain = (resource) => {
    const query = {
      asDashboard: () => query,
      select: () => query,
      where: () => query,
      parameters: () => query,
      get: async () => {
        if (resource === 'businesses') {
          if (answers.businesses instanceof Error) throw answers.businesses
          return { content: answers.businesses }
        }
        return { content: { result: [], pagination: { total: 0 } } }
      }
    }
    return query
  }
  const ordering = {
    root: 'https://api.test/v400/en/demo',
    setAccessToken: () => ordering,
    users: () => chain('users'),
    orders: () => chain('orders'),
    businesses: () => chain('businesses')
  }
  const socket = { on: () => {}, off: () => {}, join: () => {}, leave: () => {} }
  return { user: { id: 1, level: 0 }, ordering, socket, answers }
})

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: state.user }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [state.ordering]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => state.socket,
  useSocketInstance: () => null
}))

import { DriverStoreStatus } from '../index'

const UI = ({ groupsLoading, businessesLoading, storesWithoutGroups, groups }) => (
  <div data-testid='ui' data-loading={String(groupsLoading || businessesLoading)} data-groups={groups.length}>
    {String(storesWithoutGroups)}
  </div>
)

const jsonResponse = (body) => ({ ok: true, json: async () => body })

const mockApi = ({ groups = [], groupsError = false, stores = { error: false, result: [] } } = {}) => {
  state.answers.businesses = stores
  global.fetch.mockImplementation(async (url) => {
    if (url.startsWith(`${ROOT}/drivergroups`)) return jsonResponse({ error: groupsError, result: groups })
    throw new Error(`Unexpected request ${url}`)
  })
}

const renderAndWait = async () => {
  render(<DriverStoreStatus UIComponent={UI} />)
  await waitFor(() => expect(screen.getByTestId('ui')).toHaveAttribute('data-loading', 'false'))
  return screen.getByTestId('ui')
}

describe('DriverStoreStatus controller · stores without a driver group', () => {
  beforeEach(() => {
    state.user = { id: 1, level: 0 }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('flags active stores when the project has no groups', async () => {
    mockApi({ groups: [], stores: { error: false, result: [{ id: 9, name: 'Downtown', enabled: true }] } })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('true')
  })

  it('flags them too when groups exist but none has an active store', async () => {
    mockApi({
      groups: [{ id: 1, name: 'North', business: [{ id: 5, name: 'Closed', enabled: false }] }, { id: 2, name: 'South', business: [] }],
      stores: { error: false, result: [{ id: 9, name: 'Downtown', enabled: true }] }
    })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('true')
    expect(ui).toHaveAttribute('data-groups', '2')
  })

  it('does not flag a project with no active stores', async () => {
    mockApi({ groups: [], stores: { error: false, result: [] } })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('false')
  })

  it('does not flag when a group already covers an active store', async () => {
    mockApi({
      groups: [{ id: 1, name: 'North', business: [{ id: 5, name: 'Downtown', enabled: true }] }],
      stores: { error: false, result: [{ id: 5, name: 'Downtown', enabled: true }, { id: 9, name: 'Uptown', enabled: true }] }
    })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('false')
  })

  it('does not flag for driver managers, who only see their groups stores', async () => {
    state.user = { id: 1, level: 5 }
    mockApi({ groups: [], stores: { error: false, result: [{ id: 9, name: 'Downtown', enabled: true }] } })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('false')
  })

  it('does not blame missing groups when the groups request fails', async () => {
    mockApi({ groups: ['ERROR'], groupsError: true, stores: { error: false, result: [{ id: 9, name: 'Downtown', enabled: true }] } })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('false')
  })

  it('does not flag when the stores request fails or throws', async () => {
    mockApi({ groups: [], stores: { error: true, result: ['ERROR'] } })
    const ui = await renderAndWait()
    expect(ui).toHaveTextContent('false')
  })
})
