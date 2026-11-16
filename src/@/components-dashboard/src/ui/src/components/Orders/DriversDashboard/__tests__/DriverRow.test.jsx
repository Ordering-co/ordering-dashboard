/* eslint-disable import/first */
// redesign drivers-dashboard B3 (decisions 2 and 6): the driver row — state with text, assigned orders, location signal.
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (value) => value, parseDate: (date) => `parsed ${date}` }]
}))

import { DriverRow } from '../DriverRow'

const NOW = Date.parse('2026-10-09T12:00:00Z')

const makeDriver = (overrides = {}) => ({
  id: 1,
  name: 'Marco',
  lastname: 'Test',
  enabled: true,
  available: true,
  busy: false,
  assigned_orders_count: 2,
  last_location_at: '2026-10-09 11:57:00',
  ...overrides
})

const renderRow = (driver, props = {}) => {
  const handlers = { onSelect: vi.fn(), onOpenOrders: vi.fn() }
  const view = renderWithProviders(
    <ul>
      <DriverRow driver={driver} selected={false} now={NOW} {...handlers} {...props} />
    </ul>
  )
  return { ...handlers, ...view, row: view.container.querySelector('li.odd-row') }
}

describe('DriverRow · state as text', () => {
  it('says Available for a connected driver with no load', () => {
    const { row } = renderRow(makeDriver())
    expect(row).toHaveAttribute('data-state', 'available')
    expect(within(row).getByText('Available')).toBeInTheDocument()
  })

  it('says Busy for a connected driver with a load', () => {
    const { row } = renderRow(makeDriver({ busy: true }))
    expect(row).toHaveAttribute('data-state', 'busy')
    expect(within(row).getByText('Busy')).toBeInTheDocument()
  })

  it('says Offline for a disconnected driver', () => {
    const { row } = renderRow(makeDriver({ available: false }))
    expect(row).toHaveAttribute('data-state', 'offline')
    expect(within(row).getByText('Offline')).toBeInTheDocument()
    expect(within(row).queryByText(/Busy/)).toBeNull()
  })

  it('says Offline · Busy for a disconnected driver that still has a load', () => {
    const { row } = renderRow(makeDriver({ available: false, busy: true }))
    expect(row).toHaveAttribute('data-state', 'offline')
    expect(row.querySelector('.odd-state')).toHaveTextContent('Offline · Busy')
  })
})

