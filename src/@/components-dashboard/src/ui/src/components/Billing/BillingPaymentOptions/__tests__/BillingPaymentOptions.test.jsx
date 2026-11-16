/* eslint-disable import/first */
// redesign BM-C (D1, D2, D5, D6, M-BM1, M-BM2, M-BM3, M-BM5, M-BM7, M-BM8, M-BM9, M-BM16, M-BM17, M-BM18, M-BM20, C-2..C-5): the
// Billing dialog (pay an overdue subscription or upgrade to Pro), a real charge. The Product wrappers are real; the controller
// (its state comes in as props), the card picker (lot B) and the billing model (lot A) are the real files or stand-ins we drive.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const stub = vi.hoisted(() => ({
  translations: {},
  showToast: undefined,
  user: { email: 'owner@example.com' }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => stub.translations[key] ?? fallback],
  useToast: () => [null, { showToast: stub.showToast }],
  useSession: () => [{ user: stub.user }],
  ToastType: { Success: 'success', Error: 'error' },
  BillingPaymentOptions: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      subscriptionsState={{ loading: false, error: null, subscriptions: [] }}
      placeOrderState={{ loading: false, error: null, kind: null, messages: [], result: null }}
      confirmState={{ loading: false, error: null, result: null, currentSub: null }}
      planStateToUpgrade={{ loading: false, error: null, plan: {} }}
      paymethodSelected={null}
      handlePaymethodChange={() => {}}
      handlePlaceOrder={() => {}}
    />
  )
}))

// The card picker is lot B's: here it only reports a chosen card and its busy state, and shows whether it was told to lock.
vi.mock('../../PaymentMethodPicker', () => ({
  PaymentMethodPicker: ({ onSelectCard, onBusyChange, disabled }) => (
    <div data-testid='picker' data-disabled={disabled ? '' : undefined}>
      <button type='button' onClick={() => onSelectCard({ id: 'pm1' })}>Choose card</button>
      <button type='button' onClick={() => onBusyChange(true)}>Card busy</button>
      <button type='button' onClick={() => onBusyChange(false)}>Card idle</button>
    </div>
  )
}))

vi.mock('../../../../contexts/ConfigFileContext', async () => {
  const { createContext } = await import('react')
  return { ConfigFileContext: createContext([{}]) }
})
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [{ project: { id: 7 } }] }))

import { BillingPaymentOptions, BillingPaymentOptionsUI, resetBillingUnconfirmedForTests } from '../index'
import { BillingResultNotice } from '../../BillingResultNotice'

const pastDue = {
  id: 11,
  status: 'past_due',
  interval: 'month',
  plan: { plan: { id: 3, name: 'Marketplace Pro' }, price: { type: 'recurring', interval: 'month', amount: 299 } }
}
const otherPastDue = { id: 12, status: 'past_due', plan: { plan: { id: 4, name: 'Other plan' } } }
const active = { id: 21, status: 'active', interval: 'month', plan: { plan: { id: 5, name: 'Marketplace' } } }
const proPlan = {
  id: 77,
  name: 'Marketplace Pro Bundle',
  description: '<p>Everything <b>you</b> need.</p>',
  prices: { monthly: { amount: 599 }, annual: { amount: 5990 } },
  products: [{ product: { id: 1, description: 'Unlimited orders' } }, { product: { id: 2 } }],
  features: ['Custom domain', 'Priority support']
}

const idleOrder = { loading: false, error: null, kind: null, messages: [], result: null }

const baseProps = (overrides = {}) => ({
  open: true,
  onClose: vi.fn(),
  isUpgradeToPro: false,
  upgradeProPlanId: [77],
  showPlanInformation: false,
  handlePaymethodChange: vi.fn(),
  handlePlaceOrder: vi.fn(),
  paymethodSelected: { id: 'pm1' },
  subscriptionsState: { loading: false, error: null, subscriptions: [pastDue] },
  placeOrderState: idleOrder,
  confirmState: { loading: false, error: null, result: null, currentSub: null },
  planStateToUpgrade: { loading: false, error: null, plan: {} },
  ...overrides
})

const upgradeProps = (overrides = {}) => baseProps({
  isUpgradeToPro: true,
  subscriptionsState: { loading: false, error: null, subscriptions: [active] },
  planStateToUpgrade: { loading: false, error: null, plan: proPlan },
  ...overrides
})

const mount = (props) => {
  const view = renderWithProviders(<BillingPaymentOptionsUI {...props} />)
  const update = (next) => view.rerender(<BillingPaymentOptionsUI {...props} {...next} />)
  return { ...view, props, update }
}

const overdueDialog = () => screen.findByRole('dialog', { name: 'Pay your overdue subscription' })
const upgradeDialog = () => screen.findByRole('dialog', { name: 'Upgrade to Marketplace Pro Bundle' })
const payButton = (dialog, name = 'Pay overdue subscription') => within(dialog).getByRole('button', { name })

