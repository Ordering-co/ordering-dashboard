/* eslint-disable import/first */
// redesign drivers-dashboard B3 (decisions 4 and 5): the chosen driver's panel — facts, call, active orders and «All orders».
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: mocks.configs }],
  useUtils: () => [{ optimizeImage: (value) => value, parseDate: (date) => `parsed ${date}` }]
}))

import { DriverPanel, IN_PROGRESS_STATUSES } from '../DriverPanel'

const NOW = Date.parse('2026-10-09T12:00:00Z')

const driver = {
  id: 7,
  name: 'Marco',
  lastname: 'Test',
  enabled: true,
  available: true,
  busy: true,
  cellphone: '+15550101',
  assigned_orders_count: 2,
  last_location_at: '2026-10-09 11:57:00',
  driver_groups: [{ id: 1, name: 'North' }, { id: 2, name: 'Airport' }]
}

const orderOf = (id, status, extra = {}) => ({
  id,
  status,
  business: { name: 'Pizza Place' },
  customer: { name: 'Ana Client' },
  ...extra
})

const idle = { loading: false, error: null, orders: [] }

const renderPanel = (props = {}) => {
  const handlers = { onClose: vi.fn(), onOpenOrders: vi.fn() }
  const view = renderWithProviders(
    <DriverPanel driver={driver} assignedOrders={idle} now={NOW} {...handlers} {...props} />
  )
  return { ...handlers, ...view }
}

beforeEach(() => {
  mocks.configs = {}
})

