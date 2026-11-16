/* eslint-disable import/first */
// redesign fix-qa E4 · exporting never starts with one click and never says «finished» for a queued job.
// Every option asks first on a Product ConfirmDialog that names the scope and where the file goes; the
// result says what the API answered; the focus goes back to the trigger. The Product wrappers are real
// here; `getCSV` is the controller's and is only ever called after the confirmation, with the same
// arguments as before.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ getCSV: null, actionStatus: { loading: false, error: null, result: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  ExportCSV: ({ UIComponent, ...props }) => <UIComponent {...props} actionStatus={runtime.actionStatus} getCSV={runtime.getCSV} />
}))

import { OrdersExportCSV } from '..'

const props = {
  filterValues: { statuses: [] },
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { pending: [0, 13], inProgress: [7, 8], completed: [1, 11], cancelled: [2] }
}
const element = (extra = {}) => <OrdersExportCSV {...props} {...extra} />
const mount = (extra) => renderWithProviders(element(extra))
const trigger = () => screen.getByRole('button', { name: 'Export' })
const confirmDialog = name => screen.findByRole('alertdialog', { name })
const sent = 'The report will be generated and sent to your email when ready'

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.actionStatus = { loading: false, error: null, result: null }
})
afterEach(() => document.getElementById('app-modals')?.remove())

const choose = async (user, name) => {
  await user.click(trigger())
  await user.click(await screen.findByRole('menuitem', { name }))
}

