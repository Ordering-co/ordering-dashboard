/* eslint-disable import/first */
// redesign (row 77, M-15): an unavailable product in the open-cart panel kept neither its price nor
// a reason (same in `main`). It now shows the price (muted by the row's own dimming) and a short reason.
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ width: 1024 }))

vi.mock('~components', () => ({
  // controller stand-in: the real one only derives `productInfo` and renders the UIComponent
  ProductItemAccordion: ({ UIComponent, ...props }) => <UIComponent {...props} productInfo={{ ingredients: [], options: [] }} />,
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [{
    parseDate: value => value,
    parsePrice: value => `$${Number(value).toFixed(2)}`
  }]
}))

vi.mock('~ui', () => ({
  useWindowSize: () => ({ width: mocks.width, height: 768 })
}))

import { ProductItemAccordion } from '..'

const line = (extra) => ({ id: 1, code: 'a', name: 'Burger', quantity: 2, price: 12, total: 24, valid: true, valid_menu: true, valid_quantity: true, ...extra })

// (review of ): in Arabic the panel read «Piece McCrispy™ Strips 3»; the name is its own bidi island
describe('CartRecovery ProductItemAccordion product name direction', () => {
  it('isolates the product name, so a Latin name keeps its order in a right-to-left panel', () => {
    mocks.width = 1024
    renderWithProviders(<ProductItemAccordion isCartProduct product={line({ name: '3 Piece McCrispy™ Strips' })} />)
    const name = screen.getByText('3 Piece McCrispy™ Strips')
    expect(name.tagName).toBe('BDI')
    expect(name.parentElement.tagName).toBe('H3')
  })
})

describe('CartRecovery ProductItemAccordion unavailable products (row 77)', () => {
  it('shows the price and a reason for a product that is no longer on the menu', () => {
    mocks.width = 1024
    renderWithProviders(<ProductItemAccordion isCartProduct product={line({ valid: false, valid_menu: false })} />)
    expect(screen.getByText('$24.00')).toBeTruthy()
    expect(screen.getByText('Not available')).toBeTruthy()
  })

  it('shows the same reason for a product whose quantity is no longer valid', () => {
    mocks.width = 1024
    renderWithProviders(<ProductItemAccordion isCartProduct product={line({ valid: false, valid_quantity: false })} />)
    expect(screen.getByText('$24.00')).toBeTruthy()
    expect(screen.getByText('Not available')).toBeTruthy()
  })

  it('names the reason even where the price column is hidden (<= 410px)', () => {
    mocks.width = 390
    renderWithProviders(<ProductItemAccordion isCartProduct product={line({ valid: false, valid_menu: false })} />)
    expect(screen.getByText('Not available')).toBeTruthy()
  })

  it('keeps a valid product as it was: price, no reason', () => {
    mocks.width = 1024
    renderWithProviders(<ProductItemAccordion isCartProduct product={line()} />)
    expect(screen.getByText('$24.00')).toBeTruthy()
    expect(screen.queryByText('Not available')).toBeNull()
  })

  it('shows the price of a valid product under its name at <= 410px (row 15)', () => {
    mocks.width = 390
    renderWithProviders(<ProductItemAccordion isCartProduct product={line()} />)
    const price = screen.getByText('$24.00').closest('.mobile-product-price')
    expect(price).not.toBeNull()
    expect(price.previousElementSibling?.tagName).toBe('H3')
    expect(screen.getByText('$24.00')).toHaveAttribute('dir', 'ltr')
    expect(screen.getAllByText('$24.00')).toHaveLength(1)
  })

  it('does not repeat the price under the name above 410px (row 15)', () => {
    mocks.width = 1024
    const { container } = renderWithProviders(<ProductItemAccordion isCartProduct product={line()} />)
    expect(container.querySelector('.mobile-product-price')).toBeNull()
    expect(screen.getAllByText('$24.00')).toHaveLength(1)
  })
})
