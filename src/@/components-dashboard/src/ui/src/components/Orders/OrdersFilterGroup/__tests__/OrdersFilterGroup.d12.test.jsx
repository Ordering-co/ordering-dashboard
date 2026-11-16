/* eslint-disable import/first */
// redesign F6a (D-12): inside the real Filters sheet (real selects, a controller that keeps the values and
// re-renders the sheet on every choice) Esc closes only the innermost layer.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// A controller that behaves like the real one: every handler writes a new filterValues object.
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useApi: () => [{ root: 'https://api.test' }],
    useSession: () => [{ token: null }],
    OrdersFilter: ({ UIComponent, ...props }) => {
      const [filterValues, setFilterValues] = React.useState({ orderId: '', groupTypes: [], groupTypesUnassigned: [], deliveryTypes: [1], metafield: [], assigned: null, logisticStatus: null, statuses: [], businessIds: [] })
      const merge = patch => setFilterValues(current => ({ ...current, ...patch }))
      return (
        <UIComponent
          {...props}
          filterValues={filterValues}
          handleChangeChildFilterValue={merge}
          handleChangeDeliveryType={type => setFilterValues(current => ({
            ...current,
            deliveryTypes: current.deliveryTypes.includes(type) ? current.deliveryTypes.filter(item => item !== type) : [...current.deliveryTypes, type]
          }))}
          handleChangeFilterValues={vi.fn()}
          handleFilterValues={vi.fn()}
          handleResetFilterValues={vi.fn()}
          handleChangeOrderId={vi.fn()}
          handleChangeOfferId={vi.fn()}
          handleChangeGroupUnassigned={vi.fn()}
          handleChangeDateType={vi.fn()}
          handleChangeFromDate={vi.fn()}
          handleChangeEndDate={vi.fn()}
          handleChangeBusinesses={vi.fn()}
          handleChangeCity={vi.fn()}
          handleChangePaymethodType={vi.fn()}
          handleChangeCountryCode={vi.fn()}
          handleChangeCurrency={vi.fn()}
          handleChangeAdmin={vi.fn()}
          handleChangeMetaFieldValue={vi.fn()}
          handleAddMetaField={vi.fn()}
          handleDeleteMetafield={vi.fn()}
        />
      )
    }
  }
})
vi.mock('../../../Shared', () => ({ CitySelector: () => <div /> }))
vi.mock('../../BusinessesSelector', () => ({ BusinessesSelector: () => <div /> }))
vi.mock('../../DateTypeSelector', () => ({ DateTypeSelector: () => <div /> }))
vi.mock('../../DriversGroupTypeSelector', () => ({ DriversGroupTypeSelector: () => <div /> }))
vi.mock('../../PaymethodTypeSelector', () => ({ PaymethodTypeSelector: () => <div /> }))
vi.mock('../../CountryFilter', () => ({ CountryFilter: () => <div /> }))
vi.mock('../../CurrencyFilter', () => ({ CurrencyFilter: () => <div /> }))
vi.mock('../../AdminsSelector', () => ({ AdminsSelector: () => <div /> }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersFilterGroup } from '..'

const Harness = ({ onOpenChange }) => {
  const [open, setOpen] = useState(true)
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <FilterValuesContext.Provider value={[{}, { handleFilterValues: vi.fn() }]}>
        <OrdersFilterGroup
          filterModalOpen={open}
          setFilterModalOpen={next => { onOpenChange(next); setOpen(next) }}
          handleChangeFilterValues={vi.fn()}
          driverGroupList={{ loading: false, groups: [] }}
          driversList={{ loading: false, drivers: [] }}
          paymethodsList={{ loading: false, paymethods: [] }}
          businessesList={{ loading: false, businesses: [] }}
          citiesList={[]}
          adminsList={{ loading: false, admins: [] }}
        />
      </FilterValuesContext.Provider>
    </ThemeProvider>
  )
}

const field = name => document.querySelector(`[data-orders-filter-field="${name}"]`)
const triggerOf = name => field(name).querySelector('[aria-haspopup="listbox"]')
const sheet = () => screen.queryByRole('dialog', { name: 'Filters' })

describe('Esc inside the real Filters sheet', () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.reject(new Error('no plugin'))) })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it('single select: choose with the pointer, the list closes, the focus is on the field and the sheet stays', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheet()).not.toBeNull())
    await user.click(triggerOf('assigned'))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Unassigned' }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(triggerOf('assigned')).toHaveTextContent('Unassigned')
    expect(document.activeElement).toBe(triggerOf('assigned'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(sheet()).not.toBeNull()
  })

  it('single select: open, Esc closes only the list and puts the focus back; the next Esc closes the sheet', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheet()).not.toBeNull())
    await user.click(triggerOf('logisticStatus'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(triggerOf('logisticStatus'))
    expect(onOpenChange).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('multi select: pick a row (the sheet re-renders with the new value), Esc closes only the list', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheet()).not.toBeNull())
    await user.click(triggerOf('deliveryType'))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Pickup/ }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(triggerOf('deliveryType'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(sheet()).not.toBeNull()
  })
})
