/* eslint-disable import/first */
// redesign messages B2: the two opt-in props the /messages inbox needs from the list controller.
//   B2-1 `withMessagesOnly`: `last_direct_message_at != null` joins the where of every request `getOrders` makes.
//   B2-2 `pullInOnMessage`: a `message` event for an order that is not in the page pulls it in (page 1) or counts it
//        (other pages), with one request per id, at most two in flight and a queue of the latest ten ids.
// redesign messages R2.2: two more opt-in props, `unreadByAuthor` (M-D12) and `unreadResetSignal` (M-08).
// The real SDK runs; only the XMLHttpRequest, the socket and the event bus are faked.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stable = vi.hoisted(() => {
  const listeners = () => {
    const map = new Map()
    return {
      map,
      on: (name, fn) => { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn) },
      off: (name, fn) => { map.get(name)?.delete(fn) },
      emit: (name, payload) => { [...(map.get(name) || [])].forEach(fn => fn(payload)) }
    }
  }
  const socket = listeners()
  const bus = listeners()
  return {
    session: [{ token: 'test-token', loading: false, user: { level: 0 } }],
    socket: { on: socket.on, off: socket.off, join: () => {}, leave: () => {} },
    emitSocket: socket.emit,
    events: [{ on: bus.on, off: bus.off, emit: bus.emit }],
    config: [{ loading: false, configs: {} }]
  }
})

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
const HOLD = Symbol('hold')
const requests = []
// What the fake API answers: a function (xhr) => { result, pagination? } | HOLD | 'fail'
let behaviour

const paginationFor = (xhr, total = 5) => {
  const query = new URL(xhr.url).searchParams
  const pageSize = Number(query.get('page_size'))
  return {
    current_page: Number(query.get('page')),
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
    total,
    from: 1,
    to: pageSize
  }
}

class FakeXhr {
  open (method, url) { this.method = method; this.url = url; this.headers = {} }
  setRequestHeader (name, value) { this.headers[name] = value }
  abort () {}
  answer (payload) {
    this.status = 200
    this.response = JSON.stringify({ error: false, pagination: paginationFor(this), ...payload })
    this.onload()
  }

