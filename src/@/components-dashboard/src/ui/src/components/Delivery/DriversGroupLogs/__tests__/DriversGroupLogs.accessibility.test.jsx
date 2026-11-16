/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  DriversGroupLogs: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (key, fallback) => fallback || key],
  useUtils: () => [{ parseDate: value => `date:${value}` }],
  useConfig: () => [{ configs: { general_hour_format: { value: 'hh:mm A' } } }]
}))

vi.mock('../../../../utils', () => ({ getAttributeName: attribute => `attribute:${attribute}` }))
vi.mock('../../../../../../utils/safeJsonParse', () => ({
  parseLogData: () => [{ attribute: 'enabled', new: true, old: false }]
}))

import { DriversGroupLogsUI } from '..'

describe('DriversGroupLogs table semantics', () => {
  it('uses one named table body with scoped headers, real lists and an LTR identifier', () => {
    renderWithProviders(
      <DriversGroupLogsUI
        logsList={{ loading: false, error: null, logs: [{ id: 41, event: 'updated', data: '{}', created_at: '2026-09-15 15:30:42', user_agent: 'fixture-agent', author: { name: 'Ada', lastname: 'Lovelace', email: 'ada@example.invalid' } }] }}
        paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
        getDriversGroupLogs={vi.fn()}
      />
    )

    const table = screen.getByRole('table', { name: 'Logs' })
    expect(table.querySelectorAll('tbody')).toHaveLength(1)
    // (row 85 a of batch D): the table is Shared/ChangeLog's (Date, User, Event, Changes, User agent); the date names the row
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(5)
    expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(1)
    expect(table.querySelectorAll('table')).toHaveLength(0)
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('attribute:enabled')
    expect(screen.getByText('fixture-agent')).toHaveAttribute('dir', 'ltr')
  })

  it('keeps every row cell count aligned with the column headers while loading', () => {
    renderWithProviders(
      <DriversGroupLogsUI
        logsList={{ loading: true, error: null, logs: [] }}
        paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
        getDriversGroupLogs={vi.fn()}
      />
    )

    const table = screen.getByRole('table', { name: 'Logs' })
    const columns = table.querySelectorAll('thead th[scope="col"]').length
    for (const row of table.querySelectorAll('tbody tr')) {
      expect(row.children).toHaveLength(columns)
    }
  })
})
