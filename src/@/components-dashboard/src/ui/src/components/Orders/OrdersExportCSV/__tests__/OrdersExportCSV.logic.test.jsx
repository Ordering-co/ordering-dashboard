/* eslint-disable import/first */
// Batch 5.4-A · logic of the orders CSV export. Written green against the legacy popover and modals
// and kept green after the move to Product Menu and Dialog: it only reads text, roles that both
// markups share, and what the controller receives (`getCSV(filterApply, withoutMetafields, statuses)`).
// redesign fix-qa E4: the calls and payloads are the same; only how they are reached changed. Every option
// confirms first (`confirm`), and the tab picker's button is «Continue» because the confirmation exports.
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ getCSV: null, actionStatus: { loading: false, error: null, result: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  ExportCSV: ({ UIComponent, ...props }) => <UIComponent {...props} actionStatus={runtime.actionStatus} getCSV={runtime.getCSV} />
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
// The legacy shell stays a stub: a visible dialog only while open, with its text and its buttons.
vi.mock('../../../Shared', () => ({
  SpinnerLoader: () => <span data-testid='spinner' />,
  Modal: ({ open, children }) => (open ? <div role='dialog'>{children}</div> : null),
  Alert: ({ open, title, content, onAccept }) => (open
    ? (
      <div role='alertdialog'>
        <h2>{title}</h2>
        <p>{Array.isArray(content) ? content.join(' ') : String(content)}</p>
        <button type='button' onClick={onAccept}>Alert accept</button>
      </div>
      )
    : null)
}))

import { OrdersExportCSV } from '..'
// User decision 5 (2026-10-06): the export trigger reads «Export», not «CSV»; only the name looked up changed.

const props = {
  filterValues: { statuses: [] },
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { pending: [0, 13], inProgress: [7, 8], completed: [1, 11], cancelled: [2] }
}
const element = () => <OrdersExportCSV {...props} />
const mount = () => renderWithProviders(element())

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.actionStatus = { loading: false, error: null, result: null }
})
afterEach(() => document.getElementById('app-modals')?.remove())

const openOption = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Export' }))
  await user.click(await screen.findByText(name))
}

// redesign fix-qa E4: the confirmation that every export now asks before calling the controller.
const confirm = async (user) => {
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))
}

describe('OrdersExportCSV · the four options', () => {
  it('Export all asks for the whole list with metafields', async () => {
    const user = userEvent.setup()
    mount()
    await openOption(user, 'Export all')
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(false, undefined)
  })

  it('Export all without metafields drops them', async () => {
    const user = userEvent.setup()
    mount()
    await openOption(user, 'Export all without metafields')
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledWith(false, true)
  })

  it('Export filtered opens the tab picker and does not export yet', async () => {
    mount()
    await openOption(userEvent.setup(), 'Export filtered')
    expect(await screen.findByText('Select tabs to export')).toBeInTheDocument()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })
})

// redesign 5.2 audit-3: the picker's confirm button is looked up as «Export orders» (it read «Export»); same behaviour.
describe('OrdersExportCSV · tab picker', () => {
  const openPicker = async (user, name = 'Export filtered') => {
    await openOption(user, name)
    await screen.findByText('Select tabs to export')
  }
  const tab = name => screen.getByRole('checkbox', { name })
  // A native input (legacy) and a role=checkbox button (Product) both answer.
  const isChecked = node => (node.tagName === 'INPUT' ? node.checked : node.getAttribute('aria-checked') === 'true')

  it('starts with the current tab selected and the four tabs offered', async () => {
    mount()
    await openPicker(userEvent.setup())
    expect(['Pending', 'In progress', 'Completed', 'Cancelled'].map(name => isChecked(tab(name)))).toEqual([false, true, false, false])
  })

  it('exports the statuses of the selected tabs, in the order they were picked', async () => {
    const user = userEvent.setup()
    mount()
    await openPicker(user)
    await user.click(tab('Pending'))
    await user.click(tab('Completed'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(true, false, [7, 8, 0, 13, 1, 11])
  })

  it('keeps the without-metafields choice from the option that opened the picker', async () => {
    const user = userEvent.setup()
    mount()
    await openPicker(user, 'Export filtered without metafields')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledWith(true, true, [7, 8])
  })

  it('cannot export with no tab selected', async () => {
    const user = userEvent.setup()
    mount()
    await openPicker(user)
    await user.click(tab('In progress'))
    const exportButton = screen.getByRole('button', { name: 'Continue' })
    expect(exportButton).toBeDisabled()
    await user.click(exportButton)
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('closes the picker when it goes on to the confirmation', async () => {
    const user = userEvent.setup()
    mount()
    await openPicker(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await vi.waitFor(() => expect(screen.queryByText('Select tabs to export')).not.toBeInTheDocument())
  })
})

describe('OrdersExportCSV · result, error and loading', () => {
  // redesign fix-qa E4: an e-mail answer reads «You’ll get it by e-mail.»; any other answer is shown as it came.
  it('shows each message of the result, once', () => {
    runtime.actionStatus = { loading: false, error: null, result: ['Queued with the number 41', { message: 'Check the queue.' }] }
    mount()
    expect(screen.getByText('Queued with the number 41')).toBeInTheDocument()
    expect(screen.getByText('Check the queue.')).toBeInTheDocument()
  })

  it('shows the error and not the result dialog when the export failed', () => {
    runtime.actionStatus = { loading: false, error: ['Export is not available'], result: null }
    mount()
    expect(screen.getByText('Export is not available')).toBeInTheDocument()
  })

  it('disables the CSV button while the export runs', () => {
    runtime.actionStatus = { loading: true, error: null, result: null }
    mount()
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('does not draw any dialog by itself', () => {
    mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(within(document.body).queryByText('Select tabs to export')).not.toBeInTheDocument()
  })
})
