/* eslint-disable import/first */
// redesign IM-B (decision D4): the Logs tab of the store panel of /connect/importers, in Product. The hook
// (useImportRawLogs) is a stub the test sets: it is the one that fetches, downloads and deletes; this test pins what the UI
// does with it. The model (importerLogsModel) and the Product wrappers are the real ones.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hook: null,
  hookArgs: null,
  parseDate: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ parseDate: (...args) => mocks.parseDate(...args) }]
}))
vi.mock('../useImportRawLogs', () => ({
  useImportRawLogs: (args) => {
    mocks.hookArgs = args
    return mocks.hook
  }
}))

import { ImporterLogs } from '../ImporterLogs'
import {
  SOURCE_FILTERS,
  formatBytes,
  logStamp,
  selectionState,
  statusFamily,
  visibleSelection
} from '../importerLogsModel'

const business = { id: 7, name: 'Fast Bite' }

const log = (id, source, overrides = {}) => ({
  id,
  source,
  status: 'ready',
  downloadable: true,
  createdAt: '2026-07-28T12:00:00Z',
  compressedBytes: 2048,
  uncompressedBytes: 5 * 1024 * 1024,
  ...overrides
})

const LOGS = [
  log('a', 'doordash'),
  log('b', 'gloriafood', { status: 'skipped_too_large', downloadable: false }),
  log('c', 'gloriafood', { status: 'failed' }),
  log('d', 'ordering', { status: 'skipped_duplicate' })
]

let onGoToImporters
const buildHook = (overrides = {}) => ({
  logs: LOGS,
  loading: false,
  error: null,
  refetch: vi.fn(),
  downloadLog: vi.fn(),
  downloadingId: null,
  deleteLogs: vi.fn().mockResolvedValue({ deleted: 0, ids: [] }),
  deleting: false,
  ...overrides
})
const renderLogs = () => render(<ImporterLogs business={business} onGoToImporters={onGoToImporters} />)
const rowOf = (id) => screen.getByTestId(`importers-log-row-${id}`)

beforeEach(() => {
  mocks.hook = buildHook()
  mocks.hookArgs = null
  mocks.parseDate = vi.fn((value) => `PD(${value instanceof Date ? value.getTime() : value})`)
  onGoToImporters = vi.fn()
})
afterEach(() => {
  cleanup()
})

describe('ImporterLogs hook wiring', () => {
  it('asks the hook for the store, enabled', () => {
    renderLogs()
    expect(mocks.hookArgs).toEqual({ businessId: 7, enabled: true })
  })

  it('says how many it keeps per importer', () => {
    renderLogs()
    expect(screen.getByText('Keeping the latest 10 per importer')).toBeInTheDocument()
  })
})

describe('ImporterLogs states', () => {
  it('shows a skeleton while loading', () => {
    mocks.hook = buildHook({ logs: [], loading: true })
    renderLogs()
    const skeleton = screen.getByTestId('importers-logs-skeleton')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
    expect(skeleton).toHaveAccessibleName('Loading')
    expect(screen.queryByTestId('importers-logs-list')).toBeNull()
  })

  // redesign IM-04: a failure says what failed and offers the retry
  it('shows the error of the hook with «Try again», which refetches (IM-04)', async () => {
    const user = userEvent.setup()
    mocks.hook = buildHook({ logs: [], error: new Error('Menu import API is not configured.') })
    renderLogs()
    const error = screen.getByTestId('importers-logs-error')
    expect(error).toHaveAttribute('role', 'alert')
    expect(error).toHaveTextContent('Menu import API is not configured.')
    await user.click(within(error).getByRole('button', { name: 'Try again' }))
    expect(mocks.hook.refetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('importers-logs-empty')).toBeNull()
  })

  it('falls back to the main text when the error has no message', () => {
    mocks.hook = buildHook({ logs: [], error: new Error('') })
    renderLogs()
    expect(screen.getByTestId('importers-logs-error')).toHaveTextContent('Could not load import logs.')
  })

  it('the global empty state teaches the two steps, and «Go to Importers» goes back', async () => {
    const user = userEvent.setup()
    mocks.hook = buildHook({ logs: [] })
    renderLogs()
    const empty = screen.getByTestId('importers-logs-empty')
    expect(empty).toHaveTextContent('No import logs yet')
    expect(empty).toHaveTextContent('After a successful import, the original source data is saved here so you can download and review it.')
    const steps = within(empty).getAllByRole('listitem').map(item => item.textContent)
    expect(steps).toEqual([
      'Run an import from the Importers tab.',
      'Return here to download the latest file.'
    ])
    await user.click(within(empty).getByRole('button', { name: 'Go to Importers' }))
    expect(onGoToImporters).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('importers-logs-selection-bar')).toBeNull()
  })
})