let reload
let storage

beforeEach(() => {
  stub.translations = {}
  stub.showToast = vi.fn()
  reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  window.sessionStorage.clear()
  resetBillingUnconfirmedForTests()
  storage = window.sessionStorage
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
  document.querySelectorAll('[data-slot="banner-stack"], main, [data-test-extra]').forEach(node => node.remove())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe('BillingPaymentOptions · overdue subscription (D1, D2, M-BM2, M-BM8)', () => {
  it('names the object, says the consequence and starts the focus on Cancel (never on the charge)', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(dialog).toHaveTextContent('Your account is past due. Pay the outstanding invoice to keep it active.')
    expect(payButton(dialog)).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('summarises the overdue plan first: name, recurring price in a figure and the past-due badge', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    const summary = dialog.querySelector('.odc-bpay-summary')
    expect(within(summary).getByText('Marketplace Pro')).toBeInTheDocument()
    expect(within(summary).getByText('$299.00')).toHaveClass('odc-figure')
    expect(within(summary).getByText('/ month')).toBeInTheDocument()
    expect(within(summary).getByText('Payment past due')).toBeInTheDocument()
    // the summary comes before the payment method
    const picker = within(dialog).getByTestId('picker')
    expect(summary.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('never presents the recurring price as an amount to pay today', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(within(dialog).queryByRole('button', { name: /\$/ })).not.toBeInTheDocument()
    expect(dialog.textContent).not.toMatch(/pay \$|\$299\.00 (now|today)/i)
  })

  it('says only the plan name when the subscription has no recurring amount', async () => {
    const tiered = { ...pastDue, plan: { plan: pastDue.plan.plan, price: { type: 'tiered' } } }
    mount(baseProps({ subscriptionsState: { loading: false, error: null, subscriptions: [tiered] } }))
    const dialog = await overdueDialog()
    const summary = dialog.querySelector('.odc-bpay-summary')
    expect(within(summary).getByText('Marketplace Pro')).toBeInTheDocument()
    expect(summary.querySelector('.odc-figure')).toBeNull()
    expect(within(summary).getByText('Payment past due')).toBeInTheDocument()
  })

  it('paints a skeleton instead of the summary while the subscriptions load', async () => {
    mount(baseProps({ subscriptionsState: { loading: true, error: null, subscriptions: [] } }))
    const dialog = await overdueDialog()
    expect(dialog.querySelector('.odc-bpay-summary .odc-skeleton')).not.toBeNull()
    expect(payButton(dialog)).toBeDisabled()
  })

  it('with two overdue subscriptions says one more follows (M-BM18)', async () => {
    mount(baseProps({ subscriptionsState: { loading: false, error: null, subscriptions: [pastDue, otherPastDue] } }))
    const dialog = await overdueDialog()
    expect(within(dialog).getByText('1 more overdue subscription follows after this payment.')).toBeInTheDocument()
  })

  it('with three overdue subscriptions uses the plural', async () => {
    const third = { ...otherPastDue, id: 13 }
    mount(baseProps({ subscriptionsState: { loading: false, error: null, subscriptions: [pastDue, otherPastDue, third] } }))
    const dialog = await overdueDialog()
    expect(within(dialog).getByText('2 more overdue subscriptions follow after this payment.')).toBeInTheDocument()
  })

  it('says nothing about other overdue subscriptions when there are none', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(dialog.textContent).not.toMatch(/more overdue/)
  })

  it('pays with the same arguments as main: plan id, period "monthly" and the overdue subscription', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps())
    const dialog = await overdueDialog()
    await user.click(payButton(dialog))
    expect(props.handlePlaceOrder).toHaveBeenCalledTimes(1)
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 3, period: 'monthly', subscription: pastDue })
  })

  it('wires the picker: the chosen card goes to the controller', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps({ paymethodSelected: null }))
    const dialog = await overdueDialog()
    expect(payButton(dialog)).toBeDisabled() // no card yet
    await user.click(within(dialog).getByRole('button', { name: 'Choose card' }))
    expect(props.handlePaymethodChange).toHaveBeenCalledWith({ id: 'pm1' })
  })
})

