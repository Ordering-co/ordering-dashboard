/* eslint-disable import/first */
// one import into several stores from the import dialogs. The menu-import service already takes `businessIds`
// and answers store by store (appliedCount, partialFailures, a quota cut). Synthetic stores only: no real project.
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  triggerImport: vi.fn(),
  reset: vi.fn(),
  state: { isImporting: false, status: 'idle', error: null, result: null, startedAt: null },
  stores: []
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'tok-1' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  useUtils: () => [{ parseDate: (date) => date.toISOString() }],
  // the store list of the project, as DashboardBusinessList hands it to its UIComponent
  DashboardBusinessList: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      businessList={{ loading: false, error: null, businesses: mocks.stores }}
      pagination={{ currentPage: 1, pageSize: 10, totalItems: mocks.stores.length, totalPages: 1 }}
      onSearch={() => {}}
      getPageBusinesses={() => {}}
    />
  )
}))
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: vi.fn() }) }))
vi.mock('../useMenuImport', () => ({
  useMenuImport: () => ({ triggerImport: mocks.triggerImport, reset: mocks.reset, ...mocks.state })
}))
vi.mock('../logMenuImportSync', async (importActual) => ({
  ...(await importActual()),
  fetchMenuImportSync: async () => null
}))

import { IMPORTER_CARDS } from '../importerCards'
import { MenuImportDialog } from '../MenuImportDialog'
import { GloriaFoodImportDialog } from '../GloriaFoodImportDialog'

const business = { id: 42, name: 'Fast Bite', slug: 'fast-bite' }
const DOORDASH_URL = 'https://www.doordash.com/store/fast-bite-123'
const card = IMPORTER_CARDS.find(({ id }) => id === 'doordash')

const renderDialog = () => render(<MenuImportDialog open card={card} business={business} onClose={vi.fn()} />)

