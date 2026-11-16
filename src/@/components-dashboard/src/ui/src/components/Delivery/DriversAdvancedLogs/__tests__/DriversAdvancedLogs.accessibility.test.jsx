/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  DriversAdvancedLogs: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (key, fallback) => fallback || key],
  useUtils: () => [{ parseDate: value => `date:${value}` }]
}))

vi.mock('../../../Shared', () => ({ Pagination: () => null }))

// tanda P: getAttributeName takes the caller's `t` (it no longer calls the hook); the mock translates only with it
vi.mock('../../../../utils', () => ({
  getAttributeName: (item, { t } = {}) => (typeof t === 'function' ? `T:${item.name}` : item.name)
}))

vi.mock('../../../../../../utils/safeJsonParse', () => ({
  parseLogData: () => [{ name: 'Driver assigned' }]
}))

import { DriversAdvancedLogsUI } from '..'

describe('DriversAdvancedLogs table semantics', () => {
  it('uses one named table body with scoped headers and list details', () => {
    renderWithProviders(
      <DriversAdvancedLogsUI
        logsList={{
          loading: false,
          error: null,
          logs: [{ id: 4, event: 'updated', data: '{}', created_at: '2030-05-06' }]
        }}
        paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
        getDriversAdvancedLogs={vi.fn()}
      />
    )

    const table = screen.getByRole('table', { name: 'Advanced logs' })
    expect(table.querySelectorAll('tbody')).toHaveLength(1)
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(3)
    expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(1)
    expect(screen.getByRole('list')).toHaveTextContent('T:Driver assigned')
    expect(screen.getByText('date:2030-05-06')).toBeInTheDocument()
  })
})

// (live check): an event with no catalog entry reads as words, not as its raw key, as in the drivers and group logs
describe('DriversAdvancedLogs event text', () => {
  it('humanizes an event the catalog does not know', () => {
    renderWithProviders(
      <DriversAdvancedLogsUI
        logsList={{
          loading: false,
          error: null,
          logs: [{ id: 5, event: 'dashboard_turn_off_gps', data: '{}', created_at: '2030-05-06' }]
        }}
        paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
        getDriversAdvancedLogs={vi.fn()}
      />
    )
    expect(screen.getByText('Dashboard turn off gps')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_TURN_OFF_GPS')).toBeNull()
  })
})
