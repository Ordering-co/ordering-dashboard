/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  validationFields: { fields: { checkout: {} } },
  orderState: { loading: false, options: { type: 1 } },
  customerMounts: { count: 0 },
  customerProps: { current: null },
  checkoutProps: { current: null }
}))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [mocks.orderState, { changeAddress: vi.fn() }],
  useValidationFields: () => [mocks.validationFields],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../SelectCustomer', () => ({
  SelectCustomer: props => {
    mocks.customerProps.current = props
    useEffect(() => { mocks.customerMounts.count += 1 }, [])
    return (
      <div data-testid='select-customer'>
        <input aria-label='Phone number' />
      </div>
    )
  }
}))
vi.mock('../../OrderTypeSelector', () => ({ OrderTypeSelector: () => <div data-testid='order-type' /> }))
vi.mock('../../SelectBusinesses', () => ({ SelectBusinesses: () => <div data-testid='select-businesses' /> }))
vi.mock('../../Map', () => ({ Map: () => <div data-testid='map' /> }))
vi.mock('../../SelectProducts', () => ({ SelectProducts: () => <div data-testid='select-products' /> }))
vi.mock('../../Checkout', () => ({
  Checkout: props => {
    mocks.checkoutProps.current = props
    return <div data-testid='checkout' />
  }
}))

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

const renderWizard = (overrides = {}) => {
  const props = { ...baseProps(), ...overrides }
  const view = renderWithProviders(<CustomOrderDetails {...props} />)
  return {
    props,
    ...view,
    update: next => view.rerender(<CustomOrderDetails {...props} {...next} />)
  }
}

const stepsNav = () => screen.getByRole('navigation', { name: 'Steps' })
const continueButton = () => screen.getByRole('button', { name: /^Continue$|^Place order/ })

// The ready state of each step, as the controller would hand it over.
const ready1 = { selectedUser, customerAddress }
const ready2 = { ...ready1, selectedBusiness }
const ready3 = { ...ready2, cart }

beforeEach(() => {
  mocks.validationFields = { fields: { checkout: {} } }
  mocks.orderState = { loading: false, options: { type: 1 } }
  mocks.customerMounts.count = 0
  mocks.checkoutProps.current = null
})