  send () {
    requests.push(this)
    this.released = false
    const outcome = behaviour(this)
    if (outcome === HOLD) {
      this.release = (payload) => { this.released = true; this.answer(payload) }
      return
    }
    Promise.resolve().then(() => {
      this.released = true
      if (outcome === 'fail') {
        this.onerror(new Error('network down'))
        return
      }
      this.answer(outcome)
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

let ui
const UI = (props) => { ui = props; return null }

const element = (props = {}) => (
  <DashboardOrdersList
    UIComponent={UI}
    useDefualtSessionManager
    orderStatus={[1, 11]}
    orderBy='last_direct_message_at'
    filterValues={filters}
    searchValue={null}
    paginationSettings={{ initialPage: 1, pageSize: 2, controlType: 'pages' }}
    {...props}
  />
)

const whereOf = (xhr) => JSON.parse(new URL(xhr.url).searchParams.get('where'))
const messagesCondition = { attribute: 'last_direct_message_at', value: { condition: '!=', value: null } }
const hasMessagesCondition = (xhr) => whereOf(xhr).conditions.some(condition => condition.attribute === 'last_direct_message_at')
const isPull = (xhr) => new URL(xhr.url).searchParams.get('page_size') === '1'
const pulls = () => requests.filter(isPull)
const pullId = (xhr) => whereOf(xhr).conditions.find(condition => condition.attribute === 'id')?.value

const order = (id, at, extra = {}) => ({
  id,
  status: 1,
  last_direct_message_at: at,
  unread_direct_count: 0,
  unread_count: 0,
  ...extra
})

const settle = () => new Promise(resolve => setTimeout(resolve, 30))
const message = (orderId, extra = {}) => ({
  order: { id: orderId },
  created_at: '2026-10-09 12:00:00',
  type: 2,
  author: { level: 2, name: 'Ana' },
  ...extra
})
const emitMessage = (payload) => act(async () => { stable.emitSocket('message', payload); await Promise.resolve() })

const FIRST_PAGE = [order(11, '2026-10-09 10:00:00'), order(12, '2026-10-09 09:00:00')]

// The list answers its own requests with the first page; pulls are answered by `pullAnswer`.
let pullAnswer
beforeEach(() => {
  requests.length = 0
  ui = null
  pullAnswer = () => ({ result: [] })
  behaviour = (xhr) => (isPull(xhr) ? pullAnswer(xhr) : { result: FIRST_PAGE })
  window.XMLHttpRequest = FakeXhr
})
afterEach(() => {
  window.XMLHttpRequest = RealXhr
})

describe('DashboardOrdersList · withMessagesOnly (B2-1)', () => {
  it('off by default: no request carries the messages condition', async () => {
    render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(hasMessagesCondition(requests[0])).toBe(false)
  })

  it('on: the where carries last_direct_message_at != null, ANDed with the tab statuses', async () => {
    render(element({ withMessagesOnly: true }))
    await waitFor(() => expect(requests).toHaveLength(1))
    const where = whereOf(requests[0])
    expect(where.conector).toBe('AND')
    expect(where.conditions).toContainEqual(messagesCondition)
    expect(where.conditions).toContainEqual({ attribute: 'status', value: [1, 11] })
  })

  it('on: it is ANDed with the filters, the search and orderIds too', async () => {
    render(element({
      withMessagesOnly: true,
      filterValues: { ...filters, driverIds: [7] },
      searchValue: '13795',
      isSearchByOrderId: true,
      orderIds: [5, 6]
    }))
    await waitFor(() => expect(requests).toHaveLength(1))
    const { conditions } = whereOf(requests[0])
    expect(conditions).toContainEqual(messagesCondition)
    expect(conditions).toContainEqual({ attribute: 'id', value: [5, 6] })
    expect(conditions.some(condition => condition.conector === 'OR' && condition.conditions.some(inner => inner.attribute === 'external_id'))).toBe(true)
    expect(conditions.some(condition => condition.conector === 'AND' && condition.conditions.some(inner => inner.attribute === 'driver_id'))).toBe(true)
  })

  it('on: page change, reloadPageOrders and getAllMatchingOrderIds go through the same condition', async () => {
    render(element({ withMessagesOnly: true }))
    await waitFor(() => expect(requests).toHaveLength(1))
    await settle()

    await act(async () => { await ui.getPageOrders(2, 2) })
    expect(requests).toHaveLength(2)
    expect(new URL(requests[1].url).searchParams.get('page')).toBe('2')
    expect(hasMessagesCondition(requests[1])).toBe(true)

    await act(async () => { stable.events[0].emit('websocket_connected') })
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(hasMessagesCondition(requests[2])).toBe(true)

    behaviour = (xhr) => ({ result: [{ id: 1 }], pagination: { ...paginationFor(xhr, 1) } })
    await act(async () => { await ui.getAllMatchingOrderIds() })
    const walk = requests[requests.length - 1]
    expect(walk.url).toContain('page_size=100')
    expect(hasMessagesCondition(walk)).toBe(true)
  })

  it('off: page change and the id walk carry no messages condition', async () => {
    render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    await settle()
    await act(async () => { await ui.getPageOrders(2, 2) })
    behaviour = (xhr) => ({ result: [{ id: 1 }], pagination: { ...paginationFor(xhr, 1) } })
    await act(async () => { await ui.getAllMatchingOrderIds() })
    expect(requests.some(hasMessagesCondition)).toBe(false)
  })
})

describe('DashboardOrdersList · pullInOnMessage (B2-2)', () => {
  const loaded = async (props = {}) => {
    const view = render(element({ pullInOnMessage: true, withMessagesOnly: true, ...props }))
    await waitFor(() => expect(ui?.orderList?.orders).toHaveLength(2))
    await settle()
    return view
  }

  it('off: an event for an unknown order does nothing and sends no request', async () => {
    render(element({ withMessagesOnly: true }))
    await waitFor(() => expect(ui?.orderList?.orders).toHaveLength(2))
    await settle()
    const before = requests.length
    await emitMessage(message(99))
    await settle()
    expect(requests).toHaveLength(before)
    expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
    expect(ui.pagination.total).toBe(5)
    expect(ui.outsideMessages ?? 0).toBe(0)
    expect(ui.arrival ?? null).toBe(null)
  })

  it('on, page 1: the matching order is fetched with the list where plus its id, inserted at the top, total +1, size kept', async () => {
    pullAnswer = () => ({ result: [order(99, '2026-10-09 12:00:00', { unread_direct_count: 3 })] })
    await loaded()
    const listWhere = whereOf(requests[0])

    await emitMessage(message(99))
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 11]))

    expect(pulls()).toHaveLength(1)
    const pullWhere = whereOf(pulls()[0])
    expect(pullWhere.conditions).toEqual([...listWhere.conditions, { attribute: 'id', value: 99 }])
    expect(pullWhere.conditions).toContainEqual(messagesCondition)
    expect(new URL(pulls()[0].url).searchParams.get('page')).toBe('1')
    expect(ui.orderList.orders[0].unread_direct_count).toBe(3)
    expect(ui.orderList.orders).toHaveLength(2)
    // redesign messages R1 (Q-02): the pulled order matches the list's own where, so the server's total already counts it
    expect(ui.pagination.total).toBe(5)
  })

  // redesign messages integration (live): the server may not show the new message yet (replication, or the fake socket in
  // review), so the pulled order came back with its old last_direct_message_at and sorted out of the page. The event's time wins.
  it('on, page 1, sorted by newest message: the event time is applied to the pulled order, so it lands on top', async () => {
    pullAnswer = () => ({ result: [order(99, '2026-10-01 08:00:00')] })
    await loaded({ orderBy: 'last_direct_message_at', orderDirection: 'asc' })

    await emitMessage(message(99, { created_at: '2026-10-09 12:30:00' }))
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 11]))
    expect(ui.orderList.orders[0].last_direct_message_at).toBe('2026-10-09 12:30:00')
  })

  // redesign messages R1 (Q-02): pull-in honesty. The total is never raised, and the order is inserted and announced only when,
  // after sorting and slicing to the page size, it is inside page 1.
  describe('R1 Q-02 · pull-in honesty', () => {
    it('never raises pagination.total, whichever the sort', async () => {
      pullAnswer = () => ({ result: [order(99, '2026-10-09 12:00:00')] })
      await loaded()
      expect(ui.pagination.total).toBe(5)
      await emitMessage(message(99))
      await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 11]))
      expect(ui.pagination.total).toBe(5)
      expect(ui.pagination.totalPages).toBe(3)
    })

    it('sorted by order number, an order that sorts outside page 1: not inserted, not announced, not counted', async () => {
      pullAnswer = () => ({ result: [order(5, '2026-10-09 12:00:00')] })
      await loaded({ orderBy: 'id', orderDirection: 'desc' })
      await emitMessage(message(5))
      await waitFor(() => expect(pulls()).toHaveLength(1))
      await settle()
      expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
      expect(ui.arrival ?? null).toBe(null)
      expect(ui.pagination.total).toBe(5)
      expect(ui.outsideMessages ?? 0).toBe(0)
    })

    it('sorted by order number, an order that sorts inside page 1: inserted in its place, announced, total unchanged', async () => {
      pullAnswer = () => ({ result: [order(99, '2026-10-09 12:00:00')] })
      await loaded({ orderBy: 'id', orderDirection: 'desc' })
      await emitMessage(message(99))
      await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 12]))
      expect(ui.arrival).toMatchObject({ orderId: 99, fromOutside: true })
      expect(ui.pagination.total).toBe(5)
    })

    it('ascending by order number, the lowest id is inside page 1 and a higher one is outside', async () => {
      pullAnswer = (xhr) => ({ result: [order(pullId(xhr), '2026-10-09 12:00:00')] })
      await loaded({ orderBy: 'id', orderDirection: 'asc' })
      await emitMessage(message(99))
      await waitFor(() => expect(pulls()).toHaveLength(1))
      await settle()
      expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
      expect(ui.arrival ?? null).toBe(null)
      await emitMessage(message(3))
      await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([3, 11]))
      expect(ui.arrival).toMatchObject({ orderId: 3 })
      expect(ui.pagination.total).toBe(5)
    })

    it('sorted by the newest message, a pulled order with the newest message is inserted on top and announced, as today', async () => {
      pullAnswer = () => ({ result: [order(99, '2026-10-09 12:00:00')] })
      await loaded()
      await emitMessage(message(99))
      await waitFor(() => expect(ui.arrival?.orderId).toBe(99))
      expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 11])
      expect(ui.arrival).toMatchObject({ orderId: 99, authorName: 'Ana', fromOutside: true })
      expect(ui.pagination.total).toBe(5)
    })
  })

  it('on, page 1: an order the server does not return (no match) is not inserted', async () => {
    pullAnswer = () => ({ result: [] })
    await loaded()
    await emitMessage(message(99))
    await waitFor(() => expect(pulls()).toHaveLength(1))
    await settle()
    expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
    expect(ui.pagination.total).toBe(5)
  })

  it('on, page 1: a failed fetch (error body or network) is dropped silently and not retried', async () => {
    pullAnswer = () => ({ error: true, result: ['nope'] })
    await loaded()
    await emitMessage(message(98))
    await waitFor(() => expect(pulls()).toHaveLength(1))
    pullAnswer = () => 'fail'
    await emitMessage(message(97))
    await waitFor(() => expect(pulls()).toHaveLength(2))
    await settle()
    expect(pulls()).toHaveLength(2)
    expect(ui.orderList.error).toBe(null)
    expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
    expect(ui.pagination.total).toBe(5)
  })

  it('on: both event shapes work, message.order.id and message.order_id', async () => {
    pullAnswer = (xhr) => ({ result: [order(pullId(xhr), pullId(xhr) === 98 ? '2026-10-09 11:00:00' : '2026-10-09 12:00:00')] })
    await loaded()
    await emitMessage({ order_id: 98, created_at: '2026-10-09 11:00:00', type: 2, author: { level: 2, name: 'Bo' } })
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([98, 11]))
    await emitMessage(message(99))
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 98]))
    expect(pulls().map(pullId)).toEqual([98, 99])
  })

  it('on: two events for the same id make one request while it is in flight', async () => {
    behaviour = (xhr) => (isPull(xhr) ? HOLD : { result: FIRST_PAGE })
    await loaded()
    await emitMessage(message(99))
    await emitMessage(message(99, { created_at: '2026-10-09 12:00:05' }))
    await emitMessage({ order_id: 99, created_at: '2026-10-09 12:00:06', type: 2, author: { level: 2 } })
    await settle()
    expect(pulls()).toHaveLength(1)
    await act(async () => { pulls()[0].release({ result: [order(99, '2026-10-09 12:00:00')] }) })
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([99, 11]))
    expect(pulls()).toHaveLength(1)
  })

  it('on: at most two fetches in flight; a third id waits and goes out when one ends', async () => {
    behaviour = (xhr) => (isPull(xhr) ? HOLD : { result: FIRST_PAGE })
    await loaded()
    await emitMessage(message(91))
    await emitMessage(message(92))
    await emitMessage(message(93))
    await settle()
    expect(pulls().map(pullId)).toEqual([91, 92])

    await act(async () => { pulls()[0].release({ result: [order(91, '2026-10-09 12:00:00')] }) })
    await waitFor(() => expect(pulls().map(pullId)).toEqual([91, 92, 93]))
    await act(async () => { pulls()[1].release({ result: [] }) })
    await act(async () => { pulls()[2].release({ result: [] }) })
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([91, 11]))
  })

  it('on: the queue keeps the latest 10 distinct ids', async () => {
    behaviour = (xhr) => (isPull(xhr) ? HOLD : { result: FIRST_PAGE })
    await loaded()
    // 2 in flight (101, 102), then 12 more ids queue: only the latest 10 survive (105..114)
    for (let id = 101; id <= 114; id++) await emitMessage(message(id))
    await emitMessage(message(110)) // a repeat of a queued id is not a new entry
    await settle()
    expect(pulls().map(pullId)).toEqual([101, 102])

    for (let n = 0; n < 12; n++) {
      const open = pulls().filter(xhr => !xhr.released)
      if (open.length === 0) break
      await act(async () => { open[0].release({ result: [] }) })
      await settle()
    }
    expect(pulls().map(pullId)).toEqual([101, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114])
  })

  it('on, page 2: no request, outsideMessages counts messages and loading page 1 resets it', async () => {
    behaviour = (xhr) => {
      const page = Number(new URL(xhr.url).searchParams.get('page'))
      return { result: page === 2 ? [order(21, '2026-10-08 10:00:00'), order(22, '2026-10-08 09:00:00')] : FIRST_PAGE }
    }
    render(element({
      pullInOnMessage: true,
      withMessagesOnly: true,
      paginationSettings: { initialPage: 2, pageSize: 2, controlType: 'pages' }
    }))
    await waitFor(() => expect(ui?.orderList?.orders.map(item => item.id)).toEqual([21, 22]))
    await settle()
    expect(ui.pagination.currentPage).toBe(2)
    const before = requests.length

    await emitMessage(message(99))
    await emitMessage(message(99, { created_at: '2026-10-09 12:00:09' }))
    await emitMessage(message(98))
    expect(requests).toHaveLength(before)
    expect(ui.outsideMessages).toBe(3)
    expect(ui.orderList.orders.map(item => item.id)).toEqual([21, 22])
    expect(ui.pagination.total).toBe(5)

    await act(async () => { await ui.getPageOrders(2, 1) })
    expect(ui.pagination.currentPage).toBe(1)
    expect(ui.outsideMessages).toBe(0)
  })

  it('on: arrival is a new object per event, from outside (inserted) and inside the page', async () => {
    pullAnswer = () => ({ result: [order(99, '2026-10-09 12:00:00')] })
    await loaded()
    expect(ui.arrival ?? null).toBe(null)

    await emitMessage(message(99))
    await waitFor(() => expect(ui.arrival?.orderId).toBe(99))
    expect(ui.arrival).toMatchObject({ orderId: 99, authorName: 'Ana', fromOutside: true })
    expect(ui.arrival.at).toBeTruthy()
    const first = ui.arrival

    await emitMessage(message(11, { created_at: '2026-10-09 12:30:00' }))
    await waitFor(() => expect(ui.arrival?.orderId).toBe(11))
    expect(ui.arrival).not.toBe(first)
    expect(ui.arrival).toMatchObject({ orderId: 11, authorName: 'Ana', fromOutside: false })
  })

  it('on, page 2: arrival is set at the event with fromOutside true', async () => {
    render(element({
      pullInOnMessage: true,
      paginationSettings: { initialPage: 2, pageSize: 2, controlType: 'pages' }
    }))
    await waitFor(() => expect(ui?.orderList?.orders).toHaveLength(2))
    await settle()
    await emitMessage(message(99))
    expect(ui.arrival).toMatchObject({ orderId: 99, authorName: 'Ana', fromOutside: true })
  })

  it('on: an order already in the page keeps today behaviour, unread increments included', async () => {
    await loaded()
    await emitMessage(message(12, { created_at: '2026-10-09 13:00:00' }))
    await waitFor(() => expect(ui.orderList.orders.map(item => item.id)).toEqual([12, 11]))
    const updated = ui.orderList.orders[0]
    expect(updated.unread_direct_count).toBe(1)
    expect(updated.unread_count).toBe(1)
    expect(updated.last_message_at).toBe('2026-10-09 13:00:00')
    expect(pulls()).toHaveLength(0)
  })

  it('on: a filter change while a pull is in flight drops its result', async () => {
    behaviour = (xhr) => (isPull(xhr) ? HOLD : { result: FIRST_PAGE })
    const view = await loaded()
    await emitMessage(message(99))
    await waitFor(() => expect(pulls()).toHaveLength(1))
    view.rerender(element({ pullInOnMessage: true, withMessagesOnly: true, orderStatus: [1] }))
    await act(async () => { await settle() })
    await act(async () => { pulls()[0].release({ result: [order(99, '2026-10-09 12:00:00')] }) })
    await settle()
    expect(ui.orderList.orders.map(item => item.id)).toEqual([11, 12])
  })
})

