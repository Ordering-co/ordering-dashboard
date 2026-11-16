/* eslint-disable import/first */
// redesign F6a (D-15): the amount of a refund (wallet form and plugin partial refund) is a brand field, like the
// fields of Edit customer: the field border of C2/C3 (--od-x-field-border), the brand focus ring and radius, the
// control height (44px below 768px). The shared `styles/Input` is not touched: the orders surface scopes it.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: { refund_cash_wallet_allow_when_order_cancelled: { value: '1' } } }],
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
  TaxBillRows: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null
}))

import { OrderBill } from '..'
import { RefundToWallet } from '../RefundToWallet'

afterEach(() => document.getElementById('app-modals')?.remove())

const css = readFileSync(path.resolve(__dirname, '../refund-dialogs.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = css.split('}').map(block => block.split('{')).filter(parts => parts.length === 2)
const declarationsOf = selector => rules
  .filter(([selectors]) => selectors.split(',').map(item => item.trim()).includes(selector))
  .map(([, declarations]) => declarations)
  .join(';')

describe('refund amount field · brand field standard', () => {
  it('the wallet form amount is inside the governed refund field scope', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundToWallet
        order={{ id: 42, currency: 'USD', paymethod: { gateway: 'cash' }, summary: { total: 80 }, payment_events: [{ id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } }, { id: 2, event: 'refund', amount: 10 }] }}
        actionStatus={{ loading: false }}
        handleOrderRefund={vi.fn()}
        stripePaymethods={['stripe']}
        braintreePaymethods={[]}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Refund to wallet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Refund to wallet' })
    const amount = within(dialog).getByRole('textbox', { name: 'Amount' })
    expect(amount.closest('.odc-refund-amount')).not.toBeNull()
  })

  it('the plugin partial refund amount is inside the same scope', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <OrderBill
        order={{ id: 42, currency: 'USD', delivery_type: 2, products: [{ id: 1, type: 'food' }], paymethod: { gateway: 'provider_x' }, summary: { total: 80, subtotal: 80, discount: 0, tax: 0, service_fee: 0 }, taxes: [], fees: [], offers: [], payment_events: [] }}
        actionStatus={{ loading: false }}
        getPluginRefundProvider={() => ({ partial: true })}
        handleRefundPaymentsStripe={vi.fn()}
        handleRefundPaymentsPlugin={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const dialog = await screen.findByRole('dialog', { name: 'Refund order #42' })
    await user.click(within(dialog).getByRole('radio', { name: 'Refund only an amount' }))
    expect(within(dialog).getByRole('textbox', { name: 'Amount' }).closest('.odc-refund-amount')).not.toBeNull()
  })

  it('the scope gives the field the brand roles: field border, focus ring, radius, control height', () => {
    const roles = declarationsOf('.odc-refund-amount .od-field')
    expect(roles).toContain('--od-field-border: var(--od-x-field-border)')
    expect(roles).toContain('--od-field-focus: var(--od-focus-ring-color)')
    expect(roles).toContain('--od-field-focus-width: var(--od-focus-ring-width)')
    expect(roles).toContain('--od-field-radius: var(--od-radius-component)')
    expect(roles).toContain('--od-field-surface: var(--od-bg)')
    expect(roles).toContain('--od-field-text: var(--od-text)')
    expect(roles).toContain('--od-field-font: var(--od-font-sans)')
    expect(declarationsOf('.odc-refund-amount .od-field-input')).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
  })

  it('reaches 44px on a coarse pointer and below 768px of screen (C3)', () => {
    const coarse = css.match(/@media \(pointer: coarse\), \(max-width: 767px\) \{([\s\S]*?\n)\}/)
    expect(coarse).not.toBeNull()
    expect(coarse[1]).toMatch(/\.odc-refund-amount \.od-field-input[\s\S]*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })
})
