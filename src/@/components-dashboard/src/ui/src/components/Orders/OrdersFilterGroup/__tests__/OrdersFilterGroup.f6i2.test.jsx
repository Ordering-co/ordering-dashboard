/* eslint-disable import/first */
// redesign F6i-2 (A3-02): every select trigger of the Filters sheet is named «<visible label> <value>», not only with
// the text it draws («Any», «Select business»).
import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
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
vi.mock('../../DateTypeSelector', () => ({ DateTypeSelector: () => <div /> }))
vi.mock('../../PaymethodTypeSelector', () => ({ PaymethodTypeSelector: () => <div /> }))
vi.mock('../../CountryFilter', () => ({ CountryFilter: () => <div /> }))
vi.mock('../../CurrencyFilter', () => ({ CurrencyFilter: () => <div /> }))
vi.mock('../../AdminsSelector', () => ({ AdminsSelector: () => <div /> }))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersFilterGroup } from '..'

const Harness = () => {
  const [open, setOpen] = useState(true)
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'dashboard' }]}>
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
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
}

const triggerOf = name => document.querySelector(`[data-orders-filter-field="${name}"] [aria-haspopup="listbox"]`)

describe('Filters sheet · trigger names (A3-02)', () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.reject(new Error('no plugin'))) })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it.each([
    ['business', 'Business Select business'],
    ['driverGroup', 'Driver group (assigned) Any'],
    ['assigned', 'Driver status Any'],
    ['logisticStatus', 'Logistic status Any']
  ])('%s trigger is named «%s»', (field, name) => {
    render(<Harness />)
    expect(triggerOf(field)).toHaveAccessibleName(name)
    expect(screen.getByRole('button', { name })).toBe(triggerOf(field))
  })

  it('every select trigger of the sheet starts with the visible label of its field', () => {
    render(<Harness />)
    const triggers = [...document.querySelectorAll('[data-orders-filter-field] [aria-haspopup="listbox"]')]
    expect(triggers.length).toBeGreaterThanOrEqual(4)
    for (const trigger of triggers) {
      const label = trigger.closest('[data-orders-filter-field]').querySelector('.odc-ofs-label').textContent
      expect(trigger.getAttribute('aria-labelledby').split(' ')[0]).toBe(trigger.closest('[data-orders-filter-field]').getAttribute('aria-labelledby'))
      expect(trigger).toHaveAccessibleName(expect.stringMatching(new RegExp(`^${label.replace(/[()]/g, '\\$&')} .+`)))
    }
  })
})
