/* eslint-disable import/first */
// redesign W0-3a (T0-9, decisión 11a): the price of a product row and the total of a cart line are figures (`odc-figure`)
// on the node that holds the amount; the product name beside them is not. The quantity is a count: it keeps `odc-num`.
import React from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url, parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{}, { removeProduct: vi.fn() }]
}))
vi.mock('../../../Shared', () => ({ Confirm: () => null }))
vi.mock('../ProductForm', () => ({ ProductForm: () => null }))

import { SelectProducts } from '../SelectProducts'

describe('SelectProducts · figures (W0-3a, T0-9)', () => {
  it('puts odc-figure on the price of a product row and not on its name', () => {
    renderWithProviders(
      <SelectProducts
        productList={{ loading: false, products: [{ id: 10, name: 'Burger', price: 8, category_id: 3 }] }}
        getProducts={vi.fn()}
        handeUpdateProductCart={vi.fn()}
        cart={{ products: [] }}
        business={{ id: 5, slug: 'corner' }}
      />
    )
    const row = within(screen.getByRole('list', { name: 'Select product' })).getByRole('button')
    expect(within(row).getByText('$8.00')).toHaveClass('odc-figure')
    expect(within(row).getByText('Burger')).not.toHaveClass('odc-figure')
  })

  it('puts odc-figure on the total of a cart line, not on its name, and keeps the quantity as a count', () => {
    renderWithProviders(
      <SelectProducts
        productList={{ loading: false, products: [] }}
        getProducts={vi.fn()}
        handeUpdateProductCart={vi.fn()}
        cart={{ products: [{ id: 10, name: 'Burger', quantity: 2, total: 16, maximum_per_order: 5, category_id: 3 }] }}
        business={{ id: 5, slug: 'corner' }}
      />
    )
    const line = within(screen.getByRole('list', { name: 'Items' })).getAllByRole('listitem')[0]
    expect(within(line).getByText('$16.00')).toHaveClass('odc-figure')
    expect(within(line).getByText('Burger')).not.toHaveClass('odc-figure')
    expect(line.querySelector('.odc-steps-qty')).not.toHaveClass('odc-figure')
  })
})
