/* eslint-disable import/first */
// redesign W0-3a (T0-9, decisión 11a): prices, quantity and the hour range of a product line are figures (`odc-figure`)
// on the node that holds the figure; the product name beside it is not.
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const windowSize = vi.hoisted(() => ({ width: 1024 }))

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

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: windowSize.width, height: 768 })
}))

import { ProductItemAccordion } from '..'

const product = { id: 1, name: 'Margherita', quantity: 2, price: 10, valid: true, valid_menu: true, valid_quantity: true }

describe('ProductItemAccordion · figures (W0-3a, T0-9)', () => {
  it('compact: quantity and price are figures, the name is not', () => {
    windowSize.width = 1024
    renderWithProviders(<ul><ProductItemAccordion variant='compact' product={product} currency='USD ' /></ul>)
    expect(screen.getByText('2×')).toHaveClass('odc-figure')
    expect(screen.getByText('USD 20.00')).toHaveClass('odc-figure')
    expect(screen.getByText('Margherita')).not.toHaveClass('odc-figure')
    expect(document.querySelector('.odc-num')).toBeNull()
  })

  it('full row: the price is a figure and the name is not', () => {
    windowSize.width = 1024
    renderWithProviders(<ProductItemAccordion product={product} currency='USD ' />)
    expect(screen.getByText('USD 20.00')).toHaveClass('odc-figure')
    expect(screen.getByText('Margherita')).not.toHaveClass('odc-figure')
  })

  it('full row on a narrow panel: the price of the mobile summary is a figure', () => {
    windowSize.width = 390
    renderWithProviders(<ProductItemAccordion product={product} currency='USD ' />)
    const price = screen.getByText('USD 20.00')
    expect(price).toHaveClass('odc-figure')
    expect(price.closest('.mobile-product-summary')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Margherita' })).not.toHaveClass('odc-figure')
  })

  it('full row: the hour range of a scheduled product is a figure', () => {
    windowSize.width = 1024
    renderWithProviders(
      <ProductItemAccordion
        product={{ ...product, calendar_event: { start: '2026-10-02 10:00:00', end: '2026-10-02 11:00:00' } }}
        currency='USD '
      />
    )
    const range = screen.getByText(/2026-10-02 10:00:00\s*-\s*2026-10-02 11:00:00/)
    expect(range).toHaveClass('odc-figure')
    expect(screen.getByRole('heading', { name: 'Margherita' })).not.toHaveClass('odc-figure')
  })
})
