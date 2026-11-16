/* eslint-disable import/first */
// Batch 5.4-B · the dialogs of the bill as Product dialogs (C8): the money confirmation of the
// Stripe / plugin refund as a ConfirmDialog (alertdialog, focus on Cancel, verb + amount), the partial
// refund of a plugin in a `sm` Dialog, and the alert. The calls to the controller stay in
// OrderBill.accessibility.test.jsx. The Product wrappers are real here.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseNumber: value => value,
    parsePrice: value => `$${Number(value ?? 0).toFixed(2)}`
  }]
}))

// The legacy shell stays a stub; the dialogs under test are the Product ones.
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  FeeBillRows: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  TaxBillRows: () => null
}))

import { OrderBill } from '..'

const order = (gateway) => ({
  id: 42,
  currency: 'USD',
  delivery_type: 2,
  products: [{ id: 1, type: 'food' }],
  paymethod: { gateway },
  summary: { total: 80, subtotal: 80, discount: 0, tax: 0, service_fee: 0 },
  taxes: [],
  fees: [],
  offers: [],
  payment_events: []
})

const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (props = {}) => {
  const handlers = {
    handleRefundPaymentsStripe: vi.fn(),
    handleRefundPaymentsPlugin: vi.fn()
  }
  renderWithProviders(
    <OrderBill
      order={order('stripe')}
      actionStatus={{ loading: false }}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('OrderBill · refund confirmation', () => {
  const reach = async (user, props) => {
    const handlers = mount(props)
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund order #42?' })
    return { confirm, ...handlers }
  }

  it('is an alert dialog naming the order, saying the consequence and offering verb + amount', async () => {
    const user = userEvent.setup()
    const { confirm, handleRefundPaymentsStripe } = await reach(user)
    expect(within(confirm).getByText('The payment is refunded to the customer’s card. This can’t be undone.')).toBeInTheDocument()
    expect(footerButtons(confirm)).toEqual(['Cancel', 'Refund $80.00'])
    expect(within(confirm).getByRole('button', { name: 'Refund $80.00' })).toHaveAttribute('data-variant', 'primary')
    expect(handleRefundPaymentsStripe).not.toHaveBeenCalled()
  })

  it('puts the focus on Cancel; Escape cancels and refunds nothing', async () => {
    const user = userEvent.setup()
    const { confirm, handleRefundPaymentsStripe } = await reach(user)
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleRefundPaymentsStripe).not.toHaveBeenCalled()
  })

  it('accepting refunds the Stripe payment once', async () => {
    const user = userEvent.setup()
    const { confirm, handleRefundPaymentsStripe, handleRefundPaymentsPlugin } = await reach(user)
    await user.click(within(confirm).getByRole('button', { name: 'Refund $80.00' }))
    expect(handleRefundPaymentsStripe).toHaveBeenCalledTimes(1)
    expect(handleRefundPaymentsPlugin).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a plugin that refunds only the whole payment asks the same and refunds without an amount', async () => {
    const user = userEvent.setup()
    const { confirm, handleRefundPaymentsStripe, handleRefundPaymentsPlugin } = await reach(user, {
      order: order('provider_x'),
      getPluginRefundProvider: () => ({ partial: false })
    })
    await user.click(within(confirm).getByRole('button', { name: 'Refund $80.00' }))
    expect(handleRefundPaymentsPlugin).toHaveBeenCalledTimes(1)
    expect(handleRefundPaymentsPlugin).toHaveBeenCalledWith()
    expect(handleRefundPaymentsStripe).not.toHaveBeenCalled()
  })
})

describe('OrderBill · partial refund of a plugin', () => {
  const partial = { order: order('provider_x'), getPluginRefundProvider: () => ({ partial: true }) }
  const open = async (user, props = {}) => {
    const handlers = mount({ ...partial, ...props })
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    return { dialog: await screen.findByRole('dialog', { name: 'Refund order #42' }), ...handlers }
  }

  it('is a small dialog named after the order, with Cancel first and Refund last', async () => {
    const user = userEvent.setup()
    const { dialog } = await open(user)
    expect(dialog).toHaveAttribute('data-size', 'sm')
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Refund'])
    expect(within(dialog).getByRole('radiogroup', { name: 'How do you want to refund?' })).toBeInTheDocument()
  })

  it('Escape and Cancel close it and refund nothing', async () => {
    const user = userEvent.setup()
    const { handleRefundPaymentsPlugin } = await open(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Refund order #42' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(handleRefundPaymentsPlugin).not.toHaveBeenCalled()
  })

  it('refunding all sends no amount', async () => {
    const user = userEvent.setup()
    const { dialog, handleRefundPaymentsPlugin } = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    expect(handleRefundPaymentsPlugin).toHaveBeenCalledTimes(1)
    expect(handleRefundPaymentsPlugin).toHaveBeenCalledWith(null)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an amount over the total is not sent: its own dialog says why and the form stays', async () => {
    const user = userEvent.setup()
    const { dialog, handleRefundPaymentsPlugin } = await open(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Refund only an amount' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount' }), '90')
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    const alert = await screen.findByRole('alertdialog', { name: 'Order bill' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The refund amount cannot exceed the order total.')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
    expect(handleRefundPaymentsPlugin).not.toHaveBeenCalled()
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Order bill' })).toBeNull()) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(screen.getByRole('dialog', { name: 'Refund order #42' })).toBeInTheDocument()
  })
})

describe('OrderBill · alert', () => {
  it('shows what the action answered in a dialog named Order bill, with one OK', async () => {
    mount({ actionStatus: { loading: false, error: ['The payment could not be read'] } })
    const alert = await screen.findByRole('alertdialog', { name: 'Order bill' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The payment could not be read')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
  })
})
