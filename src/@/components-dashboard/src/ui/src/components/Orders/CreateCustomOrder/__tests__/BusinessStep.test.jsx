/* eslint-disable import/first */
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  config: { order_types_allowed: { value: '1|2|3' } },
  orderType: { typeSelected: 1, change: vi.fn() }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  useConfig: () => [{ configs: mocks.config }],
  useOrder: () => [{ options: {} }, { changeType: vi.fn() }],
  OrderTypeControl: ({ UIComponent, ...props }) => (
    <UIComponent {...props} typeSelected={mocks.orderType.typeSelected} handleChangeOrderType={mocks.orderType.change} />
  )
}))

import { OrderTypeSelector } from '../OrderTypeSelector'
import { SelectBusinesses } from '../SelectBusinesses'

// redesign F6c (Q2-19): the question «How will you delivery type?» is now the label «Delivery type».
describe('OrderTypeSelector · step content (5.5-B)', () => {
  it('shows the allowed types as a segmented control and changes the type with the number the controller expects', async () => {
    mocks.config = { order_types_allowed: { value: '1|2|3' } }
    mocks.orderType = { typeSelected: 1, change: vi.fn() }
    renderWithProviders(<OrderTypeSelector />)
    const group = screen.getByRole('group', { name: 'Delivery type' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['Delivery', 'Pickup', 'Eat in'])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.setup().click(within(group).getByRole('button', { name: 'Pickup' }))
    expect(mocks.orderType.change).toHaveBeenCalledWith(2)
  })

  it('presses nothing when the current type is not allowed, so the first allowed one can still be chosen', async () => {
    mocks.config = { order_types_allowed: { value: '2|3' } }
    mocks.orderType = { typeSelected: 1, change: vi.fn() }
    renderWithProviders(<OrderTypeSelector />)
    const group = screen.getByRole('group', { name: 'Delivery type' })
    expect(within(group).getAllByRole('button').every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true)
    await userEvent.setup().click(within(group).getByRole('button', { name: 'Pickup' }))
    expect(mocks.orderType.change).toHaveBeenCalledWith(2)
  })

  it('falls back to a select when more types are allowed than a segmented control takes', async () => {
    mocks.config = { order_types_allowed: { value: '1|2|3|4|5' } }
    mocks.orderType = { typeSelected: 3, change: vi.fn() }
    renderWithProviders(<OrderTypeSelector />)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Delivery type' })
    expect(select).toHaveValue('3')
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Delivery', 'Pickup', 'Eat in', 'Curbside', 'Drive thru'])
    await userEvent.setup().selectOptions(select, '5')
    expect(mocks.orderType.change).toHaveBeenCalledWith(5)
  })

  it('offers every type when the project does not restrict them', () => {
    mocks.config = {}
    mocks.orderType = { typeSelected: 1, change: vi.fn() }
    renderWithProviders(<OrderTypeSelector />)
    expect(screen.getByRole('combobox', { name: 'Delivery type' })).toBeInTheDocument()
  })
})

const stores = [
  { id: 1, slug: 'corner', name: 'Corner Store', logo: 'corner.png', address: '1 Main St' },
  { id: 2, slug: 'bakery', name: 'Blue Bakery', logo: null, address: '9 Oak Ave' }
]

describe('SelectBusinesses · step content (5.5-B)', () => {
  const setup = (overrides = {}) => {
    const props = {
      businessList: { loading: false, businesses: stores },
      selectedBusiness: null,
      setSelectedBusiness: vi.fn(),
      ...overrides
    }
    const view = renderWithProviders(<SelectBusinesses {...props} />)
    return { props, ...view, update: next => view.rerender(<SelectBusinesses {...props} {...next} />) }
  }

  it('lists the open businesses as selectable rows with name and address, and picks one by slug', async () => {
    const { props } = setup()
    const list = screen.getByRole('list', { name: 'Select business' })
    const rows = within(list).getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Corner Store')
    expect(rows[0]).toHaveTextContent('1 Main St')
    expect(rows.every(row => row.getAttribute('aria-pressed') === 'false')).toBe(true)
    await userEvent.setup().click(rows[1])
    expect(props.setSelectedBusiness).toHaveBeenCalledWith(stores[1])
  })

  it('marks the selected business with aria-pressed and a visible state', () => {
    setup({ selectedBusiness: stores[0] })
    const row = screen.getByRole('button', { name: /Corner Store/ })
    expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(row).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('button', { name: /Blue Bakery/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters by the name typed in the search, like the select did, and says when nothing matches', async () => {
    setup()
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'blue')
    expect(screen.queryByRole('button', { name: /Corner Store/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Blue Bakery/ })).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search businesses' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'zzz')
    expect(screen.getByText('No businesses found')).toBeInTheDocument()
  })

  it('is busy while loading and drops a selection that is no longer in the list', () => {
    const { props, update } = setup({ businessList: { loading: true, businesses: undefined } })
    expect(screen.getByRole('list', { name: 'Select business' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    update({ businessList: { loading: false, businesses: [stores[1]] }, selectedBusiness: stores[0] })
    expect(props.setSelectedBusiness).toHaveBeenCalledWith(null)
  })
})
