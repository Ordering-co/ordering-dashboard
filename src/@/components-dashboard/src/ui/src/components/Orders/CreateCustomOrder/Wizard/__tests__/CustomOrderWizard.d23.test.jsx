/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign W0-2c (D-23): «Try again» of a step that crashed removes its own notice; the focus goes to the step title of the
// wizard (inside the dialog), never to <body>.
const mocks = vi.hoisted(() => ({ explode: true }))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{ loading: false, options: { type: 1 } }, { changeAddress: vi.fn().mockResolvedValue({ ok: true }) }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../SelectCustomer', () => ({ SelectCustomer: () => <input aria-label='Phone number' /> }))
vi.mock('../../OrderTypeSelector', () => ({ OrderTypeSelector: () => <div data-order-type='' /> }))
vi.mock('../../SelectBusinesses', () => ({
  SelectBusinesses: () => {
    if (mocks.explode) throw new TypeError('The business list failed')
    return <div data-testid='select-businesses' />
  }
}))
vi.mock('../../Map', () => ({ Map: () => <div data-testid='map' /> }))
vi.mock('../../SelectProducts', () => ({ SelectProducts: () => <input aria-label='Search products' /> }))
vi.mock('../../Checkout', () => ({ Checkout: () => <div data-testid='checkout' /> }))

import { CustomOrderDetails } from '../../CustomOrderDetails'

const selectedBusiness = { id: 5, slug: 'store', name: 'Corner Store' }
const props = () => ({
  phone: '',
  onChangeNumber: vi.fn(),
  customersPhones: { users: [], loading: false, error: null },
  setCustomersPhones: vi.fn(),
  businessList: { loading: false, businesses: [selectedBusiness] },
  selectedUser: { id: 1, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' },
  selectedBusiness,
  setSelectedUser: vi.fn(),
  setSelectedBusiness: vi.fn(),
  productList: { loading: false, products: [] },
  getProducts: vi.fn(),
  handeUpdateProductCart: vi.fn(),
  cart: { products: [{ id: 1, name: 'Burger', quantity: 1 }], total: 10 },
  onClose: vi.fn(),
  handleOpenCustomOrderDetail: vi.fn(),
  handlePlaceOrderByTotal: vi.fn(),
  extraFields: {},
  setExtraFields: vi.fn(),
  actionState: { loading: false, error: null },
  customerAddress: { id: 7, address: '1 Main St', location: { lat: 1, lng: 2 } }
})

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => {
  mocks.explode = true
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

describe('wizard · a crashed step and «Try again» (D-23)', () => {
  it('moves the focus to the step title, inside the dialog, when the step draws again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<div role='dialog' aria-label='Create custom order'><CustomOrderDetails {...props()} /></div>)
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))
    const alert = await screen.findByText('This step could not be shown. Try again, or go back a step and return.')
    expect(alert).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    retry.focus()
    mocks.explode = false
    await user.click(retry)
    expect(await screen.findByTestId('select-businesses')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('heading', { name: 'Business' })).toHaveFocus()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })
})
