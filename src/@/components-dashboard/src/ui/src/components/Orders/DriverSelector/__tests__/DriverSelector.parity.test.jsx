/* eslint-disable import/first */
// redesign fix-qa E6: a driver selector with nobody to pick says so in words (it used to show only
// a greyed "Remove assigned driver"), and "Assign" from a list row can leave the focus on it.
import React from 'react'
import { screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ driversList: { loading: false, drivers: [] } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  DriversList: ({ UIComponent, ...props }) => (
    <UIComponent {...props} driversList={state.driversList} driverActionStatus={{}} companyActionStatus={{}} handleAssignDriver={vi.fn()} />
  )
}))

// The select itself has its own tests; here it only lists the options it receives.
vi.mock('../../../../styles/Select', () => ({
  Select: ({ options }) => (
    <div data-testid='select'>
      <button type='button' aria-haspopup='listbox'>trigger</button>
      <ul>{options.map((option, index) => <li key={index} data-value={String(option.value)} data-disabled={option.disabled ? '' : undefined}>{option.content}</li>)}</ul>
    </div>
  )
}))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ options }) => (
    <div data-testid='select'>
      <button type='button' aria-haspopup='listbox'>trigger</button>
      <ul>{options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
    </div>
  )
}))

import { DriverSelector } from '..'
import { requestDriverFocus } from '../focusIntent'

const driver = (id, extra = {}) => ({ id, name: `Dan${id}`, lastname: 'Driver', enabled: true, available: true, busy: false, assigned_orders_count: 1, ...extra })

const renderSelector = (props = {}) => renderWithProviders(
  <DriverSelector order={{ id: 42 }} orderId={42} defaultValue='default' small isPhoneView {...props} />
)

beforeEach(() => {
  state.driversList = { loading: false, drivers: [] }
})

describe('DriverSelector with nobody to pick', () => {
  it('says there are no drivers for this order, and offers no select', () => {
    state.driversList = { loading: false, drivers: [{ id: 3, name: 'Ana', enabled: false }] }
    renderSelector()
    expect(screen.getByText('No drivers available for this order')).toBeInTheDocument()
    expect(screen.queryByTestId('select')).toBeNull()
  })

  // main (cc33a76c): a store with no driver at all gets the reason and, for an admin, the way to Delivery Groups
  it('explains a store without any driver, with the link to Delivery Groups, and offers no select', () => {
    renderSelector()
    expect(screen.getByText(/No drivers can take this order\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Delivery Groups' })).toHaveAttribute('href', '/delivery/drivers-groups')
    expect(screen.queryByText('No drivers available for this order')).toBeNull()
    expect(screen.queryByTestId('select')).toBeNull()
  })

  // main (cc33a76c) + review r1: with a driver assigned the select stays, and the reason goes under it, apart from it
  it('with a driver assigned and no driver in the store, keeps the select and puts the reason under it', () => {
    renderSelector({ defaultValue: 5 })
    expect(screen.getByTestId('select')).toBeInTheDocument()
    expect(screen.getByText(/No drivers can take this order\./).closest('.odt-assign-note')).not.toBeNull()
  })

  it('keeps the select when a driver is assigned (to remove them), with the same words in the list', () => {
    renderSelector({ defaultValue: 5 })
    const select = screen.getByTestId('select')
    expect(select).toHaveTextContent('Remove assigned driver')
    expect(select).toHaveTextContent('No drivers available for this order')
    expect(select.querySelector('[data-value="remove"]')).not.toHaveAttribute('data-disabled')
  })

  it('is silent while it loads and when there are drivers', () => {
    state.driversList = { loading: true, drivers: [] }
    const { unmount } = renderSelector()
    expect(screen.queryByText('No drivers available for this order')).toBeNull()
    unmount()
    state.driversList = { loading: false, drivers: [driver(1)] }
    renderSelector()
    expect(screen.queryByText('No drivers available for this order')).toBeNull()
    expect(screen.getByTestId('select')).toHaveTextContent('Dan1 Driver')
  })

  it('counts a driver who is busy or not available as somebody to pick', () => {
    state.driversList = { loading: false, drivers: [driver(1, { busy: true }), driver(2, { available: false })] }
    renderSelector()
    expect(screen.queryByText('No drivers available for this order')).toBeNull()
  })
})

describe('Assign from the list leaves the focus on the driver selector', () => {
  it('focuses the selector of the order that was asked for, once', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    requestDriverFocus(42)
    const first = renderSelector()
    expect(screen.getByRole('button', { name: 'trigger' })).toHaveFocus()
    first.unmount()
    // consumed: opening the same order again does not steal the focus
    renderSelector()
    expect(screen.getByRole('button', { name: 'trigger' })).not.toHaveFocus()
  })

  it('leaves the focus alone for another order', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    requestDriverFocus(99)
    renderSelector()
    expect(screen.getByRole('button', { name: 'trigger' })).not.toHaveFocus()
  })

  it('focuses once the drivers have loaded', () => {
    state.driversList = { loading: true, drivers: [] }
    requestDriverFocus(42)
    const view = renderSelector()
    state.driversList = { loading: false, drivers: [driver(1)] }
    act(() => { view.rerender(<DriverSelector order={{ id: 42 }} orderId={42} defaultValue='default' small isPhoneView />) })
    expect(screen.getByRole('button', { name: 'trigger' })).toHaveFocus()
  })

  it('an old request expires', () => {
    vi.useFakeTimers()
    try {
      state.driversList = { loading: false, drivers: [driver(1)] }
      requestDriverFocus(42)
      vi.advanceTimersByTime(30000)
      renderSelector()
      expect(screen.getByRole('button', { name: 'trigger' })).not.toHaveFocus()
    } finally {
      vi.useRealTimers()
    }
  })
})