const pickStores = async (user, ...names) => {
  await user.click(screen.getByRole('button', { name: 'Import into more stores' }))
  const list = await screen.findByRole('list', { name: 'Stores' })
  for (const name of names) await user.click(within(list).getByRole('checkbox', { name }))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.state = { isImporting: false, status: 'idle', error: null, result: null, startedAt: null }
  mocks.stores = [
    { id: 42, name: 'Fast Bite' },
    { id: 7, name: 'Pizza Two' },
    { id: 8, name: 'Taco Three' }
  ]
  mocks.triggerImport.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('MenuImportDialog — several stores', () => {
  it('with one store nothing changes: no store list until asked, and the same request and text', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('list', { name: 'Stores' })).toBeNull()
    expect(within(dialog).getByText('The menu is imported into Fast Bite. This can take a few minutes.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('DoorDash store URL'), DOORDASH_URL)
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(mocks.triggerImport.mock.calls[0][0].businessIds).toEqual([42])
  })

  it('sends every chosen store in businessIds and says how many will get the menu', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    await pickStores(user, 'Pizza Two', 'Taco Three')
    expect(within(dialog).getByText('3 of 10 stores selected')).toBeInTheDocument()
    expect(within(dialog).getByText('The menu is imported into 3 stores. This can take a few minutes.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('DoorDash store URL'), DOORDASH_URL)
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(mocks.triggerImport.mock.calls[0][0]).toMatchObject({ doordashUrl: DOORDASH_URL, businessIds: [42, 7, 8] })
  })

  it('Select all takes the stores on screen up to the limit of 10, and the limit is visible', async () => {
    const user = userEvent.setup()
    mocks.stores = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Store ${index + 1}` }))
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Import into more stores' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Select all' }))
    // review of #437 (5): the cap is said in a live region when it is reached
    expect(within(dialog).getByText('10 of 10 stores selected. That is the most one import can take.')).toHaveAttribute('aria-live', 'polite')
    const list = within(dialog).getByRole('list', { name: 'Stores' })
    expect(within(list).getByRole('checkbox', { name: 'Store 11' })).not.toBeChecked()
    // the 11th store cannot join
    await user.click(within(list).getByRole('checkbox', { name: 'Store 11' }))
    expect(within(list).getByRole('checkbox', { name: 'Store 11' })).not.toBeChecked()
  })

  // review of #437 (5)
  it('opening the store list puts the focus on its search', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Import into more stores' }))
    expect(screen.getByRole('searchbox', { name: 'Search stores' })).toHaveFocus()
  })

  // review of #437 (1): one store that is not the dialog's is the one named
  it('with only another store chosen, the header and the notice name that store', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    await pickStores(user, 'Fast Bite', 'Pizza Two')
    expect(dialog.querySelector('.odc-imp-store-name')).toHaveTextContent('Pizza Two')
    expect(within(dialog).getByText('The menu is imported into Pizza Two. This can take a few minutes.')).toBeInTheDocument()
  })

  it('without any store chosen Import stays disabled', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    await pickStores(user, 'Fast Bite')
    await user.type(within(dialog).getByLabelText('DoorDash store URL'), DOORDASH_URL)
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  const importInto = async (user, outcome, status = 'partial') => {
    mocks.triggerImport.mockImplementation(async () => { mocks.state = { ...mocks.state, status, result: outcome } })
    const view = renderDialog()
    const dialog = await screen.findByRole('dialog')
    await pickStores(user, 'Pizza Two', 'Taco Three')
    await user.type(within(dialog).getByLabelText('DoorDash store URL'), DOORDASH_URL)
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))
    view.rerender(<MenuImportDialog open card={card} business={business} onClose={vi.fn()} />)
    return { dialog, view }
  }

  it('a partial failure lists the stores that failed and why, and Retry sends only those', async () => {
    const user = userEvent.setup()
    const { dialog, view } = await importInto(user, {
      appliedCount: 2,
      total: 3,
      failed: [{ businessId: 7, message: 'Ordering did not accept the menu for this store. Try again or contact support.' }],
      pending: [],
      quotaMessage: null
    })
    expect(within(dialog).getByRole('status')).toHaveTextContent('Menu imported to 2 of 3 stores')
    const failed = within(dialog).getByRole('list', { name: 'Stores that failed' })
    expect(within(failed).getByRole('listitem')).toHaveTextContent('Pizza Two: Ordering did not accept the menu for this store. Try again or contact support.')

    mocks.triggerImport.mockImplementation(async () => { mocks.state = { ...mocks.state, status: 'failed', result: null } })
    await user.click(within(dialog).getByRole('button', { name: 'Retry 1 store' }))
    expect(mocks.triggerImport).toHaveBeenCalledTimes(2)
    expect(mocks.triggerImport.mock.calls[1][0]).toEqual({ ...mocks.triggerImport.mock.calls[0][0], businessIds: [7] })
    // review of #437 (1): back on the form, the retried store is the one named
    view.rerender(<MenuImportDialog open card={card} business={business} onClose={vi.fn()} />)
    expect(dialog.querySelector('.odc-imp-store-name')).toHaveTextContent('Pizza Two')
    expect(within(dialog).getByText('The menu is imported into Pizza Two. This can take a few minutes.')).toBeInTheDocument()
  })

  // review of #437 (6)
  it('one store left by a quota cut is said in the singular', async () => {
    const user = userEvent.setup()
    const { dialog } = await importInto(user, { appliedCount: 2, total: 3, failed: [], pending: [8], quotaMessage: 'Wait.' })
    expect(within(dialog).getByText('1 store was not imported: Taco Three')).toBeInTheDocument()
  })

  // review of #437 (2)
  it('a queued import says it is still running, with Check products and no Retry', async () => {
    const user = userEvent.setup()
    const { dialog } = await importInto(user, { jobId: 'job-9', total: 3 }, 'queued')
    expect(within(dialog).getByRole('status')).toHaveTextContent('The import is still running')
    expect(within(dialog).getByText('The menu is still being imported into 3 stores. Check the products in a few minutes before importing again.')).toBeInTheDocument()
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Close', 'Check products'])
  })

  // review of #437 (3)
  it('after a lost connection with several stores it warns before Retry sends them all again', async () => {
    const user = userEvent.setup()
    const { dialog } = await importInto(user, null, 'unknown')
    expect(within(dialog).getByText('Some of the 3 stores may already have the new menu. Retry imports it again into all of them.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Retry 3 stores' }))
    expect(mocks.triggerImport.mock.calls[1][0].businessIds).toEqual([42, 7, 8])
  })

  it('a quota cut says how many were applied and which stores were left, and Retry sends those', async () => {
    const user = userEvent.setup()
    const { dialog } = await importInto(user, {
      appliedCount: 1,
      total: 3,
      failed: [],
      pending: [7, 8],
      quotaMessage: 'Ordering updated 1 stores, then reached its API limit. Try again in 30 seconds.'
    })
    expect(within(dialog).getByRole('status')).toHaveTextContent('Menu imported to 1 of 3 stores')
    expect(within(dialog).getByText('Ordering updated 1 stores, then reached its API limit. Try again in 30 seconds.')).toBeInTheDocument()
    expect(within(dialog).getByText('2 stores were not imported: Pizza Two, Taco Three')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Retry 2 stores' }))
    expect(mocks.triggerImport.mock.calls[1][0].businessIds).toEqual([7, 8])
  })
})

describe('GloriaFoodImportDialog — several stores', () => {
  it('sends every chosen store in businessIds', async () => {
    const user = userEvent.setup()
    render(<GloriaFoodImportDialog open business={business} onClose={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await pickStores(user, 'Pizza Two')
    await user.type(within(dialog).getByLabelText('Restaurant Key'), 'res-1')
    await user.type(within(dialog).getByLabelText('Master Key'), 'mas-1')
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Synchronize Menu' }))
    })
    expect(mocks.triggerImport.mock.calls[0][0].businessIds).toEqual([42, 7])
  })
})
