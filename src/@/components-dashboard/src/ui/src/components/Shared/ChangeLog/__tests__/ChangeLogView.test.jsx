/* eslint-disable import/first */
// redesign settings-logs: the shared logs view.
// Covered: where the focus goes after «Try again» unmounts itself (the new «Try again» if it failed again, the first row if it worked,
// nowhere if the person went elsewhere while the list loaded); what the default view clamps (the table, the phone cards with «+N»)
// and what `complete` does not.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({ phone: false }))

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: (value) => `date(${value})` }],
  useConfig: () => [{ configs: {} }]
}))
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { ChangeLogView } from '../ChangeLogView'

const LOG = {
  id: 5,
  event: 'data_changed',
  data: [{ attribute: 'featured', old: false, new: true }],
  user_agent: 'Mozilla/5.0 (Macintosh)',
  created_at: '2026-10-09 21:55:08',
  author: { name: 'Ana', lastname: 'Lopez', email: 'ana@shop.test' }
}
const FIVE_CHANGES = {
  ...LOG,
  data: [
    { attribute: 'featured', old: false, new: true },
    { attribute: 'notes', old: 'a', new: 'b' },
    { attribute: 'gallery', old: 1, new: 2 },
    { attribute: 'zip', old: 3, new: 4 },
    { attribute: 'city', old: 'x', new: 'y' }
  ]
}

const LIST = { logs: [LOG], loading: false, error: null }
const LOADING = { logs: [], loading: true, error: null }
const FAILED = { logs: [], loading: false, error: 'Boom' }

const view = (props = {}) => (
  <ChangeLogView
    frame='page'
    logsList={LIST}
    paginationProps={{ currentPage: 1, pageSize: 10, totalItems: 1 }}
    onPageChange={vi.fn()}
    onReload={props.onReload ?? vi.fn()}
    listLabel='Logs'
    scrollLabel='Logs table, scrolls sideways'
    emptyTitle='No changes yet'
    emptyDescription='Changes will appear here.'
    loadFailedLabel='The changes could not be loaded.'
    {...props}
  />
)

beforeEach(() => {
  probe.phone = false
})

