/* eslint-disable import/first */
// (row 85 a of batch D): the logs of a driver group and the logs of a driver draw through Shared/ChangeLog (ChangeLogView),
// the same view as the store's and the settings' logs. Both are DriversGroupLogsUI with a different controller.
// Covered: the table and the cards are ChangeLogView's (Date is the row header, «Changes» has one line per change, no 1000px table);
// nothing that the legacy table showed is lost (the event, the unknown event as words, old -> new, `last_available_at` as a date, the
// schedule dialog, the raw or the formatted date, the user agent, the pages, the failure, the empty state); L-2 of bugs D.
// The controllers are stand-ins that give the lists and record the calls.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  logs: [],
  loading: false,
  error: null,
  page: 1,
  total: null,
  phone: false,
  spies: {}
}))

const dictionary = { UPDATED: 'Updated' }

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  const controller = (propName) => ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, {
    ...props,
    logsList: { logs: probe.logs, loading: probe.loading, error: probe.error },
    paginationProps: {
      currentPage: probe.page,
      pageSize: 10,
      totalItems: probe.total ?? probe.logs.length,
      totalPages: Math.max(1, Math.ceil((probe.total ?? probe.logs.length) / 10))
    },
    getDriversGroupLogs: (...args) => probe.spies.get?.(propName, ...args)
  })
  return {
    useLanguage: () => [{}, (key, fallback) => dictionary[key] || fallback || key],
    useUtils: () => [{
      parseDate: (value, options) => {
        probe.spies.parseDate?.(value, options)
        return `date(${value})`
      }
    }],
    useConfig: () => [{ configs: { general_hour_format: { value: 'HH:mm' } } }],
    DriversGroupLogs: controller('group'),
    DriversLogs: controller('driver')
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { DriversGroupLogs, DriversGroupLogsUI } from '..'
import { DriversLogs } from '../../DriversLogs'

const RAW = '2026-09-15 15:30:42'
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0'
const LOG = {
  id: 41,
  event: 'updated',
  data: [{ attribute: 'enabled', old: false, new: true }],
  user_agent: AGENT,
  created_at: RAW,
  author: { name: 'Ada', lastname: 'Lovelace', email: 'ada@example.invalid' }
}

const renderGroup = (props = {}) => renderWithProviders(<DriversGroupLogs driversGroupId={7} formatDates {...props} />)
const renderDriver = (props = {}) => renderWithProviders(<DriversLogs userId={41} UIComponent={DriversGroupLogsUI} formatDates {...props} />)

beforeEach(() => {
  probe.logs = []
  probe.loading = false
  probe.error = null
  probe.page = 1
  probe.total = null
  probe.phone = false
  probe.spies = { get: vi.fn(), parseDate: vi.fn() }
})

describe('DriversGroupLogs · row 85 (a): the view is Shared/ChangeLog', () => {
  it('draws the logs of a group as a Product table: Date (row header), User, Event, Changes and User agent', () => {
    probe.logs = [LOG]
    const { container } = renderGroup()
    const table = screen.getByRole('table', { name: 'Logs' })
    expect(table.classList.contains('odc-table')).toBe(true)
    expect(container.querySelector('.odc-cl[data-frame="section"]')).not.toBeNull()
    expect(container.querySelector('table:not(.odc-table)')).toBeNull()
    for (const name of ['Date', 'User', 'Event', 'Changes', 'User agent']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    // the legacy table's «Details / New / Old» are one line per change now
    expect(screen.queryByRole('columnheader', { name: 'New' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Old' })).toBeNull()
    expect(screen.getByRole('rowheader', { name: `date(${RAW})` })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.invalid')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.getByText('Enabled: false → true')).toBeInTheDocument()
    // ST8: the cell reads short; the whole agent is its title
    expect(screen.getByText('Chrome 141 · macOS')).toHaveAttribute('title', AGENT)
  })

  it('draws the logs of a driver through the same view (the driver panel Logs tab)', () => {
    probe.logs = [LOG]
    renderDriver()
    expect(screen.getByRole('table', { name: 'Logs' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: `date(${RAW})` })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Enabled: false → true')).toBeInTheDocument()
  })

  it('humanizes an event that is not in the dictionary, in the table and in the cards', () => {
    probe.logs = [{ ...LOG, event: 'driver_group_updated' }]
    renderGroup()
    expect(screen.getByText('Driver group updated')).toBeInTheDocument()
    expect(screen.queryByText('DRIVER_GROUP_UPDATED')).toBeNull()
  })

  it('draws cards under 768px, with the name of the list, the person and the date', () => {
    probe.phone = true
    probe.logs = [{ ...LOG, event: 'driver_group_updated' }]
    renderDriver()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Logs' })
    expect(within(list).getAllByText('Driver group updated').length).toBeGreaterThan(0)
    expect(within(list).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(list).getAllByText(`date(${RAW})`).length).toBeGreaterThan(0)
  })
})

describe('DriversGroupLogs · row 85 (a): nothing the legacy table showed is lost', () => {
  it('without `formatDates` paints the raw created_at; with it, parseDate in UTC (DG-B2b)', () => {
    probe.logs = [LOG]
    const { unmount } = renderGroup({ formatDates: false })
    expect(screen.getByRole('rowheader', { name: RAW })).toBeInTheDocument()
    expect(probe.spies.parseDate).not.toHaveBeenCalled()
    unmount()
    renderGroup()
    expect(probe.spies.parseDate).toHaveBeenCalledWith(RAW, { utc: true })
    expect(probe.spies.parseDate).not.toHaveBeenCalledWith(RAW, { utc: false })
  })

  it('writes `last_available_at` as a date in UTC, on both sides, and any other value as it is', () => {
    probe.logs = [{
      ...LOG,
      data: [
        { attribute: 'last_available_at', old: '2026-09-14 10:00:00', new: '2026-09-15 11:00:00' },
        { attribute: 'busy', old: null, added: ['a', 'b'] },
        { attribute: 'available', old: true, new: null, removed: [] }
      ]
    }]
    renderGroup()
    expect(screen.getByText('Last available at: date(2026-09-14 10:00:00) → date(2026-09-15 11:00:00)')).toBeInTheDocument()
    expect(probe.spies.parseDate).toHaveBeenCalledWith('2026-09-15 11:00:00', { utc: true })
    expect(screen.getByText('Busy: None → a, b')).toBeInTheDocument()
    expect(screen.getByText('Available: true → None')).toBeInTheDocument()
  })

  it('a schedule change is a «See changes» button that opens the schedule dialog, with the project hour format', async () => {
    const user = userEvent.setup()
    probe.logs = [{
      ...LOG,
      data: [{
        attribute: 'schedule',
        old: [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 30 } }] }],
        new: [{ enabled: true, lapses: [{ open: { hour: 8, minute: 5 }, close: { hour: 13, minute: 0 } }] }]
      }]
    }]
    renderGroup()
    await user.click(screen.getByRole('button', { name: 'See changes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Schedule changes' })
    expect(within(dialog).getByText('08:05 - 13:00')).toBeInTheDocument()
    expect(within(dialog).getByText('09:00 - 17:30')).toBeInTheDocument()
  })

  it('the detail dialog opens from a row and keeps the user agent folded in the technical details', async () => {
    const user = userEvent.setup()
    probe.logs = [LOG]
    renderGroup()
    await user.click(screen.getByRole('rowheader', { name: `date(${RAW})` }))
    const dialog = await screen.findByRole('dialog', { name: 'Updated' })
    expect(within(dialog).getByText('Ada Lovelace · ada@example.invalid')).toBeInTheDocument()
  })

  it('asks for the next page with the fixed size of 10; a page past the end asks once for the last one', async () => {
    const user = userEvent.setup()
    probe.logs = [LOG]
    probe.total = 25
    const { unmount } = renderGroup()
    await user.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(probe.spies.get).toHaveBeenCalledTimes(1)
    expect(probe.spies.get).toHaveBeenCalledWith('group', 2, 10)
    unmount()

    probe.spies.get.mockClear()
    probe.page = 4
    renderDriver()
    expect(probe.spies.get).toHaveBeenCalledTimes(1)
    expect(probe.spies.get).toHaveBeenCalledWith('driver', 3, 10)
  })

  it('says a failure (the API message, «Try again» asks the same page again), never «No data»', async () => {
    const user = userEvent.setup()
    probe.error = 'Access denied'
    probe.page = 2
    probe.total = 25
    renderDriver()
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Access denied')).toBeInTheDocument()
    expect(screen.queryByText('No data')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(probe.spies.get).toHaveBeenCalledWith('driver', 2, 10)
  })

  it('says the empty state with «No data», and for whom the changes will appear', () => {
    const { unmount } = renderGroup()
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Changes made to this driver group will appear here.')).toBeInTheDocument()
    unmount()
    renderDriver()
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Changes made to this driver will appear here.')).toBeInTheDocument()
  })

  it('draws the loading state as a busy table, not as «No data»', () => {
    probe.loading = true
    const { container } = renderGroup()
    expect(screen.queryByText('No data')).toBeNull()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(container.querySelectorAll('tr').length).toBeGreaterThan(1)
  })

  it('`actionDisabled` leaves the logs out of reach (inert)', () => {
    probe.logs = [LOG]
    const { container } = renderGroup({ actionDisabled: true })
    expect(container.querySelector('[inert]')).not.toBeNull()
  })
})
