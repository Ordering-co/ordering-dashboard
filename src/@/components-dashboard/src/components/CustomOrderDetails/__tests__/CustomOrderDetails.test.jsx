/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  orderState: {},
  customerState: {},
  refreshOrderOptions: vi.fn(),
  clearOrderOptions: vi.fn(),
  deleteUserCustomer: vi.fn(),
  handleDisableToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../contexts/ToastContext', () => ({ ToastType: {}, useToast: () => [null, { showToast: vi.fn() }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/CustomerContext', () => ({
  useCustomer: () => [mocks.customerState, { deleteUserCustomer: mocks.deleteUserCustomer }]
}))
vi.mock('../../../contexts/OrderContext', () => ({
  useOrder: () => [
    mocks.orderState,
    {
      updateProduct: vi.fn(),
      handleDisableToast: mocks.handleDisableToast,
      refreshOrderOptions: mocks.refreshOrderOptions,
      clearOrderOptions: mocks.clearOrderOptions
    }
  ]
}))

import { CustomOrderDetails } from '..'

const customerA = { id: 10, name: 'Ana', addresses: [] }
const customerB = { id: 20, name: 'Beto', addresses: [] }
const business = { id: 41, name: 'Burgers' }
const cartA = { uuid: 'cart-a', business_id: 41 }

const renderDetails = () => {
  const ui = { current: null }
  const UIComponent = (props) => {
    ui.current = props
    return null
  }
  const utils = render(<CustomOrderDetails UIComponent={UIComponent} />)
  return { ui, ...utils }
}

describe('CustomOrderDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.orderState = { loading: false, optionsUserId: null, options: {}, carts: {} }
    mocks.customerState = { loading: false, user: null }
  })

  it('does not request order options when the form opens', () => {
    renderDetails()

    expect(mocks.refreshOrderOptions).not.toHaveBeenCalled()
    expect(mocks.clearOrderOptions).not.toHaveBeenCalled()
  })

  it('clears a customer left from a previous session when the form opens', () => {
    mocks.customerState = { loading: false, user: customerA }

    renderDetails()

    expect(mocks.clearOrderOptions).toHaveBeenCalledTimes(1)
    expect(mocks.deleteUserCustomer).toHaveBeenCalledWith(true)
  })

  it('clears the customer options and carts when the form closes', () => {
    const { unmount } = renderDetails()

    unmount()

    expect(mocks.clearOrderOptions).toHaveBeenCalledTimes(1)
    expect(mocks.deleteUserCustomer).toHaveBeenCalledWith(true)
  })

  it('clears the previous customer data when the customer changes', () => {
    const { ui } = renderDetails()

    act(() => ui.current.setSelectedUser(customerA))
    act(() => ui.current.setSelectedBusiness(business))
    act(() => ui.current.setExtraFields({ external_id: 'A-1' }))
    mocks.clearOrderOptions.mockClear()

    act(() => ui.current.setSelectedUser(customerB))

    expect(mocks.clearOrderOptions).toHaveBeenCalledTimes(1)
    expect(ui.current.selectedUser).toBe(customerB)
    expect(ui.current.selectedBusiness).toBeNull()
    expect(ui.current.extraFields).toEqual({})
  })

  it('clears the customer data when the customer is removed', () => {
    const { ui } = renderDetails()
    act(() => ui.current.setSelectedUser(customerA))
    mocks.clearOrderOptions.mockClear()

    act(() => ui.current.setSelectedUser(null))

    expect(mocks.clearOrderOptions).toHaveBeenCalledTimes(1)
  })

  it('keeps the data when the same customer is updated', () => {
    const { ui } = renderDetails()
    act(() => ui.current.setSelectedUser(customerA))
    mocks.clearOrderOptions.mockClear()

    act(() => ui.current.setSelectedUser({ ...customerA, addresses: [{ id: 1, default: true }] }))

    expect(mocks.clearOrderOptions).not.toHaveBeenCalled()
  })

  it('shows a cart only when the loaded options belong to the selected customer', () => {
    mocks.orderState = { loading: false, optionsUserId: customerA.id, options: {}, carts: { 'businessId:41': cartA } }
    const { ui, rerender } = renderDetails()
    const rerenderDetails = () => rerender(<CustomOrderDetails UIComponent={(props) => { ui.current = props; return null }} />)

    act(() => ui.current.setSelectedUser(customerB))
    act(() => ui.current.setSelectedBusiness(business))
    expect(ui.current.cart).toBeNull()

    mocks.orderState = { ...mocks.orderState, optionsUserId: customerB.id }
    rerenderDetails()
    expect(ui.current.cart).toEqual(cartA)
  })
})