describe('BillingPaymentOptions · upgrade to Pro (D6, M-BM3, M-BM17, C-2, C-5)', () => {
  it('is named after the plan, in the title and in the action, with the plan facts as lists', async () => {
    mount(upgradeProps())
    const dialog = await upgradeDialog()
    expect(dialog).toHaveTextContent('Change, pause or cancel your plan at any time.')
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeEnabled()
    expect(dialog.querySelector('.odc-bpay-html b')).toHaveTextContent('you')
    const details = within(dialog).getByRole('heading', { name: 'Plan Details' })
    expect(details).toBeInTheDocument()
    expect(within(dialog).getByText('Unlimited orders')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'All features' })).toBeInTheDocument()
    expect(within(dialog).getByText('Custom domain')).toBeInTheDocument()
    expect(within(dialog).getByText('Priority support')).toBeInTheDocument()
  })

  it('shows the monthly price as a figure, and Annual shows the monthly equivalent and the yearly total', async () => {
    const user = userEvent.setup()
    mount(upgradeProps())
    const dialog = await upgradeDialog()
    const card = dialog.querySelector('.odc-bpay-summary')
    expect(within(card).getByText('$599.00')).toHaveClass('odc-figure')
    expect(within(card).getByText('/ month')).toBeInTheDocument()

    await user.click(within(dialog).getByText('Annual'))
    expect(within(card).getByText('$499.17')).toHaveClass('odc-figure')
    expect(within(card).getByText('$5,990.00')).toHaveClass('odc-figure')
    expect(card).toHaveTextContent('Billed $5,990.00 yearly')
    expect(dialog.textContent).not.toContain('${')

    await user.click(within(dialog).getByText('Monthly'))
    expect(within(card).getByText('$599.00')).toBeInTheDocument()
    expect(card).not.toHaveTextContent('Billed')
  })

  it('the Monthly | Annual control is labelled and only there when the plan has both prices', async () => {
    mount(upgradeProps())
    const dialog = await upgradeDialog()
    expect(within(dialog).getByRole('group', { name: 'Billing period' })).toBeInTheDocument()
  })

  it('without an annual price there is no period control', async () => {
    mount(upgradeProps({ planStateToUpgrade: { loading: false, error: null, plan: { ...proPlan, prices: { monthly: { amount: 599 } } } } }))
    const dialog = await upgradeDialog()
    expect(within(dialog).queryByText('Annual')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('group', { name: 'Billing period' })).not.toBeInTheDocument()
  })

  // Owner decision 16 B (2026-10-21): with a single price the period comes from the plan, never a monthly that does not exist.
  it('with only an annual price it asks for "annual" and shows the yearly total (owner decision 16)', async () => {
    const user = userEvent.setup()
    const { props } = mount(upgradeProps({ planStateToUpgrade: { loading: false, error: null, plan: { ...proPlan, prices: { annual: { amount: 5990 } } } } }))
    const dialog = await upgradeDialog()
    const card = dialog.querySelector('.odc-bpay-summary')
    expect(within(dialog).queryByRole('group', { name: 'Billing period' })).not.toBeInTheDocument()
    expect(within(card).getByText('$499.17')).toHaveClass('odc-figure')
    expect(card).toHaveTextContent('Billed $5,990.00 yearly')
    await user.click(payButton(dialog, 'Upgrade to Marketplace Pro Bundle'))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'annual', subscription: active })
  })

  it('with only a monthly price it asks for "monthly" (owner decision 16)', async () => {
    const user = userEvent.setup()
    const { props } = mount(upgradeProps({ planStateToUpgrade: { loading: false, error: null, plan: { ...proPlan, prices: { monthly: { amount: 599 } } } } }))
    const dialog = await upgradeDialog()
    await user.click(payButton(dialog, 'Upgrade to Marketplace Pro Bundle'))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'monthly', subscription: active })
  })

  it('asks for the period that is shown: Annual goes to the controller as "annual"', async () => {
    const user = userEvent.setup()
    const { props } = mount(upgradeProps())
    const dialog = await upgradeDialog()
    await user.click(within(dialog).getByText('Annual'))
    await user.click(payButton(dialog, 'Upgrade to Marketplace Pro Bundle'))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'annual', subscription: active })
  })

  it('never builds a label with the price: the action is a verb and an object', async () => {
    mount(upgradeProps())
    const dialog = await upgradeDialog()
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle').textContent).not.toMatch(/\$/)
  })

  it('while the plan loads the title and the action say "Upgrade to Pro" and the action waits', async () => {
    mount(upgradeProps({ planStateToUpgrade: { loading: true, error: null, plan: {} } }))
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade to Pro' })
    expect(payButton(dialog, 'Upgrade to Pro')).toBeDisabled()
    expect(dialog.querySelector('.odc-bpay-summary .odc-skeleton')).not.toBeNull()
  })

  it('without a plan to upgrade says so (as main) and keeps the action off', async () => {
    mount(upgradeProps({ planStateToUpgrade: { loading: false, error: null, plan: {} } }))
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade to Pro' })
    expect(await within(dialog).findByText('No plan found to upgrade')).toBeInTheDocument()
    expect(payButton(dialog, 'Upgrade to Pro')).toBeDisabled()
  })

  it('without an active subscription says why before any click and keeps the action off (M-BM17, C-2)', async () => {
    const { props } = mount(upgradeProps({ subscriptionsState: { loading: false, error: null, subscriptions: [] } }))
    const dialog = await upgradeDialog()
    expect(await within(dialog).findByText('Please pay your current subscription before you upgrade to Pro')).toBeInTheDocument()
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeDisabled()
    expect(props.handlePlaceOrder).not.toHaveBeenCalled()
  })

  it('a failed load of the subscriptions is said as such, not as «pay your current subscription» (M-BM17)', async () => {
    mount(upgradeProps({ subscriptionsState: { loading: false, error: 'Network down', subscriptions: [] } }))
    const dialog = await upgradeDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Network down')
    expect(within(dialog).queryByText('Please pay your current subscription before you upgrade to Pro')).toBeNull()
  })

  it('keeps the plan-information notice of main when asked', async () => {
    mount(upgradeProps({ showPlanInformation: true }))
    const dialog = await upgradeDialog()
    expect(within(dialog).getByText('You can create another project, pay per store or upgrade to pro plan')).toBeInTheDocument()
  })

  it('the overdue-only parts are not in the upgrade', async () => {
    mount(upgradeProps({ subscriptionsState: { loading: false, error: null, subscriptions: [active, pastDue, otherPastDue] } }))
    const dialog = await upgradeDialog()
    expect(dialog.textContent).not.toMatch(/Payment past due|more overdue/)
  })
})

