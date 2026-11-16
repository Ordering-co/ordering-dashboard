/* eslint-disable import/first */
// (R-4): a read-only admin cannot open Settings, so the SLA menu of the orders filter bar does not offer «SLA settings»
// to it (nor its separator). The admin of level 0 keeps it. `Menu` is a recorder, as in the audit-1 test.
import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const recorded = vi.hoisted(() => ({ menus: [], user: { level: 0 } }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {}, loading: false }],
  // eslint-disable-next-line no-use-before-define
  useUtils: () => [{ parseDate: mockParseDate({}) }],
  useApi: () => [{ root: 'https://api.test', project: 'demo' }],
  useSession: () => [{ token: 'token', user: recorded.user }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../OrdersFilterGroup', () => ({ OrdersFilterGroup: () => null }))
vi.mock('../../OrdersHeaderFilterGroup', () => ({ OrdersHeaderFilterGroup: () => null }))
vi.mock('../../../Shared/Product', async (importActual) => ({
  ...(await importActual()),
  FilterBar: (props) => <div data-testid='filter-bar'>{props.filters}{props.more}{props.chips}</div>,
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

const renderBar = () => render(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    <FilterValuesContext.Provider value={[EMPTY_FILTERS, { handleFilterValues: vi.fn() }]}>
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
      />
    </FilterValuesContext.Provider>
  </ConfigFileContext.Provider>
)

const slaMenu = () => recorded.menus.filter(menu => String(menu.label).startsWith('SLA')).at(-1)

describe('OrdersFilterBar · SLA menu and read-only access (R-4)', () => {
  beforeEach(() => {
    recorded.menus = []
    recorded.user = { level: 0 }
  })

  it('offers «SLA settings» (after a separator) to the admin', () => {
    renderBar()
    const items = slaMenu().items
    expect(items.map(item => item.label)).toContain('SLA settings')
    expect(items.find(item => item.key === 'sla_settings').separatorBefore).toBe(true)
  })

  it('does not offer «SLA settings», nor a separator, to a read-only admin, and keeps the four values', () => {
    recorded.user = { level: 0, readOnlyAdmin: true }
    renderBar()
    const items = slaMenu().items
    expect(items.map(item => item.label)).not.toContain('SLA settings')
    expect(items.map(item => item.key)).toEqual(['default', 'in_time', 'at_risk', 'delayed'])
    expect(items.some(item => item.separatorBefore)).toBe(false)
  })
})
