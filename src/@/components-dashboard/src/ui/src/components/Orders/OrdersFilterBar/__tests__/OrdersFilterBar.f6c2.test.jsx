/* eslint-disable import/first */
// redesign F6c-2: Status counts as a filter everywhere, one value format for pills and chips, no group id.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ configs: {} }))
const controller = vi.hoisted(() => ({
  handleChangeDriver: vi.fn(),
  handleChangeGroup: vi.fn(),
  handleChangeExternalId: vi.fn(),
  handleChangeBusinesses: vi.fn(),
  handleChangeDateType: vi.fn(),
  handleChangeFromDate: vi.fn(),
  handleChangeEndDate: vi.fn()
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: mockState.configs, loading: false }],
  // eslint-disable-next-line no-use-before-define
  useUtils: () => [{ parseDate: mockParseDate(mockState.configs) }],
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'token' }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} {...controller} />
}))
vi.mock('../../DriversGroupTypeSelector', () => ({
  DriversGroupTypeSelector: () => <div />
}))
vi.mock('../../../Shared', () => ({
  SearchBar: () => <input />,
  CitySelector: () => <div />
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { mockParseDate } from './parseDateMock'
import { OrdersFilterBar } from '..'
import { hasActiveOrdersNarrowing, clearOrdersNarrowing, hasActiveFilterValues } from '../../OrdersFilterGroup/activeFilters'

const EMPTY_FILTERS = {
  orderId: null,
  externalId: null,
  groupTypes: [],
  groupTypesUnassigned: [],
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null,
  businessIds: [],
  driverIds: [],
  driverGroupIds: [],
  cityIds: [],
  statuses: [],
  deliveryTypes: [],
  paymethodIds: [],
  countryCode: [],
  currency: [],
  metafield: [],
  logisticStatus: null,
  assigned: null,
  driverGroupBusinessIds: [],
  customerName: null,
  customerEmail: null,
  customerCellphone: null,
  customerLastname: null,
  coupon: null,
  offerId: null,
  administratorIds: [],
  timeStatus: null
}
const ALL_SUBSTATUS = {
  pending: [0, 13],
  inProgress: [7, 4, 8, 3, 9, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  completed: [1, 11, 15],
  cancelled: [2, 5, 6, 10, 12, 16, 17]
}

const renderBar = ({ filters = EMPTY_FILTERS, configs = {}, ...props } = {}) => {
  mockState.configs = configs
  const spies = {
    handleFilterValues: vi.fn(),
    handleChangeFilterValues: vi.fn(),
    handleChangeSearch: vi.fn(),
    handleSelectedSubOrderStatus: vi.fn(),
    setTimeStatus: vi.fn(),
    setFilterModalOpen: vi.fn()
  }
  const view = render(
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <FilterValuesContext.Provider value={[filters, { handleFilterValues: spies.handleFilterValues }]}>
        <OrdersFilterBar
          ordersStatusGroup='pending'
          selectedSubOrderStatus={ALL_SUBSTATUS}
          handleSelectedSubOrderStatus={spies.handleSelectedSubOrderStatus}
          handleChangeFilterValues={spies.handleChangeFilterValues}
          handleChangeSearch={spies.handleChangeSearch}
          setTimeStatus={spies.setTimeStatus}
          filterModalOpen={false}
          setFilterModalOpen={spies.setFilterModalOpen}
          searchValue={null}
          driversList={{ loading: false, drivers: [{ id: 5, name: 'Ana', lastname: 'Ruiz' }, { id: 6, name: 'Bruno', lastname: 'Diaz' }] }}
          driverGroupList={{ loading: false, groups: [] }}
          assignableDriverGroupList={{ loading: false, groups: [{ id: 34, name: 'Driver Group: Shipday Downtown' }, { id: 3, name: 'Night' }] }}
          businessesList={{ loading: false, businesses: [{ id: 1, name: 'Fast Bite' }] }}
          paymethodsList={{ loading: false, paymethods: [] }}
          adminsList={{ loading: false, admins: [] }}
          citiesList={[]}
          {...props}
        />
      </FilterValuesContext.Provider>
    </ConfigFileContext.Provider>
  )
  return { ...spies, ...view }
}
const groupConfigs = { filter_order_options: { value: 'driver|driver_group' } }

describe('Status sub filter counts as a filter (Q2-01)', () => {
  beforeEach(() => vi.clearAllMocks())
  const one = { ...ALL_SUBSTATUS, pending: [13] }

  it('counts in «Filters N», has its chip with an X, shows the notice and the Clear button', () => {
    renderBar({ selectedSubOrderStatus: one })
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeInTheDocument()
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(within(chips).getByText('Status: Preorder')).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: 'Remove Status filter' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Filters applied. You may miss new orders.')
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0)
  })

  it('is neutral with every sub status selected: no count, chip, notice or Clear', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('writes the chip of several as a count and goes back to all with its X', async () => {
    const user = userEvent.setup()
    const some = { ...ALL_SUBSTATUS, inProgress: [7, 4, 8] }
    const { handleSelectedSubOrderStatus } = renderBar({ ordersStatusGroup: 'inProgress', selectedSubOrderStatus: some })
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getByText('Status: 3 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Status filter' }))
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith(ALL_SUBSTATUS)
  })

  it('«Clear filters» clears it together with the rest', async () => {
    const user = userEvent.setup()
    const { handleSelectedSubOrderStatus, handleFilterValues } = renderBar({
      selectedSubOrderStatus: one,
      filters: { ...EMPTY_FILTERS, timeStatus: 'delayed' }
    })
    expect(screen.getByRole('button', { name: 'Filters 2' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('list', { name: 'Active filters' })).getByRole('button', { name: 'Clear filters' }))
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith(ALL_SUBSTATUS)
    expect(handleFilterValues).toHaveBeenCalled()
  })

  it('«Clear filters» clears Status even when it is the only filter', async () => {
    const user = userEvent.setup()
    const { handleSelectedSubOrderStatus } = renderBar({ selectedSubOrderStatus: one })
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith(ALL_SUBSTATUS)
  })

  it('exposes the same rule to the list for its empty state', () => {
    const sub = { ordersStatusGroup: 'pending', selectedSubOrderStatus: one }
    expect(hasActiveOrdersNarrowing(EMPTY_FILTERS, null, sub)).toBe(true)
    expect(hasActiveOrdersNarrowing(EMPTY_FILTERS, null, { ordersStatusGroup: 'pending', selectedSubOrderStatus: ALL_SUBSTATUS })).toBe(false)
    expect(hasActiveOrdersNarrowing(EMPTY_FILTERS, null)).toBe(false)
    const handleSelectedSubOrderStatus = vi.fn()
    clearOrdersNarrowing({ filterValues: EMPTY_FILTERS, searchValue: null, ...sub, handleSelectedSubOrderStatus })
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith(ALL_SUBSTATUS)
  })

  it('counts Driver status «Assigned» (value 0) as a filter', () => {
    expect(hasActiveFilterValues({ ...EMPTY_FILTERS, assigned: 0 })).toBe(true)
    const handleFilterValues = vi.fn()
    clearOrdersNarrowing({ filterValues: { ...EMPTY_FILTERS, assigned: 0 }, searchValue: null, handleFilterValues })
    expect(handleFilterValues).toHaveBeenCalledWith(expect.objectContaining({ assigned: null }))
  })
})

describe('One value format for the pills and no doubled prefix (Q2-04, Q2-15)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Status: «Label value» for one, the count for several', () => {
    const { unmount } = renderBar({ selectedSubOrderStatus: { ...ALL_SUBSTATUS, pending: [13] } })
    expect(screen.getByRole('button', { name: 'Status Preorder' })).toBeInTheDocument()
    unmount()
    renderBar({ ordersStatusGroup: 'inProgress', selectedSubOrderStatus: { ...ALL_SUBSTATUS, inProgress: [7, 4] } })
    expect(screen.getByRole('button', { name: 'Status 2' })).toBeInTheDocument()
  })

  it('Driver: the name for one, the count for several (no «selected»)', () => {
    const { unmount } = renderBar({ configs: groupConfigs, filters: { ...EMPTY_FILTERS, driverIds: [5] } })
    expect(screen.getByRole('button', { name: 'Driver Ana Ruiz' })).toBeInTheDocument()
    unmount()
    renderBar({ configs: groupConfigs, filters: { ...EMPTY_FILTERS, driverIds: [5, 6] } })
    expect(screen.getByRole('button', { name: 'Driver 2' })).toBeInTheDocument()
  })

  it('SLA reads like the other pills: «SLA · value»', () => {
    renderBar({ filters: { ...EMPTY_FILTERS, timeStatus: 'delayed' } })
    expect(screen.getByRole('button', { name: 'SLA · Delayed' })).toBeInTheDocument()
  })

  it('the group name that already starts with the label is not prefixed twice, in the pill or in the chip', () => {
    renderBar({ configs: groupConfigs, filters: { ...EMPTY_FILTERS, driverGroupBusinessIds: [34] } })
    expect(screen.getByRole('button', { name: 'Driver group Shipday Downtown' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getByText('Driver group: Shipday Downtown')).toBeInTheDocument()
  })

  it('a group name that does not start with the label keeps it in the chip', () => {
    renderBar({ configs: groupConfigs, filters: { ...EMPTY_FILTERS, driverGroupBusinessIds: [3] } })
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getByText('Driver group: Night')).toBeInTheDocument()
  })

  // redesign F6d-1 (P4-04): the id is back on the right as a labelled, muted «ID 34» (never a bare number).
  it('the driver group list shows the id on the right, labelled', async () => {
    const user = userEvent.setup()
    renderBar({ configs: groupConfigs })
    await user.click(screen.getByRole('button', { name: 'Driver group' }))
    const popup = await screen.findByRole('dialog', { name: 'Driver group' })
    expect([...popup.querySelectorAll('.odc-orders-picker-meta')].map(node => node.textContent)).toEqual(['ID 34', 'ID 3'])
    expect(within(popup).getByRole('checkbox', { name: 'Driver Group: Shipday Downtown ID 34' })).toBeInTheDocument()
  })
})
