/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen, within, act } from '@testing-library/react'
import dayjs from 'dayjs'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { mockUseImportRawLogsReturn } = vi.hoisted(() => ({
  mockUseImportRawLogsReturn: {
    logs: [
      {
        id: 'log-1',
        source: 'doordash',
        status: 'ready',
        downloadable: true,
        createdAt: '2026-07-28T12:00:00Z',
        compressedBytes: 1200,
        uncompressedBytes: 8000
      },
      {
        id: 'log-2',
        source: 'gloriafood',
        status: 'skipped_too_large',
        downloadable: false,
        createdAt: '2026-07-27T12:00:00Z',
        compressedBytes: null,
        uncompressedBytes: 20_000_000
      }
    ],
    loading: false,
    error: null,
    downloadLog: vi.fn(),
    downloadingId: null,
    deleteLogs: vi.fn(),
    deleting: false,
    refetch: vi.fn()
  }
}))

const { menuSnapshotGet } = vi.hoisted(() => ({
  menuSnapshotGet: vi.fn()
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{
    project: 'demo',
    root: 'https://api.example.com',
    businesses: () => ({ select: () => ({ get: menuSnapshotGet }) })
  }]
}))

vi.mock('../../../Shared', () => ({
  SideBar: ({ children, open }) => (open ? <div data-testid='importers-sidebar'>{children}</div> : null),
  DragScroll: ({ children }) => <div data-testid='importers-logs-drag-scroll'>{children}</div>
}))

vi.mock('../../../styles', () => ({
  Button: ({ children, onClick, disabled, title, ...props }) => (
    <button type='button' onClick={onClick} disabled={disabled} title={title} {...props}>{children}</button>
  ),
  Checkbox: ({ checked, onChange, ...props }) => (
    <input type='checkbox' checked={checked} onChange={onChange} {...props} />
  )
}))

vi.mock('../../Importers/useImportRawLogs.js', () => ({
  useImportRawLogs: () => mockUseImportRawLogsReturn
}))

import { ImportersPanel } from '../index'
import { IMPORTER_CARDS } from '../../Importers/importerCards'
import { saveRun, getRun, RUN_EXPIRES_AFTER_MS } from '../../Importers/menuImportRuns'

const business = { id: 42, name: 'Pizza Pro' }
const runRef = { project: 'demo', businessId: 42, source: 'doordash' }
const startedAt = '2026-10-13T10:32:00.000Z'
const finishedAt = '2026-10-13T10:41:00.000Z'
const timeOf = (iso) => dayjs(iso).format('h:mm A')
const baseRun = {
  status: 'importing',
  startedAt,
  finishedAt: null,
  sourceUrl: 'https://www.doordash.com/store/test',
  appliedCount: null,
  errorMessage: null,
  menuBefore: { categories: 3, products: 120 },
  menuAfter: null
}

const openLogsTab = () => {
  fireEvent.click(screen.getByTestId('importers-panel-tab-logs'))
}

