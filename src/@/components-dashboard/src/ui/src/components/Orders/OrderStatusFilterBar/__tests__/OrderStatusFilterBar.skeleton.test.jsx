/* eslint-disable import/first */
// redesign F4 (C20): while the totals load each tab holds the room of a count (two digits), so the tabs
// to its right do not slide when the numbers arrive; a total that failed is a dash, not a skeleton.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn() }))

import { OrderStatusFilterBar, ORDERS_AMOUNT_UNAVAILABLE } from '..'

const mount = (amounts) => render(
  <MemoryRouter initialEntries={['/orders']}>
    <OrderStatusFilterBar selectedOrderStatus='pending' changeOrderStatus={vi.fn()} ordersAmountByStatus={amounts} />
  </MemoryRouter>
)
const LOADING = { pending: null, inProgress: null, completed: null, cancelled: null }

describe('OrderStatusFilterBar · counters while loading', () => {
  it('draws a skeleton in every tab, as wide as a two-digit count', () => {
    const { container } = mount(LOADING)
    const bars = container.querySelectorAll('[role="tab"] .odc-skeleton')
    expect(bars).toHaveLength(4)
    bars.forEach(bar => {
      expect(bar).toHaveAttribute('aria-hidden', 'true')
      expect(bar.style.inlineSize).toBe('calc(var(--od-x-count-height) + var(--od-x-space-1-5))')
    })
  })

  it('reads no count for the tabs that are still loading', () => {
    const { container } = mount(LOADING)
    const list = container.querySelector('[role="tablist"]')
    expect(within(list).getByRole('tab', { name: 'Pending' })).toBeInTheDocument()
    expect(within(list).getByRole('tab', { name: 'Completed' })).toBeInTheDocument()
  })

  it('shows the count, and no skeleton, once the total is there; a dash when it failed', () => {
    const { container } = mount({ pending: 3, inProgress: ORDERS_AMOUNT_UNAVAILABLE, completed: 745, cancelled: null })
    expect(container.querySelectorAll('[role="tab"] .odc-skeleton')).toHaveLength(1)
    expect(within(container.querySelector('[role="tablist"]')).getByRole('tab', { name: 'In progress count unavailable' })).toBeInTheDocument()
  })

  it('the skeleton is the chip without its grey box, at the chip height, from tokens', () => {
    const css = readFileSync(resolve(__dirname, '../order-status-filter-bar.css'), 'utf8')
    expect(css).toMatch(/\.odc-status-tabs \.odc-count \.odc-skeleton\s*\{[^}]*block-size:\s*var\(--od-x-count-height\)/)
  })
})