describe('DriverPanel · head and facts', () => {
  it('draws nothing without a driver', () => {
    const { container } = renderPanel({ driver: null })
    expect(container).toBeEmptyDOMElement()
  })

  it('names the section with the driver as an h2, with state and signal', () => {
    const { container } = renderPanel()
    const heading = screen.getByRole('heading', { level: 2, name: 'Marco Test' })
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('region', { name: 'Marco Test' })).toBeInTheDocument()
    expect(container.querySelector('.odd-state')).toHaveTextContent('Busy')
    expect(container.querySelector('.odd-signal')).toHaveTextContent('Location 3 minutes ago')
  })

  it('does not take the focus when it mounts or when the driver changes', () => {
    const { rerender, onClose, onOpenOrders } = renderPanel()
    expect(document.body).toHaveFocus()
    rerender(<DriverPanel driver={{ ...driver, id: 8, name: 'Other' }} assignedOrders={idle} now={NOW} onClose={onClose} onOpenOrders={onOpenOrders} />)
    expect(document.body).toHaveFocus()
  })

  it('offers a call link with the phone number', () => {
    renderPanel()
    const call = screen.getByRole('link', { name: 'Call Marco Test' })
    expect(call).toHaveAttribute('href', 'tel:+15550101')
    expect(call).toHaveTextContent('Call')
  })

  it('has no call link without a phone', () => {
    renderPanel({ driver: { ...driver, cellphone: undefined } })
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('lists the phone, the groups and the last location as facts', () => {
    const { container } = renderPanel()
    const facts = container.querySelector('dl.odd-facts')
    expect(facts).not.toBeNull()
    expect(within(facts).getByText('Phone').nextElementSibling).toHaveTextContent('+15550101')
    expect(within(facts).getByText('Phone').nextElementSibling.querySelector('bdi.odc-figure')).not.toBeNull()
    expect(within(facts).getByText('Driver group').nextElementSibling).toHaveTextContent('North, Airport')
    expect(within(facts).getByText('Last location').nextElementSibling).toHaveTextContent('parsed 2026-10-09 11:57:00')
  })

  it('draws no facts when there is nothing to say', () => {
    const { container } = renderPanel({ driver: { id: 9, name: 'Bare', lastname: 'Bones', enabled: true, available: true } })
    expect(container.querySelector('dl')).toBeNull()
  })

  it('closes from its × button', () => {
    const { onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Close Marco Test' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('DriverPanel · active orders', () => {
  it('shows a skeleton while the first load runs', () => {
    const { container } = renderPanel({ assignedOrders: { loading: true, error: null, orders: [] } })
    expect(container.querySelectorAll('.odd-orders .odc-skeleton').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('No active orders')).toBeNull()
  })

  it('keeps the orders already drawn while the same driver reloads', () => {
    const { container } = renderPanel({ assignedOrders: { loading: true, error: null, orders: [orderOf(101, 7)] } })
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(0)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('101')).toBeInTheDocument()
  })

  it('warns when the orders could not be loaded', () => {
    renderPanel({ assignedOrders: { loading: false, error: ['boom'], orders: [] } })
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't load this driver's orders.")
  })

  it('says so when there are no active orders', () => {
    renderPanel({ driver: { ...driver, assigned_orders_count: 0 } })
    expect(screen.getByText('No active orders')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('draws each order with its number, status, business and customer', () => {
    const { container } = renderPanel({
      assignedOrders: { loading: false, error: null, orders: [orderOf(101, 7), orderOf(102, 0, { business: { name: 'Taco Spot' }, customer: { name: 'Lee' } })] }
    })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('bdi.odc-figure')).toHaveTextContent('101')
    expect(items[0]).toHaveTextContent('#101')
    expect(items[0].querySelector('.odc-status')).toHaveAttribute('data-family', 'progress')
    expect(items[0]).toHaveTextContent('Accepted by business')
    expect(items[0]).toHaveTextContent('Pizza Place')
    expect(items[0]).toHaveTextContent('Ana Client')
    expect(items[1]).toHaveTextContent('#102')
    expect(items[1].querySelector('.odc-status')).toHaveAttribute('data-family', 'pending')
    expect(items[1]).toHaveTextContent('Taco Spot')
    expect(container.querySelector('.odd-orders h3')).toHaveTextContent('Active orders (2)')
    expect(container.querySelector('.odd-orders h3 .odc-figure')).toHaveTextContent('2')
  })

  it('shows the external id when the project uses it', () => {
    mocks.configs = { change_order_id: { value: '1' } }
    renderPanel({ assignedOrders: { loading: false, error: null, orders: [orderOf(101, 7, { external_id: 'EXT-9' }), orderOf(102, 7)] } })
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('#EXT-9')
    expect(items[1]).toHaveTextContent('#102')
  })
})

describe('DriverPanel · all orders', () => {
  const withOrders = (...statuses) => ({
    loading: false,
    error: null,
    orders: statuses.map((status, index) => orderOf(200 + index, status))
  })

  it('exports the in-progress statuses of OrdersManage', () => {
    expect(IN_PROGRESS_STATUSES).toEqual([7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26])
  })

  it('opens the in-progress tab when any order is in progress', () => {
    const { onOpenOrders } = renderPanel({ assignedOrders: withOrders(0, 7) })
    fireEvent.click(screen.getByRole('button', { name: 'All orders' }))
    expect(onOpenOrders).toHaveBeenCalledTimes(1)
    expect(onOpenOrders).toHaveBeenCalledWith(driver, 'inProgress')
  })

  it('opens the pending tab when every order is pending or a preorder', () => {
    const { onOpenOrders } = renderPanel({ assignedOrders: withOrders(0, 13) })
    fireEvent.click(screen.getByRole('button', { name: 'All orders' }))
    expect(onOpenOrders).toHaveBeenCalledWith(driver, 'pending')
  })

  it('is offered while the orders load if the driver has assigned orders, and not for a driver with none', () => {
    const { unmount } = renderPanel({ assignedOrders: { loading: true, error: null, orders: [] } })
    expect(screen.getByRole('button', { name: 'All orders' })).toBeInTheDocument()
    unmount()
    renderPanel({ driver: { ...driver, assigned_orders_count: 0 } })
    expect(screen.queryByRole('button', { name: 'All orders' })).toBeNull()
  })

  it('is busy, and does not repeat, while the page waits for the orders', () => {
    const { onOpenOrders } = renderPanel({ assignedOrders: withOrders(7), ordersBusy: true })
    const button = screen.getByRole('button', { name: 'All orders' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onOpenOrders).not.toHaveBeenCalled()
  })
})

// redesign drivers-dashboard R1-01: «All orders» while the orders still load passed 'pending' (the group of an empty list) and the sheet
// opened on Pending; with nothing loaded yet it passes no group, so the page waits for the orders
describe('DriverPanel · All orders while loading (R1-01)', () => {
  it('passes no group while the orders load', () => {
    const { onOpenOrders } = renderPanel({ driver: { ...driver, assigned_orders_count: 1 }, assignedOrders: { loading: true, error: null, orders: [] } })
    fireEvent.click(screen.getByRole('button', { name: 'All orders' }))
    expect(onOpenOrders).toHaveBeenCalledTimes(1)
    expect(onOpenOrders.mock.calls[0][1]).toBeUndefined()
  })
})
