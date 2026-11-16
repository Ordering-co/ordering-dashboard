/* eslint-disable import/first */
// redesign F6i-3 (A3-03): a failed refund is told by one dialog of the bill, in the product style: it says what happened
// (the request never reached the API, the API refused it, or its answer cannot be read), says whether money moved when that
// is known, and puts the focus on «Try again». No stacked «Order bill» alert, and the refund's own logic is not touched.
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

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  FeeBillRows: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  TaxBillRows: () => null
}))

import { OrderBill } from '..'

const order = (gateway = 'stripe') => ({
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
const failure = (patch = {}) => ({ loading: false, error: ['Failed to fetch'], errorSource: 'refund', errorKind: 'network', ...patch })

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (actionStatus, props = {}) => {
  const handlers = { handleRefundPaymentsStripe: vi.fn(), handleRefundPaymentsPlugin: vi.fn() }
  const view = renderWithProviders(
    <OrderBill order={order()} actionStatus={actionStatus} {...handlers} {...props} />
  )
  return { ...handlers, ...view }
}

describe('OrderBill · the refund failed before the API answered', () => {
  it('opens one dialog: what happened, that no money moved, what to do; no stacked alert and no raw «Failed to fetch»', async () => {
    mount(failure())
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    expect(within(dialog).getByText('The refund was not sent. No money moved. Try again.')).toBeInTheDocument()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.queryByRole('alertdialog', { name: 'Order bill' })).toBeNull() // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(screen.queryByText('Failed to fetch')).toBeNull()
    expect(footerButtons(dialog)).toEqual(['OK', 'Try again'])
  })

  it('puts the focus on «Try again»', async () => {
    mount(failure())
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Try again' })).toHaveFocus())
  })

  it('«Try again» refunds nothing by itself: it asks the confirmation of the refund again', async () => {
    const user = userEvent.setup()
    const { handleRefundPaymentsStripe } = mount(failure())
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund order #42?' })
    expect(within(confirm).getByRole('button', { name: 'Refund $80.00' })).toBeInTheDocument()
    expect(handleRefundPaymentsStripe).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Refund not sent' })).toBeNull())
  })

  it('«OK» dismisses it and it does not come back on its own', async () => {
    const user = userEvent.setup()
    const status = failure()
    const { rerender, handleRefundPaymentsStripe } = mount(status)
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    rerender(<OrderBill order={order()} actionStatus={status} handleRefundPaymentsStripe={handleRefundPaymentsStripe} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Escape dismisses it too', async () => {
    const user = userEvent.setup()
    mount(failure())
    await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a new failure after another attempt opens it again', async () => {
    const user = userEvent.setup()
    const first = failure()
    const { rerender } = mount(first)
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Refund not sent' })).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    rerender(<OrderBill order={order()} actionStatus={{ ...first, loading: true }} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    rerender(<OrderBill order={order()} actionStatus={failure()} />)
    expect(await screen.findByRole('alertdialog', { name: 'Refund not sent' })).toBeInTheDocument()
  })

  it('stays closed while a new attempt is running, even if the old error is still in the state', async () => {
    mount(failure({ loading: true }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('OrderBill · the API answered with an error', () => {
  it('tells what the API said, translated as every API message is, and does not claim that no money moved', async () => {
    mount(failure({ error: ['Order already refunded'], errorKind: 'api' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    expect(within(dialog).getByText('Order already refunded')).toBeInTheDocument()
    expect(within(dialog).queryByText(/No money moved/)).toBeNull()
    expect(footerButtons(dialog)).toEqual(['OK', 'Try again'])
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Try again' })).toHaveFocus())
  })

  it('accepts the message as a text (Stripe answers with one) and says something when it has none', async () => {
    const { unmount } = mount(failure({ error: 'Charge already refunded', errorKind: 'api' }))
    expect(await within(await screen.findByRole('alertdialog')).findByText('Charge already refunded')).toBeInTheDocument()
    unmount()
    document.getElementById('app-modals')?.remove()
    mount(failure({ error: [], errorKind: 'api' }))
    expect(await screen.findByText('The refund was not sent. Try again.')).toBeInTheDocument()
  })
})

describe('OrderBill · the answer cannot be read', () => {
  it('does not claim the refund was not sent, points to the order and offers no retry', async () => {
    mount(failure({ errorKind: 'unreadable' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    expect(within(dialog).getByText('The answer could not be read, so the refund may have been sent. Check the payment of this order before you try again.')).toBeInTheDocument()
    expect(footerButtons(dialog)).toEqual(['OK'])
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'OK' })).toHaveFocus())
  })
})

describe('OrderBill · the refund to a wallet failed', () => {
  it('tells it in the same dialog; the retry is the wallet form itself, so it offers only OK', async () => {
    mount(failure({ refundTarget: 'wallet' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    expect(within(dialog).getByText('The refund was not sent. No money moved. Try again.')).toBeInTheDocument()
    expect(footerButtons(dialog)).toEqual(['OK'])
  })
})

describe('OrderBill · other errors', () => {
  it('keep the alert of main, named Order bill', async () => {
    mount({ loading: false, error: ['The payment could not be read'] })
    const alert = await screen.findByRole('alertdialog', { name: 'Order bill' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The payment could not be read')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog', { name: 'Refund not sent' })).toBeNull()
  })

  it('a refund error is never told by the Order bill alert', async () => {
    mount(failure())
    await screen.findByRole('alertdialog', { name: 'Refund not sent' })
    expect(screen.queryByRole('alertdialog', { name: 'Order bill' })).toBeNull() // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
  })
})
