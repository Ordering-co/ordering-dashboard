/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

// redesign SP-F1 (D1): what ProductSummary:216-285 drew under its header.
const ring = vi.hoisted(() => ({ props: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => `opt:${url}`, parsePrice: (value) => `$${Number(value).toFixed(2)}` }]
}))
vi.mock('../../../Shared', async () => {
  const { createElement } = await import('react')
  return {
    ProgressRing: (props) => {
      ring.props.push(props)
      return createElement('div', { 'data-testid': 'ring', 'data-percent': String(props.percent) })
    }
  }
})

import { ProductOverview, getPercentage } from '../ProductOverview'

const burger = {
  id: 1,
  name: 'Cheese Burger',
  type: 'product',
  images: 'https://img.test/burger.png',
  price: 10,
  cost_price: 4,
  in_offer: true,
  offer_price: 12,
  cost_offer_price: 5
}

const priceOf = (name) => {
  const term = screen.getByText(name, { selector: 'dt' })
  return term.nextElementSibling
}

describe('getPercentage', () => {
  it('is the part of the price that is not cost, 100 with no price and 0 with no product', () => {
    expect(getPercentage({ price: 10, cost_price: 4 })).toBe(60)
    expect(getPercentage({ price: 0, cost_price: 4 })).toBe(100)
    expect(getPercentage(null)).toBe(0)
  })
})

describe('ProductOverview', () => {
  it('draws the image (optimized), the ROI ring with its figure and every price of a product with figures', () => {
    render(<ProductOverview product={burger} />)
    expect(document.querySelector('.odc-pe-image img')).toHaveAttribute('src', 'opt:https://img.test/burger.png')
    expect(screen.getByTestId('ring')).toHaveAttribute('data-percent', '60')
    expect(ring.props.at(-1)).toMatchObject({ progressColor: 'var(--od-action)', trackColor: 'var(--od-border)', isShowPercent: true })
    expect(screen.getByText('Product sales ROI').previousElementSibling).toHaveTextContent('$6.00')
    expect(priceOf('Selling price')).toHaveTextContent('$10.00')
    expect(priceOf('Regular Price')).toHaveTextContent('$12.00')
    expect(priceOf('Product cost')).toHaveTextContent('$4.00')
    expect(priceOf('Product cost - regular price')).toHaveTextContent('$5.00')
  })

  it('puts the figures in the mono figure style', () => {
    render(<ProductOverview product={burger} />)
    expect(priceOf('Selling price')).toHaveClass('odc-figure')
    expect(screen.getByText('Product sales ROI').previousElementSibling).toHaveClass('odc-figure')
  })

  it('leaves out the regular price when not in offer, and the costs when there are none', () => {
    render(<ProductOverview product={{ ...burger, in_offer: false, cost_price: 0, cost_offer_price: null }} />)
    expect(screen.getByText('Selling price')).toBeInTheDocument()
    expect(screen.queryByText('Regular Price')).toBeNull()
    expect(screen.queryByText('Product cost')).toBeNull()
    expect(screen.queryByText('Product cost - regular price')).toBeNull()
  })

  it('draws an icon, not a broken image, when the product has none', () => {
    render(<ProductOverview product={{ ...burger, images: null }} />)
    expect(document.querySelector('.odc-pe-image img')).toBeNull()
    expect(document.querySelector('.odc-pe-image svg')).not.toBeNull()
  })

  it('a service shows price • duration and its description, without the ring or the cost figures', () => {
    render(<ProductOverview product={{ ...burger, type: 'service', duration: 45, description: 'A long haircut' }} />)
    expect(screen.queryByTestId('ring')).toBeNull()
    expect(screen.queryByText('Selling price')).toBeNull()
    const line = document.querySelector('.odc-pe-service-line')
    expect(line).toHaveTextContent('$10.00•45 min')
    expect(within(line).getByText('$10.00')).toHaveClass('odc-figure')
    expect(screen.getByText('A long haircut')).toBeInTheDocument()
  })

  it('a service with no description draws none', () => {
    render(<ProductOverview product={{ ...burger, type: 'service', duration: 30, description: '' }} />)
    expect(document.querySelector('.odc-pe-description')).toBeNull()
  })

  it('is a busy skeleton while loading or with no product, with no figures', () => {
    const { rerender } = render(<ProductOverview loading product={burger} />)
    expect(document.querySelector('.odc-pe-overview')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('Selling price')).toBeNull()
    rerender(<ProductOverview product={null} />)
    expect(document.querySelector('.odc-pe-overview')).toHaveAttribute('aria-busy', 'true')
  })
})
