/* eslint-disable import/first */
// redesign F6d-1 (Q3-01): the Status pill of the tab (`orderStatus`) must reload the list when another
// filter is on. The list has two effects: the main one skips when a filter is applied (the filters
// effect owns that path) and the filters effect only listened to the filter values, so a Status change
// with SLA or Driver on sent no `/orders` request. The real SDK runs; only the XMLHttpRequest is faked.
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stable = vi.hoisted(() => ({
  session: [{ token: 'test-token', loading: false, user: { level: 0 } }],
  socket: { on: () => {}, off: () => {}, join: () => {}, leave: () => {} },
  events: [{ on: () => {}, off: () => {}, emit: () => {} }],
  config: [{ loading: false, configs: {} }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => stable.session }))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => stable.socket }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => stable.events }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => stable.config }))
vi.mock('../../../contexts/ApiContext', async () => {
  const { Ordering } = await import('../../../sdk/lib/index')
  const apiState = [new Ordering({ url: 'https://api.test', version: 'v400', language: 'en', project: 'demo' })]
  return { useApi: () => apiState }
})

import { DashboardOrdersList } from '../index'

const RealXhr = window.XMLHttpRequest
const requests = []

class FakeXhr {
  open (method, url) { this.method = method; this.url = url; this.headers = {} }
  setRequestHeader (name, value) { this.headers[name] = value }
  abort () {}
  send () {
    requests.push(this)
    Promise.resolve().then(() => {
      this.status = 200
      this.response = JSON.stringify({
        error: false,
        result: [{ id: 1 }],
        pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 1, from: 1, to: 1 }
      })
      this.onload()
    })
  }
}

const filters = {
  orderId: null,
  externalId: null,
  groupTypes: [],
  groupTypesUnassigned: [],
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null,
  businessIds: [],
  driverIds: [],
  driverGroupIds: [],
  cityIds: [],
  statuses: [],
  deliveryTypes: [],
  paymethodIds: [],
  countryCode: [],
  currency: [],
  metafield: [],
  logisticStatus: null,
  assigned: null,
  driverGroupBusinessIds: [],
  customerName: null,
  customerEmail: null,
  customerCellphone: null,
  customerLastname: null,
  coupon: null,
  offerId: null,
  administratorIds: [],
  timeStatus: null
}

const UI = () => null

const element = (props = {}) => (
  <DashboardOrdersList
    UIComponent={UI}
    useDefualtSessionManager
    orderStatus={[1, 11]}
    filterValues={filters}
    searchValue={null}
    paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }}
    {...props}
  />
)

const statusesOf = (xhr) => {
  const where = JSON.parse(new URL(xhr.url).searchParams.get('where'))
  return where.conditions.find(condition => condition.attribute === 'status')?.value
}

const settle = () => new Promise(resolve => setTimeout(resolve, 30))

beforeEach(() => {
  requests.length = 0
  window.XMLHttpRequest = FakeXhr
})
afterEach(() => {
  window.XMLHttpRequest = RealXhr
})

describe('DashboardOrdersList · Status change with another filter on (Q3-01)', () => {
  const withSla = { ...filters, timeStatus: 'delayed' }
  const withDriver = { ...filters, driverIds: [7] }

  it.each([
    ['SLA', withSla],
    ['Driver', withDriver]
  ])('%s on, then a Status: asks with that status', async (_name, filterValues) => {
    const view = render(element({ filterValues }))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(statusesOf(requests[0])).toEqual([1, 11])

    view.rerender(element({ filterValues, orderStatus: [1] }))
    await waitFor(() => expect(requests).toHaveLength(2))
    await settle()
    expect(requests).toHaveLength(2)
    expect(statusesOf(requests[1])).toEqual([1])
  })

  it('changing and clearing the Status with a filter on reloads each time, once', async () => {
    const view = render(element({ filterValues: withSla }))
    await waitFor(() => expect(requests).toHaveLength(1))

    view.rerender(element({ filterValues: withSla, orderStatus: [1] }))
    await waitFor(() => expect(requests).toHaveLength(2))
    view.rerender(element({ filterValues: withSla, orderStatus: [11] }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(statusesOf(requests[2])).toEqual([11])
    view.rerender(element({ filterValues: withSla, orderStatus: [1, 11] }))
    await waitFor(() => expect(requests).toHaveLength(4))
    await settle()
    expect(requests).toHaveLength(4)
    expect(statusesOf(requests[3])).toEqual([1, 11])
  })

  it('a re-render with the same statuses in a new array does not reload', async () => {
    const view = render(element({ filterValues: withSla }))
    await waitFor(() => expect(requests).toHaveLength(1))
    view.rerender(element({ filterValues: withSla, orderStatus: [1, 11] }))
    await settle()
    expect(requests).toHaveLength(1)
  })

  it('a filter and a Status that change together make one request', async () => {
    const view = render(element({ filterValues: withSla }))
    await waitFor(() => expect(requests).toHaveLength(1))
    view.rerender(element({ filterValues: { ...withSla, driverIds: [7] }, orderStatus: [1] }))
    await waitFor(() => expect(requests).toHaveLength(2))
    await settle()
    expect(requests).toHaveLength(2)
    expect(statusesOf(requests[1])).toEqual([1])
  })

  it('without filters: one request on load and exactly one per Status change', async () => {
    const view = render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    await settle()
    expect(requests).toHaveLength(1)

    view.rerender(element({ orderStatus: [1] }))
    await waitFor(() => expect(requests).toHaveLength(2))
    await settle()
    expect(requests).toHaveLength(2)
    expect(statusesOf(requests[1])).toEqual([1])

    view.rerender(element({ orderStatus: [1, 11] }))
    await waitFor(() => expect(requests).toHaveLength(3))
    await settle()
    expect(requests).toHaveLength(3)
  })
})

// redesign F6d (Q3-01, follow-up): the same skip hit the search, the sort and the context ids — with a
// filter on, typing in the search or sorting sent no request.
describe('DashboardOrdersList · search, sort and context with a filter on', () => {
  const withSla = { ...filters, timeStatus: 'delayed' }

  it.each([
    ['search', { searchValue: '13795' }],
    ['sort', { orderBy: 'delivery_datetime' }],
    ['driver context', { driverId: 7 }],
    ['business context', { businessId: 41 }]
  ])('a %s change reloads once', async (_name, change) => {
    const view = render(element({ filterValues: withSla }))
    await waitFor(() => expect(requests).toHaveLength(1))
    view.rerender(element({ filterValues: withSla, ...change }))
    await waitFor(() => expect(requests).toHaveLength(2))
    await settle()
    expect(requests).toHaveLength(2)
  })
})
