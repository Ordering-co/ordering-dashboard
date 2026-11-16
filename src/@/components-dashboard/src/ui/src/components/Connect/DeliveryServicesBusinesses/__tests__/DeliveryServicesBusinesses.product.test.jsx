/* eslint-disable import/first */
// the Businesses section of the delivery provider panel on P/SelectableList, in place of main's
// SearchBar, grey buttons, empty logo box, legacy checkboxes and Pagination. Same data and handlers: the list is filtered and
// paginated locally, as main did, and Save (or Add) sends the same change.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }]
}))

import { DeliveryServiceBusinesses } from '..'

const BUSINESSES = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Store ${i + 1}`, logo: i === 0 ? 'https://cdn.example.invalid/logo.png' : null }))

const draw = (props = {}) => {
  const handlers = {
    handleSelectAllBusiness: vi.fn(),
    handleSelectBusiness: vi.fn(),
    handleUpdateDeliveryGroup: vi.fn(),
    handleAddDeliveryService: vi.fn()
  }
  const all = {
    deliveryServiceState: { deliveryService: { id: 5 } },
    businesses: BUSINESSES,
    actionState: { loading: false },
    selectedBusinessIds: [],
    changesState: {},
    ...handlers,
    ...props
  }
  const view = render(<DeliveryServiceBusinesses {...all} />)
  return { ...handlers, rerender: (next) => view.rerender(<DeliveryServiceBusinesses {...all} {...next} />) }
}
const rows = () => within(screen.getByRole('list', { name: 'Stores' })).getAllByRole('checkbox')

afterEach(cleanup)

describe('DeliveryServicesBusinesses on P/SelectableList', () => {
  it('shows the first page of 10 with a Product pagination over the 12 stores', () => {
    draw()
    expect(rows()).toHaveLength(10)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent(/Showing 1–10 of 12/)
  })

  it('goes to the next local page', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(2)
    expect(rows()[0]).toHaveTextContent('Store 11')
    expect(rows()[1]).toHaveTextContent('Store 12')
  })

  it('a store without a logo has an avatar with its initials, a store with one shows it', () => {
    draw()
    const first = rows()[0]
    expect(first.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.invalid/logo.png')
    expect(rows()[1]).toHaveTextContent('S2')
  })

  it('searches with a labelled field and filters by name', async () => {
    draw()
    const search = screen.getByRole('searchbox', { name: 'Search stores' })
    await userEvent.type(search, 'Store 1{Enter}')
    // Store 1, 10, 11, 12
    expect(rows()).toHaveLength(4)
  })

  it('a row is a Product checkbox that toggles through the controller', async () => {
    const { handleSelectBusiness } = draw({ selectedBusinessIds: [2] })
    expect(rows()[1]).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(rows()[2])
    expect(handleSelectBusiness).toHaveBeenCalledWith(3, true)
  })

  it('Select all and Select none are Product buttons', () => {
    draw({ selectedBusinessIds: [1] })
    expect(screen.getByRole('button', { name: 'Select all' })).toHaveClass('odc-btn')
    expect(screen.getByRole('button', { name: 'Select none' })).toHaveClass('odc-btn')
  })

  it('Save sends the business change on the group, as main; disabled without one', async () => {
    const { handleUpdateDeliveryGroup, rerender } = draw()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    rerender({ changesState: { business: '[1,2]' } })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(save)
    expect(handleUpdateDeliveryGroup).toHaveBeenCalledWith({ business: '[1,2]' })
  })

  it('without a group it is Add and creates it', async () => {
    const { handleAddDeliveryService } = draw({ deliveryServiceState: { deliveryService: null }, changesState: { business: '[1]' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(handleAddDeliveryService).toHaveBeenCalled()
  })

  it('a save in flight locks the rows and makes Save busy', () => {
    draw({ actionState: { loading: true }, changesState: { business: '[1]' } })
    expect(rows()[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
  })

  it('shows a busy skeleton while the stores load', () => {
    draw({ businessesLoading: true })
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Stores' })).toBeNull()
  })
})
