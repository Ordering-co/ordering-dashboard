import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { DashboardOrdersList } from '..'

const mocks = vi.hoisted(() => ({
  session: { loading: false, user: { id: 7, level: 0 } },
  config: { loading: false, configs: {} },
  api: {},
  events: { on: vi.fn(), off: vi.fn() },
  listeners: new Map(),
  socket: { on: vi.fn(), off: vi.fn() }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.api] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [mocks.config] }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [mocks.events] }))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))

const previousDate = '2026-11-09 12:00:00'
const messageDate = '2026-11-09 13:00:00'
const OrdersView = ({ orderList }) => <div data-testid='orders'>{JSON.stringify(orderList.orders)}</div>
const readOrders = () => JSON.parse(screen.getByTestId('orders').textContent)

const renderOrders = () => {
  const orders = [11, 12].map(id => ({
    id,
    last_message_at: previousDate,
    last_general_message_at: previousDate,
    last_direct_message_at: previousDate,
    unread_count: 5,
    unread_general_count: 2,
    unread_direct_count: 3
  }))
  render(
    <DashboardOrdersList
      UIComponent={OrdersView}
      orders={orders}
      filterValues={{ businessIds: [] }}
      orderBy='last_direct_message_at'
    />
  )
  expect(readOrders()).toHaveLength(2)
  expect(mocks.listeners.has('message')).toBe(true)
}

const emitMessage = message => act(() => mocks.listeners.get('message')(message))

describe('DashboardOrdersList message updates', () => {
  beforeEach(() => {
    mocks.listeners.clear()
    mocks.socket.on.mockImplementation((event, handler) => mocks.listeners.set(event, handler))
    mocks.socket.off.mockImplementation((event, handler) => {
      if (mocks.listeners.get(event) === handler) mocks.listeners.delete(event)
    })
  })

  describe.each([
    ['null', { author: null }, 1],
    ['missing', {}, 1],
    ['level 0', { author: { level: 0 } }, 0],
    ['level 3', { author: { level: 3 } }, 1]
  ])('with %s author', (_name, authorFields, increment) => {
    it.each([1, 2])('updates type %i without breaking counters or duplicate handling', type => {
      renderOrders()
      const message = { order: { id: 12 }, created_at: messageDate, type, ...authorFields }
      const unrelatedOrder = readOrders().find(order => order.id === 11)

      emitMessage(message)

      const updatedOrders = readOrders()
      expect(updatedOrders.find(order => order.id === 12)).toEqual({
        id: 12,
        last_message_at: messageDate,
        last_general_message_at: type === 1 ? messageDate : previousDate,
        last_direct_message_at: type === 1 ? previousDate : messageDate,
        unread_count: 5 + increment,
        unread_general_count: 2 + (type === 1 ? increment : 0),
        unread_direct_count: 3 + (type === 1 ? 0 : increment)
      })
      expect(updatedOrders.find(order => order.id === 11)).toEqual(unrelatedOrder)
      if (type === 2) expect(updatedOrders.map(order => order.id)).toEqual([12, 11])

      emitMessage(message)
      expect(readOrders()).toEqual(updatedOrders)
    })
  })

  it('ignores a message for an order outside the list', () => {
    renderOrders()
    const orders = readOrders()
    emitMessage({ order: { id: 99 }, created_at: messageDate, type: 1, author: null })
    expect(readOrders()).toEqual(orders)
  })
})
