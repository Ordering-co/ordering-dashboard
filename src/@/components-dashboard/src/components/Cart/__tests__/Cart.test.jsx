/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mockConfigState = { current: { configs: {} } }

vi.mock('../../../contexts/OrderContext', () => ({
  useOrder: () => [{ carts: {} }, { updateProduct: vi.fn(), removeProduct: vi.fn(), clearCart: vi.fn() }]
}))

vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [mockConfigState.current]
}))

import { Cart } from '..'

const renderCart = () => {
  let uiProps
  render(<Cart UIComponent={(props) => { uiProps = props; return null }} />)
  return uiProps
}

const product = { id: 100, quantity: 1, balance: 1, inventoried: false }

describe('Cart', () => {
  beforeEach(() => {
    mockConfigState.current = { configs: {} }
  })

  it('limits product quantity with max_product_amount', () => {
    mockConfigState.current = { configs: { max_product_amount: { key: 'max_product_amount', value: '5' } } }

    const { getProductMax, offsetDisabled } = renderCart()

    expect(getProductMax(product)).toBe(5)
    expect(offsetDisabled(product)).toBe(5)
  })

  it('falls back to 100 when max_product_amount is not configured', () => {
    const { getProductMax } = renderCart()

    expect(getProductMax(product)).toBe(100)
  })

  it('falls back to 100 when max_product_amount is invalid', () => {
    mockConfigState.current = { configs: { max_product_amount: { key: 'max_product_amount', value: '1e3' } } }

    const { getProductMax } = renderCart()

    expect(getProductMax(product)).toBe(100)
  })
})