describe('ImportersPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    menuSnapshotGet.mockReset()
    mockUseImportRawLogsReturn.logs = [
      {
        id: 'log-1',
        source: 'doordash',
        status: 'ready',
        downloadable: true,
        createdAt: '2026-07-28T12:00:00Z',
        compressedBytes: 1200,
        uncompressedBytes: 8000
      },
      {
        id: 'log-2',
        source: 'gloriafood',
        status: 'skipped_too_large',
        downloadable: false,
        createdAt: '2026-07-27T12:00:00Z',
        compressedBytes: null,
        uncompressedBytes: 20_000_000
      }
    ]
    mockUseImportRawLogsReturn.loading = false
    mockUseImportRawLogsReturn.error = null
  })

  it('renders business name and all four importer rows', () => {
    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    expect(screen.getByTestId('importers-panel-business-name')).toHaveTextContent('Pizza Pro')
    expect(screen.getByText('Menu importers')).toBeInTheDocument()
    expect(screen.getByTestId('importers-panel-tab-importers')).toBeInTheDocument()
    expect(screen.getByTestId('importers-panel-tab-logs')).toBeInTheDocument()

    IMPORTER_CARDS.forEach((card) => {
      expect(screen.getByTestId(`importer-row-${card.id}`)).toBeInTheDocument()
      expect(screen.getByText(card.titleDefault)).toBeInTheDocument()
      expect(screen.getByText(card.descriptionDefault)).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: 'Import Menu' })).toHaveLength(4)
  })

  it('shows GloriaFood images migration disclaimer', () => {
    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    expect(screen.getByTestId('gloriafood-images-note')).toHaveTextContent(
      'Product images cannot be migrated via the GloriaFood API.'
    )
  })

  it('calls onImportClick with the selected importer card', () => {
    const onImportClick = vi.fn()

    renderWithProviders(
      <ImportersPanel
        open
        business={business}
        onClose={vi.fn()}
        onImportClick={onImportClick}
      />
    )

    const doordashRow = screen.getByTestId('importer-row-doordash')
    fireEvent.click(within(doordashRow).getByRole('button', { name: 'Import Menu' }))

    expect(onImportClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doordash', titleDefault: 'DoorDash' })
    )
  })

  it('shows Logs tab with download-first rows and disabled download for skipped logs', () => {
    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()

    expect(screen.getByTestId('importers-logs-tab')).toBeInTheDocument()
    expect(screen.getByTestId('importers-logs-filters-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('importers-logs-drag-scroll')).toBeInTheDocument()
    expect(screen.getByText('Keeping the latest 10 per importer')).toBeInTheDocument()
    expect(screen.getByTestId('importers-log-row-log-1')).toBeInTheDocument()
    expect(screen.getByTestId('importers-log-download-log-1')).not.toBeDisabled()
    expect(screen.getByTestId('importers-log-download-log-2')).toBeDisabled()
    expect(screen.getByTestId('importers-log-download-log-2')).toHaveAttribute(
      'title',
      'Download unavailable'
    )
  })

  it('shows skeleton rows while logs are loading', () => {
    mockUseImportRawLogsReturn.loading = true
    mockUseImportRawLogsReturn.logs = []

    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()

    expect(screen.getByTestId('importers-logs-skeleton')).toBeInTheDocument()
    expect(screen.getAllByTestId(/importers-logs-skeleton-row-/)).toHaveLength(5)
    expect(screen.queryByTestId('importers-logs-list')).not.toBeInTheDocument()
  })

  it('shows empty state with Go to Importers and switches tabs', () => {
    mockUseImportRawLogsReturn.logs = []

    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()

    expect(screen.getByTestId('importers-logs-empty')).toBeInTheDocument()
    expect(screen.getByText('No import logs yet')).toBeInTheDocument()
    expect(screen.getByTestId('importers-logs-go-to-importers')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('importers-logs-go-to-importers'))

    expect(screen.getByTestId('importers-panel-list')).toBeInTheDocument()
    expect(screen.queryByTestId('importers-logs-tab')).not.toBeInTheDocument()
  })

  it('filters logs by source chip', () => {
    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()
    fireEvent.click(screen.getByTestId('importers-logs-filter-gloriafood'))

    expect(screen.queryByTestId('importers-log-row-log-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('importers-log-row-log-2')).toBeInTheDocument()
  })

  it('shows selection bar with select all and delete controls', () => {
    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()

    expect(screen.getByTestId('importers-logs-selection-bar')).toBeInTheDocument()
    expect(screen.getByTestId('importers-logs-select-all')).toBeInTheDocument()
    expect(screen.getByTestId('importers-logs-delete-selected')).toBeDisabled()
  })

  it('select all checks visible rows and calls deleteLogs with selected ids', async () => {
    mockUseImportRawLogsReturn.deleteLogs.mockResolvedValue({
      deleted: 2,
      ids: ['log-1', 'log-2']
    })

    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()
    fireEvent.click(screen.getByTestId('importers-logs-select-all'))

    expect(screen.getByTestId('importers-log-select-log-1')).toBeChecked()
    expect(screen.getByTestId('importers-log-select-log-2')).toBeChecked()
    expect(screen.getByTestId('importers-logs-delete-selected')).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(screen.getByTestId('importers-logs-delete-selected'))
    })

    expect(mockUseImportRawLogsReturn.deleteLogs).toHaveBeenCalledWith(['log-1', 'log-2'])
  })

  it('shows filter-empty message when no logs match the selected source', () => {
    mockUseImportRawLogsReturn.logs = [
      {
        id: 'log-1',
        source: 'doordash',
        status: 'ready',
        downloadable: true,
        createdAt: '2026-07-28T12:00:00Z',
        compressedBytes: 1200,
        uncompressedBytes: 8000
      }
    ]

    renderWithProviders(
      <ImportersPanel open business={business} onClose={vi.fn()} />
    )

    openLogsTab()
    fireEvent.click(screen.getByTestId('importers-logs-filter-gloriafood'))

    expect(screen.getByTestId('importers-logs-filter-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('importers-logs-go-to-importers')).not.toBeInTheDocument()
  })

  describe('import run status line', () => {
    const statusOf = (source = 'doordash') =>
      within(screen.getByTestId(`importer-row-${source}`)).queryByTestId('importer-run-status')
    const checkedAt = '2026-10-13T11:05:00.000Z'
    const clockAt = (iso, offsetMs = 0) => {
      vi.useRealTimers()
      vi.useFakeTimers({ now: Date.parse(iso) + offsetMs, toFake: ['Date'] })
    }
    const menuWith = (products, categories = 1) => ({
      content: { error: false, result: { id: 42, categories: Array.from({ length: categories }, (_, i) => ({ id: i })), available_products_count: products } }
    })
    const render = (props = {}) =>
      renderWithProviders(<ImportersPanel open business={business} onClose={vi.fn()} {...props} />)

    // Runs expire a day after their last activity: every test reads the clock near its fixtures.
    beforeEach(() => {
      clockAt(finishedAt, 60_000)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows nothing without a run', () => {
      render()

      expect(statusOf()).not.toBeInTheDocument()
    })

    it('shows Importing since the start time', () => {
      clockAt(startedAt, 60_000)
      saveRun(runRef, baseRun)

      render()

      expect(statusOf()).toHaveTextContent(`Importing since ${timeOf(startedAt)}`)
      expect(statusOf()).toHaveAttribute('data-tone', 'progress')
      expect(statusOf('ubereats')).not.toBeInTheDocument()
    })

    it('shows Completed with the menu counts after the import', () => {
      clockAt(finishedAt, 60_000)
      saveRun(runRef, {
        ...baseRun,
        status: 'success',
        finishedAt,
        appliedCount: 1,
        menuAfter: { categories: 12, products: 120 }
      })

      render()

      expect(statusOf()).toHaveTextContent(`Completed ${timeOf(finishedAt)} · 12 categories, 120 products`)
      expect(statusOf()).toHaveAttribute('data-tone', 'success')
    })

    it('shows Failed with the message and a Retry that opens the importer', () => {
      const onImportClick = vi.fn()
      saveRun(runRef, {
        ...baseRun,
        status: 'failed',
        finishedAt,
        errorMessage: 'Check the import details and try again.'
      })

      render({ onImportClick })

      expect(statusOf()).toHaveTextContent(
        `Failed ${timeOf(finishedAt)} — Check the import details and try again.`
      )
      expect(statusOf()).toHaveAttribute('data-tone', 'danger')
      fireEvent.click(within(statusOf()).getByRole('button', { name: 'Retry' }))
      expect(onImportClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'doordash' }))
    })

    it('reads a lost connection as "may still be running", never as unknown', () => {
      clockAt(startedAt, 16 * 60_000)
      saveRun(runRef, baseRun)

      render()

      expect(statusOf()).toHaveTextContent(
        `Connection lost — the import may still be running. Started ${timeOf(startedAt)}`
      )
      expect(statusOf()).toHaveAttribute('data-tone', 'warning')
      expect(statusOf()).not.toHaveTextContent(/unknown/i)
      expect(within(statusOf()).getByRole('button', { name: 'Check now' })).toBeInTheDocument()
    })

    it('shows Checking… and disables the button while the menu is being read', async () => {
      saveRun(runRef, { ...baseRun, status: 'unknown' })
      let resolveGet
      menuSnapshotGet.mockReturnValue(new Promise((resolve) => { resolveGet = resolve }))

      render()

      await act(async () => {
        fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
      })

      expect(within(statusOf()).getByRole('button', { name: 'Checking…' })).toBeDisabled()

      await act(async () => {
        resolveGet(menuWith(120))
      })

      expect(within(statusOf()).getByRole('button', { name: 'Check now' })).not.toBeDisabled()
    })

    it('resolves the line when Check now sees the menu grew, without claiming Completed', async () => {
      clockAt(checkedAt)
      saveRun(runRef, { ...baseRun, status: 'unknown' })
      menuSnapshotGet.mockResolvedValue(menuWith(180))

      const { unmount } = render()

      await act(async () => {
        fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
      })

      expect(statusOf()).toHaveTextContent(
        `Menu grew from 120 to 180 products after the import · checked ${timeOf(checkedAt)}`
      )
      expect(statusOf()).toHaveAttribute('data-tone', 'success')
      expect(statusOf()).not.toHaveTextContent(/unknown|Completed/i)
      expect(within(statusOf()).queryByRole('button', { name: 'Check now' })).not.toBeInTheDocument()
      expect(within(statusOf()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
      expect(getRun(runRef)).toMatchObject({ status: 'unknown', checkedAt, menuAfter: { categories: 1, products: 180 } })

      unmount()
      render()

      expect(statusOf()).toHaveTextContent(`Menu grew from 120 to 180 products after the import · checked ${timeOf(checkedAt)}`)
      expect(menuSnapshotGet).toHaveBeenCalledTimes(1)
    })

    it('keeps "may still be running" with the check time when the menu did not change', async () => {
      clockAt(checkedAt)
      saveRun(runRef, { ...baseRun, status: 'unknown' })
      menuSnapshotGet.mockResolvedValue(menuWith(120, 3))

      render()

      await act(async () => {
        fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
      })

      expect(statusOf()).toHaveTextContent(
        `No menu changes yet — the import may still be running. Checked ${timeOf(checkedAt)}`
      )
      expect(statusOf()).toHaveAttribute('data-tone', 'warning')
      expect(statusOf()).not.toHaveTextContent(/unknown/i)
      expect(within(statusOf()).getByRole('button', { name: 'Check now' })).toBeInTheDocument()
    })

    it('reports the current counts when there was no pre-import snapshot to compare with', async () => {
      clockAt(checkedAt)
      saveRun(runRef, { ...baseRun, status: 'unknown', menuBefore: null })
      menuSnapshotGet.mockResolvedValue(menuWith(36, 2))

      render()

      await act(async () => {
        fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
      })

      expect(statusOf()).toHaveTextContent(
        `The import may still be running — 2 categories, 36 products now. Checked ${timeOf(checkedAt)}`
      )
      expect(statusOf()).toHaveAttribute('data-tone', 'warning')
    })

    it('does not persist a failed check and says the menu could not be read', async () => {
      saveRun(runRef, { ...baseRun, status: 'unknown' })
      menuSnapshotGet.mockRejectedValue(new Error('network'))

      render()

      await act(async () => {
        fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
      })

      expect(statusOf()).toHaveTextContent('Could not check the menu right now.')
      expect(getRun(runRef).checkedAt).toBeUndefined()
      expect(statusOf()).toHaveTextContent(`Connection lost — the import may still be running. Started ${timeOf(startedAt)}`)
    })

    it('Dismiss clears the run and hides the line', () => {
      saveRun(runRef, { ...baseRun, status: 'unknown' })

      render()

      fireEvent.click(within(statusOf()).getByRole('button', { name: 'Dismiss' }))

      expect(statusOf()).not.toBeInTheDocument()
      expect(getRun(runRef)).toBeNull()
    })

    it('offers Dismiss on success and failed, never while importing', () => {
      clockAt(startedAt, 60_000)
      saveRun(runRef, baseRun)
      const { unmount } = render()
      expect(statusOf()).toHaveTextContent('Importing since')
      expect(within(statusOf()).queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
      unmount()

      clockAt(finishedAt, 60_000)
      saveRun(runRef, { ...baseRun, status: 'success', finishedAt, menuAfter: { categories: 1, products: 1 } })
      const second = render()
      expect(within(statusOf()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
      second.unmount()

      saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
      render()
      expect(within(statusOf()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    })

    it('hides the line of the importer whose modal is open, so the status is not shown twice', () => {
      saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
      saveRun({ ...runRef, source: 'ubereats' }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })

      const { rerender } = render({ openImporterId: 'doordash' })

      expect(statusOf()).not.toBeInTheDocument()
      expect(statusOf('ubereats')).toBeInTheDocument()

      rerender(<ImportersPanel open business={business} onClose={vi.fn()} openImporterId={null} />)

      expect(statusOf()).toBeInTheDocument()
    })

    it('hides every run a day after its last activity, including failed and pending ones', () => {
      clockAt(finishedAt, RUN_EXPIRES_AFTER_MS + 1)
      saveRun(runRef, { ...baseRun, status: 'success', finishedAt, menuAfter: { categories: 1, products: 1 } })
      const { unmount } = render()
      expect(statusOf()).not.toBeInTheDocument()
      unmount()

      clockAt(checkedAt, RUN_EXPIRES_AFTER_MS + 1)
      saveRun(runRef, { ...baseRun, status: 'unknown', checkedAt, menuAfter: { categories: 3, products: 180 } })
      const second = render()
      expect(statusOf()).not.toBeInTheDocument()
      second.unmount()

      clockAt(finishedAt, RUN_EXPIRES_AFTER_MS + 1)
      saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
      const third = render()
      expect(statusOf()).not.toBeInTheDocument()
      third.unmount()

      // A pending run checked within the last day stays visible.
      clockAt(checkedAt, RUN_EXPIRES_AFTER_MS - 1)
      saveRun(runRef, { ...baseRun, status: 'unknown', checkedAt, menuAfter: { categories: 1, products: 120 } })
      render()
      expect(statusOf()).toHaveTextContent('No menu changes yet')
    })
  })

  it('does not render when closed', () => {
    renderWithProviders(
      <ImportersPanel open={false} business={business} onClose={vi.fn()} />
    )

    expect(screen.queryByTestId('importers-sidebar')).not.toBeInTheDocument()
  })
})
