/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = { configs: {}, carts: {} }

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: mockState.configs }],
  useOrder: () => [{ carts: mockState.carts }],
  useUtils: () => [{ parsePrice: (value) => `$${value}`, optimizeImage: (value) => value }],
  SingleProductCard: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../../utils', () => ({ shape: {} }))

import { SingleProductCard } from '..'

const product = { id: 100, name: 'Burger', price: 8 }

const cartWith = (quantity) => ({
  'businessId:1': { business_id: 1, products: [{ id: 100, quantity }] }
})

describe('CreateCustomOrder SingleProductCard', () => {
  beforeEach(() => {
    mockState.configs = {}
    mockState.carts = {}
  })

  it('marks the product sold out when the cart reaches max_product_amount', () => {
    mockState.configs = { max_product_amount: { key: 'max_product_amount', value: '2' } }
    mockState.carts = cartWith(2)

    renderWithProviders(<SingleProductCard product={product} />)

    expect(screen.getByText('SOLD OUT')).toBeInTheDocument()
  })

  it('keeps the product available below max_product_amount', () => {
    mockState.configs = { max_product_amount: { key: 'max_product_amount', value: '2' } }
    mockState.carts = cartWith(1)

    renderWithProviders(<SingleProductCard product={product} />)

    expect(screen.queryByText('SOLD OUT')).not.toBeInTheDocument()
  })

  it('falls back to 100 when max_product_amount is not configured', () => {
    mockState.carts = cartWith(2)

    renderWithProviders(<SingleProductCard product={product} />)

    expect(screen.queryByText('SOLD OUT')).not.toBeInTheDocument()
  })

  it.each([[''], ['1e3'], ['1abc'], ['1.5']])('falls back to 100 when max_product_amount is the invalid value %j', (value) => {
    mockState.configs = { max_product_amount: { key: 'max_product_amount', value } }
    mockState.carts = cartWith(2)

    renderWithProviders(<SingleProductCard product={product} />)

    expect(screen.queryByText('SOLD OUT')).not.toBeInTheDocument()
  })
})
