/* eslint-disable import/first */
// redesign stores 5.16 (; G2-33, G2-34): the logs of a store on Product.
// Covered: an API error is said (alert + «Try again» that reloads), never «No data» / the empty state; the empty state; the rows
// («Featured: false → true», no «[object Object]», «Data changed», an event the dashboard does not know reads as words); the detail
// dialog (a P/ActivityTimeline with the user agent folded in «Technical details»; the table also has a «User agent» column); the schedule changes in their own dialog (a real
// button, the days, the hour format of the project); the cards under 768px; the loading state; the pages (one request per page change).
// The controller is a stand-in that gives the lists and records the calls.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  logs: [],
  loading: false,
  error: null,
  page: 1,
  total: null,
  phone: false,
  hourFormat: 'HH:mm',
  spies: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{
      parseDate: (value, options) => {
        probe.spies.parseDate?.(value, options)
        return `date(${value})`
      }
    }],
    useConfig: () => [{ configs: { general_hour_format: { value: probe.hourFormat } } }],
    BusinessLogs: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, {
      ...props,
      logsList: { logs: probe.logs, loading: probe.loading, error: probe.error },
      paginationProps: {
        currentPage: probe.page,
        pageSize: 10,
        totalItems: probe.total ?? probe.logs.length,
        totalPages: Math.max(1, Math.ceil((probe.total ?? probe.logs.length) / 10))
      },
      getBusinessLogs: (...args) => probe.spies.get?.(...args),
      reload: () => probe.spies.reload?.()
    })
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { BusinessLogs } from '../index'

const AUTHOR = { name: 'Ana', lastname: 'Lopez', email: 'ana@shop.test' }
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'
const FEATURED = {
  id: 5,
  event: 'data_changed',
  data: [{ attribute: 'featured', old: false, new: true }],
  user_agent: AGENT,
  created_at: '2026-10-09 21:55:08',
  author: AUTHOR
}
const SCHEDULE_LOG = {
  id: 6,
  event: 'data_changed',
  data: [{
    attribute: 'schedule',
    old: JSON.stringify([
      { enabled: false, lapses: [] },
      { enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 30 } }] }
    ]),
    new: [
      { enabled: true, lapses: [{ open: { hour: 8, minute: 5 }, close: { hour: 13, minute: 0 } }] },
      { enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 18, minute: 0 } }] }
    ]
  }, { attribute: 'schedule_ranges', old: [], new: [] }],
  user_agent: 'curl/8.0',
  created_at: '2026-10-08 10:00:00',
  author: { name: 'Bo', lastname: 'Diaz', email: 'bo@shop.test' }
}

const renderLogs = (props = {}) => renderWithProviders(<BusinessLogs businessId={397} {...props} />)

beforeEach(() => {
  probe.logs = []
  probe.loading = false
  probe.error = null
  probe.page = 1
  probe.total = null
  probe.phone = false
  probe.hourFormat = 'HH:mm'
  probe.spies = { get: vi.fn(), reload: vi.fn(), parseDate: vi.fn() }
})

