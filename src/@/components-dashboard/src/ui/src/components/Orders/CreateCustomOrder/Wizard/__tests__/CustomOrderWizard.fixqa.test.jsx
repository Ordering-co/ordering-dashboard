/* eslint-disable import/first */
import React, { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: parity items and the guard that keeps a step error from blanking the app.
const mocks = vi.hoisted(() => ({
  orderState: { loading: false, options: { type: 1 } },
  throwIn: { business: false, products: false, customer: false, map: false }
}))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [mocks.orderState, { changeAddress: vi.fn() }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../SelectCustomer', () => ({
  SelectCustomer: () => {
    if (mocks.throwIn.customer) throw new Error('customer step broke')
    return <input aria-label='Phone number' />
  }
}))
vi.mock('../../OrderTypeSelector', () => ({ OrderTypeSelector: () => <div data-testid='order-type' /> }))
vi.mock('../../SelectBusinesses', () => ({
  SelectBusinesses: () => {
    if (mocks.throwIn.business) throw new TypeError("Cannot read properties of undefined (reading 'maps')")
    return <div data-testid='select-businesses' />
  }
}))
vi.mock('../../Map', () => ({ Map: () => <div data-testid='map' /> }))
// The product search keeps its own text, like the real one: it survives only while it stays mounted.
vi.mock('../../SelectProducts', () => ({
  SelectProducts: () => {
    const [value, setValue] = useState('')
    if (mocks.throwIn.products) throw new Error('products step broke')
    return <input aria-label='Search products' value={value} onChange={event => setValue(event.target.value)} />
  }
}))
vi.mock('../../Checkout', () => ({ Checkout: () => <div data-testid='checkout' /> }))

import { CustomOrderDetails } from '../../CustomOrderDetails'

const selectedUser = { id: 1, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' }
const customerAddress = { id: 7, address: '1 Main St', location: { lat: 1, lng: 2 } }
const selectedBusiness = { id: 5, slug: 'store', name: 'Corner Store' }
const cart = { uuid: 'cart-1', total: 31.5, products: [{ id: 1, name: 'Burger', quantity: 2 }] }

const baseProps = () => ({
  phone: '',
  onChangeNumber: vi.fn(),
  customersPhones: { users: [], loading: false, error: null },
  setCustomersPhones: vi.fn(),
  businessList: { loading: false, businesses: [selectedBusiness] },
  selectedUser: null,
  selectedBusiness: null,
  setSelectedUser: vi.fn(),
  setSelectedBusiness: vi.fn(),
  productList: { loading: false, products: [] },
  getProducts: vi.fn(),
  handeUpdateProductCart: vi.fn(),
  cart: null,
  onClose: vi.fn(),
  handleOpenCustomOrderDetail: vi.fn(),
  handlePlaceOrderByTotal: vi.fn(),
  extraFields: {},
  setExtraFields: vi.fn(),
  actionState: { loading: false, error: null },
  customerAddress: null
})

const renderWizard = (overrides = {}) => renderWithProviders(<CustomOrderDetails {...baseProps()} {...overrides} />)
const continueButton = () => screen.getByRole('button', { name: /^Continue$|^Place order/ })
const ready3 = { selectedUser, customerAddress, selectedBusiness, cart }

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => {
  mocks.orderState = { loading: false, options: { type: 1 } }
  mocks.throwIn = { business: false, products: false, customer: false, map: false }
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

describe('Create custom order wizard · parity with main (E3)', () => {
  it('the summary says "Not set yet" for the delivery type while the order has none', () => {
    mocks.orderState = { loading: false, options: {} }
    renderWizard({ selectedUser, customerAddress })
    const summary = screen.getByRole('region', { name: 'Order summary' })
    const type = within(summary).getByText('Delivery type').closest('.odc-wizard-block')
    expect(within(type).getByText('Not set yet')).toBeInTheDocument()
    expect(within(summary).queryByText('Delivery')).not.toBeInTheDocument()
  })

  // redesign fix-qa C3 (B14): by total the controller sends `delivery_type: options.type || 1`, so that is what the
  // summary says when no type was picked; by products an unset type is still unset.
  it('by total, the summary says Delivery while no type was picked, because that is what is sent', async () => {
    mocks.orderState = { loading: false, options: {} }
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    const summary = screen.getByRole('region', { name: 'Order summary' })
    const type = () => within(summary).getByText('Delivery type').closest('.odc-wizard-block')
    expect(within(type()).getByText('Not set yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'By total' }))
    expect(within(type()).getByText('Delivery')).toBeInTheDocument()
    expect(within(type()).queryByText('Not set yet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(within(type()).getByText('Not set yet')).toBeInTheDocument()
  })

  it('by total, a picked type is shown as picked', async () => {
    mocks.orderState = { loading: false, options: { type: 2 } }
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'By total' }))
    const type = within(screen.getByRole('region', { name: 'Order summary' })).getByText('Delivery type').closest('.odc-wizard-block')
    expect(within(type).getByText('Pickup')).toBeInTheDocument()
  })

  it('the summary names the delivery type once the order has one', () => {
    mocks.orderState = { loading: false, options: { type: 2 } }
    renderWizard({ selectedUser, customerAddress })
    expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('Pickup')).toBeInTheDocument()
  })

  it('keeps what was typed in the product search when the step changes and comes back', async () => {
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'Search products' }), 'burg')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    // The Items step is hidden, not gone.
    expect(screen.queryByRole('textbox', { name: 'Search products' })).not.toBeInTheDocument()
    await user.click(continueButton())
    expect(screen.getByRole('textbox', { name: 'Search products' })).toHaveValue('burg')
  })
})

describe('Create custom order wizard · an error in a step does not blank the app (E3)', () => {
  it('a business step that throws is replaced by a message with a retry, and the wizard stays', async () => {
    mocks.throwIn.business = true
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This step could not be shown')
    // Stepper, summary and footer are still there.
    expect(screen.getByRole('navigation', { name: 'Steps' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Order summary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()

    mocks.throwIn.business = false
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('select-businesses')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a customer step that throws leaves the other parts of the wizard standing', () => {
    mocks.throwIn.customer = true
    renderWizard()
    expect(screen.getByRole('alert')).toHaveTextContent('This step could not be shown')
    expect(screen.getByRole('navigation', { name: 'Steps' })).toBeInTheDocument()
  })

  it('an Items step that throws can be left through Back', async () => {
    mocks.throwIn.products = true
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('This step could not be shown')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Business', level: 3 })).toBeInTheDocument()
  })
})
