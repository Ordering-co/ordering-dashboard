/* eslint-disable import/first */
// redesign IM-B (decision D2): the store panel of /connect/importers. No controller and no request of its own: the
// panel is given the row of the list. The Product wrappers (RecordPanel, Tabs, Button) are the real ones; ImporterLogs and the
// two import dialogs (batch C) are stubs that paint a `data-testid` and call back, so this test pins what the PANEL does with them.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  split: { mode: 'split', open: true },
  logsMounts: 0,
  menuDialog: null,
  gloriaDialog: null,
  // the Ordering API the run status reads the menu with (main sync, ): `get` answers the «Check now» read
  api: {
    project: 'demo',
    root: 'https://api.example.com',
    businesses: () => ({ select: () => ({ get: (...args) => mocks.menuGet(...args) }) })
  },
  menuGet: () => Promise.resolve({ content: { error: true } })
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [mocks.api]
}))
vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [mocks.api]
}))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    useSplitView: () => ({
      expanded: false,
      onClose: () => {},
      requestClose: () => {},
      registerCloseGuard: () => () => {},
      getEscapedField: () => null,
      ...mocks.split
    })
  }
})
vi.mock('../ImporterLogs', () => ({
  ImporterLogs: ({ business, onGoToImporters }) => {
    mocks.logsMounts += 1
    return (
      <div data-testid='logs-stub' data-business={business.id}>
        <button type='button' onClick={onGoToImporters}>logs-go-importers</button>
      </div>
    )
  }
}))
vi.mock('../MenuImportDialog', () => ({
  MenuImportDialog: (props) => {
    mocks.menuDialog = props
    return (
      <div data-testid='menu-dialog-stub' data-card={props.card.id} data-open={String(props.open)}>
        <button type='button' onClick={props.onClose}>menu-stub-close</button>
      </div>
    )
  }
}))
vi.mock('../GloriaFoodImportDialog', () => ({
  GloriaFoodImportDialog: (props) => {
    mocks.gloriaDialog = props
    return (
      <div data-testid='gloria-dialog-stub' data-open={String(props.open)}>
        <button type='button' onClick={props.onClose}>gloria-stub-close</button>
      </div>
    )
  }
}))

import dayjs from 'dayjs'
import { ImporterRows, ImporterStorePanel } from '../ImporterStorePanel'
import { IMPORTER_CARDS } from '../importerCards'
import { clearRun, getRun, saveRun } from '../menuImportRuns'

const business = { id: 7, name: 'Fast Bite', city: { name: 'Miami' } }

let onClose
let onExpandedChange
const renderPanel = (props = {}) => render(
  <ImporterStorePanel
    business={business}
    expanded={false}
    onExpandedChange={onExpandedChange}
    onClose={onClose}
    {...props}
  />
)

