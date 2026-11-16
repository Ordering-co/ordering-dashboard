/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign tramo B r4 (W0-PB3-01): the boundary of each step of the wizard (CustomOrderDetails) reports a render error once.
vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{ loading: false, options: { type: 1 } }, { changeAddress: vi.fn() }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../SelectCustomer', () => ({ SelectCustomer: () => { throw new Error('customer step broke') } }))
vi.mock('../../OrderTypeSelector', () => ({ OrderTypeSelector: () => <div /> }))
vi.mock('../../SelectBusinesses', () => ({ SelectBusinesses: () => <div /> }))
vi.mock('../../Map', () => ({ Map: () => <div /> }))
vi.mock('../../SelectProducts', () => ({ SelectProducts: () => <div /> }))
vi.mock('../../Checkout', () => ({ Checkout: () => <div /> }))

import { CustomOrderDetails } from '../../CustomOrderDetails'

let consoleError
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.reportError = vi.fn()
})
afterEach(() => {
  consoleError.mockRestore()
  delete window.reportError
})

const props = {
  phone: '',
  onChangeNumber: vi.fn(),
  customersPhones: { users: [], loading: false, error: null },
  setCustomersPhones: vi.fn(),
  businessList: { loading: false, businesses: [] },
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
}

describe('W0-PB3-01 · the step boundary reports to the window, once', () => {
  it('a render error of a step', () => {
    renderWithProviders(<CustomOrderDetails {...props} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This step could not be shown')
    expect(window.reportError).toHaveBeenCalledTimes(1)
    expect(window.reportError.mock.calls[0][0].message).toBe('customer step broke')
  })
})
