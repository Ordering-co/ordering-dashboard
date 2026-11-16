// redesign 5.1 copy: labels in sentence case (C14), approved with the catalog sync on 2026-10-06.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const historyPush = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useHistory: () => ({ push: historyPush })
  }
})

const mockState = vi.hoisted(() => ({ user: { level: 0 } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: mockState.user }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }]
}))

vi.mock('../../../../contexts/FilterValuesContext', () => ({
  useFilterValues: () => [{ timeStatus: null }, { handleFilterValues: vi.fn() }]
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ options, onChange }) => (
    <div>
      {options.map(option => (
        <button
          key={option.value}
          type='button'
          onClick={() => onChange(option.value)}
        >
          {option.name}
        </button>
      ))}
    </div>
  )
}))

import { OrdersDashboardSLAControls } from '../index'

describe('OrdersDashboardSLAControls', () => {
  beforeEach(() => {
    mockState.user = { level: 0 }
  })

  // (R-4): the read-only admin cannot open Settings, so the SLA options stay and the shortcut goes
  it('does not offer SLA settings to a read-only admin and keeps the SLA options', async () => {
    mockState.user = { level: 0, readOnlyAdmin: true }
    renderWithProviders(<OrdersDashboardSLAControls setTimeStatus={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ok' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'At risk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delayed' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SLA settings' })).not.toBeInTheDocument()
  })

  it('opens Settings for SLA settings and keeps filter options', async () => {
    const setTimeStatus = vi.fn()
    renderWithProviders(
      <OrdersDashboardSLAControls setTimeStatus={setTimeStatus} />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ok' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'At risk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delayed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'SLA settings' }))
    expect(historyPush).toHaveBeenCalledWith('/settings?group=orders&category=enterprise_orders_slas')
    expect(setTimeStatus).not.toHaveBeenCalled()
    expect(screen.queryByText('Google Maps API')).not.toBeInTheDocument()
  })
})
