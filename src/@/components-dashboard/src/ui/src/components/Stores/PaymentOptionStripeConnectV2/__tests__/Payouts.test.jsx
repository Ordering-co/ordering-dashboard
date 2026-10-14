import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const handleChangePage = vi.fn()
let payoutsState
let paginationProps

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: date => `date:${date}` }],
  PayoutsList: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      payoutsState={payoutsState}
      paginationProps={paginationProps}
      handleChangePage={handleChangePage}
      handleChangePageSize={vi.fn()}
    />
  )
}))

vi.mock('../../../Shared', () => ({
  Pagination: ({ currentPage, totalPages }) => <div data-testid='pagination'>{currentPage}/{totalPages}</div>
}))

import { Payouts } from '../Payouts'

const whole = {
  id: 3,
  order_id: 12122,
  business_id: 41,
  driver_id: 6,
  status: 'pending',
  restaurant_status: 'paid',
  driver_status: 'pending',
  review_reason: 'no_driver_account',
  currency: 'mxn',
  total: 21.06,
  stripe_fee: 4.48,
  platform_amount: 2.95,
  driver_amount: 5,
  restaurant_amount: 8.63,
  created_at: '2026-10-08 20:38:00',
  driver: { id: 6, name: 'Driver', lastname: 'Demo' }
}

describe('Payouts of a store', () => {
  beforeEach(() => {
    payoutsState = { loading: false, error: null, payouts: [] }
    paginationProps = { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 }
  })

  it('says so when the store has no payouts yet', () => {
    renderWithProviders(<Payouts businessId={41} />)

    expect(screen.getByText('No payouts yet. They appear here once an order paid with Stripe Connect v2 is completed.')).toBeInTheDocument()
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })

  it('shows an administrator the whole split of the order and what each part waits for', () => {
    payoutsState = { loading: false, error: null, payouts: [whole] }
    renderWithProviders(<Payouts businessId={41} />)

    const card = within(screen.getByTestId('payout-3'))
    expect(card.getByRole('link', { name: 'Order No. 12122' })).toHaveAttribute('href', '/orders?id=12122')
    expect(card.getByText('date:2026-10-08 20:38:00')).toBeInTheDocument()
    expect(card.getByText('Pending')).toBeInTheDocument()
    expect(card.getByText('21.06 MXN')).toBeInTheDocument()
    expect(card.getByText('4.48 MXN')).toBeInTheDocument()
    expect(card.getByText('2.95 MXN')).toBeInTheDocument()
    expect(card.getByText('Driver (Pending): Driver Demo')).toBeInTheDocument()
    expect(card.getByText('5.00 MXN')).toBeInTheDocument()
    // The store's part was already transferred: nothing next to its name
    expect(card.getByText('Store')).toBeInTheDocument()
    expect(card.getByText('8.63 MXN')).toBeInTheDocument()
    expect(card.getByText('Waiting for the driver to connect a Stripe account.')).toBeInTheDocument()
  })

  it('marks the order nothing was transferred of as needing review, with why', () => {
    payoutsState = {
      loading: false,
      error: null,
      payouts: [{ ...whole, driver_id: null, driver: null, status: 'needs_review', restaurant_status: 'needs_review', driver_status: null, review_reason: 'negative_restaurant' }]
    }
    renderWithProviders(<Payouts businessId={41} />)

    const card = within(screen.getByTestId('payout-3'))
    expect(card.getByText('Distribution needs review')).toBeInTheDocument()
    expect(card.getByText('Store (Distribution needs review)')).toBeInTheDocument()
    expect(card.queryByText(/^Driver/)).not.toBeInTheDocument()
    expect(card.getByText('The platform fee and the driver payment are more than what is left for the store.')).toBeInTheDocument()
  })

  it('shows a store owner only what the store received', () => {
    payoutsState = {
      loading: false,
      error: null,
      payouts: [{ id: 3, order_id: 12122, business_id: 41, driver_id: 6, currency: 'mxn', restaurant_amount: 13.63, restaurant_status: 'paid', review_reason: null, created_at: '2026-10-08 20:38:00' }]
    }
    renderWithProviders(<Payouts businessId={41} />)

    const card = within(screen.getByTestId('payout-3'))
    expect(card.getByText('Paid')).toBeInTheDocument()
    expect(card.getByText('Store')).toBeInTheDocument()
    expect(card.getByText('13.63 MXN')).toBeInTheDocument()
    expect(card.queryByText('Customer paid')).not.toBeInTheDocument()
    expect(card.queryByText('Platform')).not.toBeInTheDocument()
    expect(card.queryByText(/^Driver/)).not.toBeInTheDocument()
  })

  it('shows a reason it has no words for as it comes', () => {
    payoutsState = { loading: false, error: null, payouts: [{ ...whole, review_reason: 'something_new' }] }
    renderWithProviders(<Payouts businessId={41} />)

    expect(screen.getByText('something_new')).toBeInTheDocument()
  })

  it('pages only when there is more than one page', () => {
    payoutsState = { loading: false, error: null, payouts: [whole] }
    paginationProps = { currentPage: 2, pageSize: 10, totalItems: 30, totalPages: 3 }
    renderWithProviders(<Payouts businessId={41} />)

    expect(screen.getByTestId('pagination')).toHaveTextContent('2/3')
  })

  it('shows the error of a list that could not be read', () => {
    payoutsState = { loading: false, error: ['Not allowed'], payouts: [] }
    renderWithProviders(<Payouts businessId={41} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.queryByText(/No payouts yet/)).not.toBeInTheDocument()
  })
})