describe('ChangeLogView · the focus after «Try again»', () => {
  it('lands on the new «Try again» when the second answer fails again', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(view({ logsList: FAILED, onReload }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onReload).toHaveBeenCalledTimes(1)

    // the list loads: the alert (and the button that had the focus) is gone, the focus falls to <body>
    rerender(view({ logsList: LOADING, onReload }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(document.body)

    rerender(view({ logsList: { ...FAILED, error: 'Boom again' }, onReload }))
    const again = screen.getByRole('button', { name: 'Try again' })
    expect(within(screen.getByRole('alert')).getByText('Boom again')).toBeInTheDocument()
    expect(again).toHaveFocus()
  })

  it('lands on the first row of the list when the second answer works', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(view({ logsList: FAILED, onReload }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    rerender(view({ logsList: LOADING, onReload }))
    expect(document.activeElement).toBe(document.body)

    rerender(view({ logsList: { logs: [LOG, { ...LOG, id: 6 }], loading: false, error: null }, onReload }))
    const firstRow = document.querySelector('tr[tabindex="0"]')
    expect(firstRow).not.toBeNull()
    expect(firstRow).toHaveFocus()
    expect(within(firstRow).getByText('ana@shop.test')).toBeInTheDocument()
  })

  it('leaves the focus where the person put it while the list loaded', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    const header = <input aria-label='Search logs' />
    const { rerender } = renderWithProviders(view({ logsList: FAILED, onReload, header }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    rerender(view({ logsList: LOADING, onReload, header }))

    const input = screen.getByRole('textbox', { name: 'Search logs' })
    act(() => input.focus())
    expect(input).toHaveFocus()

    // failed again: the focus stays on the input
    rerender(view({ logsList: FAILED, onReload, header }))
    expect(screen.getByRole('textbox', { name: 'Search logs' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Try again' })).not.toHaveFocus()

    // and the same when it works
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    rerender(view({ logsList: LOADING, onReload, header }))
    act(() => screen.getByRole('textbox', { name: 'Search logs' }).focus())
    rerender(view({ logsList: LIST, onReload, header }))
    expect(screen.getByRole('textbox', { name: 'Search logs' })).toHaveFocus()
    expect(document.querySelector('tr[tabindex="0"]')).not.toHaveFocus()
  })

  // review R1 H2: a page change that fails unmounts the pagination (the foot hides on an error): the keyboard user lands on the
  // «Try again» that replaced the list, not on <body>
  it('lands on «Try again» when a page change fails and the pagination is gone', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    const pages = { currentPage: 1, pageSize: 10, totalItems: 30 }
    const { rerender } = renderWithProviders(view({ onPageChange, paginationProps: pages }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2, 10)

    rerender(view({ onPageChange, paginationProps: pages, logsList: { ...LIST, loading: true } }))
    rerender(view({ onPageChange, paginationProps: pages, logsList: FAILED }))
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
  })

  it('keeps the focus on the pagination when a page change works', async () => {
    const user = userEvent.setup()
    const pages = { currentPage: 1, pageSize: 10, totalItems: 30 }
    const { rerender } = renderWithProviders(view({ paginationProps: pages }))
    const next = screen.getByRole('button', { name: 'Next page' })
    await user.click(next)
    rerender(view({ paginationProps: pages, logsList: { ...LIST, loading: true } }))
    rerender(view({ paginationProps: { ...pages, currentPage: 2 }, logsList: LIST }))
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveFocus()
  })

  it('does not take the focus when the list changes without a «Try again» before', () => {
    const { rerender } = renderWithProviders(view({ logsList: LOADING }))
    rerender(view({ logsList: LIST }))
    expect(document.activeElement).toBe(document.body)
  })

  it('falls back to asking the same page again when there is no onReload', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    renderWithProviders(view({ logsList: FAILED, onReload: undefined, onPageChange, paginationProps: { currentPage: 3, pageSize: 10, totalItems: 25 } }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onPageChange).toHaveBeenCalledWith(3, 10)
  })
})

describe('ChangeLogView · clamp and summary (the store keeps its behaviour)', () => {
  it('the table clamps the changes by default (data-clamp present)', () => {
    renderWithProviders(view({ logsList: { logs: [FIVE_CHANGES], loading: false, error: null } }))
    const lists = document.querySelectorAll('ul.odc-cl-changes')
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) expect(list).toHaveAttribute('data-clamp')
  })

  it('the table does not clamp when `complete`', () => {
    renderWithProviders(view({ complete: true, logsList: { logs: [FIVE_CHANGES], loading: false, error: null } }))
    const lists = document.querySelectorAll('ul.odc-cl-changes')
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) expect(list).not.toHaveAttribute('data-clamp')
  })

  it('the phone cards show three changes and «+N» by default', () => {
    probe.phone = true
    renderWithProviders(view({ logsList: { logs: [FIVE_CHANGES], loading: false, error: null } }))
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Logs' })
    expect(within(list).getByText('Featured: false → true')).toBeInTheDocument()
    expect(within(list).getByText('Notes: a → b')).toBeInTheDocument()
    expect(within(list).getByText('Gallery: 1 → 2')).toBeInTheDocument()
    expect(within(list).queryByText('Zip: 3 → 4')).toBeNull()
    expect(within(list).queryByText('City: x → y')).toBeNull()
    expect(within(list).getByText('+2')).toBeInTheDocument()
  })

  it('the phone cards show every change and no «+N» when `complete`', () => {
    probe.phone = true
    renderWithProviders(view({ complete: true, logsList: { logs: [FIVE_CHANGES], loading: false, error: null } }))
    const list = screen.getByRole('list', { name: 'Logs' })
    for (const line of ['Featured: false → true', 'Notes: a → b', 'Gallery: 1 → 2', 'Zip: 3 → 4', 'City: x → y']) {
      expect(within(list).getByText(line)).toBeInTheDocument()
    }
    expect(within(list).queryByText(/^\+\d+$/)).toBeNull()
  })
})

// redesign bugs F row 37: the detail dialog is titled with the event; the date shows once, in its timeline.
describe('ChangeLogView · the detail dialog', () => {
  it('names the event once (the title), not again in the timeline (row 13)', async () => {
    const user = userEvent.setup()
    renderWithProviders(view())
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getAllByText('Data changed')).toHaveLength(1)
    expect(within(dialog.querySelector('.odc-cl-detail')).queryByText('Data changed')).toBeNull()
  })

  it('is titled with the event and shows the date once', async () => {
    const user = userEvent.setup()
    renderWithProviders(view())
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getAllByText('date(2026-10-09 21:55:08)')).toHaveLength(1)
  })
})

// (row 85 a of batch D): `formatDate` is optional; without it the date is what the store and settings logs always had.
describe('ChangeLogView · formatDate', () => {
  it('without it writes created_at with parseDate, as before', () => {
    renderWithProviders(view())
    expect(screen.getByRole('rowheader', { name: 'date(2026-10-09 21:55:08)' })).toBeInTheDocument()
  })

  it('with it writes created_at as the consumer says, in the table and in the detail, and gives it the log', async () => {
    const user = userEvent.setup()
    const formatDate = vi.fn((stamp, log) => `utc:${stamp}#${log.id}`)
    renderWithProviders(view({ formatDate }))
    expect(formatDate).toHaveBeenCalledWith('2026-10-09 21:55:08', expect.objectContaining({ id: 5 }))
    expect(screen.getByRole('rowheader', { name: 'utc:2026-10-09 21:55:08#5' })).toBeInTheDocument()
    expect(screen.queryByText('date(2026-10-09 21:55:08)')).toBeNull()
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getAllByText('utc:2026-10-09 21:55:08#5')).toHaveLength(1)
  })
})

// ST8: the table and the cards read «Chrome 155 · macOS»; the whole user agent is the cell's title and, folded in
// «Technical details», the detail's. A client that is not a browser keeps its own text.
describe('ChangeLogView · the user agent reads short', () => {
  const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
  const chromeList = { logs: [{ ...LOG, user_agent: CHROME_MAC }], loading: false, error: null }

  it('the table cell says the browser, the version and the system, and keeps the whole agent as its title', () => {
    renderWithProviders(view({ logsList: chromeList }))
    const cell = screen.getByText('Chrome 155 · macOS')
    expect(cell).toHaveAttribute('title', CHROME_MAC)
    expect(cell).toHaveAttribute('dir', 'ltr')
    expect(screen.queryByText(CHROME_MAC)).toBeNull()
  })

  it('the detail keeps the whole agent, folded in «Technical details»', async () => {
    const user = userEvent.setup()
    renderWithProviders(view({ logsList: chromeList }))
    await user.click(screen.getByText('ana@shop.test'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getByText(CHROME_MAC).closest('details')).not.toBeNull()
  })

  it('the complete phone cards say it short too, and the whole agent is behind the tap', async () => {
    probe.phone = true
    const user = userEvent.setup()
    renderWithProviders(view({ complete: true, logsList: chromeList }))
    const list = screen.getByRole('list', { name: 'Logs' })
    expect(within(list).getByText('Chrome 155 · macOS')).toHaveAttribute('title', CHROME_MAC)
    expect(within(list).queryByText(CHROME_MAC)).toBeNull()
    await user.click(within(list).getByRole('link'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(within(dialog).getByText(CHROME_MAC)).toBeInTheDocument()
  })

  it('a client that is not a browser, or an unknown agent, shows its own text', () => {
    renderWithProviders(view({ logsList: { logs: [{ ...LOG, user_agent: 'okhttp/4.12.0' }], loading: false, error: null } }))
    const cell = screen.getByText('okhttp/4.12.0')
    expect(cell).not.toHaveAttribute('title')
  })

  it('a log with no agent shows a dash', () => {
    renderWithProviders(view({ logsList: { logs: [{ ...LOG, user_agent: undefined }], loading: false, error: null } }))
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells[cells.length - 1]).toHaveTextContent('-')
  })
})

// the settings logs hold the open log themselves (it lives in their ?id=); the store and the groups do not pass
// `detailLog`, so the view keeps its own, as it always did.
describe('ChangeLogView · a detail held outside (detailLog)', () => {
  it('opens the log it is given, and a row or the close button only report', async () => {
    const user = userEvent.setup()
    const onDetailChange = vi.fn()
    const { rerender } = renderWithProviders(view({ detailLog: null, onDetailChange }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByText('ana@shop.test'))
    expect(onDetailChange).toHaveBeenLastCalledWith(LOG)
    expect(screen.queryByRole('dialog')).toBeNull()

    // a log that is not on this page opens all the same
    rerender(view({ detailLog: { ...LOG, id: 99, author: { email: 'other@shop.test' } }, onDetailChange }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('other@shop.test')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onDetailChange).toHaveBeenLastCalledWith(null)
  })

  it('without detailLog a row opens its own dialog, as before', async () => {
    const user = userEvent.setup()
    renderWithProviders(view())
    await user.click(screen.getByText('ana@shop.test'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('draws the empty state\'s action', () => {
    renderWithProviders(view({ logsList: { logs: [], loading: false, error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0 }, emptyAction: <button>Clear filters</button> }))
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })
})
