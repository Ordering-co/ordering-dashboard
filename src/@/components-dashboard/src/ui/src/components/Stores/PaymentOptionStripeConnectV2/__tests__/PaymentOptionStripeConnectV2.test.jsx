/* eslint-disable import/first */
// main on the redesign's PaymentOption (ProviderPanel): adapted for . The panel no longer writes the URL itself:
// it reports the tab to the form through `onTabChange` (a number for a common tab, `null` for a tab of Stripe Connect).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

let user

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user }]
}))

vi.mock('../../../Shared/StripeConnectAccount', () => ({
  StripeConnectAccount: ({ ownerType, ownerId }) => <div data-testid='stripe-account'>{ownerType}:{ownerId}</div>
}))

vi.mock('../../../Shared/PayoutRuleForm', () => ({
  PayoutRuleForm: ({ scope, ownerId }) => <div data-testid='platform-rule'>{scope}:{ownerId}</div>
}))

vi.mock('../Payouts', () => ({
  Payouts: ({ businessId }) => <div data-testid='payouts'>{businessId}</div>
}))

import { PaymentOptionStripeConnectV2 } from '../index'

const props = () => ({
  paymethod: { id: 3, gateway: 'stripe_connect_v2', name: 'Stripe Connect v2' },
  businessPaymethod: { id: 161, paymethod_id: 3, enabled: true, allowed_order_types: [1], sites: [], devices: [] },
  gatewayName: 'Stripe Connect v2',
  storeName: 'Burger Hub',
  business: { id: 41 },
  sites: [{ id: 5, name: 'Website' }],
  devices: [],
  orderTypes: [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }]
})

const setup = (overrides = {}) => {
  const userEvents = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  const utils = renderWithProviders(
    <PaymentOptionStripeConnectV2 {...props()} onSave={onSave} onTabChange={onTabChange} {...overrides} />,
    { theme }
  )
  return { user: userEvents, onSave, onTabChange, ...utils }
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent)

describe('PaymentOptionStripeConnectV2', () => {
  beforeEach(() => {
    user = { level: 0 }
  })

  it('opens on the Stripe account of the store, with no Save for that tab', () => {
    setup()

    expect(screen.getByRole('tablist', { name: 'Stripe Connect v2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Stripe account' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stripe-account')).toHaveTextContent('business:41')
    expect(screen.queryByTestId('platform-rule')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('draws its own tabs before the common ones', () => {
    setup()

    expect(tabNames()).toEqual(['Stripe account', 'Platform fee', 'Payouts', 'Channels', 'Order type'])
  })

  it('lets an administrator set the platform fee of the store', async () => {
    const { user: events } = setup()

    await events.click(screen.getByRole('tab', { name: 'Platform fee' }))

    expect(screen.getByTestId('platform-rule')).toHaveTextContent('platform:41')
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('keeps the platform fee away from a store owner', () => {
    user = { level: 2 }
    setup()

    expect(screen.getByTestId('stripe-account')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Platform fee' })).not.toBeInTheDocument()
    expect(tabNames()).toEqual(['Stripe account', 'Payouts', 'Channels', 'Order type'])
  })

  it('lists the payouts of the store, for an administrator and for its owner', async () => {
    user = { level: 2 }
    const { user: events } = setup()

    await events.click(screen.getByRole('tab', { name: 'Payouts' }))

    expect(screen.getByTestId('payouts')).toHaveTextContent('41')
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('never leaves a tab of its own in the URL, where the other payment methods read a tab number', async () => {
    const { user: events, onTabChange } = setup()

    // the panel reports only what the user picks: `null` asks the form to take `paymethod_tab` away
    expect(onTabChange).not.toHaveBeenCalled()
    await events.click(screen.getByRole('tab', { name: 'Platform fee' }))
    expect(onTabChange).toHaveBeenLastCalledWith(null)
    await events.click(screen.getByRole('tab', { name: 'Payouts' }))
    expect(onTabChange).toHaveBeenLastCalledWith(null)
    expect(onTabChange.mock.calls.flat().every(value => value === null)).toBe(true)

    await events.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
  })

  it('opens on the Stripe account whatever tab another payment method left in the URL', () => {
    const { onTabChange } = setup({ initialTab: 1 })

    expect(screen.getByTestId('stripe-account')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Stripe account' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('checkbox', { name: 'Delivery' })).not.toBeInTheDocument()
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it('still offers the common tabs, with their Save', async () => {
    const { user: events, onSave } = setup()

    await events.click(screen.getByRole('tab', { name: 'Order type' }))

    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument()
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
    // the Save bar of the redesign comes up once something changed
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await events.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await events.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1, 2] })
  })
})
