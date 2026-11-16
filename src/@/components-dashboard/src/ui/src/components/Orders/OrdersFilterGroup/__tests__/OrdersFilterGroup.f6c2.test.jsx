/* eslint-disable import/first */
// redesign F6c-2 (Q2-16, Q2-28): the single-choice selects of the Filters sheet offer «Any» to go back to no
// filter and write their options in sentence case; «Select business» reads as a placeholder.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
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

const field = name => document.querySelector(`[data-orders-filter-field="${name}"]`)
const triggerOf = name => field(name).querySelector('[aria-haspopup="listbox"]')
const optionNames = () => within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent.trim())

describe('Filters sheet · single-choice selects (F6c-2)', () => {
  beforeEach(() => { spies.merge.mockClear(); global.fetch = vi.fn(() => Promise.reject(new Error('no plugin'))) })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it('Driver status offers «Any» first and writes the options in sentence case', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await waitFor(() => expect(field('assigned')).not.toBeNull())
    await user.click(triggerOf('assigned'))
    expect(optionNames()).toEqual(['Any', 'Assigned', 'Unassigned'])
  })

  it('goes back to no filter with «Any» (null, like the Clear of the chip)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await waitFor(() => expect(field('assigned')).not.toBeNull())
    await user.click(triggerOf('assigned'))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Unassigned' }))
    expect(spies.merge).toHaveBeenLastCalledWith({ assigned: 1 })
    expect(triggerOf('assigned')).toHaveTextContent('Unassigned')
    await user.click(triggerOf('assigned'))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Any' }))
    expect(spies.merge).toHaveBeenLastCalledWith({ assigned: null })
    expect(triggerOf('assigned')).toHaveTextContent('Any')
  })

  it('Logistic status offers «Any» and capitalises its options', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await waitFor(() => expect(field('logisticStatus')).not.toBeNull())
    await user.click(triggerOf('logisticStatus'))
    expect(optionNames()).toEqual(['Any', 'Pending', 'In progress', 'In queue', 'Expired', 'Resolved'])
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Resolved' }))
    expect(spies.merge).toHaveBeenLastCalledWith({ logisticStatus: 4 })
    await user.click(triggerOf('logisticStatus'))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Any' }))
    expect(spies.merge).toHaveBeenLastCalledWith({ logisticStatus: null })
  })
})

describe('Filters sheet · «Select business» placeholder (Q2-28)', () => {
  const css = readFileSync(path.resolve(__dirname, '../orders-filter-group.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('colours the closed picker that has no value drawn (its placeholder is a bare text node, not an element)', () => {
    const rule = css.match(/\.odc-ofs-body \.od-multi-select-trigger:not\(:has\(\.od-multi-select-header\)\)\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/color:\s*var\(--od-x-text-subtle\)/)
  })
})
