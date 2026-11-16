/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: { format_time: { value: '24' } } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useOrder: () => [{ loading: false }],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: value => value,
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value).toFixed(2)}`
  }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1024, height: 768 }) }))

import { ProductItemAccordion } from '../../ProductItemAccordion'

const renderItem = (product, props = {}) => renderWithProviders(
  <ul>
    <ProductItemAccordion variant='compact' product={product} currency='USD ' {...props} />
  </ul>
)

describe('ProductItemAccordion variant compact', () => {
  it('shows quantity, name, folded options and the price, with no controls', () => {
    renderItem({
      id: 1,
      name: 'Margherita',
      quantity: 2,
      price: 10,
      comment: 'Well done',
      ingredients: [{ id: 5, name: 'Onion', selected: false }, { id: 6, name: 'Basil', selected: true }],
      options: [{
        id: 3,
        name: 'Toppings',
        rank: 1,
        suboptions: [
          { id: 8, name: 'Olives', quantity: 2, position: 'left', half_price: 1.5, price: 3 },
          { id: 9, name: 'Ham', quantity: 1, position: 'whole', price: 2 }
        ]
      }]
    }, { toppingsRemoved: { removed: [{ code: 'x', name: 'Mushroom' }] } })
    const item = screen.getByRole('listitem')
    expect(within(item).getByText('2×')).toBeInTheDocument()
    expect(within(item).getByText('Margherita')).toBeInTheDocument()
    const options = item.querySelector('.odt-item-opt')
    expect(options).toHaveTextContent('No Onion')
    expect(options).toHaveTextContent('Toppings: 2 x Olives (left) +USD 1.50, 1 x Ham +USD 2.00')
    expect(options).toHaveTextContent('Toppings removed: Mushroom')
    expect(options).toHaveTextContent('Well done')
    // 2 × (10 + 2×1.5 + 1×2)
    expect(within(item).getByText('USD 30.00')).toBeInTheDocument()
    expect(within(item).queryAllByRole('button')).toHaveLength(0)
  })

  it('has no options line for a plain product', () => {
    renderItem({ id: 2, name: 'Cola', quantity: 1, price: 2, options: [] })
    expect(screen.getByRole('listitem').querySelector('.odt-item-opt')).toBeNull()
  })

  it('shows the schedule of a calendar product', () => {
    renderItem({
      id: 3,
      name: 'Haircut',
      quantity: 1,
      price: 20,
      options: [],
      calendar_event: { start: '10:00', end: '10:30' }
    })
    expect(screen.getByRole('listitem')).toHaveTextContent('10:00 - 10:30')
  })

  // redesign fix-qa E6 (main: ProductItemAccordion/index.js:144-148 image, 340-345 "Comment" label)
  it('shows the product image, decorative because the name sits next to it', () => {
    renderItem({ id: 4, name: 'Pizza', quantity: 1, price: 9, options: [], images: 'pizza.jpg' })
    const image = screen.getByRole('listitem').querySelector('.odt-item-img')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('src', 'pizza.jpg')
    expect(image).toHaveAttribute('alt', '')
  })

  it('has no image slot for a product without one', () => {
    renderItem({ id: 5, name: 'Cola', quantity: 1, price: 2, options: [] })
    expect(screen.getByRole('listitem').querySelector('.odt-item-img')).toBeNull()
  })

  it('labels the comment, so it is not read as one more option', () => {
    renderItem({ id: 6, name: 'Burger', quantity: 1, price: 8, options: [], comment: 'No onions' })
    const options = screen.getByRole('listitem').querySelector('.odt-item-opt')
    expect(options).toHaveTextContent('Comment: No onions')
  })

  it('keeps the comment last, after the options', () => {
    renderItem({
      id: 7,
      name: 'Burger',
      quantity: 1,
      price: 8,
      comment: 'Well done',
      options: [{ id: 3, name: 'Sauce', rank: 1, suboptions: [{ id: 8, name: 'BBQ', quantity: 1, position: 'whole', price: 0 }] }]
    })
    const text = screen.getByRole('listitem').querySelector('.odt-item-opt').textContent
    expect(text.indexOf('Sauce')).toBeLessThan(text.indexOf('Comment: Well done'))
  })
})