describe('ImporterLogs filter (IM-05, decision 35)', () => {
  it('is a native select named «Importer» with All and the four importers', () => {
    renderLogs()
    const select = screen.getByRole('combobox', { name: 'Importer' })
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map(option => [option.value, option.textContent])).toEqual([
      ['all', 'All'],
      ['doordash', 'DoorDash'],
      ['ubereats', 'Uber Eats'],
      ['gloriafood', 'GloriaFood'],
      ['ordering', 'Ordering.co']
    ])
    expect(select).toHaveValue('all')
  })

  it('narrows the list to one importer', async () => {
    const user = userEvent.setup()
    renderLogs()
    expect(screen.getAllByTestId(/^importers-log-row-/)).toHaveLength(4)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Importer' }), 'gloriafood')
    expect(screen.getAllByTestId(/^importers-log-row-/).map(row => row.getAttribute('data-testid'))).toEqual([
      'importers-log-row-b',
      'importers-log-row-c'
    ])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Importer' }), 'all')
    expect(screen.getAllByTestId(/^importers-log-row-/)).toHaveLength(4)
  })

  it('says so when the filter matches nothing, and the filter stays to change it', async () => {
    const user = userEvent.setup()
    renderLogs()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Importer' }), 'ubereats')
    expect(screen.getByTestId('importers-logs-filter-empty')).toHaveTextContent('No logs match this importer filter.')
    expect(screen.queryByTestId('importers-logs-selection-bar')).toBeNull()
    expect(screen.queryByTestId('importers-logs-empty')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Importer' })).toBeInTheDocument()
  })
})

describe('ImporterLogs rows', () => {
  it('names the importer (or the raw source), with a decorative logo', () => {
    mocks.hook = buildHook({ logs: [LOGS[0], log('z', 'mystery')] })
    renderLogs()
    expect(within(rowOf('a')).getByText('DoorDash')).toBeInTheDocument()
    expect(within(rowOf('a')).getByText('DD')).toHaveAttribute('aria-hidden', 'true')
    expect(within(rowOf('z')).getByText('mystery')).toBeInTheDocument()
    expect(within(rowOf('z')).getByText('MY')).toHaveAttribute('aria-hidden', 'true')
  })

  // redesign IM-06 (decision 13): the project's date format, never ISO
  it('paints the date with parseDate of the project and «ago» beside it (IM-06)', () => {
    mocks.hook = buildHook({ logs: [LOGS[0]] })
    renderLogs()
    expect(mocks.parseDate).toHaveBeenCalledWith(new Date('2026-07-28T12:00:00Z'))
    const row = rowOf('a')
    expect(row).toHaveTextContent(`PD(${Date.UTC(2026, 6, 28, 12)})`)
    expect(row).not.toHaveTextContent('2026-07-28T12:00:00Z')
    expect(row).toHaveTextContent(/ago/)
  })

  it('has a dash when the log has no date, and does not call parseDate', () => {
    mocks.hook = buildHook({ logs: [log('n', 'doordash', { createdAt: null })] })
    renderLogs()
    expect(mocks.parseDate).not.toHaveBeenCalled()
    expect(rowOf('n')).toHaveTextContent('—')
  })

  it('shows the compressed and the real size', () => {
    mocks.hook = buildHook({ logs: [LOGS[0], log('s', 'doordash', { compressedBytes: 512, uncompressedBytes: null })] })
    renderLogs()
    expect(rowOf('a')).toHaveTextContent('2.0 KB / 5.0 MB')
    expect(rowOf('s')).toHaveTextContent('512 B / —')
  })

  it('shows the status with the words of main', () => {
    renderLogs()
    expect(within(rowOf('a')).getByText('Ready')).toBeInTheDocument()
    expect(within(rowOf('b')).getByText('Too large')).toBeInTheDocument()
    expect(within(rowOf('c')).getByText('Failed')).toBeInTheDocument()
    expect(within(rowOf('d')).getByText('Duplicate')).toBeInTheDocument()
  })
})

