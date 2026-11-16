/* eslint-disable import/first */
// redesign BO-B2 (promotion): the props the shared filter bar adds over the customers list's (`showOrders`, `sheetKeys`,
// `searchLabel`, `barLabel`). The customers defaults are covered by CustomersDirectory/__tests__ through the re-exports.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text],
  useConfig: () => [{ configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } } }],
  useUtils: () => [{}]
}))

import { USERS_FILTER_INITIAL_VALUES } from '../../../../../../components/UsersFilter'
import { UsersFilterBar } from '../UsersFilterBar'
import { UsersFilterSheet } from '../UsersFilterSheet'
import { SHEET_KEYS, clearSheetFields, sheetActiveCount } from '../userFilters'

const INITIAL = JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))
const OWNER_KEYS = ['name', 'lastname', 'email', 'ordersCount', 'countryPhoneCode', 'cellphone']

const renderBar = ({ values = INITIAL, order = null, ...extra } = {}) => {
  const onMultiFilterChange = vi.fn()
  const Harness = () => {
    const [multiFilterValues, setMulti] = useState(values)
    return (
      <UsersFilterBar
        searchValue=''
        onSearch={() => {}}
        orderFilterValue={order}
        onOrderFilterChange={() => {}}
        multiFilterValues={multiFilterValues}
        onMultiFilterChange={(next) => { onMultiFilterChange(next); setMulti(next) }}
        loyaltyLevels={{ loading: false, levels: [] }}
        onClearAll={() => {}}
        {...extra}
      />
    )
  }
  render(<Harness />)
  return { onMultiFilterChange }
}

const lastWrite = (spy) => spy.mock.calls[spy.mock.calls.length - 1][0]
const openSheet = async (user) => {
  await user.click(screen.getByRole('button', { name: /^Filters/ }))
  return screen.findByRole('dialog', { name: 'Filters' })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => document.getElementById('app-modals')?.remove())

