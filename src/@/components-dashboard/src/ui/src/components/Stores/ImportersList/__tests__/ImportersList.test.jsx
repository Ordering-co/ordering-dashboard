/* eslint-disable import/first */
// redesign stores 3.C: level 0 of the Importers panel as a Product DataTable (RecordCards under 768px). Pinned here:
// «Enable» is gone (decision 12b), Delete is only offered to the importers that are not the 8 defaults and asks first (decision 6,
// anatomy C8), the failed load and the failed delete are shown, and a row click / Enter / «Import file» is the same action.
// The ImporterListing controller is not here: the props are its state, and the callbacks are spies.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))

import { ImportersList, importerTypeLabel } from '../index'

const DEFAULT_SLUGS = [
  'sync_businesses_default', 'sync_categories_default', 'sync_products_default',
  'sync_extras_default', 'sync_extra_options_default', 'sync_extra_option_suboptions_default',
  'sync_extra_products_default', 'sync_full_menu_default'
]

const IMPORTERS = [
  { id: 1, name: 'Products default', slug: 'sync_products_default', type: 'sync_products' },
  { id: 2, name: 'Acme menu', slug: 'acme-menu', type: 'sync_multiple' },
  { id: 3, name: 'Legacy feed', slug: 'legacy-feed', type: 'sync_something_new' }
]

const draw = (props = {}) => {
  const spies = {
    getImporters: vi.fn(),
    handleDeleteImporter: vi.fn(async () => {}),
    onImportFile: vi.fn(),
    onEditImporter: vi.fn(),
    onAddImporter: vi.fn()
  }
  const tree = (extra) => (
    <ImportersList
      importerList={{ loading: false, error: null, importers: IMPORTERS }}
      actionStatus={{ loading: false, error: null }}
      {...spies}
      {...extra}
    />
  )
  const utils = render(tree(props))
  return { ...utils, ...spies, redraw: (next) => utils.rerender(tree(next)) }
}

const rowOf = (name) => screen.getByRole('rowheader', { name }).closest('tr')
const openMenu = async (name) => {
  await userEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }))
  return screen.findByRole('menu')
}
const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
}
const menuItems = () => screen.queryAllByRole('menuitem').map(item => item.textContent)