describe('BillingPaymentOptions · the card must be settled (M-BM16)', () => {
  it('the picker reporting busy disables the action, and idle enables it again', async () => {
    const user = userEvent.setup()
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(payButton(dialog)).toBeEnabled()
    await user.click(within(dialog).getByRole('button', { name: 'Card busy' }))
    expect(payButton(dialog)).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Card idle' }))
    expect(payButton(dialog)).toBeEnabled()
  })
})

describe('BillingPaymentOptions · the picker is locked while the charge is in flight (main-1)', () => {
  it('tells the picker to lock while paying, and not otherwise', async () => {
    const { update } = mount(baseProps())
    const dialog = await overdueDialog()
    expect(within(dialog).getByTestId('picker')).not.toHaveAttribute('data-disabled')
    update({ placeOrderState: { ...idleOrder, loading: true } })
    expect(within(dialog).getByTestId('picker')).toHaveAttribute('data-disabled')
    update({ placeOrderState: idleOrder })
    expect(within(dialog).getByTestId('picker')).not.toHaveAttribute('data-disabled')
  })
})

describe('BillingPaymentOptions · nothing to pay (main-3)', () => {
  const noneOverdue = { loading: false, error: null, subscriptions: [active] }

  it('with no overdue subscription says so, keeps «Pay» off and never sends a charge', async () => {
    const { props } = mount(baseProps({ subscriptionsState: noneOverdue }))
    const dialog = await overdueDialog()
    expect(await within(dialog).findByText('You have no overdue subscription to pay.')).toBeInTheDocument()
    expect(payButton(dialog)).toBeDisabled()
    expect(props.handlePlaceOrder).not.toHaveBeenCalled()
  })

  it('does not say it while the subscriptions load, nor when their load failed', async () => {
    const { unmount } = mount(baseProps({ subscriptionsState: { loading: true, error: null, subscriptions: [] } }))
    let dialog = await overdueDialog()
    expect(within(dialog).queryByText('You have no overdue subscription to pay.')).toBeNull()
    unmount()
    mount(baseProps({ subscriptionsState: { loading: false, error: 'Network down', subscriptions: [] } }))
    dialog = await overdueDialog()
    expect(within(dialog).queryByText('You have no overdue subscription to pay.')).toBeNull()
    // the error alert already says what happened; «Pay» still has nothing to act on, so it stays off (it never charged before either)
    expect(payButton(dialog)).toBeDisabled()
  })

  it('does not say it when there is an overdue subscription, and the upgrade keeps its own notice', async () => {
    const { unmount } = mount(baseProps())
    let dialog = await overdueDialog()
    expect(within(dialog).queryByText('You have no overdue subscription to pay.')).toBeNull()
    unmount()
    mount(upgradeProps({ subscriptionsState: { loading: false, error: null, subscriptions: [] } }))
    dialog = await upgradeDialog()
    expect(within(dialog).queryByText('You have no overdue subscription to pay.')).toBeNull()
  })
})

