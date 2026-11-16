/* eslint-disable import/first */
// «Select all N» on /orders (orders pilot, decision 3): the controller hands the UI a function
// that walks the list's own query (same where, status group, search and filters) asking only for
// `id`. The real SDK runs here; only the network (XMLHttpRequest) is faked, so the URL is the
// one the API would receive.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stable values: the controller keeps `session` in an effect's dependencies.
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

import { DashboardOrdersList, MAX_MATCHING_ORDER_PAGES, MATCHING_ORDER_IDS_PAGE_SIZE } from '../index'

const RealXhr = window.XMLHttpRequest
const requests = []
let respond

class FakeXhr {
  open (method, url) { this.method = method; this.url = url; this.headers = {} }
  setRequestHeader (name, value) { this.headers[name] = value }
  abort () {}
  send () {
    requests.push(this)
    const body = respond(this)
    Promise.resolve().then(() => {
      this.status = body.error ? 400 : 200
      this.response = JSON.stringify(body)
      this.onload()
    })
  }
}

const xhrUrl = (xhr) => xhr.url
const parse = (xhr) => {
  const url = new URL(xhr.url)
  return { path: url.pathname, query: Object.fromEntries(url.searchParams) }
}

const page = (ids, { currentPage, totalPages, total, pageSize }) => ({
  error: false,
  result: ids.map(id => ({ id })),
  pagination: { current_page: currentPage, page_size: pageSize, total_pages: totalPages, total, from: 1, to: ids.length }
})

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

// The default of the page's FilterValuesContext: the list reads most of these keys unguarded.
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

let ui
const UI = (props) => { ui = props; return null }

const mount = (props = {}) => render(
  <DashboardOrdersList
    UIComponent={UI}
    useDefualtSessionManager
    orderStatus={[0, 13]}
    filterValues={filters}
    searchValue={null}
    paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }}
    {...props}
  />
)

const listLoaded = () => waitFor(() => {
  expect(ui.orderList.error).toBeNull()
  expect(ui.orderList.loading).toBe(false)
  expect(requests.length).toBeGreaterThan(0)
})

// The list's own request is the first one; the id walk comes after it.
const listRequest = () => parse(requests[0])
const idRequests = () => requests.slice(1).map(parse)

beforeEach(() => {
  requests.length = 0
  ui = null
  respond = () => page(range(1, 10), { currentPage: 1, totalPages: 1, total: 10, pageSize: 10 })
  window.XMLHttpRequest = FakeXhr
})
afterEach(() => {
  window.XMLHttpRequest = RealXhr
})

describe('DashboardOrdersList · getAllMatchingOrderIds', () => {
  it('is handed to the UI component', async () => {
    mount()
    await listLoaded()
    expect(typeof ui.getAllMatchingOrderIds).toBe('function')
  })

  it('walks every page with the list’s own where, asking only for the id', async () => {
    mount({
      orderStatus: [7, 8],
      searchValue: 'ana',
      isSearchByOrderId: true,
      isSearchByCustomerName: true,
      filterValues: { ...filters, statuses: [7], deliveryTypes: [1], businessIds: [4] }
    })
    await listLoaded()
    const pageSize = MATCHING_ORDER_IDS_PAGE_SIZE
    respond = (xhr) => {
      const { query } = parse(xhr)
      const current = Number(query.page)
      const ids = current === 1 ? range(1, pageSize) : range(pageSize + 1, pageSize + 40)
      return page(ids, { currentPage: current, totalPages: 2, total: pageSize + 40, pageSize })
    }

    let ids
    await act(async () => { ids = await ui.getAllMatchingOrderIds() })

    expect(ids).toEqual(range(1, pageSize + 40))
    const walk = idRequests()
    expect(walk).toHaveLength(2)
    const list = listRequest()
    walk.forEach((request, index) => {
      expect(request.path).toBe('/v400/en/demo/orders')
      expect(request.query.where).toBe(list.query.where)
      expect(request.query.mode).toBe('dashboard')
      expect(request.query.params).toBe('id')
      expect(request.query.orderBy).toBe(list.query.orderBy)
      expect(request.query.page).toBe(String(index + 1))
      expect(request.query.page_size).toBe(String(pageSize))
    })
    // sanity: the where really carries the tab statuses, the narrowed status, the type and the search
    const where = JSON.parse(list.query.where)
    expect(JSON.stringify(where)).toContain('"attribute":"status"')
    // (the URL carries it percent-encoded; reading the query decodes one level)
    expect(xhrUrl(requests[0])).toContain('%25ana%25')
    expect(JSON.stringify(where)).toContain('ana')
  })

  it('follows the status group and the order of the list it belongs to', async () => {
    mount({ orderStatus: [1, 11, 15], orderBy: 'delivery_datetime', orderDirection: 'asc' })
    await listLoaded()
    await act(async () => { await ui.getAllMatchingOrderIds() })
    const [request] = idRequests()
    expect(JSON.parse(request.query.where).conditions).toContainEqual({ attribute: 'status', value: [1, 11, 15] })
    expect(request.query.orderBy).toBe('delivery_datetime')
  })

  it('does not touch the list: same orders, same page, no extra loading state', async () => {
    mount()
    await listLoaded()
    const before = { orders: ui.orderList.orders, pagination: ui.pagination }
    await act(async () => { await ui.getAllMatchingOrderIds() })
    expect(ui.orderList.orders).toBe(before.orders)
    expect(ui.orderList.loading).toBe(false)
    expect(ui.pagination).toEqual(before.pagination)
  })

  it('rejects when the API answers with an error, instead of returning a partial list', async () => {
    mount()
    await listLoaded()
    respond = () => ({ error: true, result: ['Denied'] })
    await act(async () => { await expect(ui.getAllMatchingOrderIds()).rejects.toThrow('Denied') })
  })

  it('stops at the page cap and rejects, never returning a partial list', async () => {
    mount()
    await listLoaded()
    respond = (xhr) => page([Number(parse(xhr).query.page)], { currentPage: Number(parse(xhr).query.page), totalPages: MAX_MATCHING_ORDER_PAGES + 50, total: 999999, pageSize: 1 })
    await act(async () => { await expect(ui.getAllMatchingOrderIds()).rejects.toThrow(/too many/i) })
    expect(idRequests().length).toBeLessThanOrEqual(MAX_MATCHING_ORDER_PAGES)
  })

  it('an empty answer is an empty list', async () => {
    mount()
    await listLoaded()
    respond = () => page([], { currentPage: 1, totalPages: 0, total: 0, pageSize: MATCHING_ORDER_IDS_PAGE_SIZE })
    let ids
    await act(async () => { ids = await ui.getAllMatchingOrderIds() })
    expect(ids).toEqual([])
  })
})
