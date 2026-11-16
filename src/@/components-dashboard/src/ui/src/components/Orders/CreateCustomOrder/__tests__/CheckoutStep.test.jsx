/* eslint-disable import/first */
import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  cart: null,
  controller: { paymethodSelected: { gateway: 'cash' }, placing: false, errors: null },
  validationFields: { fields: { checkout: {} } },
  options: { type: 2 },
  handlerClickPlaceOrder: null,
  // Stable references: Checkout's effects depend on them, a fresh object per render would loop.
  session: [{ token: 'token', user: { id: 1 } }],
  customer: [{ user: null }],
  config: [{ configs: {} }],
  api: [{ root: 'http://api', appId: 'app' }],
  utils: [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  confirmCart: vi.fn(async () => ({ result: {} })),
  orderActions: null,
  orderState: null
}))
mocks.orderActions = { confirmCart: mocks.confirmCart }
mocks.orderState = () => {
  // Same object while the cart and the options do not change.
  const key = `${mocks.options.type}|${JSON.stringify(mocks.cart)}`
  if (mocks.orderState.cache?.key !== key) {
    mocks.orderState.cache = { key, value: { loading: false, options: mocks.options, carts: { 'cart-1': mocks.cart } } }
  }
  return mocks.orderState.cache.value
}

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => mocks.utils,
  useOrder: () => [mocks.orderState(), mocks.orderActions],
  useSession: () => mocks.session,
  useApi: () => mocks.api,
  useValidationFields: () => [mocks.validationFields],
  useConfig: () => mocks.config,
  useCustomer: () => mocks.customer,
  Checkout: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      cart={mocks.cart}
      errors={mocks.controller.errors}
      placing={mocks.controller.placing}
      paymethodSelected={mocks.controller.paymethodSelected}
      businessDetails={{ loading: false, business: { id: 5, configs: [], paymethods: [] } }}
      handlePaymethodChange={vi.fn()}
      handlerClickPlaceOrder={mocks.handlerClickPlaceOrder}
    />
  )
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  NotFoundSource: () => null
}))
vi.mock('../PaymentOptions', () => ({ PaymentOptions: () => <div data-testid='payment-options' /> }))
vi.mock('../PaymentOptionWallet', () => ({ PaymentOptionWallet: () => null }))
vi.mock('../DriverTips', () => ({ DriverTips: () => null }))
vi.mock('../CartBill', () => ({ CartBill: () => <div data-testid='cart-bill' /> }))

import { Checkout } from '../Checkout'

const validCart = () => ({
  uuid: 'cart-1',
  business_id: 5,
  status: 0,
  valid: true,
  valid_address: true,
  valid_products: true,
  valid_maximum: true,
  valid_minimum: true,
  balance: 20,
  total: 20,
  products: [{ id: 1, quantity: 1 }]
})

const renderCheckout = (props = {}) => renderWithProviders(<Checkout cartUuid='cart-1' {...props} />)

const lastRegistered = register => register.mock.calls.at(-1)[0]

beforeEach(() => {
  window.localStorage.removeItem('user-customer')
  mocks.cart = validCart()
  mocks.controller = { paymethodSelected: { gateway: 'cash' }, placing: false, errors: null }
  mocks.validationFields = { fields: { checkout: {} } }
  mocks.options = { type: 2 }
  mocks.handlerClickPlaceOrder = vi.fn(() => ({ error: false }))
})