describe('BusinessLogs · G2-33 an error is not an empty list', () => {
  it('says the API message in an alert with «Try again», and draws no table, no empty state and no pages', () => {
    probe.error = 'Access denied'
    probe.total = 25 // the controller keeps the totals of the last good page: the foot must not use them
    renderLogs()
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Access denied')).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('No data')).toBeNull()
    expect(screen.queryByText('No changes yet')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('reads the fallback when the error has no text of its own (a thrown error, an empty answer)', () => {
    probe.error = true
    renderLogs()
    expect(within(screen.getByRole('alert')).getByText('The changes could not be loaded.')).toBeInTheDocument()
  })

  it('«Try again» asks the controller to reload the same page', async () => {
    const user = userEvent.setup()
    probe.error = 'Access denied'
    renderLogs()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(probe.spies.reload).toHaveBeenCalledTimes(1)
    expect(probe.spies.get).not.toHaveBeenCalled()
  })

  it('does not draw the error while the list loads again', () => {
    probe.error = 'Access denied'
    probe.loading = true
    renderLogs()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table', { name: 'Logs' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('BusinessLogs · empty and loading', () => {
  it('says there are no changes yet when the store has none (no error)', () => {
    renderLogs()
    expect(screen.getByRole('heading', { level: 1, name: 'Logs' })).toBeInTheDocument()
    expect(screen.getByText('No changes yet')).toBeInTheDocument()
    expect(screen.getByText('Changes made to this store will appear here.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('No data')).toBeNull()
  })

  it('draws loading rows with the label read once, hidden', () => {
    probe.loading = true
    const { container } = renderLogs()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
    expect(screen.queryByText('No changes yet')).toBeNull()
  })

  it('draws loading cards under 768px', () => {
    probe.phone = true
    probe.loading = true
    const { container } = renderLogs()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(container.querySelectorAll('li[data-skeleton]').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('BusinessLogs · the table (G2-34)', () => {
  it('draws Date, User, Event and Changes as a Product table, one line per change', () => {
    probe.logs = [FEATURED]
    const { container } = renderLogs()
    const table = screen.getByRole('table', { name: 'Logs' })
    expect(table.classList.contains('odc-table')).toBe(true)
    expect(container.querySelector('table:not(.odc-table)')).toBeNull()
    for (const name of ['Date', 'User', 'Event', 'Changes', 'User agent']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    // the date is the row header, parsed as the legacy table did (the stamp is not UTC)
    expect(screen.getByRole('rowheader', { name: 'date(2026-10-09 21:55:08)' })).toBeInTheDocument()
    expect(probe.spies.parseDate).toHaveBeenCalledWith('2026-10-09 21:55:08', { utc: false })
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('ana@shop.test')).toBeInTheDocument()
    expect(screen.getByText('Featured: false → true')).toBeInTheDocument()
    expect(screen.getByText('Data changed')).toBeInTheDocument()
  })

  it('has a «User agent» column after Changes (parity with main), with the agent of each row and a dash when there is none', () => {
    probe.logs = [FEATURED, { ...FEATURED, id: 8, user_agent: undefined }]
    renderLogs()
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent)
    expect(headers).toEqual(['Date', 'User', 'Event', 'Changes', 'User agent'])
    const [, withAgent, withoutAgent] = screen.getAllByRole('row')
    // ST8: the cell reads short; the whole agent is its title (and the detail's)
    expect(within(withAgent).getByText('Chrome 141 · macOS')).toHaveAttribute('title', AGENT)
    const cells = within(withoutAgent).getAllByRole('cell')
    expect(cells[cells.length - 1]).toHaveTextContent('-')
    expect(within(withoutAgent).queryByText(AGENT)).toBeNull()
  })

  it('names the attributes the dashboard knows, and reads an unknown one as words', () => {
    probe.logs = [{
      ...FEATURED,
      data: [
        { attribute: 'enabled', old: true, new: false },
        { attribute: 'delivery_price', old: 3, new: 4.5 }
      ]
    }]
    renderLogs()
    expect(screen.getByText('Enabled: true → false')).toBeInTheDocument()
    expect(screen.getByText('Delivery price: 3 → 4.5')).toBeInTheDocument()
  })

  it('never draws «[object Object]»: objects and arrays are JSON, a missing value is «None»', () => {
    probe.logs = [{
      ...FEATURED,
      data: [
        { attribute: 'address', old: { street: 'Main 1', zip: 90210 }, new: ['a', { b: 2 }] },
        { attribute: 'notes', old: null, new: 'Closed on Monday' },
        { attribute: 'gallery' }
      ]
    }]
    const { container } = renderLogs()
    expect(container.textContent).not.toContain('[object Object]')
    expect(screen.getByText('Address: {"street":"Main 1","zip":90210} → ["a",{"b":2}]')).toBeInTheDocument()
    expect(screen.getByText('Notes: None → Closed on Monday')).toBeInTheDocument()
    expect(screen.getByText('Gallery: None → None')).toBeInTheDocument()
  })

  it('joins the added and removed items of a list change', () => {
    probe.logs = [{
      ...FEATURED,
      data: [{ attribute: 'categories', old: null, new: null, added: [4, 9], removed: ['x'] }]
    }]
    renderLogs()
    expect(screen.getByText('Categories: x → 4, 9')).toBeInTheDocument()
  })

  it('reads data that arrives as a JSON string, and skips schedule_ranges', () => {
    probe.logs = [{
      ...FEATURED,
      data: JSON.stringify([
        { attribute: 'featured', old: false, new: true },
        { attribute: 'schedule_ranges', old: [], new: [] }
      ])
    }]
    renderLogs()
    expect(screen.getByText('Featured: false → true')).toBeInTheDocument()
    expect(screen.queryByText(/schedule_ranges|Schedule ranges/i)).toBeNull()
  })

  it('does not break on data that cannot be read', () => {
    probe.logs = [{ ...FEATURED, data: '{not json' }, { ...FEATURED, id: 7, data: null }]
    renderLogs()
    expect(screen.getAllByText('Data changed')).toHaveLength(2)
  })

  it('reads an event the dashboard does not know as words, never as a bare key', () => {
    probe.logs = [{ ...FEATURED, event: 'order_status_changed' }]
    renderLogs()
    expect(screen.getByText('Order status changed')).toBeInTheDocument()
    expect(screen.queryByText('ORDER_STATUS_CHANGED')).toBeNull()
  })

  it('takes the person from `user` when the log has no author', () => {
    probe.logs = [{ ...FEATURED, author: undefined, user: { name: 'Cy', lastname: 'Mora', email: 'cy@shop.test' } }]
    renderLogs()
    expect(screen.getByText('Cy Mora')).toBeInTheDocument()
    expect(screen.getByText('cy@shop.test')).toBeInTheDocument()
  })
})

describe('BusinessLogs · the detail', () => {
  it('opens a dialog titled with the event when a row is clicked (bugs F row 37: the date shows once, in the timeline), with a timeline of the change', async () => {
    const user = userEvent.setup()
    probe.logs = [FEATURED]
    renderLogs()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    const timeline = within(dialog).getByRole('list', { name: 'Change details' })
    expect(within(timeline).queryByText('Data changed')).toBeNull() // the event is the dialog title; the timeline does not repeat it (row 13)
    expect(within(timeline).getByText('Featured: false → true')).toBeInTheDocument()
    expect(within(timeline).getByText('Ana Lopez · ana@shop.test')).toBeInTheDocument()
    expect(timeline.querySelector('time')).toHaveAttribute('datetime', '2026-10-09T21:55:08')
  })

  it('opens with Enter on the row and puts the user agent inside the folded «Technical details»', async () => {
    const user = userEvent.setup()
    probe.logs = [FEATURED]
    renderLogs()
    act(() => screen.getAllByRole('row')[1].focus())
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')
    const agent = within(dialog).getByText(AGENT)
    const fold = agent.closest('details')
    expect(fold).not.toBeNull()
    expect(fold).not.toHaveAttribute('open')
    expect(within(fold).getByText('Technical details')).toBeInTheDocument()
  })

  it('closes with the close button', async () => {
    const user = userEvent.setup()
    probe.logs = [FEATURED]
    renderLogs()
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows every change of the log in the detail, not a clamped list', async () => {
    const user = userEvent.setup()
    probe.logs = [{
      ...FEATURED,
      data: [
        { attribute: 'featured', old: false, new: true },
        { attribute: 'notes', old: 'a', new: 'b' },
        { attribute: 'gallery', old: 1, new: 2 },
        { attribute: 'zip', old: 3, new: 4 },
        { attribute: 'city', old: 'x', new: 'y' }
      ]
    }]
    renderLogs()
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog')
    for (const line of ['Featured: false → true', 'Notes: a → b', 'Gallery: 1 → 2', 'Zip: 3 → 4', 'City: x → y']) {
      expect(within(dialog).getByText(line)).toBeInTheDocument()
    }
  })

  it('omits the fold and the author line when the log has neither', async () => {
    const user = userEvent.setup()
    probe.logs = [{ ...FEATURED, author: undefined, user: undefined, user_agent: undefined }]
    renderLogs()
    await user.click(screen.getByText('Data changed'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('details')).toBeNull()
    expect(within(dialog).queryByText('Technical details')).toBeNull()
  })
})

describe('BusinessLogs · schedule changes', () => {
  it('«See changes» is a real button; it opens the schedule dialog and not the detail of the row', async () => {
    const user = userEvent.setup()
    probe.logs = [SCHEDULE_LOG]
    renderLogs()
    const button = screen.getByRole('button', { name: 'See changes' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    await user.click(button)
    const dialog = await screen.findByRole('dialog', { name: 'Schedule changes' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByRole('heading', { level: 3, name: 'New' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Old' })).toBeInTheDocument()
  })

  it('draws the new and the old schedule day by day, with the hour format of the project', async () => {
    const user = userEvent.setup()
    probe.logs = [SCHEDULE_LOG]
    renderLogs()
    await user.click(screen.getByRole('button', { name: 'See changes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Schedule changes' })
    const [newColumn, oldColumn] = within(dialog).getAllByRole('list', { name: /^(New|Old)$/ })
    // new: Sunday 08:05 - 13:00, Monday 09:00 - 18:00 (the second is the old one's Monday with another close)
    expect(within(newColumn).getByText('Sunday')).toBeInTheDocument()
    expect(within(newColumn).getByText('08:05 - 13:00')).toBeInTheDocument()
    expect(within(newColumn).getByText('09:00 - 18:00')).toBeInTheDocument()
    // old (a JSON string in the log): Sunday unavailable, Monday 09:00 - 17:30
    expect(within(oldColumn).getByText('Unavailable')).toBeInTheDocument()
    expect(within(oldColumn).getByText('09:00 - 17:30')).toBeInTheDocument()
  })

  it('writes the hours in 12-hour format when the project asks for it', async () => {
    const user = userEvent.setup()
    probe.hourFormat = 'hh:mm a'
    probe.logs = [SCHEDULE_LOG]
    renderLogs()
    await user.click(screen.getByRole('button', { name: 'See changes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Schedule changes' })
    expect(within(dialog).getByText('08:05 am - 01:00 pm')).toBeInTheDocument()
    expect(within(dialog).getByText('09:00 am - 05:30 pm')).toBeInTheDocument()
  })

  it('says «None» for a schedule without days, and leaves out the side the log does not have', async () => {
    const user = userEvent.setup()
    probe.logs = [{ ...SCHEDULE_LOG, data: [{ attribute: 'schedule', old: null, new: [] }] }]
    renderLogs()
    await user.click(screen.getByRole('button', { name: 'See changes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Schedule changes' })
    expect(within(dialog).getByRole('heading', { level: 3, name: 'New' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { level: 3, name: 'Old' })).toBeNull()
    expect(within(dialog).getByText('None')).toBeInTheDocument()
  })

  it('is also reachable from the detail of the log', async () => {
    const user = userEvent.setup()
    probe.logs = [SCHEDULE_LOG]
    renderLogs()
    await user.click(screen.getByText('bo@shop.test'))
    const detail = await screen.findByRole('dialog', { name: 'Data changed' })
    await user.click(within(detail).getByRole('button', { name: 'See changes' }))
    expect(await screen.findByRole('dialog', { name: 'Schedule changes' })).toBeInTheDocument()
  })
})

describe('BusinessLogs · cards under 768px', () => {
  it('draws one card per log: the event, the changes, the person and the date; no table', () => {
    probe.phone = true
    probe.logs = [FEATURED, { ...FEATURED, id: 9, event: 'order_status_changed', author: { name: 'Bo', lastname: 'Diaz', email: 'bo@shop.test' } }]
    const { container } = renderLogs()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Logs' })
    expect(list.querySelectorAll(':scope > li')).toHaveLength(2)
    expect(within(list).getByText('Data changed')).toBeInTheDocument()
    expect(within(list).getByText('Order status changed')).toBeInTheDocument()
    expect(within(list).getAllByText('Featured: false → true')).toHaveLength(2)
    expect(within(list).getByText('Ana Lopez')).toBeInTheDocument()
    expect(within(list).getByText('Bo Diaz')).toBeInTheDocument()
    expect(within(list).getAllByText('date(2026-10-09 21:55:08)').length).toBeGreaterThan(0)
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('summarises a long list of changes in three lines and «+N», and a schedule change is its name alone (no button under the card link)', () => {
    probe.phone = true
    probe.logs = [{
      ...SCHEDULE_LOG,
      data: [
        { attribute: 'schedule', old: [], new: [] },
        { attribute: 'featured', old: false, new: true },
        { attribute: 'notes', old: 'a', new: 'b' },
        { attribute: 'gallery', old: 1, new: 2 },
        { attribute: 'zip', old: 3, new: 4 }
      ]
    }]
    renderLogs()
    const list = screen.getByRole('list', { name: 'Logs' })
    expect(within(list).getByText('Schedule')).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'See changes' })).toBeNull()
    expect(within(list).getByText('Featured: false → true')).toBeInTheDocument()
    expect(within(list).getByText('Notes: a → b')).toBeInTheDocument()
    expect(within(list).queryByText('Gallery: 1 → 2')).toBeNull()
    expect(within(list).getByText('+2')).toBeInTheDocument()
  })

  it('opens the same detail dialog from a card', async () => {
    const user = userEvent.setup()
    probe.phone = true
    probe.logs = [FEATURED]
    renderLogs()
    await user.click(screen.getByRole('link', { name: /Data changed/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getByRole('list', { name: 'Change details' })).toBeInTheDocument()
    expect(within(dialog).getByText(AGENT).closest('details')).not.toBeNull()
  })
})

describe('BusinessLogs · pages', () => {
  const rows = (count) => Array.from({ length: count }, (_, index) => ({ ...FEATURED, id: 100 + index }))

  it('shows the range and asks for the next page once, with the page size', async () => {
    const user = userEvent.setup()
    probe.logs = rows(10)
    probe.total = 25
    renderLogs()
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav.textContent).toContain('Showing 1–10 of 25')
    // a fixed size of 10: no rows-per-page selector
    expect(within(nav).queryByText('Items per page')).toBeNull()
    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(probe.spies.get).toHaveBeenCalledTimes(1)
    expect(probe.spies.get).toHaveBeenCalledWith(2, 10)
  })

  it('draws no pagination when the store has no logs at all', () => {
    renderLogs()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('a page past the end asks for the last valid page once (the foot clamps; no second request)', () => {
    probe.logs = []
    probe.page = 3
    probe.total = 15
    renderLogs()
    expect(probe.spies.get).toHaveBeenCalledTimes(1)
    expect(probe.spies.get).toHaveBeenCalledWith(2, 10)
  })

  it('does not ask for anything on its own when the page is valid', () => {
    probe.logs = rows(10)
    probe.total = 25
    renderLogs()
    expect(probe.spies.get).not.toHaveBeenCalled()
    expect(probe.spies.reload).not.toHaveBeenCalled()
  })
})