beforeEach(() => {
  mocks.split = { mode: 'split', open: true }
  mocks.logsMounts = 0
  mocks.menuDialog = null
  mocks.gloriaDialog = null
  mocks.menuGet = () => Promise.resolve({ content: { error: true } })
  window.localStorage.clear()
  onClose = vi.fn()
  onExpandedChange = vi.fn()
  global.fetch = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ImporterStorePanel header', () => {
  it('names the store, with the city as the subtitle', () => {
    renderPanel()
    expect(screen.getByTestId('importer-store-panel')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fast Bite')
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('Miami')
  })

  it('falls back to «Business» when the store has no name, and has no subtitle without a city', () => {
    renderPanel({ business: { id: 8, name: '', city: null } })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Business')
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
  })

  it('Close calls onClose', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('on a phone the way out is «Back» and there is no expand button', async () => {
    mocks.split = { mode: 'full', open: true }
    const user = userEvent.setup()
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('expands and collapses as PosStorePanel does', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    rerender(<ImporterStorePanel business={business} expanded onExpandedChange={onExpandedChange} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  })
})

describe('ImporterStorePanel Importers tab', () => {
  it('opens on Importers, with the tab strip named', () => {
    renderPanel()
    expect(screen.getByRole('tablist', { name: 'Store importers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Importers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { level: 3, name: 'Menu importers' })).toBeInTheDocument()
  })

  it('lists the four importers in main order, with the images note only on GloriaFood', () => {
    renderPanel()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'importer-row-doordash',
      'importer-row-ubereats',
      'importer-row-gloriafood',
      'importer-row-ordering'
    ])
    expect(within(rows[0]).getByText('DoorDash')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Import menu from a DoorDash store URL')).toBeInTheDocument()
    expect(within(rows[3]).getByText('Ordering.co')).toBeInTheDocument()
    const note = 'Product images cannot be migrated via the GloriaFood API.'
    expect(within(rows[2]).getByText(note)).toBeInTheDocument()
    expect(screen.getAllByText(note)).toHaveLength(1)
  })

  it('every row has an «Import Menu» button named after its importer, and a decorative logo', () => {
    renderPanel()
    for (const [id, name] of [['doordash', 'DoorDash'], ['ubereats', 'Uber Eats'], ['gloriafood', 'GloriaFood'], ['ordering', 'Ordering.co']]) {
      const button = screen.getByTestId(`importer-import-${id}`)
      expect(button).toHaveTextContent('Import Menu')
      expect(button).toHaveAccessibleName(`Import menu from ${name}`)
      expect(within(screen.getByTestId(`importer-row-${id}`)).getByText(/^(DD|UE|GF|OC)$/)).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('«Import Menu» of DoorDash opens the menu dialog with its card and the store', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(screen.queryByTestId('menu-dialog-stub')).toBeNull()
    await user.click(screen.getByTestId('importer-import-doordash'))
    const stub = screen.getByTestId('menu-dialog-stub')
    expect(stub).toHaveAttribute('data-card', 'doordash')
    expect(stub).toHaveAttribute('data-open', 'true')
    expect(mocks.menuDialog.business).toBe(business)
    expect(mocks.menuDialog.card.id).toBe('doordash')
    expect(screen.queryByTestId('gloria-dialog-stub')).toBeNull()
  })

  it('Uber Eats and Ordering.co open the same dialog with their own card', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('importer-import-ubereats'))
    expect(screen.getByTestId('menu-dialog-stub')).toHaveAttribute('data-card', 'ubereats')
    await user.click(screen.getByText('menu-stub-close'))
    await user.click(screen.getByTestId('importer-import-ordering'))
    expect(screen.getByTestId('menu-dialog-stub')).toHaveAttribute('data-card', 'ordering')
  })

  it('«Import Menu» of GloriaFood opens the GloriaFood dialog, not the menu one', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('importer-import-gloriafood'))
    expect(screen.getByTestId('gloria-dialog-stub')).toHaveAttribute('data-open', 'true')
    expect(mocks.gloriaDialog.business).toBe(business)
    expect(mocks.gloriaDialog.card.id).toBe('gloriafood')
    expect(screen.queryByTestId('menu-dialog-stub')).toBeNull()
  })

  it('the dialog opens over the panel: the panel stays', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('importer-import-doordash'))
    expect(screen.getByTestId('importer-store-panel')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closing the dialog gives the focus back to the button that opened it', async () => {
    const user = userEvent.setup()
    renderPanel()
    const opener = screen.getByTestId('importer-import-ubereats')
    await user.click(opener)
    await user.click(screen.getByText('menu-stub-close'))
    expect(screen.queryByTestId('menu-dialog-stub')).toBeNull()
    expect(opener).toHaveFocus()

    const gloria = screen.getByTestId('importer-import-gloriafood')
    await user.click(gloria)
    await user.click(screen.getByText('gloria-stub-close'))
    expect(gloria).toHaveFocus()
  })
})

describe('ImporterStorePanel Logs tab', () => {
  it('does not mount ImporterLogs until the tab is pressed (its requests wait for the first visit)', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(screen.queryByTestId('logs-stub')).toBeNull()
    expect(mocks.logsMounts).toBe(0)
    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(screen.getByTestId('logs-stub')).toHaveAttribute('data-business', '7')
    expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute('aria-selected', 'true')
  })

  // redesign IM-R1-2 (review r1 #2): main mounted the Logs tab on every visit, so an import made meanwhile shows up
  it('mounts ImporterLogs again on every visit (the logs are asked for again, as in main), and «Go to Importers» goes back', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(mocks.logsMounts).toBe(1)
    await user.click(screen.getByRole('tab', { name: 'Importers' }))
    expect(screen.queryByTestId('logs-stub')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(mocks.logsMounts).toBe(2)
    await user.click(screen.getByText('logs-go-importers'))
    expect(screen.getByRole('tab', { name: 'Importers' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('ImporterStorePanel requests', () => {
  it('makes none on its own: not on mount, not on the tabs', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    await user.click(screen.getByRole('tab', { name: 'Importers' }))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// main sync: the run status line of each importer row, ported from main's ImportersPanel (ImporterRow + ImportRunStatus).
// ImporterRunStatus has its own spec (ImporterRunStatus.test.jsx); this one pins how the PANEL wires it: whose run, which dialog
// hides it, what Retry does, and the reusable `ImporterRows`.
describe('ImporterStorePanel run status', () => {
  const runRef = { project: 'demo', businessId: 7, source: 'doordash' }
  const startedAt = '2026-10-13T10:32:00.000Z'
  const finishedAt = '2026-10-13T10:41:00.000Z'
  const checkedAt = '2026-10-13T11:05:00.000Z'
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
  const clockAt = (iso, offsetMs = 0) => {
    vi.useRealTimers()
    vi.useFakeTimers({ now: Date.parse(iso) + offsetMs, toFake: ['Date'] })
  }
  const statusOf = (source = 'doordash') => within(screen.getByTestId(`importer-row-${source}`)).queryByTestId('importer-run-status')
  const menuWith = (products, categories = 1) => ({
    content: { error: false, result: { id: 7, categories: Array.from({ length: categories }, (_, i) => ({ id: i })), available_products_count: products } }
  })

  beforeEach(() => {
    clearRun(runRef)
    clockAt(finishedAt, 60_000)
  })

  it('shows no status line on a row without a run', () => {
    renderPanel()
    expect(screen.queryByTestId('importer-run-status')).toBeNull()
  })

  it('a row with a stored importing run shows «Importing since…», and only that row', () => {
    clockAt(startedAt, 60_000)
    saveRun(runRef, baseRun)
    renderPanel()
    expect(statusOf()).toHaveTextContent(`Importing since ${timeOf(startedAt)}`)
    expect(statusOf()).toHaveAttribute('data-tone', 'progress')
    expect(statusOf('ubereats')).toBeNull()
    expect(statusOf('gloriafood')).toBeNull()
  })

  it('reads the run of this store: the run of another store is not shown', () => {
    saveRun({ ...runRef, businessId: 99 }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderPanel()
    expect(screen.queryByTestId('importer-run-status')).toBeNull()
  })

  it('Dismiss clears the stored run', async () => {
    const user = userEvent.setup()
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    renderPanel()
    await user.click(within(statusOf()).getByRole('button', { name: 'Dismiss' }))
    expect(statusOf()).toBeNull()
    expect(getRun(runRef)).toBeNull()
  })

  it('Check now closes the run as failed when the menu did not grow, as main does', async () => {
    clockAt(checkedAt)
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    mocks.menuGet = () => Promise.resolve(menuWith(120, 3))
    renderPanel()
    await act(async () => {
      fireEvent.click(within(statusOf()).getByRole('button', { name: 'Check now' }))
    })
    expect(statusOf()).toHaveTextContent(`Failed ${timeOf(checkedAt)} — The menu did not grow, so the import did not finish.`)
    expect(getRun(runRef)).toMatchObject({ status: 'failed', finishedAt: checkedAt })
  })

  it('a run past its expiry reads as no run', () => {
    clockAt(finishedAt, 2 * 60 * 60 * 1000)
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderPanel()
    expect(statusOf()).toBeNull()
  })

  it('hides the status of the importer whose dialog is open, and shows it again when the dialog closes', async () => {
    const user = userEvent.setup()
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    saveRun({ ...runRef, source: 'ubereats' }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderPanel()
    expect(statusOf()).toBeInTheDocument()
    await user.click(screen.getByTestId('importer-import-doordash'))
    expect(screen.getByTestId('menu-dialog-stub')).toBeInTheDocument()
    expect(statusOf()).toBeNull()
    expect(statusOf('ubereats')).toBeInTheDocument()
    await user.click(screen.getByText('menu-stub-close'))
    expect(statusOf()).toBeInTheDocument()
  })

  it('Retry of a failed run opens the dialog of that importer, and closing it gives the focus to its «Import Menu» button', async () => {
    const user = userEvent.setup()
    saveRun({ ...runRef, source: 'ubereats' }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderPanel()
    await user.click(within(statusOf('ubereats')).getByRole('button', { name: 'Retry' }))
    expect(screen.getByTestId('menu-dialog-stub')).toHaveAttribute('data-card', 'ubereats')
    expect(mocks.menuDialog.business).toBe(business)
    await user.click(screen.getByText('menu-stub-close'))
    expect(screen.getByTestId('importer-import-ubereats')).toHaveFocus()
  })

  it('makes no request of its own for the run: only «Check now» reads the menu', async () => {
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    const get = vi.fn(() => Promise.resolve(menuWith(120, 3)))
    mocks.menuGet = get
    renderPanel()
    expect(get).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('ImporterRows', () => {
  it('is the row list of the panel, reusable: the four importers, onOpen with the card and the button, no panel around it', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<ImporterRows business={business} onOpen={onOpen} openImporterId={null} />)
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual(IMPORTER_CARDS.map(({ id }) => `importer-row-${id}`))
    const button = screen.getByTestId('importer-import-ubereats')
    await user.click(button)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'ubereats' }), button)
  })

  it('hides the status of `openImporterId` only', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-13T10:42:00.000Z'), toFake: ['Date'] })
    const failed = { status: 'failed', startedAt: '2026-10-13T10:32:00.000Z', finishedAt: '2026-10-13T10:41:00.000Z', errorMessage: 'Boom' }
    saveRun({ project: 'demo', businessId: 7, source: 'doordash' }, failed)
    saveRun({ project: 'demo', businessId: 7, source: 'ubereats' }, failed)
    render(<ImporterRows business={business} onOpen={() => {}} openImporterId='doordash' />)
    expect(screen.getAllByTestId('importer-run-status')).toHaveLength(1)
    expect(within(screen.getByTestId('importer-row-ubereats')).getByTestId('importer-run-status')).toBeInTheDocument()
  })
})
