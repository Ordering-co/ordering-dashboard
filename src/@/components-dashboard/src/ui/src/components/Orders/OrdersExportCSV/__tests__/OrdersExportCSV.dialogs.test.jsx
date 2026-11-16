/* eslint-disable import/first */
// Batch 5.4-A · the CSV export on Product Menu and Dialog (C8, C10): roles and names, initial focus,
// Escape, footer order and the same `getCSV` call as before. The Product wrappers are real here.
// redesign fix-qa E4: every option confirms first (`confirm`); the tab picker's button is «Continue»; the result
// is «Export requested» / «Export ready» by what the API answered. The new behaviour is in `.confirm.test.jsx`.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ getCSV: null, actionStatus: { loading: false, error: null, result: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  ExportCSV: ({ UIComponent, ...props }) => <UIComponent {...props} actionStatus={runtime.actionStatus} getCSV={runtime.getCSV} />
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))

import { OrdersExportCSV } from '..'
// User decision 5 (2026-10-06): the export trigger reads «Export», not «CSV»; only the name looked up changed.

const props = {
  filterValues: { statuses: [] },
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { pending: [0, 13], inProgress: [7, 8], completed: [1, 11], cancelled: [2] }
}
const mount = () => renderWithProviders(<OrdersExportCSV {...props} />)
const confirm = async (user) => {
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))
}
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.actionStatus = { loading: false, error: null, result: null }
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrdersExportCSV · menu', () => {
  it('the CSV button is a menu trigger that offers the four options in the same order', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: 'Export' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Export all',
      'Export filtered',
      'Export all without metafields',
      'Export filtered without metafields'
    ])
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('Escape closes the menu and gives the focus back to the CSV button', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: 'Export' })
    await user.click(trigger)
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('choosing Export all calls getCSV with the same arguments and closes the menu', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Export all without metafields' }))
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(false, true)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('while the export runs the button is busy and cannot open the menu', async () => {
    runtime.actionStatus = { loading: true, error: null, result: null }
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: 'Export' })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('aria-busy', 'true')
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
  })
})

describe('OrdersExportCSV · tab picker dialog', () => {
  const openPicker = async (user, name = 'Export filtered') => {
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(await screen.findByRole('menuitem', { name }))
    return screen.findByRole('dialog', { name: 'Select tabs to export' })
  }

  it('is a small dialog named Select tabs to export, with the four tabs as labelled checkboxes', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openPicker(user)
    expect(dialog).toHaveAttribute('data-size', 'sm')
    const boxes = within(dialog).getAllByRole('checkbox')
    expect(boxes.map(box => box.textContent)).toEqual(['Pending', 'In progress', 'Completed', 'Cancelled'])
    expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
  })

  it('puts the focus on the first tab and keeps it inside the dialog', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openPicker(user)
    await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: 'Pending' })).toHaveFocus())
  })

  // redesign 5.2 audit-3: the confirm button names its object («Export orders»), not just «Export».
  it('footer reads Cancel then Continue, and it carries the same payload as before once confirmed', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openPicker(user)
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Continue'])
    await user.click(within(dialog).getByRole('checkbox', { name: 'Pending' }))
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(true, false, [7, 8, 0, 13])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Export is disabled with no tab and says why, in text', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openPicker(user)
    const exportButton = within(dialog).getByRole('button', { name: 'Continue' })
    expect(within(dialog).queryByText('Select at least one tab to export.')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'In progress' }))
    expect(exportButton).toBeDisabled()
    const reason = within(dialog).getByText('Select at least one tab to export.')
    expect(exportButton).toHaveAccessibleDescription('Select at least one tab to export.')
    expect(reason).toBeVisible()
    await user.click(exportButton)
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('Cancel and Escape close it without exporting, and the focus goes back to the CSV button', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: 'Export' })
    let dialog = await openPicker(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()

    dialog = await openPicker(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })
})

describe('OrdersExportCSV · result and error dialogs', () => {
  it('an answered export opens Export requested with the API messages and a primary OK that closes it', async () => {
    runtime.actionStatus = { loading: false, error: null, result: ['Queued with the number 41', { message: 'Check the queue.' }] }
    const user = userEvent.setup()
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export requested' })
    expect(dialog).toHaveAttribute('data-size', 'sm')
    expect(within(dialog).getByText('Queued with the number 41')).toBeInTheDocument()
    expect(within(dialog).getByText('Check the queue.')).toBeInTheDocument()
    expect(footerButtons(dialog)).toEqual(['OK'])
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'OK' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Escape closes the result', async () => {
    runtime.actionStatus = { loading: false, error: null, result: ['Done'] }
    const user = userEvent.setup()
    mount()
    await screen.findByRole('dialog', { name: 'Export requested' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a failed export opens Export failed with the error and OK, and not the result dialog', async () => {
    runtime.actionStatus = { loading: false, error: ['Export is not available'], result: ['ignored'] }
    const user = userEvent.setup()
    mount()
    const dialog = await screen.findByRole('alertdialog', { name: 'Export failed' }) // redesign W0-2 r3 (W0-P2-07): the failure is an alertdialog described by its messages
    expect(dialog).toHaveAttribute('data-size', 'sm')
    expect(dialog).toHaveAccessibleDescription('Export is not available')
    expect(within(dialog).getByText('Export is not available')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Export requested' })).not.toBeInTheDocument()
    expect(footerButtons(dialog)).toEqual(['OK'])
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()) // redesign W0-2 r3 (W0-P2-07)
  })

  it('shows the message of an Error thrown by the request', async () => {
    runtime.actionStatus = { loading: false, error: new Error('Network request failed'), result: null }
    mount()
    const dialog = await screen.findByRole('alertdialog', { name: 'Export failed' }) // redesign W0-2 r3 (W0-P2-07)
    expect(within(dialog).getByText('Network request failed')).toBeInTheDocument()
  })
})
