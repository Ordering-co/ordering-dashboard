import React from 'react'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
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
  it('opens Settings for SLA settings and keeps filter options', async () => {
    const setTimeStatus = vi.fn()
    renderWithProviders(
      <OrdersDashboardSLAControls setTimeStatus={setTimeStatus} />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ok' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'At Risk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delayed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'SLA’s settings' }))
    expect(historyPush).toHaveBeenCalledWith('/settings?group=orders&category=enterprise_orders_slas')
    expect(setTimeStatus).not.toHaveBeenCalled()
    expect(screen.queryByText('Google Maps API')).not.toBeInTheDocument()
  })
})
