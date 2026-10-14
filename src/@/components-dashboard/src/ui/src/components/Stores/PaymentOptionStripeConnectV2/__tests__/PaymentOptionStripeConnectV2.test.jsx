import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'

const addQueryToUrl = vi.fn()
const removeQueryToUrl = vi.fn()
let user

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1400 })
}))

vi.mock('../../../Shared', () => ({
  Confirm: () => null
}))

vi.mock('../../../../utils', () => ({
  addQueryToUrl: (...args) => addQueryToUrl(...args),
  removeQueryToUrl: (...args) => removeQueryToUrl(...args)
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, color, borderRadius, ...props }) => <button type='button' {...props}>{children}</button>,
  IconButton: ({ children, color, ...props }) => <button type='button' {...props}>{children}</button>
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

const props = {
  open: true,
  onClose: vi.fn(),
  title: 'Stripe Connect v2',
  business: { id: 41 },
  businessPaymethod: { id: 161, allowed_order_types: [1, 2], sites: [] },
  orderTypes: [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }],
  sitesState: { sites: [] },
  changesState: {},
  actionState: { loading: false },
  cleanChangesState: vi.fn(),
  handleChangeBusinessPaymentState: vi.fn(),
  handleSaveClick: vi.fn(),
  handleDeletePaymethod: vi.fn(),
  selectedPaymethodGateway: 'stripe_connect_v2'
}

// The panel darkens this color for its menu
const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, secundary: '#f8f9fa' } }
const renderPanel = (options = {}) => renderWithProviders(<PaymentOptionStripeConnectV2 {...props} />, { theme, ...options })

describe('PaymentOptionStripeConnectV2', () => {
  beforeEach(() => {
    user = { level: 0 }
    addQueryToUrl.mockReset()
    removeQueryToUrl.mockReset()
  })

  it('opens on the Stripe account of the store, with no Save for that tab', () => {
    renderPanel()

    expect(screen.getByRole('heading', { name: 'Stripe Connect v2' })).toBeInTheDocument()
    expect(screen.getByTestId('stripe-account')).toHaveTextContent('business:41')
    expect(screen.queryByTestId('platform-rule')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('lets an administrator set the platform fee of the store', () => {
    renderPanel()

    fireEvent.click(screen.getByText('Platform fee'))

    expect(screen.getByTestId('platform-rule')).toHaveTextContent('platform:41')
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
  })

  it('keeps the platform fee away from a store owner', () => {
    user = { level: 2 }
    renderPanel()

    expect(screen.getByTestId('stripe-account')).toBeInTheDocument()
    expect(screen.queryByText('Platform fee')).not.toBeInTheDocument()
  })

  it('lists the payouts of the store, for an administrator and for its owner', () => {
    user = { level: 2 }
    renderPanel()

    fireEvent.click(screen.getByText('Payouts'))

    expect(screen.getByTestId('payouts')).toHaveTextContent('41')
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('never leaves a tab of its own in the URL, where the other payment methods read a tab number', () => {
    renderPanel()

    expect(removeQueryToUrl).toHaveBeenCalledWith(['paymethod_tab'])
    fireEvent.click(screen.getByText('Platform fee'))
    expect(addQueryToUrl).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Order type'))
    expect(addQueryToUrl).toHaveBeenCalledWith({ paymethod_tab: 1 })
  })

  it('opens on the Stripe account whatever tab another payment method left in the URL', () => {
    renderPanel({ initialEntries: ['/stores/list?paymethod_tab=1'] })

    expect(screen.getByTestId('stripe-account')).toBeInTheDocument()
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
    expect(removeQueryToUrl).toHaveBeenCalledWith(['paymethod_tab'])
  })

  it('still offers the common tabs, with their Save', () => {
    renderPanel()

    fireEvent.click(screen.getByText('Order type'))

    expect(screen.getByText('Delivery')).toBeInTheDocument()
    expect(screen.queryByTestId('stripe-account')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