describe('DriverRow · select and assigned orders', () => {
  it('opens the orders from the assigned-orders button and does not select the row', () => {
    const driver = makeDriver()
    const { onSelect, onOpenOrders } = renderRow(driver)
    const button = screen.getByRole('button', { name: '2 assigned orders' })
    expect(button.querySelector('.odc-figure')).toHaveTextContent('2')
    fireEvent.click(button)
    expect(onOpenOrders).toHaveBeenCalledTimes(1)
    expect(onOpenOrders).toHaveBeenCalledWith(driver)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('uses the singular for one order', () => {
    renderRow(makeDriver({ assigned_orders_count: 1 }))
    expect(screen.getByRole('button', { name: '1 assigned order' })).toBeInTheDocument()
  })

  it('draws the same text with no button when there are no orders', () => {
    const { row } = renderRow(makeDriver({ assigned_orders_count: 0 }))
    expect(screen.queryByRole('button', { name: /assigned order/ })).toBeNull()
    expect(row.querySelector('.odd-row-orders')).toHaveTextContent('0 assigned orders')
    expect(row.querySelector('.odd-row-orders .odc-figure')).toHaveTextContent('0')
  })

  it('selects the driver from the row button, and aria-pressed reflects selected', () => {
    const driver = makeDriver()
    const { onSelect, onOpenOrders, rerender } = renderRow(driver)
    const select = screen.getByRole('button', { name: 'Select driver Marco Test' })
    expect(select).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(select)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(driver)
    expect(onOpenOrders).not.toHaveBeenCalled()
    rerender(
      <ul>
        <DriverRow driver={driver} selected onSelect={onSelect} onOpenOrders={onOpenOrders} now={NOW} />
      </ul>
    )
    expect(screen.getByRole('button', { name: 'Select driver Marco Test' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('li.odd-row')).toHaveAttribute('data-selected')
  })

  it('collapses stray spaces in the name', () => {
    const { row } = renderRow(makeDriver({ name: '  Marco  ', lastname: ' Test ' }))
    expect(screen.getByRole('button', { name: 'Select driver Marco Test' })).toBeInTheDocument()
    expect(row.querySelector('.odd-row-name')).toHaveTextContent(/^Marco Test$/)
  })
})

describe('DriverRow · location signal', () => {
  it('says how long ago the last location was, with the project date as title', () => {
    const { row } = renderRow(makeDriver())
    const signal = row.querySelector('.odd-signal')
    expect(signal).toHaveTextContent('Location 3 minutes ago')
    expect(signal).toHaveAttribute('data-signal', 'fresh')
    expect(signal).toHaveAttribute('title', 'parsed 2026-10-09 11:57:00')
    expect(signal.querySelector('svg')).toBeNull()
  })

  it('warns with an icon and text for a connected driver without a recent location', () => {
    const { row } = renderRow(makeDriver({ last_location_at: '2026-10-09 11:40:00' }))
    const signal = row.querySelector('.odd-signal')
    expect(signal).toHaveAttribute('data-signal', 'stale')
    expect(signal).toHaveTextContent('No recent location · 20 minutes ago')
    expect(signal.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not warn for a disconnected driver whose last location is days old', () => {
    const { row } = renderRow(makeDriver({ available: false, last_location_at: '2026-10-06 12:00:00' }))
    const signal = row.querySelector('.odd-signal')
    expect(signal).toHaveAttribute('data-signal', 'fresh')
    expect(signal).toHaveTextContent('Location 3 days ago')
    expect(row).not.toHaveTextContent('No recent location')
  })

  it('says there is no location yet when the driver never reported one', () => {
    const { row } = renderRow(makeDriver({ last_location_at: null }))
    const signal = row.querySelector('.odd-signal')
    expect(signal).toHaveTextContent('No location yet')
    expect(signal).toHaveAttribute('data-signal', 'none')
    expect(signal).not.toHaveAttribute('title')
  })
})

// tanda AG (A3-1): the row is a container with two sibling actions. The button that selects holds the driver (photo,
// name, state, signal); the orders button sits after it, outside its box, so their 44px areas never cross on a phone.
describe('DriverRow · two sibling actions', () => {
  it('keeps the orders button outside the select button, both direct children of the row', () => {
    const { row } = renderRow(makeDriver())
    const select = screen.getByRole('button', { name: 'Select driver Marco Test' })
    const orders = screen.getByRole('button', { name: '2 assigned orders' })
    expect(select.parentElement).toBe(row)
    expect(orders.parentElement).toBe(row)
    expect(select.contains(orders)).toBe(false)
    expect(select.compareDocumentPosition(orders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts the photo, the name, the state and the signal inside the select button', () => {
    renderRow(makeDriver())
    const select = screen.getByRole('button', { name: 'Select driver Marco Test' })
    expect(select.querySelector('.odc-avatar')).not.toBeNull()
    expect(select.querySelector('.odd-row-name')).toHaveTextContent('Marco Test')
    expect(select.querySelector('.odd-state')).toHaveTextContent('Available')
    expect(select.querySelector('.odd-signal')).toHaveTextContent('Location 3 minutes ago')
    expect(select.querySelector('div')).toBeNull() // phrasing content only inside a button
  })

  it('keeps the state and the signal for a screen reader: the name says who, the description says how they are', () => {
    renderRow(makeDriver())
    const select = screen.getByRole('button', { name: 'Select driver Marco Test' })
    expect(select).toHaveAccessibleDescription('Available Location 3 minutes ago')
  })

  it('draws the orders text as one piece, so the link has one underline', () => {
    renderRow(makeDriver())
    const orders = screen.getByRole('button', { name: '2 assigned orders' })
    const text = orders.querySelector('.odd-row-orders-text')
    expect(text).not.toBeNull()
    expect(text).toHaveTextContent('2 assigned orders')
    expect(text.querySelector('.odc-figure')).toHaveTextContent('2')
  })

  it('keeps the no-orders text in the same place as the button, outside the select button', () => {
    const { row } = renderRow(makeDriver({ assigned_orders_count: 0 }))
    const select = screen.getByRole('button', { name: 'Select driver Marco Test' })
    const text = row.querySelector('.odd-row-orders')
    expect(text).toHaveTextContent('0 assigned orders')
    expect(text.parentElement).toBe(row)
    // one piece here too: as flex items, the figure and the words lost the space between them («0assigned orders»)
    expect(text.children).toHaveLength(1)
    expect(text.firstElementChild).toHaveClass('odd-row-orders-text')
    expect(select.contains(text)).toBe(false)
  })
})

// redesign drivers-dashboard B4 (decision 5): while the page waits for the driver's orders to open the sheet, the orders button is busy
describe('DriverRow · orders button busy', () => {
  it('marks the orders button busy with ordersBusy and ignores a second press', () => {
    const { onOpenOrders } = renderRow(makeDriver(), { ordersBusy: true })
    const button = screen.getByRole('button', { name: /2\s*assigned orders/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onOpenOrders).not.toHaveBeenCalled()
  })
})
