import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ user: { level: 0 }, driversList: { drivers: [], loading: false, error: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: state.user }],
  DriversList: ({ UIComponent, ...props }) => <UIComponent {...props} driversList={state.driversList} />
}))

vi.mock('../../../../styles/Select', () => ({
  Select: () => <div data-testid='driver-select' />
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: () => <div data-testid='driver-select' />
}))

import { DriverSelector } from '../index'

const EMPTY_MESSAGE = 'No drivers can take this order. Check that the store is in an enabled driver group that accepts this payment method.'

describe('DriverSelector', () => {
  beforeEach(() => {
    state.user = { level: 0 }
    state.driversList = { drivers: [], loading: false, error: null }
  })

  it('explains an empty list and links admins to Delivery Groups', () => {
    renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)

    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Delivery Groups' }))
      .toHaveAttribute('href', '/delivery/drivers-groups')
  })

  it('hides the link from business owners, who cannot open Delivery Groups', () => {
    state.user = { level: 2 }
    renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)

    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Delivery Groups' })).not.toBeInTheDocument()
  })

  it('hides the link from read-only admins', () => {
    state.user = { level: 0, readOnlyAdmin: true }
    renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)

    expect(screen.queryByRole('link', { name: 'Open Delivery Groups' })).not.toBeInTheDocument()
  })

  it('shows no message when the store has drivers, even if none is online', () => {
    state.driversList = {
      drivers: [{ id: 7, name: 'Ana', lastname: 'Ruiz', enabled: true, available: false, busy: false }],
      loading: false,
      error: null
    }
    renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)

    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument()
  })

  it('shows no message while loading or after a request error', () => {
    state.driversList = { drivers: [], loading: true, error: null }
    const { unmount } = renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument()
    unmount()

    state.driversList = { drivers: [], loading: false, error: 'Network error' }
    renderWithProviders(<DriverSelector order={{ id: 1 }} defaultValue='default' />)
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument()
  })
})