describe('UsersFilterBar · showOrders', () => {
  it('draws the Orders control by default', () => {
    renderBar()
    expect(screen.getByRole('group', { name: 'Orders' })).toBeInTheDocument()
  })

  it('draws no «Orders» control with showOrders={false}', () => {
    renderBar({ showOrders: false })
    expect(screen.queryByRole('group', { name: 'Orders' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Orders' })).toBeNull()
    expect(screen.queryByText('With 5+ orders')).toBeNull()
  })

  it('an Orders value held elsewhere does not make a bar without that control narrow', () => {
    renderBar({ showOrders: false, order: 0 })
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })
})

describe('UsersFilterBar · labels', () => {
  it('keeps the customers search and bar names by default', () => {
    renderBar()
    expect(screen.getByRole('searchbox', { name: 'Search name, email or phone' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Customer filters' })).toBeInTheDocument()
  })

  it('takes the search and the bar names from the props', () => {
    renderBar({
      searchLabel: { key: 'OWNERS_SEARCH', text: 'Search owners' },
      barLabel: { key: 'OWNERS_FILTER_BAR', text: 'Owner filters' }
    })
    expect(screen.getByRole('searchbox', { name: 'Search owners' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Owner filters' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search name, email or phone' })).toBeNull()
  })
})

describe('UsersFilterBar · sheetKeys of the business owners', () => {
  it('the sheet paints those six fields, in that order, and no ID or External ID', async () => {
    const user = userEvent.setup()
    renderBar({ sheetKeys: OWNER_KEYS, showOrders: false })
    const box = await openSheet(user)
    const labels = [...box.querySelectorAll('.odc-cf-form > .odc-field label, .odc-cf-form > .odc-cf-amount .odc-cf-legend')].map(node => node.textContent)
    expect(labels).toEqual(['Name', 'Last name', 'Email', 'Amount of orders', 'Country phone code', 'Phone number'])
    expect(within(box).queryByLabelText('ID')).toBeNull()
    expect(within(box).queryByLabelText('External ID')).toBeNull()
    // with no Orders control on the page, the amount has nothing to override
    expect(within(box).queryByText('Overrides the Orders filter')).toBeNull()
  })

  it('writes countryPhoneCode (digits only) and cellphone in a complete multiFilterValues, and not the fields it does not show', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ sheetKeys: OWNER_KEYS, showOrders: false, values: { ...INITIAL, id: 7 } })
    const box = await openSheet(user)
    await user.type(within(box).getByLabelText('Country phone code'), '+34a')
    await user.type(within(box).getByLabelText('Phone number'), '555 01')
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    const written = lastWrite(onMultiFilterChange)
    expect(written).toEqual({ ...INITIAL, id: 7, countryPhoneCode: '34', cellphone: '555 01' })
    expect(Object.values(written).includes(undefined)).toBe(false)
  })

  it('their chips appear, and removing one clears only that value', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({
      sheetKeys: OWNER_KEYS,
      showOrders: false,
      values: { ...INITIAL, countryPhoneCode: '34', cellphone: '555', name: 'Ana' }
    })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(within(chips).getByText('Country phone code: +34')).toBeInTheDocument()
    expect(within(chips).getByText('Phone number: 555')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Phone number: 555 filter' }))
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...INITIAL, countryPhoneCode: '34', name: 'Ana' })
    await waitFor(() => expect(screen.queryByText('Phone number: 555')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Remove Country phone code: +34 filter' }))
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...INITIAL, name: 'Ana' })
    await waitFor(() => expect(screen.queryByText('Country phone code: +34')).toBeNull())
  })

  it('the count of «Filters» covers the sheet keys only', () => {
    // id is a sheet field of customers, not of owners: it holds a value but does not count here
    renderBar({ sheetKeys: OWNER_KEYS, showOrders: false, values: { ...INITIAL, id: 7, cellphone: '555' } })
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent(/^Filters1$/)
  })
})

describe('UsersFilterSheet · sheetKeys', () => {
  const renderSheet = (props) => {
    const onApply = vi.fn()
    render(<UsersFilterSheet open onOpenChange={() => {}} multiFilterValues={INITIAL} onApply={onApply} {...props} />)
    return { onApply }
  }

  it('paints the customers fields by default', async () => {
    renderSheet()
    const box = await screen.findByRole('dialog', { name: 'Filters' })
    ;['ID', 'External ID', 'Name', 'Last name', 'Email'].forEach(label => expect(within(box).getByLabelText(label)).toBeInTheDocument())
    expect(within(box).getByRole('group', { name: 'Amount of orders' })).toBeInTheDocument()
    expect(within(box).queryByLabelText('Phone number')).toBeNull()
    expect(within(box).queryByLabelText('Country phone code')).toBeNull()
  })

  it('«Clear» empties only the sheet keys: a value outside them survives', async () => {
    const user = userEvent.setup()
    const { onApply } = renderSheet({
      sheetKeys: OWNER_KEYS,
      multiFilterValues: { ...INITIAL, id: 7, name: 'Ana', cellphone: '555', countryPhoneCode: '34' }
    })
    const box = await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(within(box).getByLabelText('Name')).toHaveValue('')
    expect(within(box).getByLabelText('Phone number')).toHaveValue('')
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith({ ...INITIAL, id: 7 })
  })
})

describe('userFilters · sheet keys', () => {
  it('count and clear use the keys they are given, and the customers keys by default', () => {
    const values = { ...INITIAL, id: 7, cellphone: '555' }
    expect(sheetActiveCount(values)).toBe(1)
    expect(sheetActiveCount(values, OWNER_KEYS)).toBe(1)
    expect(sheetActiveCount({ ...INITIAL, id: 7 }, OWNER_KEYS)).toBe(0)
    expect(clearSheetFields(values)).toEqual({ ...INITIAL, cellphone: '555' })
    expect(clearSheetFields(values, OWNER_KEYS)).toEqual({ ...INITIAL, id: 7 })
    expect(SHEET_KEYS).toEqual(['id', 'externalId', 'name', 'lastname', 'email', 'ordersCount'])
  })
})

// redesign (B1b): `showLoyalty` is opt-in off: the professionals list has no Loyalty level (main's sheet has none for them)
describe('UsersFilterBar · showLoyalty', () => {
  it('draws the Loyalty level pill by default, as today', () => {
    renderBar()
    expect(screen.getByRole('button', { name: /Loyalty level/ })).toBeInTheDocument()
  })

  it('draws no Loyalty level pill with showLoyalty={false}, and the other pills stay', () => {
    renderBar({ showLoyalty: false })
    expect(screen.queryByRole('button', { name: /Loyalty level/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Verified/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign up date/ })).toBeInTheDocument()
  })

  const gold = { loading: false, levels: [{ id: 3, name: 'Gold' }] }

  it('its chip shows by default', () => {
    renderBar({ values: { ...INITIAL, loyaltyLevel: 3 }, loyaltyLevels: gold })
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getByText('Loyalty level: Gold')).toBeInTheDocument()
  })

  it('its chip does not show with showLoyalty={false}', () => {
    renderBar({ values: { ...INITIAL, loyaltyLevel: 3 }, loyaltyLevels: gold, showLoyalty: false })
    expect(screen.queryByText('Loyalty level: Gold')).toBeNull()
  })
})
