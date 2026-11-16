/* eslint-disable import/first */
// redesign F6h-4 (A2): the single-choice selects of the Filters sheet name their listbox with the label of their field,
// not with the text of the trigger («Any»).
import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const spies = vi.hoisted(() => ({ merge: vi.fn() }))
// The catalog of the API may write these words in lower case.
const LOWER = { ASSIGNED: 'assigned', UNASSIGNED: 'unassigned', FRAUD_DECLINED: 'declined', PENDING: 'pending' }

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (key, text) => LOWER[key] ?? text],
    useApi: () => [{ root: 'https://api.test' }],
    useSession: () => [{ token: null }],
    OrdersFilter: ({ UIComponent, ...props }) => {
      const [filterValues, setFilterValues] = React.useState({ orderId: '', groupTypes: [], groupTypesUnassigned: [], deliveryTypes: [], metafield: [], assigned: null, logisticStatus: null, statuses: [], businessIds: [] })
      const merge = patch => { spies.merge(patch); setFilterValues(current => ({ ...current, ...patch })) }
      return (
        <UIComponent
          {...props}
          filterValues={filterValues}
          handleChangeChildFilterValue={merge}
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
          handleChangeDeliveryType={vi.fn()}
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

const Harness = () => {
  const [open, setOpen] = useState(true)
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <FilterValuesContext.Provider value={[{}, { handleFilterValues: vi.fn() }]}>
        <OrdersFilterGroup
          filterModalOpen={open}
          setFilterModalOpen={setOpen}
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

const triggerOf = name => document.querySelector(`[data-orders-filter-field="${name}"] [aria-haspopup="listbox"]`)

describe('Filters sheet · listbox names (F6h-4)', () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.reject(new Error('no plugin'))) })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it.each([
    ['assigned', 'Driver status'],
    ['logisticStatus', 'Logistic status']
  ])('%s names its listbox «%s»', async (field, label) => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(triggerOf(field))
    expect(screen.getByRole('listbox')).toHaveAccessibleName(label)
  })
})
