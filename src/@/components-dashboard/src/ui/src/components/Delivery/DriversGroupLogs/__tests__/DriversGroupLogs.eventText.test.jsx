/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// the event type is translated by its upper-case key; a key missing from the dictionary must show a
// humanized English default, never the raw key.
const dictionary = { UPDATED: 'Updated' }

vi.mock('../../../../../../index', () => ({
  DriversGroupLogs: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (key, fallback) => dictionary[key] || fallback || key],
  useUtils: () => [{ parseDate: value => value }],
  useConfig: () => [{ configs: {} }]
}))

vi.mock('../../../../utils', () => ({ getAttributeName: attribute => attribute }))
vi.mock('../../../../../../utils/safeJsonParse', () => ({ parseLogData: () => [] }))

import { DriversGroupLogsUI } from '..'

const renderEvent = (event) => renderWithProviders(
  <DriversGroupLogsUI
    logsList={{ loading: false, error: null, logs: [{ id: 1, event, data: '{}', created_at: '2026-09-15 15:30:42', author: { name: 'Ada' } }] }}
    paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
    getDriversGroupLogs={vi.fn()}
  />
)

describe('DriversGroupLogs event text', () => {
  it('humanizes an event that is not in the dictionary', () => {
    renderEvent('driver_group_updated')
    expect(screen.getByText('Driver group updated')).toBeInTheDocument()
    expect(screen.queryByText('DRIVER_GROUP_UPDATED')).toBeNull()
  })

  it('keeps the translation when the event is in the dictionary', () => {
    renderEvent('updated')
    expect(screen.getByText('Updated')).toBeInTheDocument()
  })

  it('does not break without an event', () => {
    renderEvent(undefined)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
