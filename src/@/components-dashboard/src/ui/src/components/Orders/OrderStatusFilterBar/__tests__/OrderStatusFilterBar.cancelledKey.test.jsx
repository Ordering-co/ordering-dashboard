/* eslint-disable import/first */
// (tanda Y, decision Y-6): the live dictionary of a project can say «cancelled» for CANCELLED (the T10 audit saw it
// on /deliveries). The tab reads its own key, so it says «Cancelled» like its three neighbours.
import React from 'react'
import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const live = { CANCELLED: 'cancelled' }
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => live[key] ?? fallback]
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn() }))

import { OrderStatusFilterBar } from '..'

describe('OrderStatusFilterBar · Cancelled tab', () => {
  it('says «Cancelled» even when the dictionary has CANCELLED in lower case', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/deliveries']}>
        <OrderStatusFilterBar selectedOrderStatus='pending' changeOrderStatus={vi.fn()} ordersAmountByStatus={{ pending: 1, inProgress: 2, completed: 3, cancelled: 4 }} />
      </MemoryRouter>
    )
    const list = container.querySelector('[role="tablist"]')
    expect(within(list).getByRole('tab', { name: /^Cancelled/ })).toBeInTheDocument()
    expect(within(list).queryByRole('tab', { name: /^cancelled/ })).toBeNull()
  })
})