describe('BillingPaymentOptions · a fixed target on retry (audit §5)', () => {
  it('after a decline the controller replaces the list with the POST answer: the retry goes to the same subscription', async () => {
    const user = userEvent.setup()
    const { props, update } = mount(baseProps({ subscriptionsState: { loading: false, error: null, subscriptions: [pastDue, otherPastDue] } }))
    const dialog = await overdueDialog()
    await user.click(payButton(dialog))
    expect(props.handlePlaceOrder.mock.calls[0][0].subscription).toBe(pastDue)

    const replaced = { id: 99, status: 'past_due', plan: { plan: { id: 8, name: 'Unrelated' } } }
    update({
      placeOrderState: { loading: false, error: 'Your card was declined', kind: 'declined', messages: ['Your card was declined'], result: null },
      subscriptionsState: { loading: false, error: null, subscriptions: [replaced] }
    })
    await user.click(payButton(dialog))
    expect(props.handlePlaceOrder).toHaveBeenCalledTimes(2)
    expect(props.handlePlaceOrder.mock.calls[1][0].subscription).toBe(pastDue)
    expect(props.handlePlaceOrder.mock.calls[1][0].propPlanId).toBe(3)
  })

  it('when the new list has the same subscription it uses its fresh state', async () => {
    const user = userEvent.setup()
    const { props, update } = mount(baseProps())
    const dialog = await overdueDialog()
    const refreshed = { ...pastDue, status: 'incomplete' }
    update({ subscriptionsState: { loading: false, error: null, subscriptions: [otherPastDue, refreshed] } })
    await user.click(payButton(dialog))
    expect(props.handlePlaceOrder.mock.calls[0][0].subscription).toBe(refreshed)
  })

  it('a subscription that shows up after the dialog opened is picked once, and not changed by a later list', async () => {
    const user = userEvent.setup()
    const { props, update } = mount(baseProps({ subscriptionsState: { loading: true, error: null, subscriptions: [] } }))
    await overdueDialog()
    update({ subscriptionsState: { loading: false, error: null, subscriptions: [pastDue, otherPastDue] } })
    update({ subscriptionsState: { loading: false, error: null, subscriptions: [otherPastDue, pastDue] } })
    await user.click(payButton(screen.getByRole('dialog')))
    expect(props.handlePlaceOrder.mock.calls[0][0].subscription).toBe(pastDue)
  })
})

