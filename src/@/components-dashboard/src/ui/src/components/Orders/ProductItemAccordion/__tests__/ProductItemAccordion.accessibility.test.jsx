/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: { format_time: { value: '12' } } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useOrder: () => [{ loading: false }],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: value => value,
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value).toFixed(2)}`
  }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1024, height: 768 })
}))

import { ProductItemAccordion } from '..'

describe('ProductItemAccordion accessibility', () => {
  it('uses named native actions while preserving quantity, edit, delete, option, and ingredient data', () => {
    const changeQuantity = vi.fn()
    const onDeleteProduct = vi.fn()
    const onEditProduct = vi.fn()
    const product = {
      id: 12,
      name: 'Long custom pizza name for operations',
      quantity: 1,
      price: 10,
      valid: true,
      valid_menu: true,
      valid_quantity: true,
      images: 'pizza.jpg',
      ingredients: [{ id: 5, name: 'Onion', selected: false }],
      options: [{
        id: 3,
        name: 'Toppings',
        rank: 1,
        suboptions: [{
          id: 8,
          name: 'Olives',
          quantity: 2,
          position: 'left',
          half_price: 1.5,
          price: 3
        }]
      }],
      comment: 'Please keep every detail visible'
    }

    const { container } = renderWithProviders(
      <ProductItemAccordion
        isCartProduct
        product={product}
        changeQuantity={changeQuantity}
        getProductMax={() => 3}
        offsetDisabled={() => 3}
        onDeleteProduct={onDeleteProduct}
        onEditProduct={onEditProduct}
        currency='USD '
        returnSuboptions
      />
    )

    const quantity = screen.getByRole('combobox', { name: 'Qty Long custom pizza name for operations' })
    fireEvent.change(quantity, { target: { value: '2' } })
    expect(changeQuantity).toHaveBeenCalledWith(product, 2)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Long custom pizza name for operations' }))
    expect(onEditProduct).toHaveBeenCalledWith(product)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Long custom pizza name for operations' }))
    expect(onDeleteProduct).toHaveBeenCalledWith(product)

    const toggle = screen.getByRole('button', { name: 'Expand Long custom pizza name for operations' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(getComputedStyle(toggle).minWidth).toBe('44px')
    fireEvent.click(screen.getByText('Long custom pizza name for operations'))
    expect(screen.getByRole('button', { name: 'Collapse Long custom pizza name for operations' })).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText('No Onion')).toBeInTheDocument()
    expect(screen.getByText(/2 x Olives.*USD 1\.50/)).toBeInTheDocument()
    expect(screen.getByText('Please keep every detail visible')).toBeInTheDocument()
    expect(screen.getByText('USD 13.00')).toBeInTheDocument()
    expect(container.querySelector('button button')).toBeNull()
    expect(container.querySelector('ul > p')).toBeNull()
    expect(container.querySelector('span > p, span > div')).toBeNull()
  })
})
