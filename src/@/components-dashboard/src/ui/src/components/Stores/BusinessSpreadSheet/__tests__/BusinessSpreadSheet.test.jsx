/* eslint-disable import/first */
// redesign D-9 (owner, 2026-10-19): the products spreadsheet asks before it deletes. The controller hands the UI
// `pendingRemoval`; the UI shows a danger P/ConfirmDialog (one product by name, several by count), busy while deleting, and
// Cancel leaves everything where it was. The grid and the controller are stand-ins; the dialog is the real one.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const probe = vi.hoisted(() => ({ pending: null, loading: false, confirm: null, cancel: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessSpreadSheet: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      spreadSheetState={{ products: [], loading: probe.loading, result: { error: false } }}
      handleItemChange={() => {}}
      handleRowRemove={() => {}}
      handleAfterSectionEnd={() => {}}
      handleoutsideClickDeselects={() => {}}
      pendingRemoval={probe.pending}
      confirmRemoval={(...args) => probe.confirm(...args)}
      cancelRemoval={(...args) => probe.cancel(...args)}
    />
  )
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  SpreadSheetEditor: () => <div data-testid='sheet' />
}))

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { BusinessSpreadSheet } from '../index'

const dashboardTheme = createDashboardTheme(theme)
const renderSheet = () => render(<ThemeProvider theme={dashboardTheme}><BusinessSpreadSheet /></ThemeProvider>)

beforeEach(() => {
  probe.pending = null
  probe.loading = false
  probe.confirm = vi.fn()
  probe.cancel = vi.fn()
})

describe('Products spreadsheet › confirm before deleting', () => {
  it('shows no dialog while nothing is pending', () => {
    renderSheet()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks about one product by name, with a danger confirm and the consequence', async () => {
    probe.pending = { ids: [5], count: 1, names: ['Burger'] }
    renderSheet()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete Burger?')).toBeTruthy()
    expect(within(dialog).getByText("It is removed from this store's menu. This can't be undone.")).toBeTruthy() // one product: singular (live review)
    expect(within(dialog).getByRole('button', { name: 'Delete product' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('asks about several products by count', async () => {
    probe.pending = { ids: [5, 6, 7], count: 3, names: ['Burger', 'Fries', 'Soda'] }
    renderSheet()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete 3 products?')).toBeTruthy()
    expect(within(dialog).getByText("They are removed from this store's menu. This can't be undone.")).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Delete 3 products' })).toBeTruthy()
  })

  it('Delete runs confirmRemoval and Cancel runs cancelRemoval, nothing else', async () => {
    probe.pending = { ids: [5], count: 1, names: ['Burger'] }
    renderSheet()
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(probe.cancel).toHaveBeenCalledTimes(1)
    expect(probe.confirm).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete product' }))
    expect(probe.confirm).toHaveBeenCalledTimes(1)
  })

  it('while deleting the dialog is busy: Cancel is off and the confirm cannot be repeated', async () => {
    probe.pending = { ids: [5], count: 1, names: ['Burger'] }
    probe.loading = true
    renderSheet()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    await userEvent.click(within(dialog).getByRole('button', { name: /Delete product/ }))
    expect(probe.confirm).not.toHaveBeenCalled()
  })
})