describe('Checkout · place-order action for the wizard footer (5.5-B)', () => {
  it('without a host it keeps its own Place Order button, as before', async () => {
    renderCheckout()
    const button = await screen.findByRole('button', { name: 'Place Order' })
    expect(button).toBeEnabled()
    await userEvent.setup().click(button)
    expect(mocks.handlerClickPlaceOrder).toHaveBeenCalledTimes(1)
  })

  it('with a host it registers the action and does not draw a second button', async () => {
    const register = vi.fn()
    renderCheckout({ onRegisterPlaceOrder: register })
    await screen.findByTestId('cart-bill')
    expect(screen.queryByRole('button', { name: /Place order/i })).not.toBeInTheDocument()
    const action = lastRegistered(register)
    expect(action).toMatchObject({ disabled: false, placing: false, reason: null })
    expect(typeof action.place).toBe('function')
    act(() => { action.place() })
    expect(mocks.handlerClickPlaceOrder).toHaveBeenCalledTimes(1)
  })

  it('reports the order as disabled with the reason of the first blocker, and as placing', async () => {
    mocks.controller.paymethodSelected = null
    const register = vi.fn()
    const view = renderCheckout({ onRegisterPlaceOrder: register })
    await screen.findByTestId('cart-bill')
    expect(lastRegistered(register)).toMatchObject({
      disabled: true,
      reason: 'Please, select a payment method to place order.'
    })

    mocks.controller.paymethodSelected = { gateway: 'cash' }
    mocks.controller.placing = true
    view.rerender(<Checkout cartUuid='cart-1' onRegisterPlaceOrder={register} />)
    expect(lastRegistered(register)).toMatchObject({ disabled: true, placing: true })
  })

  it('keeps the minimum and maximum subtotal messages of the old button as the reason', async () => {
    mocks.cart = { ...validCart(), valid_minimum: false, minimum: 15, valid: false }
    const register = vi.fn()
    renderCheckout({ onRegisterPlaceOrder: register })
    await screen.findByTestId('cart-bill')
    expect(lastRegistered(register)).toMatchObject({ disabled: true, reason: 'Minimum subtotal order: $15.00' })

    mocks.cart = { ...validCart(), valid_maximum: false, maximum: 90, valid: false }
    const second = vi.fn()
    renderCheckout({ onRegisterPlaceOrder: second })
    await screen.findAllByTestId('cart-bill')
    expect(lastRegistered(second)).toMatchObject({ disabled: true, reason: 'Maximum subtotal order: $90.00' })
  })

  it('releases the action when it unmounts, and when the cart is being processed', async () => {
    const register = vi.fn()
    const view = renderCheckout({ onRegisterPlaceOrder: register })
    await screen.findByTestId('cart-bill')
    view.unmount()
    expect(register).toHaveBeenLastCalledWith(null)

    const processing = vi.fn()
    mocks.cart = { ...validCart(), status: 2 }
    renderCheckout({ onRegisterPlaceOrder: processing })
    await screen.findByText(/Your order is being processed/)
    expect(processing).toHaveBeenLastCalledWith(null)
  })
})

describe('Checkout · inline notices (5.5-B)', () => {
  it('shows the blocking warnings as inline notices with the text of today', async () => {
    mocks.controller.paymethodSelected = null
    mocks.cart = { ...validCart(), valid_address: false, valid_products: false }
    renderCheckout()
    await screen.findByTestId('cart-bill')
    for (const text of [
      'Selected address is invalid, please select a closer address.',
      'Please, select a payment method to place order.',
      'Some products are invalid, please check them.'
    ]) {
      const notice = screen.getByText(text).closest('.odc-notice')
      expect(notice).not.toBeNull()
      expect(notice).toHaveAttribute('data-tone', 'warning')
      expect(notice).toHaveAttribute('role', 'status')
    }
  })

  it('shows the pending-cart message as a warning notice', async () => {
    mocks.cart = { ...validCart(), status: 2 }
    renderCheckout()
    const notice = (await screen.findByText(/Your order is being processed/)).closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
  })

  it('shows the controller errors above the payment methods as an alert with an Accept action', async () => {
    mocks.controller.errors = ['Card declined']
    const { container } = renderCheckout()
    await screen.findByTestId('cart-bill')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Card declined')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Accept' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container.querySelector('.odc-steps-checkout')).not.toBeNull()
  })
})
