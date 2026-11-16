/* eslint-disable import/first */
// main, `extraTabs` of ProviderPanel. Stripe Connect v2 brings tabs of its own, drawn BEFORE the common ones.
// main's rules: (1) the panel opens on the first extra tab whatever tab the URL carries; (2) an extra tab is never kept in the URL
// (`onTabChange(null)`), a common tab still writes its number; (3) an extra tab has no Save bar (its content saves by itself);
// (4) a gateway that passes no extraTabs behaves exactly as before.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../../../Shared/Product/LeaveGuard'
import { ProviderPanel } from '../index'

const PAYMETHOD = { id: 1, gateway: 'stripe_connect_v2', name: 'Stripe Connect v2' }

// the same indices the generic PaymentOption keeps from main
const TABS = [
  { id: 'channels', index: 0 },
  { id: 'order_types', index: 1 }
]

const EXTRA_TABS = [
  { id: 'stripe_account', label: 'Stripe account', content: <p>Stripe account body</p> },
  { id: 'payouts', label: 'Payouts', content: <p>Payouts body</p> }
]

const record = () => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: {},
  data_sandbox: {},
  allowed_order_types: [1],
  sites: [],
  devices: []
})

const baseProps = () => ({
  paymethod: PAYMETHOD,
  businessPaymethod: record(),
  gatewayName: 'Stripe Connect v2',
  storeName: 'Burger Hub',
  tabs: TABS,
  sites: [{ id: 1, name: 'Web' }],
  orderTypes: [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }]
})

const setup = (props = {}, options = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  const utils = renderWithProviders(
    <ProviderPanel {...baseProps()} extraTabs={EXTRA_TABS} onSave={onSave} onTabChange={onTabChange} {...props} />,
    { theme, ...options }
  )
  return { user, onSave, onTabChange, ...utils }
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent)
const selected = (name) => expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')

describe('extraTabs: where they are and where the panel opens', () => {
  it('draws the extra tabs before the common ones, in the same tablist', () => {
    setup()
    expect(tabNames()).toEqual(['Stripe account', 'Payouts', 'Channels', 'Order type'])
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(screen.getByRole('tablist', { name: 'Stripe Connect v2' })).toBeInTheDocument()
  })

  it('opens on the first extra tab and shows its content', () => {
    setup()
    selected('Stripe account')
    expect(screen.getByText('Stripe account body')).toBeInTheDocument()
    expect(screen.queryByText('Payouts body')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('opens on the first extra tab whatever initialTab another gateway left, valid or not', () => {
    const { unmount } = setup({ initialTab: 1 })
    selected('Stripe account')
    expect(screen.queryByRole('checkbox', { name: 'Delivery' })).not.toBeInTheDocument()
    unmount()
    setup({ initialTab: 42 })
    selected('Stripe account')
  })

  it('never calls onTabChange on mount', () => {
    const { onTabChange } = setup({ initialTab: 1 })
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it('a tab the user picks wins over the opening one, and the opening one does not come back', async () => {
    const { user } = setup({ initialTab: 1 })
    await user.click(screen.getByRole('tab', { name: 'Payouts' }))
    selected('Payouts')
    expect(screen.getByText('Payouts body')).toBeInTheDocument()
    expect(screen.queryByText('Stripe account body')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    selected('Order type')
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument()
  })

  it('draws the extra tabs even when no common tab is available', () => {
    setup({ tabs: [] })
    expect(tabNames()).toEqual(['Stripe account', 'Payouts'])
    expect(screen.getByText('Stripe account body')).toBeInTheDocument()
  })
})

describe('extraTabs: the URL', () => {
  it('picking an extra tab sends null, so the form takes the param away', async () => {
    const { user, onTabChange } = setup()
    await user.click(screen.getByRole('tab', { name: 'Payouts' }))
    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith(null)
  })

  it('picking a common tab still sends its number', async () => {
    const { user, onTabChange } = setup()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith(1)
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(0)
  })

  it('going back to an extra tab from a common one sends null again', async () => {
    const { user, onTabChange } = setup()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    await user.click(screen.getByRole('tab', { name: 'Stripe account' }))
    expect(onTabChange.mock.calls).toEqual([[1], [null]])
  })
})

describe('extraTabs: the Save bar', () => {
  it('has no Save bar on an extra tab, and has it on a common one once something changed', async () => {
    const { user } = setup()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  // review r1 #1: a change pending in a common tab stays said (count and Save) while an extra tab is current
  it('keeps the bar of a change pending in a common tab while an extra tab is current, and the draft is still there', async () => {
    const { user, onSave } = setup()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    expect(screen.getByRole('group', { name: 'Stripe Connect v2' })).toHaveTextContent('1 unsaved change')

    await user.click(screen.getByRole('tab', { name: 'Payouts' }))
    expect(screen.getByRole('group', { name: 'Stripe Connect v2' })).toHaveTextContent('1 unsaved change')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.getByRole('checkbox', { name: 'Pickup' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1, 2] })
  })

  it('the leave guard still sees the unsaved changes made in a common tab while an extra tab is current', async () => {
    const proceed = vi.fn()
    const Host = () => {
      const { context, requestLeave, dialog } = useLeaveGuardHost()
      return (
        <LeaveGuardContext.Provider value={context}>
          <ProviderPanel {...baseProps()} extraTabs={EXTRA_TABS} onSave={vi.fn().mockResolvedValue({ ok: true })} />
          <button type='button' onClick={() => requestLeave(proceed)}>Leave</button>
          <LeaveDialog {...dialog} title='Unsaved changes' keepLabel='Keep editing' saveLabel='Save and leave' discardLabel='Discard and leave' closeLabel='Close' description='You have unsaved changes' />
        </LeaveGuardContext.Provider>
      )
    }
    const user = userEvent.setup()
    renderWithProviders(<Host />, { theme })
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('tab', { name: 'Stripe account' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard and leave' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
  })
})

describe('without extraTabs the panel is the one it was', () => {
  it.each([
    ['absent', {}],
    ['empty', { extraTabs: [] }]
  ])('%s: only the common tabs, the first one open, initialTab honoured, never null', async (_name, extra) => {
    const { user, onTabChange } = setup({ extraTabs: undefined, ...extra })
    expect(tabNames()).toEqual(['Channels', 'Order type'])
    selected('Channels')
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange.mock.calls).toEqual([[1], [0]])
  })

  it('honours initialTab', () => {
    setup({ extraTabs: undefined, initialTab: 1 })
    selected('Order type')
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument()
  })
})
