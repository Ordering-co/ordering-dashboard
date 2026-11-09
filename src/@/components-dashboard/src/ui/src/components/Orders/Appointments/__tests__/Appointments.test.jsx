/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('react-big-calendar', () => ({
  Calendar: () => <div data-testid='calendar' />,
  momentLocalizer: () => ({}),
  Views: { MONTH: 'month' }
}))

vi.mock('../../../../styles', () => ({
  IconButton: ({ children }) => <button>{children}</button>
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../Stores/BusinessSelectHeader', () => ({ BusinessSelectHeader: () => null }))
vi.mock('../../OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('../../../Shared', () => ({ SpinnerLoader: () => null }))
vi.mock('../CalendarHeader', () => ({ CalendarHeader: () => null }))
vi.mock('../EventComponent', () => ({ EventComponent: () => null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [{ parseDate: (value) => value }],
  Appointments: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

import { Appointments } from '..'

describe('Appointments', () => {
  it('shows the calendar on a project without any appointments config', () => {
    renderWithProviders(
      <Appointments
        selectedBusiness={null}
        setSelectedBusiness={vi.fn()}
        businessCalendarEvents={{ loading: false, result: [] }}
      />
    )

    expect(screen.getByTestId('calendar')).toBeInTheDocument()
    expect(screen.getByText('Select a business')).toBeInTheDocument()
    expect(screen.queryByText('The appointments feature is not enabled.')).not.toBeInTheDocument()
  })
})