beforeEach(() => {
  mockState.phone = false
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('importerTypeLabel', () => {
  const t = (key, text) => text

  it.each([
    ['sync_businesses', 'Store importer'],
    ['sync_categories', 'Category importer'],
    ['sync_products', 'Product importer'],
    ['sync_extra_products', 'Extra products'],
    ['sync_extras', 'Extras'],
    ['sync_extra_options', 'Extra options'],
    ['sync_extra_option_suboptions', 'extra option suboptions'],
    ['sync_multiple', 'Multiple']
  ])('%s reads %s', (type, label) => {
    expect(importerTypeLabel(type, t)).toBe(label)
  })

  it('goes through the translation function with the key of the importer form', () => {
    const calls = []
    importerTypeLabel('sync_products', (key, text) => { calls.push(key); return text })
    expect(calls).toEqual(['PRODUCT_IMPORTER'])
  })

  it('shows a type it does not know as it comes, and nothing for no type', () => {
    expect(importerTypeLabel('sync_something_new', t)).toBe('sync_something_new')
    expect(importerTypeLabel(undefined, t)).toBe('')
  })
})

describe('the table', () => {
  it('has Name and Type columns, a name and a readable type per importer, and an actions column named for a screen reader', () => {
    draw()
    const table = screen.getByRole('table', { name: 'Importers list' })
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Name', 'Type', 'Actions'])
    const row = rowOf('Acme menu')
    expect(within(row).getByText('Multiple')).toBeInTheDocument()
    expect(within(rowOf('Products default')).getByText('Product importer')).toBeInTheDocument()
    expect(within(rowOf('Legacy feed')).getByText('sync_something_new')).toBeInTheDocument()
  })

  it('draws no Enable on any row: the API has no state to save (decision 12b)', () => {
    draw()
    expect(screen.queryByText('Enable')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('is a Product table, not the legacy one', () => {
    draw()
    expect(screen.getByRole('table', { name: 'Importers list' })).toHaveClass('odc-table')
  })

  it('draws the skeleton while it loads (aria-busy, a read label) and no rows', () => {
    draw({ importerList: { loading: true, error: null, importers: [] } })
    expect(screen.getByRole('table', { name: 'Importers list' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading importers')).toBeInTheDocument()
    expect(screen.queryByText('Acme menu')).not.toBeInTheDocument()
    expect(document.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
  })

  it('says «No importers yet» with no importers (the key of today, the new default)', () => {
    draw({ importerList: { loading: false, error: null, importers: [] } })
    expect(screen.getByText('No importers yet')).toBeInTheDocument()
    expect(screen.queryByText("Can't found importers")).not.toBeInTheDocument()
  })

  it('marks the row whose detail is open', () => {
    draw({ activeImporterId: 2 })
    expect(rowOf('Acme menu')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('Products default')).not.toHaveAttribute('aria-current')
  })
})

describe('opening an importer', () => {
  it('a click on the row imports a file', async () => {
    const { onImportFile } = draw()
    await userEvent.click(within(rowOf('Acme menu')).getByText('Acme menu'))
    expect(onImportFile).toHaveBeenCalledWith(IMPORTERS[1])
  })

  it('Enter on the row imports a file', async () => {
    const { onImportFile } = draw()
    rowOf('Acme menu').focus()
    await userEvent.keyboard('{Enter}')
    expect(onImportFile).toHaveBeenCalledWith(IMPORTERS[1])
  })

  it('the menu has Import file, Edit and Delete, and Import file / Edit call their action without opening the row', async () => {
    const { onImportFile, onEditImporter } = draw()
    await openMenu('Acme menu')
    expect(menuItems()).toEqual(['Import file', 'Edit', 'Delete'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(onEditImporter).toHaveBeenCalledWith(IMPORTERS[1])
    expect(onImportFile).not.toHaveBeenCalled()

    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Import file' }))
    expect(onImportFile).toHaveBeenCalledTimes(1)
    expect(onImportFile).toHaveBeenCalledWith(IMPORTERS[1])
  })

  it('opening the menu does not open the row', async () => {
    const { onImportFile } = draw()
    await openMenu('Acme menu')
    expect(onImportFile).not.toHaveBeenCalled()
  })

  // J2 row 15 (stores-3-c-importers P-1): the repeated «Add new importer» under the list is gone; «Add importer» of the header of
  // the panel (S/ImportersListing) stays, so the action is still one click away
  it('has no «Add new importer» under the list', () => {
    const { container } = draw()
    expect(screen.queryByRole('button', { name: 'Add new importer' })).toBeNull()
    expect(container.querySelector('.odc-imp-list-foot')).toBeNull()
  })
})

describe('Delete is not offered to the 8 default importers', () => {
  it.each(DEFAULT_SLUGS)('%s: Import file and Edit, no Delete', async (slug) => {
    draw({ importerList: { loading: false, error: null, importers: [{ id: 9, name: 'A default', slug, type: 'sync_products' }] } })
    await openMenu('A default')
    expect(menuItems()).toEqual(['Import file', 'Edit'])
  })

  // n.º 15, stores-3-c P-2 (owner, 2026-10-20): every slug with `_default` is a system importer the API brings, also those the
  // list of 8 does not know
  it.each(['sync_full_menu_default_v2', 'sync_users_default', 'sync_external_orders_default'])('%s: no Delete either (n.º 15)', async (slug) => {
    draw({ importerList: { loading: false, error: null, importers: [{ id: 9, name: 'A default', slug, type: 'sync_products' }] } })
    await openMenu('A default')
    expect(menuItems()).toEqual(['Import file', 'Edit'])
  })

  it('an importer that is not one of them has Delete', async () => {
    draw()
    await openMenu('Acme menu')
    expect(menuItems()).toContain('Delete')
    await closeMenu()
    await openMenu('Products default')
    expect(menuItems()).toEqual(['Import file', 'Edit'])
  })
})

describe('deleting asks first (decision 6)', () => {
  it('Delete opens the dialog with the name and the consequence and does NOT delete yet', async () => {
    const { handleDeleteImporter } = draw()
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Acme menu?' })
    expect(within(dialog).getByText("This importer and its mapping are deleted. Data you already imported stays. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete importer' })).toHaveAttribute('data-variant', 'danger')
    expect(handleDeleteImporter).not.toHaveBeenCalled()
  })

  it('the focus starts on Cancel, and Cancel closes without deleting', async () => {
    const { handleDeleteImporter } = draw()
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(handleDeleteImporter).not.toHaveBeenCalled()
  })

  it('Escape closes without deleting', async () => {
    const { handleDeleteImporter } = draw()
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(handleDeleteImporter).not.toHaveBeenCalled()
  })

  it('«Delete importer» deletes that importer once, and the dialog closes', async () => {
    const { handleDeleteImporter } = draw()
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete importer' }))
    expect(handleDeleteImporter).toHaveBeenCalledTimes(1)
    expect(handleDeleteImporter).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('while the delete runs the button is busy and nothing can be repeated or cancelled', async () => {
    let finish
    const handleDeleteImporter = vi.fn(() => new Promise(resolve => { finish = resolve }))
    draw({ handleDeleteImporter })
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete importer' })
    expect(confirm).not.toHaveAttribute('aria-busy')
    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.click(confirm)
    expect(handleDeleteImporter).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('shows the busy state of the controller (actionStatus.loading) on the confirm button', async () => {
    draw({ actionStatus: { loading: true, error: null } })
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Delete importer' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('failures', () => {
  it('a failed delete shows its message above the list (a list of messages) and can be closed', async () => {
    draw({ actionStatus: { loading: false, error: ['Importer is in use', 'Try later'] } })
    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('Importer is in use Try later')
    expect(screen.getByRole('table', { name: 'Importers list' })).toBeInTheDocument()
    await userEvent.click(within(notice).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('a failed delete as a plain string is shown too, and a new failure shows again after closing the old one', async () => {
    const first = 'Not allowed'
    const { redraw } = draw({ actionStatus: { loading: false, error: first } })
    expect(screen.getByRole('status')).toHaveTextContent('Not allowed')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    redraw({ actionStatus: { loading: false, error: ['Not allowed'] } })
    expect(screen.getByRole('status')).toHaveTextContent('Not allowed')
  })

  it('a failed load says so, keeps the page usable, and «Try again» asks the controller to load again', async () => {
    const { getImporters, onAddImporter } = draw({ importerList: { loading: false, error: ['Network Error'], importers: [] } })
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent("We couldn't load the importers.")
    expect(screen.queryByText('No importers yet')).not.toBeInTheDocument()
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(getImporters).toHaveBeenCalledTimes(1)
    expect(onAddImporter).not.toHaveBeenCalled()
  })

  it('«Try again» hides the notice it answers (the controller keeps its old error after a load that works); a new failure shows it again', async () => {
    const error = ['Network Error']
    const { redraw } = draw({ importerList: { loading: false, error, importers: [] } })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByText("We couldn't load the importers.")).not.toBeInTheDocument()
    redraw({ importerList: { loading: true, error, importers: [] } })
    redraw({ importerList: { loading: false, error, importers: IMPORTERS } })
    expect(screen.queryByText("We couldn't load the importers.")).not.toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Acme menu' })).toBeInTheDocument()
    redraw({ importerList: { loading: false, error: ['Network Error'], importers: IMPORTERS } })
    expect(screen.getByText("We couldn't load the importers.")).toBeInTheDocument()
  })
})

describe('under 768px', () => {
  beforeEach(() => {
    mockState.phone = true
  })

  it('draws cards with the name, the type and the same menu, and no table', async () => {
    const { onImportFile, onEditImporter } = draw()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Importers list' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(within(cards[1]).getByText('Acme menu')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Multiple')).toBeInTheDocument()
    expect(screen.queryByText('Enable')).not.toBeInTheDocument()

    await userEvent.click(within(cards[1]).getByRole('link', { name: 'Acme menu' }))
    expect(onImportFile).toHaveBeenCalledWith(IMPORTERS[1])

    await openMenu('Acme menu')
    expect(menuItems()).toEqual(['Import file', 'Edit', 'Delete'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(onEditImporter).toHaveBeenCalledWith(IMPORTERS[1])
    expect(onImportFile).toHaveBeenCalledTimes(1)
  })

  it('the card of the open detail is the current one', () => {
    draw({ activeImporterId: 2 })
    const cards = within(screen.getByRole('list', { name: 'Importers list' })).getAllByRole('listitem')
    expect(cards[1]).toHaveAttribute('aria-current', 'true')
    expect(cards[0]).not.toHaveAttribute('aria-current')
  })

  it('deleting on a card asks first too, and a default importer has no Delete', async () => {
    const { handleDeleteImporter } = draw()
    await openMenu('Products default')
    expect(menuItems()).toEqual(['Import file', 'Edit'])
    await closeMenu()
    await openMenu('Acme menu')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(await screen.findByRole('alertdialog', { name: 'Delete Acme menu?' })).toBeInTheDocument()
    expect(handleDeleteImporter).not.toHaveBeenCalled()
  })

  it('loads as skeleton cards and is empty as the table is', () => {
    const { redraw } = draw({ importerList: { loading: true, error: null, importers: [] } })
    expect(document.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
    redraw({ importerList: { loading: false, error: null, importers: [] } })
    expect(screen.getByText('No importers yet')).toBeInTheDocument()
  })
})

// review (3.C): «Import Users» showed its raw type
describe('importerTypeLabel (review)', () => {
  it('names sync_users', async () => {
    const { importerTypeLabel } = await import('../index')
    expect(importerTypeLabel('sync_users', (_k, text) => text)).toBe('User importer')
  })
})