// redesign messages R2.2 (M-D12): with `unreadByAuthor` only a message written by someone else raises the three counters
describe('DashboardOrdersList · unreadByAuthor (M-D12)', () => {
  const originalUser = stable.session[0].user
  const asUser = (user) => { stable.session[0] = { ...stable.session[0], user } }
  const withCounters = [
    order(11, '2026-10-09 10:00:00', { unread_general_count: 0 }),
    order(12, '2026-10-09 09:00:00', { unread_general_count: 0 })
  ]
  const counters = (id) => {
    const found = ui.orderList.orders.find(item => item.id === id)
    return [found.unread_count, found.unread_direct_count, found.unread_general_count]
  }
  const loaded = async (props = {}) => {
    behaviour = (xhr) => (isPull(xhr) ? { result: [] } : { result: withCounters })
    render(element({ unreadByAuthor: true, ...props }))
    await waitFor(() => expect(ui?.orderList?.orders).toHaveLength(2))
    await settle()
  }
  const from = (author, extra = {}) => message(11, { author, created_at: `2026-10-09 13:00:${String(Math.floor(Math.random() * 50) + 10)}`, ...extra })

  beforeEach(() => asUser({ id: 7, level: 2 }))
  afterEach(() => { stable.session[0] = { ...stable.session[0], user: originalUser } })

  it('on, session user 7: a message by user 7 adds nothing, whatever the level, and the last-message time still moves', async () => {
    await loaded()
    await emitMessage(from({ id: 7, level: 2 }, { created_at: '2026-10-09 13:00:01' }))
    await emitMessage(from({ id: 7, level: 0 }, { created_at: '2026-10-09 13:00:02' }))
    await emitMessage(from(undefined, { author_id: 7, created_at: '2026-10-09 13:00:03' }))
    expect(counters(11)).toEqual([0, 0, 0])
    expect(ui.orderList.orders.find(item => item.id === 11).last_message_at).toBe('2026-10-09 13:00:03')
    expect(ui.orderList.orders.find(item => item.id === 11).last_direct_message_at).toBe('2026-10-09 13:00:03')
  })

  it('on, session user 7: a message by an admin (level 0) with another id adds 1 to an owner', async () => {
    await loaded()
    await emitMessage(from({ id: 3, level: 0 }, { created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([1, 1, 0])
  })

  it('on: the same rule for the three counters, type 1 raises the general one and types 2 and 3 the direct one', async () => {
    await loaded()
    await emitMessage(from({ id: 3, level: 2 }, { type: 1, created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([1, 0, 1])
    await emitMessage(from({ id: 3, level: 2 }, { type: 3, created_at: '2026-10-09 13:00:02' }))
    expect(counters(11)).toEqual([2, 1, 1])
    await emitMessage(from({ id: 7, level: 2 }, { type: 1, created_at: '2026-10-09 13:00:03' }))
    await emitMessage(from({ id: 7, level: 2 }, { type: 2, created_at: '2026-10-09 13:00:04' }))
    expect(counters(11)).toEqual([2, 1, 1])
    expect(ui.orderList.orders.find(item => item.id === 11).last_general_message_at).toBe('2026-10-09 13:00:03')
  })

  it('on: author_id wins over author.id, and a message that carries no author id counts', async () => {
    await loaded()
    await emitMessage(from({ id: 3, level: 2 }, { author_id: 7, created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([0, 0, 0])
    await emitMessage(from({ level: 2 }, { created_at: '2026-10-09 13:00:02' }))
    expect(counters(11)).toEqual([1, 1, 0])
  })

  it('on, an admin session: its own message adds nothing and another admin message adds 1 (the level-0 rule no longer applies)', async () => {
    asUser({ id: 1, level: 0 })
    await loaded()
    await emitMessage(from({ id: 1, level: 0 }, { created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([0, 0, 0])
    await emitMessage(from({ id: 2, level: 0 }, { created_at: '2026-10-09 13:00:02' }))
    expect(counters(11)).toEqual([1, 1, 0])
  })

  it('off (default): today the level-0 rule exactly, whoever the author is', async () => {
    await loaded({ unreadByAuthor: undefined })
    await emitMessage(from({ id: 7, level: 2 }, { created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([1, 1, 0])
    await emitMessage(from({ id: 3, level: 0 }, { created_at: '2026-10-09 13:00:02' }))
    expect(counters(11)).toEqual([1, 1, 0])
    await emitMessage(from({ id: 3, level: 0 }, { type: 1, created_at: '2026-10-09 13:00:03' }))
    await emitMessage(from({ id: 9, level: 2 }, { type: 1, created_at: '2026-10-09 13:00:04' }))
    expect(counters(11)).toEqual([2, 1, 1])
  })
})

// redesign messages R2.2 (M-08): a new `seq` zeroes the order again, even when the id is the same
describe('DashboardOrdersList · unreadResetSignal (M-08)', () => {
  // a stable array: the controller reloads when the identity of `orderStatus` changes, and a reload would bring the server's counters back
  const STATUSES = [1, 11]
  const withCounters = [
    order(11, '2026-10-09 10:00:00', { unread_count: 2, unread_direct_count: 2, unread_general_count: 1 }),
    order(12, '2026-10-09 09:00:00', { unread_count: 4, unread_direct_count: 3, unread_general_count: 0 })
  ]
  const counters = (id) => {
    const found = ui.orderList.orders.find(item => item.id === id)
    return [found.unread_count, found.unread_direct_count, found.unread_general_count]
  }
  const loaded = async (props = {}) => {
    behaviour = (xhr) => (isPull(xhr) ? { result: [] } : { result: withCounters })
    const view = render(element({ orderStatus: STATUSES, ...props }))
    await waitFor(() => expect(ui?.orderList?.orders).toHaveLength(2))
    await settle()
    return view
  }

  it('two resets of the same order in a row both zero it, including after a socket message raised it in between', async () => {
    const view = await loaded({ unreadResetSignal: null })
    expect(counters(11)).toEqual([2, 2, 1])

    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: { orderId: 11, seq: 1 } }))
    await waitFor(() => expect(counters(11)).toEqual([0, 0, 0]))

    await emitMessage(message(11, { created_at: '2026-10-09 13:00:01' }))
    expect(counters(11)).toEqual([1, 1, 0])

    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: { orderId: 11, seq: 2 } }))
    await waitFor(() => expect(counters(11)).toEqual([0, 0, 0]))
  })

  it('only the order of the signal is zeroed, and a null signal does nothing', async () => {
    const view = await loaded({ unreadResetSignal: null })
    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: { orderId: 11, seq: 1 } }))
    await waitFor(() => expect(counters(11)).toEqual([0, 0, 0]))
    expect(counters(12)).toEqual([4, 3, 0])
    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: null }))
    await settle()
    expect(counters(12)).toEqual([4, 3, 0])
  })

  it('a new object with the same seq is not a new reset', async () => {
    const view = await loaded({ unreadResetSignal: null })
    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: { orderId: 11, seq: 1 } }))
    await waitFor(() => expect(counters(11)).toEqual([0, 0, 0]))
    await emitMessage(message(11, { created_at: '2026-10-09 13:00:01' }))
    view.rerender(element({ orderStatus: STATUSES, unreadResetSignal: { orderId: 11, seq: 1 } }))
    await settle()
    expect(counters(11)).toEqual([1, 1, 0])
  })

  it('the existing orderIdForUnreadCountUpdate effect is untouched for the other consumers', async () => {
    const view = await loaded({ orderIdForUnreadCountUpdate: null })
    view.rerender(element({ orderStatus: STATUSES, orderIdForUnreadCountUpdate: 12 }))
    await waitFor(() => expect(counters(12)).toEqual([0, 0, 0]))
    expect(counters(11)).toEqual([2, 2, 1])
  })
})