describe('BillingPaymentOptions · the API says no (D5, M-BM1)', () => {
  const declined = (messages) => ({ loading: false, error: messages[0], kind: 'declined', messages, result: null })

  it('shows every message in an alert, keeps the dialog open and never navigates or reloads', async () => {
    const hrefBefore = window.location.href
    const { props } = mount(baseProps({ placeOrderState: declined(['Your card was declined', 'Try again later']) }))
    const dialog = await overdueDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('Your card was declined')
    expect(alert).toHaveTextContent('Try again later')
    expect(window.location.href).toBe(hrefBefore)
    expect(reload).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(storage.getItem('odc-billing-result')).toBeNull()
  })

  it('translates the messages of the API by their slug', async () => {
    stub.translations = { YOUR_CARD_WAS_DECLINED: 'Tu tarjeta fue rechazada' }
    mount(baseProps({ placeOrderState: declined(['Your card was declined']) }))
    const dialog = await overdueDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tu tarjeta fue rechazada')
  })

  it('a decline can be retried: the action is enabled and the click goes out again', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps({ placeOrderState: declined(['Your card was declined']) }))
    const dialog = await overdueDialog()
    expect(payButton(dialog)).toBeEnabled()
    await user.click(payButton(dialog))
    expect(props.handlePlaceOrder).toHaveBeenCalledTimes(1)
  })

  it('shows the error of the card confirmation (3-D Secure) in the same alert', async () => {
    mount(baseProps({
      placeOrderState: declined(['Payment Failed']),
      confirmState: { loading: false, error: 'Authentication failed', result: null, currentSub: 11 }
    }))
    const dialog = await overdueDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('Payment Failed')
    expect(alert).toHaveTextContent('Authentication failed')
  })

  it('a confirmation error alone is shown too', async () => {
    mount(baseProps({ confirmState: { loading: false, error: 'Authentication failed', result: null, currentSub: 11 } }))
    const dialog = await overdueDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Authentication failed')
  })

  it('an error without text still says «Error»', async () => {
    mount(baseProps({ placeOrderState: { loading: false, error: null, kind: 'declined', messages: [], result: null } }))
    const dialog = await overdueDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Error')
  })

  it('no alert before anything happened', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

// the two 409 of billing-api#100 say what happened and offer the one way forward, never the raw code.
describe('BillingPaymentOptions · plan change refused (billing-api#100)', () => {
  const refused = (code) => ({ loading: false, error: code, kind: 'declined', messages: [code], result: null })
  const pendingAttempt = { id: 31, status: 'incomplete', interval: 'year', plan: { plan: { id: 77, name: 'Marketplace Pro Bundle' } } }

  it('pending_modify_unsupported explains it, offers «Contact support» and keeps «Pay» off', async () => {
    const user = userEvent.setup()
    const intercom = vi.fn()
    vi.stubGlobal('Intercom', intercom)
    const { props } = mount(upgradeProps({ placeOrderState: refused('plan_change.pending_modify_unsupported') }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent("Your project has add-ons billed on another period, so we can't change the plan automatically. Contact us and we'll change it for you.")
    expect(alert).not.toHaveTextContent('plan_change')
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeDisabled()
    await user.click(within(alert).getByRole('button', { name: 'Contact support' }))
    expect(intercom).toHaveBeenCalledWith('showNewMessage')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('pending_modify_unsupported without Intercom keeps the text and shows no «Contact support»', async () => {
    mount(upgradeProps({ placeOrderState: refused('plan_change.pending_modify_unsupported') }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent("Your project has add-ons billed on another period, so we can't change the plan automatically.")
    expect(within(alert).queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
  })

  it('mixed_interval_pending explains it and «Pay the pending payment» retries the incomplete subscription', async () => {
    const user = userEvent.setup()
    const { props } = mount(upgradeProps({
      subscriptionsState: { loading: false, error: null, subscriptions: [active, pendingAttempt] },
      placeOrderState: refused('plan_change.mixed_interval_pending')
    }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('You have a pending payment from an earlier plan change. Pay it to continue, or wait for it to expire (about 24 h) and choose another plan.')
    expect(alert).not.toHaveTextContent('plan_change')
    // one payment offered at a time: the new plan's «Pay» waits while the pending one is offered
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeDisabled()
    await user.click(within(alert).getByRole('button', { name: 'Pay the pending payment' }))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'annual', subscription: pendingAttempt, payPending: true })
  })

  it('payment_pending with the pending subscription in the list offers «Pay the pending payment» on it', async () => {
    const user = userEvent.setup()
    const { props } = mount(upgradeProps({
      subscriptionsState: { loading: false, error: null, subscriptions: [active, pendingAttempt] },
      placeOrderState: refused('plan_change.payment_pending')
    }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('A payment for your plan change is still being confirmed. Complete it or wait a few minutes, then try again.')
    expect(alert).not.toHaveTextContent('plan_change')
    expect(within(alert).queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Pay the pending payment' }))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'annual', subscription: pendingAttempt, payPending: true })
  })

  it('with two incomplete subscriptions «Pay the pending payment» retries the one of the pending plan change', async () => {
    const user = userEvent.setup()
    const otherIncomplete = { id: 30, status: 'incomplete', interval: 'month', plan: { plan: { id: 5, name: 'Marketplace' } } }
    const changing = { ...pendingAttempt, data: { plan_change: { status: 'pending', replaces: [21] } } }
    const { props } = mount(upgradeProps({
      subscriptionsState: { loading: false, error: null, subscriptions: [active, otherIncomplete, changing] },
      placeOrderState: refused('plan_change.payment_pending')
    }))
    const dialog = await upgradeDialog()
    await user.click(within(within(dialog).getByRole('alert')).getByRole('button', { name: 'Pay the pending payment' }))
    expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 77, period: 'annual', subscription: changing, payPending: true })
  })

  describe('an active subscription with a pending change by modify (billing-api#103)', () => {
    const modified = { ...active, data: { status: 'requires_payment_method', plan_change: { status: 'pending', kind: 'modify' } } }

    it('a 3DS that failed on it offers «Pay the pending payment» on that subscription, and «Pay» waits', async () => {
      const user = userEvent.setup()
      const { props } = mount(upgradeProps({
        subscriptionsState: { loading: false, error: null, subscriptions: [modified] },
        placeOrderState: { loading: false, error: 'Payment Failed', kind: 'declined', messages: ['Payment Failed'], result: null },
        confirmState: { loading: false, error: 'Authentication failed', result: null, currentSub: 21 }
      }))
      const dialog = await upgradeDialog()
      expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeDisabled()
      await user.click(within(within(dialog).getByRole('alert')).getByRole('button', { name: 'Pay the pending payment' }))
      expect(props.handlePlaceOrder).toHaveBeenCalledWith({ propPlanId: 5, period: 'monthly', subscription: modified, payPending: true })
    })

    it('payment_pending finds it although it is active', async () => {
      const user = userEvent.setup()
      const { props } = mount(upgradeProps({
        subscriptionsState: { loading: false, error: null, subscriptions: [modified] },
        placeOrderState: refused('plan_change.payment_pending')
      }))
      const dialog = await upgradeDialog()
      await user.click(within(within(dialog).getByRole('alert')).getByRole('button', { name: 'Pay the pending payment' }))
      expect(props.handlePlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ subscription: modified, payPending: true }))
    })

    it('a plain decline without a pending modify keeps today\'s «Pay» and offers no pending payment', async () => {
      mount(upgradeProps({ placeOrderState: { loading: false, error: 'Your card was declined', kind: 'declined', messages: ['Your card was declined'], result: null } }))
      const dialog = await upgradeDialog()
      expect(within(within(dialog).getByRole('alert')).queryByRole('button', { name: 'Pay the pending payment' })).not.toBeInTheDocument()
      expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeEnabled()
    })
  })

  it('mixed_interval_pending without the pending subscription offers only «Reload»', async () => {
    mount(upgradeProps({ placeOrderState: refused('plan_change.mixed_interval_pending') }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(within(alert).queryByRole('button', { name: 'Pay the pending payment' })).not.toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('payment_pending without the pending subscription offers only «Reload»', async () => {
    const user = userEvent.setup()
    mount(upgradeProps({ placeOrderState: refused('plan_change.payment_pending') }))
    const dialog = await upgradeDialog()
    const alert = within(dialog).getByRole('alert')
    expect(within(alert).queryByRole('button', { name: 'Pay the pending payment' })).not.toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('uses the translation of the project for both texts', async () => {
    stub.translations = { BILLING_PLAN_CHANGE_PENDING_ATTEMPT: 'Tienes un pago pendiente' }
    mount(upgradeProps({ placeOrderState: refused('plan_change.mixed_interval_pending') }))
    const dialog = await upgradeDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tienes un pago pendiente')
  })

  it('a card rejected on the new plan keeps «Pay» on to try another card', async () => {
    mount(upgradeProps({ placeOrderState: { loading: false, error: 'Subscription status requires payment method', kind: 'declined', messages: ['Subscription status requires payment method'], result: null } }))
    const dialog = await upgradeDialog()
    expect(payButton(dialog, 'Upgrade to Marketplace Pro Bundle')).toBeEnabled()
    expect(within(dialog).queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })
})

describe('BillingPaymentOptions · the charge may have gone out (D5, M-BM4, M-BM21)', () => {
  const uncertain = { loading: false, error: 'Network down', kind: 'uncertain', messages: ['Network down'], result: null }

  it('warns, offers Reload, and blocks the action even with a card chosen', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps({ placeOrderState: uncertain }))
    const dialog = await overdueDialog()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't confirm the payment. Reload to see your account status before paying again.")
    expect(payButton(dialog)).toBeDisabled()
    await user.click(within(alert).getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(props.handlePlaceOrder).not.toHaveBeenCalled()
  })

  it('takes the focus to «Reload» when «Pay» turns off under it, never to <body> (D-BM1)', async () => {
    const { update } = mount(baseProps())
    const dialog = await overdueDialog()
    payButton(dialog).focus()
    update({ placeOrderState: uncertain })
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Reload' })))
  })

  it('stays blocked after the dialog is closed and opened again, until the page reloads', async () => {
    const first = mount(baseProps({ placeOrderState: uncertain }))
    await overdueDialog()
    first.unmount()

    mount(baseProps()) // a fresh controller: nothing in its state
    const dialog = await overdueDialog()
    expect(within(dialog).getByRole('alert')).toHaveTextContent("We couldn't confirm the payment")
    expect(payButton(dialog)).toBeDisabled()
  })

  it('a decline never blocks the next open', async () => {
    const first = mount(baseProps({ placeOrderState: { loading: false, error: 'No', kind: 'declined', messages: ['No'], result: null } }))
    await overdueDialog()
    first.unmount()
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(payButton(dialog)).toBeEnabled()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BillingPaymentOptions · the payment went through (M-BM5)', () => {
  const paid = { loading: false, error: null, kind: null, messages: [], result: [{ id: 11, status: 'active' }] }

  it('overdue: remembers "paid" for the notice and reloads once, with no toast before', async () => {
    const { update } = mount(baseProps())
    await overdueDialog()
    update({ placeOrderState: paid })
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(storage.getItem('odc-billing-result')).toBe('paid')
    expect(stub.showToast).not.toHaveBeenCalled()
    update({ placeOrderState: { ...paid } })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('upgrade: remembers "upgraded"', async () => {
    const { update } = mount(upgradeProps())
    await upgradeDialog()
    update({ placeOrderState: paid })
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(storage.getItem('odc-billing-result')).toBe('upgraded')
  })

  it('does not reload nor remember anything for a result that comes with an error', async () => {
    mount(baseProps({ placeOrderState: { ...paid, error: 'Payment Failed', kind: 'declined', messages: ['Payment Failed'] } }))
    await overdueDialog()
    expect(reload).not.toHaveBeenCalled()
    expect(storage.getItem('odc-billing-result')).toBeNull()
  })

  it('after the success the action stays off until the reload lands', async () => {
    const { update } = mount(baseProps())
    const dialog = await overdueDialog()
    update({ placeOrderState: paid })
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(payButton(dialog)).toBeDisabled()
  })
})

describe('BillingPaymentOptions · closing', () => {
  it('Cancel, the X and Escape call onClose', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps())
    const dialog = await overdueDialog()
    // the layer takes Escape once it is the active one: wait for the focus to land on Cancel
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(3)
  })

  it('open={false} paints nothing', () => {
    mount(baseProps({ open: false }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('while paying: the action is busy, Cancel is off and neither Escape nor the X close it', async () => {
    const user = userEvent.setup()
    const { props } = mount(baseProps({ placeOrderState: { ...idleOrder, loading: true } }))
    const dialog = await overdueDialog()
    const pay = payButton(dialog)
    expect(pay).toHaveAttribute('aria-busy', 'true')
    await user.click(pay) // a busy button swallows the click: no second charge
    expect(props.handlePlaceOrder).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    // redesign (row 51 R1-1): the X looks active only if it works, so it is off while the charge is in flight
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('the X is active again when no charge is in flight (R1-1)', async () => {
    mount(baseProps())
    const dialog = await overdueDialog()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  it('is wired to the billing controller of main through the exported component', async () => {
    renderWithProviders(<BillingPaymentOptions open onClose={() => {}} isUpgradeToPro={false} upgradeProPlanId={[1]} />)
    expect(await screen.findByRole('dialog', { name: 'Pay your overdue subscription' })).toBeInTheDocument()
  })
})

describe('BillingPaymentOptions · where the focus goes when the shell unmounts the dialog (C-4)', () => {
  const stubLayout = () => vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}])

  const closeWithUnmount = async (props) => {
    const user = userEvent.setup()
    const holder = {}
    const onClose = vi.fn(() => act(() => holder.view.unmount()))
    holder.view = mount({ ...props, onClose })
    const dialog = await overdueDialog()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    return onClose
  }

  it('goes to the "Pay now" of the shell notice when it is on the page', async () => {
    stubLayout()
    const banner = document.createElement('div')
    banner.setAttribute('data-slot', 'banner-stack')
    banner.innerHTML = '<div role="alert"><h1>Past due</h1><button type="button">Pay now</button></div>'
    document.body.append(banner)
    const onClose = await closeWithUnmount(baseProps())
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay now' })).toHaveFocus())
  })

  it('goes to the start of the page content when there is no notice', async () => {
    stubLayout()
    const main = document.createElement('main')
    main.innerHTML = '<h1>Home</h1>'
    document.body.append(main)
    await closeWithUnmount(baseProps())
    await waitFor(() => expect(main.querySelector('h1')).toHaveFocus())
  })

  it('does nothing when the focus is already on a real control', async () => {
    stubLayout()
    const opener = document.createElement('button')
    opener.textContent = 'Upgrade to Pro'
    opener.setAttribute('data-test-extra', '')
    document.body.append(opener)
    const user = userEvent.setup()
    const onClose = vi.fn(() => { opener.focus() })
    mount(baseProps({ onClose }))
    const dialog = await overdueDialog()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve())) })
    expect(opener).toHaveFocus()
  })
})

describe('BillingResultNotice (M-BM5)', () => {
  it('shows the payment toast once and clears the mark', () => {
    window.sessionStorage.setItem('odc-billing-result', 'paid')
    const view = renderWithProviders(<BillingResultNotice />)
    expect(stub.showToast).toHaveBeenCalledTimes(1)
    expect(stub.showToast).toHaveBeenCalledWith('success', 'Payment received.')
    expect(window.sessionStorage.getItem('odc-billing-result')).toBeNull()
    expect(view.container).toBeEmptyDOMElement()
    view.unmount()
    renderWithProviders(<BillingResultNotice />)
    expect(stub.showToast).toHaveBeenCalledTimes(1)
  })

  it('says the plan was updated after an upgrade', () => {
    window.sessionStorage.setItem('odc-billing-result', 'upgraded')
    renderWithProviders(<BillingResultNotice />)
    expect(stub.showToast).toHaveBeenCalledWith('success', 'Plan updated Successfully')
  })

  it('shows nothing without a mark, nor for anything else under the key', () => {
    renderWithProviders(<BillingResultNotice />)
    window.sessionStorage.setItem('odc-billing-result', 'something else')
    renderWithProviders(<BillingResultNotice />)
    expect(stub.showToast).not.toHaveBeenCalled()
  })

  it('uses the translation of the project', () => {
    stub.translations = { BILLING_PAYMENT_RECEIVED: 'Pago recibido.' }
    window.sessionStorage.setItem('odc-billing-result', 'paid')
    renderWithProviders(<BillingResultNotice />)
    expect(stub.showToast).toHaveBeenCalledWith('success', 'Pago recibido.')
  })

  // (owner decision 4 of the parity audit, 2026-10-27): main counted the Rewardful conversion when the dialog opened, so
  // paying with a saved card counted too. It is counted once a payment went through, whatever the card, after the reload.
  describe('the Rewardful conversion', () => {
    afterEach(() => { delete window.rewardful })

    it.each(['paid', 'upgraded'])('is counted once after a payment that went through (%s), with the email of the session', (mark) => {
      window.rewardful = vi.fn()
      window.sessionStorage.setItem('odc-billing-result', mark)
      renderWithProviders(<BillingResultNotice />)
      expect(window.rewardful).toHaveBeenCalledTimes(1)
      expect(window.rewardful).toHaveBeenCalledWith('convert', { email: 'owner@example.com' })
      renderWithProviders(<BillingResultNotice />)
      expect(window.rewardful).toHaveBeenCalledTimes(1)
    })

    it('is not counted without a payment, and a page without Rewardful does not fail', () => {
      window.rewardful = vi.fn()
      renderWithProviders(<BillingResultNotice />)
      expect(window.rewardful).not.toHaveBeenCalled()
      delete window.rewardful
      window.sessionStorage.setItem('odc-billing-result', 'paid')
      expect(() => renderWithProviders(<BillingResultNotice />)).not.toThrow()
    })
  })
})
