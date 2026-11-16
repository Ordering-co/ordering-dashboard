/* eslint-disable import/first */
// (main sync, 6f58d106 · ): the empty-store start guide offers «Import your menu» and main mounts
// `BusinessImporters` over the catalog. In the redesign it is a P/Sheet with the importer rows of /connect/importers
// (`ImporterRows`) and the two redesigned dialogs, not main's `ImportersPanel` + modals. The Product wrappers are the real
// ones; the run state of an import (`useMenuImport`), the run status of a row and the Ordering API are the only stubs.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logsMounts: 0,
  push: vi.fn(),
  triggerImport: vi.fn(),
  reset: vi.fn(),
  fetchSync: vi.fn(),
  state: { isImporting: false, status: 'idle', error: null, result: null, startedAt: null }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }]
}))
vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'tok-1' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }]
}))
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: mocks.push })
}))
vi.mock('../../Importers/useMenuImport', () => ({
  useMenuImport: () => ({ triggerImport: mocks.triggerImport, reset: mocks.reset, ...mocks.state })
}))
vi.mock('../../Importers/logMenuImportSync', async (importActual) => ({
  ...(await importActual()),
  fetchMenuImportSync: (...args) => mocks.fetchSync(...args)
}))
// the run status of a row reads the menu of the store: not what this test pins
vi.mock('../../Importers/ImporterRunStatus', () => ({ ImporterRunStatus: () => null }))
// the raw import logs of the store (main's «Logs» tab, ImportRawLogsTab): what this test pins is that the Sheet offers them
vi.mock('../../Importers/ImporterLogs', () => ({
  ImporterLogs: ({ business, onGoToImporters }) => {
    mocks.logsMounts += 1
    return (
      <div data-testid='logs-stub' data-business={business.id}>
        <button type='button' onClick={onGoToImporters}>logs-go-importers</button>
      </div>
    )
  }
}))

import { BusinessImporters } from '../index'

const business = { id: 42, name: 'Fast Bite', slug: 'fast-bite' }

let onClose
let onGoToProducts
const renderImporters = (props = {}) => render(
  <BusinessImporters open business={business} onClose={onClose} onGoToProducts={onGoToProducts} {...props} />
)
const importButton = (name) => screen.getByRole('button', { name: `Import menu from ${name}` })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.logsMounts = 0
  window.localStorage.clear()
  mocks.state = { isImporting: false, status: 'idle', error: null, result: null, startedAt: null }
  mocks.fetchSync.mockResolvedValue(null)
  mocks.triggerImport.mockResolvedValue(undefined)
  onClose = vi.fn()
  onGoToProducts = vi.fn()
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('BusinessImporters (the importers of an empty store, )', () => {
  it('returns nothing without a store', () => {
    const { container } = renderImporters({ business: undefined })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a Sheet with the importer rows of /connect/importers, not main’s importers panel', async () => {
    renderImporters()

    const sheet = await screen.findByRole('dialog', { name: 'Menu importers' })
    expect(sheet).toHaveClass('odc-sheet')
    expect(within(sheet).getByText('Fast Bite')).toBeInTheDocument()
    for (const name of ['DoorDash', 'Uber Eats', 'GloriaFood', 'Ordering.co']) {
      expect(within(sheet).getByRole('button', { name: `Import menu from ${name}` })).toBeInTheDocument()
    }
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(4)
    // nothing of main's panel: no legacy SideBar (the tabs are Product's, see the Logs tests below)
    expect(document.querySelector('[class*="SideBar"]')).toBeNull()
  })

  it('draws nothing while it is closed', () => {
    renderImporters({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closing the Sheet calls onClose', async () => {
    const user = userEvent.setup()
    renderImporters()

    const sheet = await screen.findByRole('dialog', { name: 'Menu importers' })
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGoToProducts).not.toHaveBeenCalled()
  })

  it('an importer opens its redesigned import dialog over the Sheet', async () => {
    const user = userEvent.setup()
    renderImporters()

    await user.click(await screen.findByRole('button', { name: 'Import menu from DoorDash' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import from DoorDash' })
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(dialog).not.toHaveClass('odc-sheet')
  })

  it('GloriaFood opens the GloriaFood dialog, not the URL one', async () => {
    const user = userEvent.setup()
    renderImporters()

    await user.click(await screen.findByRole('button', { name: 'Import menu from GloriaFood' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import from GloriaFood' })
    expect(dialog).not.toHaveClass('odc-sheet')
    expect(screen.queryByRole('dialog', { name: 'Import from DoorDash' })).toBeNull()
  })

  it('closing the import dialog gives the focus back to the button of its row and keeps the Sheet', async () => {
    const user = userEvent.setup()
    renderImporters()

    const opener = await screen.findByRole('button', { name: 'Import menu from Uber Eats' })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Import from Uber Eats' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Import from Uber Eats' })).toBeNull())
    await waitFor(() => expect(importButton('Uber Eats')).toHaveFocus())
    expect(screen.getByRole('dialog', { name: 'Menu importers' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('«Go to products» in the dialog hands it to onGoToProducts, and does not navigate', async () => {
    const user = userEvent.setup()
    mocks.state = { ...mocks.state, status: 'success', result: { appliedCount: 3, jobId: 'job-1' } }
    renderImporters()

    await user.click(await screen.findByRole('button', { name: 'Import menu from DoorDash' }))
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))

    expect(onGoToProducts).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Import from DoorDash' })).toBeNull())
  })

  // main's panel had two tabs, Importers and Logs (ImportRawLogsTab): the products-page entry keeps both
  it('offers the import logs of the store in a Logs tab, as main’s panel did', async () => {
    const user = userEvent.setup()
    renderImporters()

    const sheet = await screen.findByRole('dialog', { name: 'Menu importers' })
    const tabs = within(sheet).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Importers', 'Logs'])
    expect(within(sheet).getByRole('tab', { name: 'Importers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('logs-stub')).toBeNull()

    await user.click(within(sheet).getByRole('tab', { name: 'Logs' }))
    expect(await within(sheet).findByTestId('logs-stub')).toHaveAttribute('data-business', '42')
    expect(within(sheet).getByRole('tab', { name: 'Logs' })).toHaveAttribute('aria-selected', 'true')
  })

  it('the Logs tab mounts on every visit, and «go to importers» from its empty state goes back to the rows', async () => {
    const user = userEvent.setup()
    renderImporters()

    const sheet = await screen.findByRole('dialog', { name: 'Menu importers' })
    await user.click(within(sheet).getByRole('tab', { name: 'Logs' }))
    expect(mocks.logsMounts).toBeGreaterThan(0)
    await user.click(within(sheet).getByRole('button', { name: 'logs-go-importers' }))

    expect(within(sheet).getByRole('tab', { name: 'Importers' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(screen.queryByTestId('logs-stub')).toBeNull())
    expect(within(sheet).getByRole('button', { name: 'Import menu from DoorDash' })).toBeVisible()
  })
})