describe('ImporterLogs selection and Delete', () => {
  const selectAll = () => screen.getByRole('checkbox', { name: 'Select all' })
  const deleteButton = () => screen.getByTestId('importers-logs-delete-selected')

  it('starts with nothing selected and Delete off', () => {
    renderLogs()
    expect(selectAll()).toHaveAttribute('aria-checked', 'false')
    expect(deleteButton()).toBeDisabled()
    expect(screen.queryByTestId('importers-logs-selected-count')).toBeNull()
    expect(screen.getAllByRole('checkbox', { name: 'Select log' })).toHaveLength(4)
  })

  it('one log: «1 selected», Delete on, and «Select all» is partial (mixed)', async () => {
    const user = userEvent.setup()
    renderLogs()
    await user.click(within(rowOf('b')).getByRole('checkbox', { name: 'Select log' }))
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('1 selected')
    expect(selectAll()).toHaveAttribute('aria-checked', 'mixed')
    expect(deleteButton()).toBeEnabled()
    await user.click(within(rowOf('b')).getByRole('checkbox', { name: 'Select log' }))
    expect(selectAll()).toHaveAttribute('aria-checked', 'false')
    expect(deleteButton()).toBeDisabled()
  })

  it('Select all selects every visible log, and again clears them', async () => {
    const user = userEvent.setup()
    renderLogs()
    await user.click(selectAll())
    expect(selectAll()).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('4 selected')
    for (const checkbox of screen.getAllByRole('checkbox', { name: 'Select log' })) {
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    }
    await user.click(selectAll())
    expect(screen.queryByTestId('importers-logs-selected-count')).toBeNull()
  })

  it('from a partial selection, Select all completes it', async () => {
    const user = userEvent.setup()
    renderLogs()
    await user.click(within(rowOf('a')).getByRole('checkbox', { name: 'Select log' }))
    await user.click(selectAll())
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('4 selected')
  })

  it('filtering trims the selection to what is visible, and Select all only takes the visible ones', async () => {
    const user = userEvent.setup()
    renderLogs()
    await user.click(within(rowOf('a')).getByRole('checkbox', { name: 'Select log' }))
    await user.click(within(rowOf('b')).getByRole('checkbox', { name: 'Select log' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Importer' }), 'gloriafood')
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('1 selected')
    await user.click(selectAll())
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('2 selected')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Importer' }), 'all')
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('2 selected')
    expect(within(rowOf('a')).getByRole('checkbox', { name: 'Select log' })).toHaveAttribute('aria-checked', 'false')
  })

  // redesign D-77 (owner, 2026-10-19): Delete asks first (C8); main deleted at once
  const selectRows = async (user, ...ids) => {
    for (const id of ids) await user.click(within(rowOf(id)).getByRole('checkbox', { name: 'Select log' }))
  }

  it('Delete asks first: it names the count, says the consequence and does not call deleteLogs yet', async () => {
    const user = userEvent.setup()
    renderLogs()
    await selectRows(user, 'a', 'c')
    await user.click(deleteButton())
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 logs?' })
    expect(within(dialog).getByText("Their source files can no longer be downloaded. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete 2 logs' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.hook.deleteLogs).not.toHaveBeenCalled()
  })

  it('with one log it reads «Delete 1 log?» and «Delete log»', async () => {
    const user = userEvent.setup()
    renderLogs()
    await selectRows(user, 'b')
    await user.click(deleteButton())
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 1 log?' })
    expect(within(dialog).getByRole('button', { name: 'Delete log' })).toBeInTheDocument()
  })

  it('confirming calls deleteLogs with the selected ids, clears the deleted ones and focuses the filter', async () => {
    const user = userEvent.setup()
    mocks.hook.deleteLogs = vi.fn().mockResolvedValue({ deleted: 2, ids: ['a', 'c'] })
    renderLogs()
    await selectRows(user, 'a', 'c')
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete 2 logs' }))
    expect(mocks.hook.deleteLogs).toHaveBeenCalledTimes(1)
    expect(mocks.hook.deleteLogs).toHaveBeenCalledWith(['a', 'c'])
    await waitFor(() => expect(screen.queryByTestId('importers-logs-selected-count')).toBeNull())
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(deleteButton()).toBeDisabled()
    await waitFor(() => expect(screen.getByTestId('importers-logs-filter')).toHaveFocus())
  })

  it('Cancel writes nothing: no call, the selection stays and the focus goes back to Delete', async () => {
    const user = userEvent.setup()
    renderLogs()
    await selectRows(user, 'a', 'c')
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.hook.deleteLogs).not.toHaveBeenCalled()
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('2 selected')
    await waitFor(() => expect(deleteButton()).toHaveFocus())
  })

  it('keeps the selection when the delete failed', async () => {
    const user = userEvent.setup()
    mocks.hook.deleteLogs = vi.fn().mockResolvedValue(null)
    renderLogs()
    await selectRows(user, 'a')
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete log' }))
    expect(mocks.hook.deleteLogs).toHaveBeenCalledWith(['a'])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('importers-logs-selected-count')).toHaveTextContent('1 selected')
  })

  it('while it deletes, the confirmation is busy: Cancel is off and the action cannot repeat', async () => {
    const user = userEvent.setup()
    const view = renderLogs()
    await selectRows(user, 'a')
    await user.click(deleteButton())
    const dialog = await screen.findByRole('alertdialog')
    mocks.hook = buildHook({ deleting: true })
    view.rerender(<ImporterLogs business={business} onGoToImporters={onGoToImporters} />)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Delete log' })).toHaveAttribute('aria-busy', 'true')
  })

  it('says «Deleting…» and blocks Delete while it runs', async () => {
    const user = userEvent.setup()
    const view = renderLogs()
    await user.click(within(rowOf('a')).getByRole('checkbox', { name: 'Select log' }))
    mocks.hook = buildHook({ deleting: true })
    view.rerender(<ImporterLogs business={business} onGoToImporters={onGoToImporters} />)
    expect(deleteButton()).toHaveTextContent('Deleting…')
    expect(deleteButton()).toBeDisabled()
  })
})

describe('ImporterLogs Download', () => {
  it('calls downloadLog with the log', async () => {
    const user = userEvent.setup()
    renderLogs()
    const button = screen.getByTestId('importers-log-download-a')
    expect(button).toHaveTextContent('Download')
    expect(button).toBeEnabled()
    await user.click(button)
    expect(mocks.hook.downloadLog).toHaveBeenCalledTimes(1)
    expect(mocks.hook.downloadLog).toHaveBeenCalledWith(LOGS[0])
  })

  it('is off, with a reason, when the log cannot be downloaded', async () => {
    const user = userEvent.setup()
    renderLogs()
    const button = screen.getByTestId('importers-log-download-b')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Download unavailable')
    await user.click(button)
    expect(mocks.hook.downloadLog).not.toHaveBeenCalled()
  })

  it('says «Downloading…» on the row that downloads', () => {
    mocks.hook = buildHook({ downloadingId: 'a' })
    renderLogs()
    expect(screen.getByTestId('importers-log-download-a')).toHaveTextContent('Downloading…')
    expect(screen.getByTestId('importers-log-download-a')).toBeDisabled()
    expect(screen.getByTestId('importers-log-download-c')).toHaveTextContent('Download')
  })
})

describe('importerLogsModel', () => {
  it('filters: All and the four importers, in the order of the cards', () => {
    expect(SOURCE_FILTERS.map(filter => filter.id)).toEqual(['all', 'doordash', 'ubereats', 'gloriafood', 'ordering'])
    expect(SOURCE_FILTERS[0]).toMatchObject({ labelKey: 'ALL', labelDefault: 'All' })
  })

  it('formatBytes reads B, KB and MB, and a dash when there is no number', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes('x')).toBe('—')
  })

  it('statusFamily: Ready is done, Too large and Duplicate warn, Failed is an error', () => {
    expect(statusFamily('ready')).toBe('done')
    expect(statusFamily('skipped_too_large')).toBe('pending')
    expect(statusFamily('skipped_duplicate')).toBe('pending')
    expect(statusFamily('failed')).toBe('cancel')
    expect(statusFamily('whatever')).toBe('progress')
    expect(statusFamily(undefined)).toBe('progress')
  })

  it('logStamp turns an ISO instant into the Date parseDate reads, or null', () => {
    expect(logStamp('2026-07-28T12:00:00Z').getTime()).toBe(Date.UTC(2026, 6, 28, 12, 0, 0))
    expect(logStamp('2026-07-28T14:30:15.123+02:00').getTime()).toBe(Date.UTC(2026, 6, 28, 12, 30, 15, 123))
    expect(logStamp('')).toBeNull()
    expect(logStamp(null)).toBeNull()
    expect(logStamp('not a date')).toBeNull()
  })

  it('visibleSelection keeps the ids that are still visible, in order', () => {
    expect(visibleSelection(['a', 'x', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'c'])
    expect(visibleSelection([], ['a'])).toEqual([])
  })

  it('selectionState: true when all visible are selected, mixed when some, false when none or nothing to select', () => {
    expect(selectionState(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(selectionState(['a'], ['a', 'b'])).toBe('mixed')
    expect(selectionState([], ['a', 'b'])).toBe(false)
    expect(selectionState([], [])).toBe(false)
  })
})
