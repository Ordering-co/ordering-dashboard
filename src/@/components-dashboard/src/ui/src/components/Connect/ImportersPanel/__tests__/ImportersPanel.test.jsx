/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, within, act } from '@testing-library/react'

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

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
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

const business = { id: 42, name: 'Pizza Pro' }

const openLogsTab = () => {
  fireEvent.click(screen.getByTestId('importers-panel-tab-logs'))
}

describe('ImportersPanel', () => {
  beforeEach(() => {
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

  it('does not render when closed', () => {
    renderWithProviders(
      <ImportersPanel open={false} business={business} onClose={vi.fn()} />
    )

    expect(screen.queryByTestId('importers-sidebar')).not.toBeInTheDocument()
  })
})
