/* eslint-disable import/first */
// Batch 5.4-B · the wallet refund as Product dialogs (C8): the form in a `lg` Dialog with Cancel and
// Continue, the money confirmation as a ConfirmDialog (alertdialog, focus on Cancel, tone primary,
// verb + amount), and the validation alert. The payload checks stay in RefundToWallet.confirm.test.jsx.
// The Product wrappers are real here.
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{
    configs: {
      refund_cash_wallet_allow_when_order_cancelled: { value: '1' }
    }
  }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }]
}))

// The legacy shell stays a stub; the dialogs under test are the Product ones.
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  Confirm: () => null
}))

import { RefundToWallet } from '../RefundToWallet'

const order = {
  id: 42,
  currency: 'USD',
  paymethod: { gateway: 'cash' },
  summary: { total: 80 },
  payment_events: [
    { id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } },
    { id: 2, event: 'refund', amount: 10 }
  ]
}

const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (props = {}) => {
  const handleOrderRefund = vi.fn()
  renderWithProviders(
    <RefundToWallet
      order={order}
      actionStatus={{ loading: false }}
      handleOrderRefund={handleOrderRefund}
      stripePaymethods={['stripe']}
      braintreePaymethods={[]}
      {...props}
    />
  )
  return { handleOrderRefund }
}

const openForm = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Refund to wallet' }))
  return screen.findByRole('dialog', { name: 'Refund to wallet' })
}

describe('RefundToWallet · form dialog', () => {
  it('is a large dialog named Refund to wallet with Cancel first and Continue last', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openForm(user)
    expect(dialog).toHaveAttribute('data-size', 'lg')
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Continue'])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('shows what was charged and refunded in figures that line up', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openForm(user)
    expect(within(dialog).getByText(/Charged: \$80\.00/)).toHaveClass('odc-num')
  })

  it('starts the focus on the first control, not on the close button', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await openForm(user)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Refund types' })).toHaveFocus())
  })

  it('Escape and Cancel close it and refund nothing', async () => {
    const user = userEvent.setup()
    const { handleOrderRefund } = mount()
    await openForm(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const dialog = await openForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(handleOrderRefund).not.toHaveBeenCalled()
  })

  it('Continue without the amount stays in the form and says what is missing, in its own dialog', async () => {
    const user = userEvent.setup()
    const { handleOrderRefund } = mount()
    const dialog = await openForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    const alert = await screen.findByRole('alertdialog', { name: 'Refund not sent' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The Amount field is required.')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
    expect(handleOrderRefund).not.toHaveBeenCalled()
  })
})

describe('RefundToWallet · confirmation of the money', () => {
  const reachConfirmation = async (user) => {
    const dialog = await openForm(user)
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Amount' }), { target: { value: '25.5' } })
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    return screen.findByRole('alertdialog', { name: 'Refund $25.50?' })
  }

  it('is an alert dialog with the amount in its title, the destination in its body and the verb + amount on the button', async () => {
    const user = userEvent.setup()
    const { handleOrderRefund } = mount()
    const confirm = await reachConfirmation(user)
    expect(within(confirm).getByText('Refund $25.50 to Cash wallet.')).toBeInTheDocument()
    expect(footerButtons(confirm)).toEqual(['Cancel', 'Refund $25.50'])
    expect(within(confirm).getByRole('button', { name: 'Refund $25.50' })).toHaveAttribute('data-variant', 'primary')
    expect(handleOrderRefund).not.toHaveBeenCalled()
  })

  it('puts the focus on Cancel, never on the action', async () => {
    const user = userEvent.setup()
    mount()
    const confirm = await reachConfirmation(user)
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('Escape cancels the confirmation only: the form stays and nothing is refunded', async () => {
    const user = userEvent.setup()
    const { handleOrderRefund } = mount()
    const confirm = await reachConfirmation(user)
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Refund to wallet' })).toBeInTheDocument()
    expect(handleOrderRefund).not.toHaveBeenCalled()
  })

  it('accepting refunds once with the payload of the form', async () => {
    const user = userEvent.setup()
    const { handleOrderRefund } = mount()
    const confirm = await reachConfirmation(user)
    await user.click(within(confirm).getByRole('button', { name: 'Refund $25.50' }))
    expect(handleOrderRefund).toHaveBeenCalledTimes(1)
    expect(handleOrderRefund).toHaveBeenCalledWith({ amount: 25.5, transfer_to: 'cash_wallet' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
