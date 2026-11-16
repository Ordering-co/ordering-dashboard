/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign DG-B2b (M-DG30 | decisión 13): `formatDates` is opt-in. Repartidores (DriversDirectory/DriverPanel)
// share this piece and never pass it, so their dates must stay exactly as the API sends them.
const { parseDate } = vi.hoisted(() => ({ parseDate: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  DriversGroupLogs: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (key, fallback) => fallback || key],
  useUtils: () => [{ parseDate }],
  useConfig: () => [{ configs: { general_hour_format: { value: 'hh:mm A' } } }]
}))

vi.mock('../../../../utils', () => ({ getAttributeName: attribute => `attribute:${attribute}` }))
vi.mock('../../../../../../utils/safeJsonParse', () => ({
  parseLogData: () => [{ attribute: 'enabled', new: true, old: false }]
}))

import { DriversGroupLogsUI } from '..'

const RAW = '2026-09-15 15:30:42'

const renderLogs = (extra = {}) => renderWithProviders(
  <DriversGroupLogsUI
    logsList={{ loading: false, error: null, logs: [{ id: 41, event: 'updated', data: '{}', created_at: RAW, user_agent: 'fixture-agent', author: { name: 'Ada', lastname: 'Lovelace', email: 'ada@example.invalid' } }] }}
    paginationProps={{ currentPage: 1, totalPages: 1, from: 1 }}
    getDriversGroupLogs={vi.fn()}
    {...extra}
  />
)

describe('DriversGroupLogs formatDates (DG-B2b)', () => {
  beforeEach(() => {
    parseDate.mockReset()
    parseDate.mockImplementation((value) => `date:${value}`)
  })

  it('without the prop paints the raw created_at, as Repartidores do today', () => {
    renderLogs()
    expect(screen.getByText(RAW)).toBeInTheDocument()
    expect(screen.queryByText(`date:${RAW}`)).toBeNull()
    expect(parseDate).not.toHaveBeenCalled()
  })

  it('with the prop paints created_at through parseDate (UTC) in the project format', () => {
    renderLogs({ formatDates: true })
    expect(screen.getByText(`date:${RAW}`)).toBeInTheDocument()
    expect(screen.queryByText(RAW)).toBeNull()
    expect(parseDate).toHaveBeenCalledWith(RAW, { utc: true })
  })

  it('with the prop leaves the rest of the row alone', () => {
    renderLogs({ formatDates: true })
    expect(screen.getByText('fixture-agent')).toBeInTheDocument()
    expect(screen.getByText('ada@example.invalid')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('attribute:enabled')
  })
})