// The title is the same for every option on purpose: the option (as the project words it, e.g. a catalog that
// says «Last 3 months»), the tabs and the fields are the scope, and nothing here claims more than the call sends.
describe('OrdersExportCSV · every option asks first', () => {
  it.each([
    ['Export all', 'Export orders?', false, undefined],
    ['Export all without metafields', 'Export orders?', false, true]
  ])('%s opens a confirmation and sends nothing until it is confirmed', async (option, title, filterApply, withoutMetafields) => {
    const user = userEvent.setup()
    mount()
    await choose(user, option)
    const dialog = await confirmDialog(title)
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(filterApply, withoutMetafields)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it.each([
    ['Export filtered', false],
    ['Export filtered without metafields', true]
  ])('%s opens the tab picker, then the confirmation, and exports only after it', async (option, withoutMetafields) => {
    const user = userEvent.setup()
    mount()
    await choose(user, option)
    const picker = await screen.findByRole('dialog', { name: 'Select tabs to export' })
    await user.click(within(picker).getByRole('checkbox', { name: 'Pending' }))
    await user.click(within(picker).getByRole('button', { name: 'Continue' }))
    const dialog = await confirmDialog('Export orders?')
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(true, withoutMetafields, [7, 8, 0, 13])
  })

  it('the confirmation is primary, starts on Cancel and has a close button', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByRole('button', { name: 'Export orders' })).toHaveAttribute('data-variant', 'primary')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('names the scope of Export all: no tab and no filters from the screen, with custom fields', async () => {
    const user = userEvent.setup()
    mount({ userLevel: 0 })
    await choose(user, 'Export all')
    const dialog = await confirmDialog('Export orders?')
    // (bugs H, 37c): «Export all» sends every order of the project, and the line says so.
    expect(within(dialog).getByText('All the project’s orders, not narrowed by the tab or the filters on screen.')).toBeInTheDocument()
    expect(within(dialog).getByText('Includes custom fields (metafields).')).toBeInTheDocument()
  })

  // The controller adds a franchise filter to every export (also «Export all»), so there «the project» would not be exact.
  it('with a franchise filter Export all keeps the plain line, not «the project’s orders»', async () => {
    const user = userEvent.setup()
    mount({ franchiseId: 7 })
    await choose(user, 'Export all')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Not narrowed by the tab or the filters on screen.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/All the project/)).not.toBeInTheDocument()
  })

  // bugs H review R-2: a business owner (2) or a delivery manager (5) only gets their own orders from the API
  it.each([2, 5, undefined])('for user level %s Export all keeps the plain line, not «the project’s orders»', async (userLevel) => {
    const user = userEvent.setup()
    mount({ userLevel })
    await choose(user, 'Export all')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Not narrowed by the tab or the filters on screen.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/All the project/)).not.toBeInTheDocument()
  })

  // bugs H 37c: the API names the export without metafields «Export (Last 3 months) without metafields», so that one
  // does not claim every order of the project
  it('without metafields Export all keeps the plain line, not «the project’s orders»', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all without metafields')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Not narrowed by the tab or the filters on screen.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/All the project/)).not.toBeInTheDocument()
  })

  it('says it leaves custom fields out when the option is the one without metafields', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all without metafields')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Leaves out custom fields (metafields).')).toBeInTheDocument()
    expect(within(dialog).queryByText('Includes custom fields (metafields).')).not.toBeInTheDocument()
  })

  it('shows the label of the option the user chose, so a catalog that renames it is not contradicted', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all without metafields')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Export all without metafields')).toBeInTheDocument()
  })

  it('names the tabs picked and says the filters on screen apply too', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export filtered')
    const picker = await screen.findByRole('dialog', { name: 'Select tabs to export' })
    await user.click(within(picker).getByRole('checkbox', { name: 'Completed' }))
    await user.click(within(picker).getByRole('button', { name: 'Continue' }))
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('Orders in In progress, Completed. The filters on screen are applied too.')).toBeInTheDocument()
  })

  it('says where the file goes: by e-mail, not downloaded here', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all')
    const dialog = await confirmDialog('Export orders?')
    expect(within(dialog).getByText('The report is generated in the background and sent to your e-mail when it is ready.')).toBeInTheDocument()
  })

  it('Cancel, Close and Escape send nothing and give the focus back to the Export button', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all')
    let dialog = await confirmDialog('Export orders?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(trigger()).toHaveFocus()

    await choose(user, 'Export all')
    dialog = await confirmDialog('Export orders?')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(trigger()).toHaveFocus()

    await choose(user, 'Export all')
    await confirmDialog('Export orders?')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(trigger()).toHaveFocus()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('cancelling the confirmation after the tab picker sends nothing and the focus returns to the Export button', async () => {
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export filtered')
    const picker = await screen.findByRole('dialog', { name: 'Select tabs to export' })
    await user.click(within(picker).getByRole('button', { name: 'Continue' }))
    const dialog = await confirmDialog('Export orders?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(trigger()).toHaveFocus()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })
})

describe('OrdersExportCSV · the result says what the API answered', () => {
  it('an e-mail answer is «Export requested» and «You’ll get it by e-mail.», never «Export finished»', async () => {
    runtime.actionStatus = { loading: false, error: null, result: [sent] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export requested' })
    expect(within(dialog).getByText('You’ll get it by e-mail.')).toBeInTheDocument()
    expect(screen.queryByText('Export finished')).not.toBeInTheDocument()
  })

  it('reads the e-mail answer when it comes as an object with a message', async () => {
    runtime.actionStatus = { loading: false, error: null, result: [{ message: sent }] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export requested' })
    expect(within(dialog).getByText('You’ll get it by e-mail.')).toBeInTheDocument()
  })

  it('a file in the answer is «Export ready» with a download link and not the e-mail sentence', async () => {
    runtime.actionStatus = { loading: false, error: null, result: [{ url: 'https://files.example.com/orders.csv' }] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export ready' })
    const link = within(dialog).getByRole('link', { name: 'Download file' })
    expect(link).toHaveAttribute('href', 'https://files.example.com/orders.csv')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(within(dialog).queryByText('You’ll get it by e-mail.')).not.toBeInTheDocument()
  })

  it('finds the file address inside a text answer too', async () => {
    runtime.actionStatus = { loading: false, error: null, result: ['Your file: https://files.example.com/o.csv'] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export ready' })
    expect(within(dialog).getByRole('link', { name: 'Download file' })).toHaveAttribute('href', 'https://files.example.com/o.csv')
  })

  it('an answer that says neither is «Export requested» with the API text as it came, and invents no destination', async () => {
    runtime.actionStatus = { loading: false, error: null, result: ['Queued with the number 41'] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export requested' })
    expect(within(dialog).getByText('Queued with the number 41')).toBeInTheDocument()
    expect(within(dialog).queryByText('You’ll get it by e-mail.')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
  })

  it('a failure is still «Export failed» with the API text', async () => {
    runtime.actionStatus = { loading: false, error: ['Export is not available'], result: null }
    mount()
    const dialog = await screen.findByRole('alertdialog', { name: 'Export failed' }) // redesign W0-2 r3 (W0-P2-07)
    expect(within(dialog).getByText('Export is not available')).toBeInTheDocument()
  })

  // The controller keeps the previous answer in its state while the next export runs.
  it.each([
    ['result', { loading: true, error: null, result: [sent] }],
    ['error', { loading: true, error: ['Export is not available'], result: null }]
  ])('does not reopen the previous %s when a new export starts', (_, running) => {
    runtime.actionStatus = running
    mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument() // redesign W0-2 r3 (W0-P2-07)
  })

  // The trigger is disabled while the export runs, so the browser drops the focus; the result must still
  // give it back to the Export button when it is closed (it went to the side bar logo).
  it.each([
    ['the result', { loading: false, error: null, result: [sent] }, 'Export requested'],
    ['the error', { loading: false, error: ['Export is not available'], result: null }, 'Export failed']
  ])('closing %s returns the focus to the Export button after a run', async (_, finished, title) => {
    const user = userEvent.setup()
    const view = mount()
    await choose(user, 'Export all')
    await user.click(within(await confirmDialog('Export orders?')).getByRole('button', { name: 'Export orders' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // The browser drops the focus of a button that becomes disabled; jsdom keeps it, so it is dropped here.
    runtime.actionStatus = { loading: true, error: null, result: null }
    view.rerender(element())
    expect(trigger()).toBeDisabled()
    document.activeElement?.blur()
    expect(document.body).toHaveFocus()
    runtime.actionStatus = finished
    view.rerender(element())
    const dialog = await screen.findByRole(title === 'Export failed' ? 'alertdialog' : 'dialog', { name: title }) // redesign W0-2 r3 (W0-P2-07)
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })
})

describe('OrdersExportCSV · phones: the More menu', () => {
  const learn = [{ key: 'overview', label: 'Orders list', onSelect: vi.fn() }]
  const more = () => screen.getByRole('button', { name: 'More actions' })

  it('every export row asks first, and cancelling returns the focus to More actions', async () => {
    const user = userEvent.setup()
    mount({ variant: 'more', extraItems: learn })
    await user.click(more())
    await user.click(await screen.findByRole('menuitem', { name: 'Export all' }))
    const dialog = await confirmDialog('Export orders?')
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(more()).toHaveFocus()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('the menu is marked as the export menu so its rows can reach 44px on a phone', async () => {
    const user = userEvent.setup()
    mount({ variant: 'more', extraItems: learn })
    await user.click(more())
    expect(await screen.findByRole('menu')).toHaveAttribute('data-export-menu')
  })

  it('the stylesheet gives those rows the coarse target at phone width, not only with a touch pointer', () => {
    const css = readFileSync(resolve(__dirname, '../orders-export-csv.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{[^}]*\[data-export-menu\] \.odc-menu-item\s*\{[^}]*min-block-size: var\(--od-x-target-coarse\)/)
  })

  // redesign W0-3d5 (T0-12, decision 12): a lone button (OK) and the close button are seen at their own size and carry
  // Product's 44px area; the footers with two buttons (8px apart) keep the 44px box. Detail in Orders/__tests__/touch.w03d5.test.js.
  it('the two-button footers of the export dialogs keep the coarse target at phone width', async () => {
    const css = readFileSync(resolve(__dirname, '../orders-export-csv.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.odc-export-dialog \.odc-overlay-foot > \.odc-btn:not\(:only-child\)\s*\{[^}]*min-block-size: var\(--od-x-target-coarse\)/)
    const user = userEvent.setup()
    mount()
    await choose(user, 'Export all')
    expect(await confirmDialog('Export orders?')).toHaveClass('odc-export-dialog')
  })
})