describe('Create custom order wizard · steps', () => {
  it('opens on the Customer step with the heading and the phone field', () => {
    renderWizard()
    expect(screen.getByRole('heading', { name: 'Customer', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toBeInTheDocument()
    const current = within(stepsNav()).getAllByRole('listitem').find(item => item.querySelector('[aria-current="step"]'))
    expect(current).toHaveTextContent('Customer')
  })

  // redesign 5.5-B: the wizard owns the step title, so SelectCustomer is told to drop its own h3, and one panel
  // level means there is no sidebar to move aside any more.
  it('tells SelectCustomer to hide its own title and no longer hands it a sidebar mover', () => {
    renderWizard()
    expect(mocks.customerProps.current.hideTitle).toBe(true)
    expect(mocks.customerProps.current.handleParentSidebarMove).toBeUndefined()
  })

  it('lists the four steps in order, with the later ones pending', () => {
    renderWizard()
    const items = within(stepsNav()).getAllByRole('listitem')
    expect(items.map(item => item.textContent.replace(/[0-9]/g, '').trim())).toEqual([
      expect.stringContaining('Customer'),
      expect.stringContaining('Business'),
      expect.stringContaining('Items'),
      expect.stringContaining('Payment')
    ])
    expect(within(stepsNav()).queryAllByRole('button')).toHaveLength(0)
  })

  it('step 1: Continue is disabled with its reason until there is a customer with a located address', () => {
    const { update } = renderWizard()
    expect(continueButton()).toBeDisabled()
    expect(continueButton()).toHaveAccessibleDescription('Pick a customer with an address')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    update({ selectedUser })
    expect(continueButton()).toBeDisabled()

    update({ selectedUser, customerAddress: { id: 7, address: '1 Main St' } })
    expect(continueButton()).toBeDisabled()

    update(ready1)
    expect(continueButton()).toBeEnabled()
    expect(screen.queryByText('Pick a customer with an address')).not.toBeInTheDocument()
  })

  it('goes to Business, focuses its title and shows Back', async () => {
    renderWizard(ready1)
    await userEvent.setup().click(continueButton())
    const title = screen.getByRole('heading', { name: 'Business', level: 3 })
    await waitFor(() => expect(title).toHaveFocus())
    expect(screen.getByTestId('order-type')).toBeInTheDocument()
    expect(screen.getByTestId('select-businesses')).toBeInTheDocument()
    expect(screen.getByTestId('map')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(within(stepsNav()).getByRole('button', { name: /Customer/ })).toBeInTheDocument()
  })

  it('step 2: Continue is disabled with its reason until there is a business', async () => {
    const { update } = renderWizard(ready1)
    const user = userEvent.setup()
    await user.click(continueButton())
    expect(continueButton()).toBeDisabled()
    expect(continueButton()).toHaveAccessibleDescription('Pick a business')
    update(ready2)
    expect(continueButton()).toBeEnabled()
  })

  it('Back returns to the previous step and focuses its title', async () => {
    renderWizard(ready2)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    expect(screen.getByRole('heading', { name: 'Items', level: 3 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const title = screen.getByRole('heading', { name: 'Business', level: 3 })
    await waitFor(() => expect(title).toHaveFocus())
  })

  it('keeps the Customer step mounted, so its own state survives going back to it', async () => {
    renderWizard(ready1)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toBeVisible()
    expect(mocks.customerMounts.count).toBe(1)
  })

  it('does not let a pending step be reached, and returns to the first incomplete one if data is lost', async () => {
    const { update } = renderWizard(ready2)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    expect(screen.getByRole('heading', { name: 'Items', level: 3 })).toBeInTheDocument()
    update({ selectedBusiness: null })
    expect(screen.getByRole('heading', { name: 'Business', level: 3 })).toBeInTheDocument()
  })

  it('done steps in the stepper are buttons that jump', async () => {
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(continueButton())
    expect(screen.getByRole('heading', { name: 'Payment', level: 3 })).toBeInTheDocument()
    await user.click(within(stepsNav()).getByRole('button', { name: /Business/ }))
    expect(screen.getByRole('heading', { name: 'Business', level: 3 })).toBeInTheDocument()
    // Items already has its data, so it is a way forward; Payment is where Continue leads, not a jump.
    expect(within(stepsNav()).getByRole('button', { name: /Items/ })).toBeInTheDocument()
    expect(within(stepsNav()).queryByRole('button', { name: /Payment/ })).not.toBeInTheDocument()
  })
})

describe('Create custom order wizard · items', () => {
  const toItems = async (overrides = {}) => {
    const view = renderWizard({ ...ready2, ...overrides })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    return { ...view, user }
  }

  it('shows the mode as a segmented control with the two modes, By products first', async () => {
    await toItems()
    const group = screen.getByRole('group', { name: 'Order mode' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['By products', 'By total'])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('select-products')).toBeInTheDocument()
  })

  it('by products: Continue needs a product in the cart, with its reason', async () => {
    const { update } = await toItems()
    expect(continueButton()).toBeDisabled()
    expect(continueButton()).toHaveAccessibleDescription('Add a product or a total')
    update({ cart })
    expect(continueButton()).toBeEnabled()
  })

  it('by total: shows Total, External ID and Comment with the values of today and keeps the handlers', async () => {
    const { props, user } = await toItems({ extraFields: { external_id: 'EXT-1' } })
    await user.click(screen.getByRole('button', { name: 'By total' }))
    expect(screen.queryByTestId('select-products')).not.toBeInTheDocument()
    // Switching to by total keeps only the external id (same effect as before).
    expect(props.setExtraFields).toHaveBeenCalledWith({ external_id: 'EXT-1' })
    expect(screen.getByLabelText('Total')).toBeInTheDocument()
    expect(screen.getByLabelText(/External ID/)).toHaveValue('EXT-1')
    expect(screen.getByLabelText('Comment')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Total'), '2')
    expect(props.setExtraFields).toHaveBeenLastCalledWith({ external_id: 'EXT-1', total: '2' })
  })

  it('by total: only digits and the dot go into Total', async () => {
    const { props, user } = await toItems()
    await user.click(screen.getByRole('button', { name: 'By total' }))
    props.setExtraFields.mockClear()
    await user.type(screen.getByLabelText('Total'), 'a')
    expect(props.setExtraFields).not.toHaveBeenCalled()
  })

  it('by total: Continue needs a total, and the comment when the project asks for it', async () => {
    const { update, user } = await toItems()
    await user.click(screen.getByRole('button', { name: 'By total' }))
    expect(continueButton()).toBeDisabled()
    expect(continueButton()).toHaveAccessibleDescription('Add a product or a total')

    update({ extraFields: { total: '25' } })
    expect(continueButton()).toBeEnabled()

    mocks.validationFields = { fields: { checkout: { comments: { enabled: true, required: true } } } }
    update({ extraFields: { total: '25' } })
    expect(continueButton()).toBeDisabled()
    expect(continueButton()).toHaveAccessibleDescription('Name is required')
    update({ extraFields: { total: '25', comment: 'ring twice' } })
    expect(continueButton()).toBeEnabled()
  })
})

describe('Create custom order wizard · payment', () => {
  it('by total: the last button says what it does, with the total, and places the order', async () => {
    const props = { ...ready2, extraFields: { total: '25' } }
    const { props: all } = renderWizard(props)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'By total' }))
    await user.click(continueButton())
    expect(screen.getByRole('heading', { name: 'Payment', level: 3 })).toBeInTheDocument()
    const place = screen.getByRole('button', { name: 'Place order · $25.00' })
    expect(place).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    await user.click(place)
    expect(all.handlePlaceOrderByTotal).toHaveBeenCalledTimes(1)
  })

  it('by total: the busy order cannot be placed twice', async () => {
    const { props: all } = renderWizard({ ...ready2, extraFields: { total: '25' }, actionState: { loading: true, error: null } })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'By total' }))
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Place order · $25.00' }))
    expect(all.handlePlaceOrderByTotal).not.toHaveBeenCalled()
  })

  it('by products: shows the Checkout of today with the same props and opens the detail on success', async () => {
    const { props: all } = renderWizard({ ...ready3, extraFields: { external_id: 'EXT-9' } })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(continueButton())
    expect(screen.getByRole('heading', { name: 'Payment', level: 3 })).toBeInTheDocument()
    expect(screen.getByTestId('checkout')).toBeInTheDocument()
    const checkout = mocks.checkoutProps.current
    expect(checkout.cartUuid).toBe('cart-1')
    expect(checkout.extraFields).toEqual({ external_id: 'EXT-9' })
    checkout.onPlaceOrderClick({}, {}, { order_id: 42 })
    expect(all.handleOpenCustomOrderDetail).toHaveBeenCalledWith(42)
    expect(all.onClose).toHaveBeenCalled()
  })

  // redesign 5.5-B: Checkout hands its place-order action to the pinned footer (onRegisterPlaceOrder), so by
  // products the footer says what it does, like by total, and the Checkout draws no second button.
  it('by products: the footer places the order with the label "Place order · total"', async () => {
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(continueButton())
    expect(mocks.checkoutProps.current.onRegisterPlaceOrder).toEqual(expect.any(Function))
    const place = vi.fn()
    act(() => { mocks.checkoutProps.current.onRegisterPlaceOrder({ disabled: false, placing: false, reason: null, place }) })
    const button = screen.getByRole('button', { name: 'Place order · $31.50' })
    expect(button).toHaveAttribute('data-variant', 'primary')
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    await user.click(button)
    expect(place).toHaveBeenCalledTimes(1)
  })

  it('by products: the footer follows the Checkout: disabled with its reason, busy while placing, gone when released', async () => {
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(continueButton())
    const place = vi.fn()
    const register = action => act(() => { mocks.checkoutProps.current.onRegisterPlaceOrder(action) })
    register({ disabled: true, placing: false, reason: 'Please, select a payment method to place order.', place })
    const blocked = screen.getByRole('button', { name: 'Place order · $31.50' })
    expect(blocked).toBeDisabled()
    expect(blocked).toHaveAccessibleDescription('Please, select a payment method to place order.')
    register({ disabled: true, placing: true, reason: null, place })
    expect(screen.getByRole('button', { name: 'Place order · $31.50' })).toHaveAttribute('aria-busy', 'true')
    register(null)
    expect(screen.queryByRole('button', { name: /^Place order/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('by products: the summary already shows the cart total and, until Checkout registers, the footer has no place-order button', async () => {
    renderWizard(ready3)
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(continueButton())
    expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('$31.50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Place order/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})

describe('Create custom order wizard · summary', () => {
  it('starts empty: every block says "Not set yet" and there is nothing to edit', () => {
    renderWizard()
    const summary = screen.getByRole('region', { name: 'Order summary' })
    expect(within(summary).getAllByText('Not set yet').length).toBeGreaterThanOrEqual(5)
    expect(within(summary).queryAllByRole('button', { name: /^Edit/ })).toHaveLength(0)
  })

  it('shows the customer, address, delivery type, business, items and total as they are chosen', async () => {
    renderWizard({ ...ready3 })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    const summary = screen.getByRole('region', { name: 'Order summary' })
    expect(within(summary).getByText('Ana Perez')).toBeInTheDocument()
    expect(within(summary).getByText('5550001111')).toBeInTheDocument()
    expect(within(summary).getByText('1 Main St')).toBeInTheDocument()
    expect(within(summary).getByText('Delivery')).toBeInTheDocument()
    expect(within(summary).getByText('Corner Store')).toBeInTheDocument()
    expect(within(summary).getByText('2 × Burger')).toBeInTheDocument()
    expect(within(summary).getByText('$31.50')).toBeInTheDocument()
  })

  it('Edit jumps back to the step of the block and focuses its title', async () => {
    renderWizard({ ...ready3 })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Edit Customer' }))
    const title = screen.getByRole('heading', { name: 'Customer', level: 3 })
    await waitFor(() => expect(title).toHaveFocus())
    await user.click(screen.getByRole('button', { name: 'Edit Business' }))
    expect(screen.getByRole('heading', { name: 'Business', level: 3 })).toBeInTheDocument()
  })
})

describe('Create custom order wizard · inline messages', () => {
  it('shows the phone search error in the Customer step as an alert and dismisses it', async () => {
    const setCustomersPhones = vi.fn()
    renderWizard({
      customersPhones: { users: [], loading: false, error: 'Network down' },
      setCustomersPhones
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Network down')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Accept' }))
    expect(setCustomersPhones).toHaveBeenCalledWith({ users: [], loading: false, error: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the API error of the placing above the footer with the same text', async () => {
    const { update } = renderWizard({ ...ready2, extraFields: { total: '25' } })
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'By total' }))
    await user.click(continueButton())
    update({ actionState: { loading: false, error: ['The order could not be created'] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('The order could not be created')
  })
})

describe('Create custom order wizard · dirty state for the discard confirmation', () => {
  it('reports data as soon as there is a customer and clears the report on unmount', () => {
    const onDirtyChange = vi.fn()
    const view = renderWizard({ onDirtyChange })
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    view.update({ selectedUser })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    view.unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})
