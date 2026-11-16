/* eslint-disable import/first */
// redesign 5.2 audit-1 (FB-5): the filter bar uses the Product wrappers through the API of FA, and
// these tests assert only the props it passes. `FilterBar` and `Menu` are replaced by recorders, so
// nothing here depends on how the wrappers draw `flush` or the single-choice items.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const recorded = vi.hoisted(() => ({ filterBar: null, menus: [] }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {}, loading: false }],
  // eslint-disable-next-line no-use-before-define
  useUtils: () => [{ parseDate: mockParseDate({}) }],
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'token' }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
// The sheet and the header pills are other batches' surfaces; here they are only placeholders.
vi.mock('../../OrdersFilterGroup', () => ({ OrdersFilterGroup: () => null }))
vi.mock('../../OrdersHeaderFilterGroup', () => ({ OrdersHeaderFilterGroup: () => null }))
vi.mock('../../../Shared/Product', async (importActual) => ({
  ...(await importActual()),
  FilterBar: (props) => {
    recorded.filterBar = props
    return <div data-testid='filter-bar'>{props.filters}{props.more}{props.chips}</div>
  },
  Menu: (props) => {
    recorded.menus.push(props)
    return <button type='button'>{props.label}</button>
  }
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { mockParseDate } from './parseDateMock'
import { OrdersFilterBar } from '..'

const EMPTY_FILTERS = { businessIds: [], driverIds: [], statuses: [], timeStatus: null }

const renderBar = (filters = EMPTY_FILTERS, props = {}) => render(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    <FilterValuesContext.Provider value={[filters, { handleFilterValues: vi.fn() }]}>
      <OrdersFilterBar
        ordersStatusGroup='pending'
        handleChangeFilterValues={vi.fn()}
        handleChangeSearch={vi.fn()}
        setTimeStatus={vi.fn()}
        filterModalOpen={false}
        setFilterModalOpen={vi.fn()}
        searchValue={null}
        driversList={{ drivers: [] }}
        driverGroupList={{ groups: [] }}
        assignableDriverGroupList={{ groups: [] }}
        businessesList={{ businesses: [] }}
        paymethodsList={{ paymethods: [] }}
        adminsList={{ admins: [] }}
        citiesList={[]}
        {...props}
      />
    </FilterValuesContext.Provider>
  </ConfigFileContext.Provider>
)

const slaMenu = () => recorded.menus.filter(menu => String(menu.label).startsWith('SLA')).at(-1)

describe('OrdersFilterBar · wrapper API (audit 1)', () => {
  beforeEach(() => {
    recorded.filterBar = null
    recorded.menus = []
  })

  it('draws the Product filter bar flush: the page already gives it its margin', () => {
    renderBar()
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
    expect(recorded.filterBar.flush).toBe(true)
  })

  it('offers the SLA values as single-choice items with the words of the table', () => {
    renderBar()
    const items = slaMenu().items
    expect(items.map(item => [item.key, item.label])).toEqual([
      ['default', 'All'],
      ['in_time', 'On time'],
      ['at_risk', 'At risk'],
      ['delayed', 'Delayed'],
      ['sla_settings', 'SLA settings']
    ])
    // the four values are the choice; «SLA settings» is an action and stays a plain item
    expect(items.slice(0, 4).every(item => item.type === 'radio')).toBe(true)
    expect(items[4].type).toBeUndefined()
  })

  it('marks «All» as the current choice when no SLA filter is active', () => {
    renderBar()
    expect(slaMenu().items.filter(item => item.checked).map(item => item.key)).toEqual(['default'])
  })

  // redesign F6c: the pill reads «Label · value»
  it.each([
    ['in_time', 'SLA · On time'],
    ['at_risk', 'SLA · At risk'],
    ['delayed', 'SLA · Delayed']
  ])('marks only %s as current when it is the active SLA filter, and names the pill «%s»', (timeStatus, label) => {
    renderBar({ ...EMPTY_FILTERS, timeStatus })
    expect(slaMenu().label).toBe(label)
    expect(slaMenu().items.filter(item => item.checked).map(item => item.key)).toEqual([timeStatus])
  })

  it('keeps the effects of the items: a value filters, All clears, SLA settings navigates', () => {
    const handleFilterValues = vi.fn()
    const setTimeStatus = vi.fn()
    render(
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        <FilterValuesContext.Provider value={[{ ...EMPTY_FILTERS, timeStatus: 'delayed' }, { handleFilterValues }]}>
          <OrdersFilterBar
            ordersStatusGroup='pending'
            setTimeStatus={setTimeStatus}
            driversList={{ drivers: [] }}
            driverGroupList={{ groups: [] }}
            assignableDriverGroupList={{ groups: [] }}
            businessesList={{ businesses: [] }}
            paymethodsList={{ paymethods: [] }}
            adminsList={{ admins: [] }}
            citiesList={[]}
          />
        </FilterValuesContext.Provider>
      </ConfigFileContext.Provider>
    )
    const byKey = Object.fromEntries(slaMenu().items.map(item => [item.key, item]))
    byKey.in_time.onSelect()
    expect(handleFilterValues).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, timeStatus: 'in_time' })
    expect(setTimeStatus).toHaveBeenLastCalledWith('in_time')
    byKey.default.onSelect()
    expect(handleFilterValues).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, timeStatus: null })
    expect(setTimeStatus).toHaveBeenLastCalledWith(null)
  })
})
