/* eslint-disable import/first */
// redesign 5.6-B: on phones the page's «More actions» menu is the Export menu with more items after the
// export options (the Learn articles). Same four options, same handlers, same dialogs; only the trigger
// and the extra items are new. The Product wrappers are real here.
// redesign fix-qa E4: every option confirms first (`confirm`) and the tab picker's button is «Continue»;
// same calls and payloads. The new behaviour is in `.confirm.test.jsx`.
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

import { OrdersExportCSV } from '..'

const props = {
  filterValues: { statuses: [] },
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { pending: [0, 13], inProgress: [7, 8], completed: [1, 11], cancelled: [2] }
}
const learn = [
  { key: 'overview', label: 'Orders list', description: 'opens in a new tab', onSelect: vi.fn() },
  { key: 'details', label: 'Order details', description: 'opens in a new tab', onSelect: vi.fn() }
]
const mount = (extra = {}) => renderWithProviders(<OrdersExportCSV {...props} variant='more' extraItems={learn} {...extra} />)
const trigger = () => screen.getByRole('button', { name: 'More actions' })
const confirm = async (user) => {
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))
}

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.actionStatus = { loading: false, error: null, result: null }
  learn.forEach(item => item.onSelect.mockClear())
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrdersExportCSV · variant more (phones)', () => {
  it('the trigger is an icon button named More actions that announces a menu, and there is no Export button', () => {
    mount()
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveAttribute('data-icon-only')
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
  })

  it('offers the four export options in their order, then the extra items after a separator', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(trigger())
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.querySelector('.odc-menu-label').textContent)).toEqual([
      'Export all',
      'Export filtered',
      'Export all without metafields',
      'Export filtered without metafields',
      'Orders list',
      'Order details'
    ])
    expect(within(menu).getAllByRole('separator')).toHaveLength(1)
    // The extra items are read as the Learn articles are in their own menu: the hint is a description.
    expect(menu).toHaveAttribute('data-learn-menu')
  })

  it('without extra items it is only the export options, with no separator and no Learn look', async () => {
    const user = userEvent.setup()
    mount({ extraItems: undefined })
    await user.click(trigger())
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4)
    expect(within(menu).queryByRole('separator')).toBeNull()
    expect(menu).not.toHaveAttribute('data-learn-menu')
  })

  it('choosing an export option calls getCSV with the same arguments as the Export menu', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(trigger())
    await user.click(await screen.findByRole('menuitem', { name: 'Export all without metafields' }))
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(false, true)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('Export filtered opens the same tab picker, with the current tab ticked, and exports the same payload', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(trigger())
    await user.click(await screen.findByRole('menuitem', { name: 'Export filtered' }))
    const dialog = await screen.findByRole('dialog', { name: 'Select tabs to export' })
    expect(within(dialog).getAllByRole('checkbox').map(box => box.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
    await user.click(within(dialog).getByRole('checkbox', { name: 'Pending' }))
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await confirm(user)
    expect(runtime.getCSV).toHaveBeenCalledWith(true, false, [7, 8, 0, 13])
  })

  it('choosing an extra item runs its own handler and closes the menu', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(trigger())
    await user.click(await screen.findByRole('menuitem', { name: 'Order details' }))
    expect(learn[1].onSelect).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('while the export runs the export options are disabled; the menu and the extra items keep working', async () => {
    runtime.actionStatus = { loading: true, error: null, result: null }
    const user = userEvent.setup()
    mount()
    expect(trigger()).toBeEnabled()
    await user.click(trigger())
    const menu = await screen.findByRole('menu')
    for (const name of ['Export all', 'Export filtered', 'Export all without metafields', 'Export filtered without metafields']) {
      expect(within(menu).getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true')
    }
    expect(within(menu).getByRole('menuitem', { name: 'Orders list' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps showing the result and failed dialogs of the export', async () => {
    runtime.actionStatus = { loading: false, error: null, result: [{ message: 'CSV ready' }] }
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Export requested' })
    expect(within(dialog).getByText('CSV ready')).toBeInTheDocument()
  })
})
