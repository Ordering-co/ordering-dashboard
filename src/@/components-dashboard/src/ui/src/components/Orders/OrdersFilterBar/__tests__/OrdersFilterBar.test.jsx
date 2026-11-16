/* eslint-disable import/first */
// redesign 5.2-B: the filter bar of /orders (search, pills, Filters, chips, inline notice).
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const historyPush = vi.hoisted(() => vi.fn())
const mockState = vi.hoisted(() => ({ configs: {} }))
const controller = vi.hoisted(() => ({
  handleChangeDriver: vi.fn(),
  handleChangeGroup: vi.fn(),
  handleChangeExternalId: vi.fn(),
  // redesign F1b: the Date and Business pills use the sheet's own handlers
  handleChangeBusinesses: vi.fn(),
  handleChangeDateType: vi.fn(),
  handleChangeFromDate: vi.fn(),
  handleChangeEndDate: vi.fn()
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: historyPush })
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
  DriversGroupTypeSelector: ({ title }) => <div data-testid='group-selector'>{title}</div>
}))
vi.mock('../../../Shared', () => ({
  SearchBar: ({ placeholder, onSearch }) => (
    <input aria-label={placeholder} onChange={event => onSearch(event.target.value)} />
  ),
  CitySelector: () => <div />
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { mockParseDate } from './parseDateMock'
import { OrdersFilterBar } from '..'
import { OrderStatusSubFilter, getSubOrderStatuses, nextSelectedSubOrderStatus } from '../../OrderStatusSubFilter'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

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
          driversList={{ loading: false, drivers: [{ id: 5, name: 'Ana', lastname: 'Ruiz' }] }}
          driverGroupList={{ loading: false, groups: [] }}
          assignableDriverGroupList={{ loading: false, groups: [{ id: 3, name: 'Night' }] }}
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

describe('OrdersFilterBar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('is a named group with search, the pills and the Filters button', () => {
    renderBar({ configs: { filter_order_options: { value: 'external_id|driver|driver_group' } } })
    const bar = screen.getByRole('group', { name: 'Order filters' })
    expect(within(bar).getByRole('searchbox', { name: 'Search by order number, customer, phone or store' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Status' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'SLA' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Date' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Business' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'External ID' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Driver' })).toBeInTheDocument()
    // redesign fix-qa D1: the pill reads «Driver group» (the filter is still the assignable one)
    expect(within(bar).getByRole('button', { name: 'Driver group' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Filters' })).toBeInTheDocument()
  })

  it('draws the driver pills only when filter_order_options lists them', () => {
    renderBar({ configs: { filter_order_options: { value: 'driver' } } })
    expect(screen.getByRole('button', { name: 'Driver' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'External ID' })).toBeNull()
    // redesign fix-qa D1: renamed with the pill
    expect(screen.queryByRole('button', { name: 'Driver group' })).toBeNull()
  })

  it('hides the search when search_box_enabled is off', () => {
    renderBar({ configs: { search_box_enabled: { value: '0' } } })
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('sends the search text after the same debounce as the old SearchBar', () => {
    vi.useFakeTimers()
    const { handleChangeSearch } = renderBar()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'ana' } })
    expect(handleChangeSearch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(749)
    expect(handleChangeSearch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handleChangeSearch).toHaveBeenCalledWith('ana')
  })

  it('clears the search at once with the X', () => {
    const { handleChangeSearch } = renderBar({ searchValue: 'ana' })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('keeps the slot for the list tools only when toolsSlot is on', () => {
    const { container, unmount } = renderBar({ toolsSlot: true })
    const slot = container.querySelector('#orders-list-tools')
    expect(slot).not.toBeNull()
    expect(slot).toHaveClass('odc-orders-tools-slot')
    expect(slot).toBeEmptyDOMElement()
    unmount()
    const second = renderBar()
    expect(second.container.querySelector('#orders-list-tools')).toBeNull()
  })

  describe('Status pill', () => {
    it('starts inactive when every sub status is selected and lists the tab sub statuses', async () => {
      const user = userEvent.setup()
      renderBar()
      await user.click(screen.getByRole('button', { name: 'Status' }))
      const pending = await screen.findByRole('checkbox', { name: 'Pending' })
      expect(pending).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('checkbox', { name: 'Preorder' })).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByRole('checkbox', { name: 'Completed by admin' })).toBeNull()
    })

    it('selects only the clicked sub status when all were selected, as the old chip did', async () => {
      const user = userEvent.setup()
      const { handleSelectedSubOrderStatus } = renderBar()
      await user.click(screen.getByRole('button', { name: 'Status' }))
      await user.click(await screen.findByRole('checkbox', { name: 'Pending' }))
      expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith({ ...ALL_SUBSTATUS, pending: [0] })
    })

    it('shows how many are selected, adds one, and returns to all when the last is unchecked', async () => {
      const user = userEvent.setup()
      const only = { ...ALL_SUBSTATUS, inProgress: [7, 4] }
      const { handleSelectedSubOrderStatus } = renderBar({ ordersStatusGroup: 'inProgress', selectedSubOrderStatus: only })
      const pill = screen.getByRole('button', { name: 'Status 2' })
      await user.click(pill)
      expect(await screen.findByRole('checkbox', { name: 'Accepted by business' })).toHaveAttribute('aria-checked', 'true')
      await user.click(screen.getByRole('checkbox', { name: 'Accepted by driver' }))
      expect(handleSelectedSubOrderStatus).toHaveBeenLastCalledWith({ ...only, inProgress: [7, 4, 8] })
      await user.click(screen.getByRole('checkbox', { name: 'Preparation completed' })) // redesign 5.2: status labels in sentence case (C14)
      expect(handleSelectedSubOrderStatus).toHaveBeenLastCalledWith({ ...only, inProgress: [7] })
    })

    it('goes back to all with the All action and from the last checked box', async () => {
      const user = userEvent.setup()
      const one = { ...ALL_SUBSTATUS, pending: [13] }
      const { handleSelectedSubOrderStatus } = renderBar({ selectedSubOrderStatus: one })
      await user.click(screen.getByRole('button', { name: 'Status Preorder' })) // redesign F6c: the name of the one selected
      await user.click(await screen.findByRole('checkbox', { name: 'Preorder' }))
      expect(handleSelectedSubOrderStatus).toHaveBeenLastCalledWith(ALL_SUBSTATUS)
      await user.click(screen.getByRole('button', { name: 'Clear' })) // redesign F6c: «Clear» in every pill, not «All»
      expect(handleSelectedSubOrderStatus).toHaveBeenLastCalledWith(ALL_SUBSTATUS)
    })

    it('is the same control /deliveries and /all-in-one draw with OrderStatusSubFilter', async () => {
      const user = userEvent.setup()
      const handle = vi.fn()
      render(
        <OrderStatusSubFilter
          ordersStatusGroup='completed'
          selectedSubOrderStatus={ALL_SUBSTATUS}
          handleSelectedSubOrderStatus={handle}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Status' }))
      await user.click(await screen.findByRole('checkbox', { name: 'Delivery completed by driver' }))
      expect(handle).toHaveBeenCalledWith({ ...ALL_SUBSTATUS, completed: [11] })
    })
  })

  describe('sub status rule', () => {
    // The chips' handleChange, as it was in OrderStatusSubFilter before 5.2-B.
    const legacy = (status, group, selectedSubOrderStatus, statuses) => {
      let list = [...selectedSubOrderStatus[group]]
      if (list.includes(status)) {
        list = list.length === 1
          ? statuses[group].map(s => s.key)
          : statuses[group].map(s => s.key).sort().join('') === selectedSubOrderStatus[group].sort().join('')
            ? list.filter(_status => _status === status)
            : list.filter(_status => _status !== status)
      } else if (status !== 'all') {
        list.push(status)
      }
      return { ...selectedSubOrderStatus, [group]: status === 'all' ? statuses[group].map(s => s.key) : list }
    }

    it('gives the same result as the chips for every press from every subset of a tab', () => {
      const statuses = getSubOrderStatuses((_key, text) => text)
      for (const group of ['pending', 'completed', 'cancelled']) {
        const keys = statuses[group].map(status => status.key)
        const subsets = []
        for (let mask = 1; mask < (1 << keys.length); mask++) subsets.push(keys.filter((_, index) => mask & (1 << index)))
        for (const subset of subsets) {
          for (const press of [...keys, 'all']) {
            const selected = { ...ALL_SUBSTATUS, [group]: [...subset] }
            const expected = legacy(press, group, { ...selected, [group]: [...subset] }, statuses)
            const actual = nextSelectedSubOrderStatus({
              statusKey: press,
              ordersStatusGroup: group,
              selectedSubOrderStatus: selected,
              statuses
            })
            expect(actual, `${group} ${JSON.stringify(subset)} press ${press}`).toEqual(expected)
          }
        }
      }
    })
  })

  describe('SLA menu', () => {
    // redesign 5.2 audit-1: the four values are one choice (menuitemradio) with the words of the table.
    it('filters by the same time status values and keeps SLA settings', async () => {
      const user = userEvent.setup()
      const { handleFilterValues, setTimeStatus } = renderBar()
      await user.click(screen.getByRole('button', { name: 'SLA' }))
      expect(await screen.findByRole('menuitemradio', { name: 'On time' })).toBeInTheDocument()
      expect(screen.getByRole('menuitemradio', { name: 'At risk' })).toBeInTheDocument()
      await user.click(screen.getByRole('menuitemradio', { name: 'Delayed' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, timeStatus: 'delayed' })
      expect(setTimeStatus).toHaveBeenCalledWith('delayed')

      await user.click(screen.getByRole('button', { name: 'SLA' }))
      await user.click(await screen.findByRole('menuitem', { name: 'SLA settings' }))
      expect(historyPush).toHaveBeenCalledWith('/settings?group=orders&category=enterprise_orders_slas')
    })

    // redesign 5.2 audit-1: the current value is exposed (aria-checked), not only drawn.
    it('names the active value, exposes it as the checked choice and clears it with All', async () => {
      const user = userEvent.setup()
      const { handleFilterValues, setTimeStatus } = renderBar({ filters: { ...EMPTY_FILTERS, timeStatus: 'at_risk' } })
      await user.click(screen.getByRole('button', { name: 'SLA · At risk' })) // redesign F6c: «Label · value»
      expect(await screen.findByRole('menuitemradio', { name: 'At risk' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('menuitemradio', { name: 'On time' })).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('menuitemradio', { name: 'All' })).toHaveAttribute('aria-checked', 'false')
      await user.click(screen.getByRole('menuitemradio', { name: 'All' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, timeStatus: null })
      expect(setTimeStatus).toHaveBeenCalledWith(null)
    })
  })

  describe('header pills', () => {
    // redesign fix-qa E2: the pills open the checklist itself (like Status), not a second select inside the popover.
    const DRIVERS = [
      { id: 5, name: 'Ana', lastname: 'Ruiz', photo: null },
      { id: 6, name: 'Bruno', lastname: 'Diaz' },
      { id: 7, name: 'Carla', lastname: 'Mora' }
    ]
    const GROUPS = [{ id: 3, name: 'Night' }, { id: 34, name: 'Day shift with a very long name' }]
    const driverProps = { driversList: { loading: false, drivers: DRIVERS }, assignableDriverGroupList: { loading: false, groups: GROUPS } }
    const driverConfigs = { filter_order_options: { value: 'driver|driver_group' } }

    it('opens the driver checklist directly from the Driver pill: search, avatar and name rows, no nested select', async () => {
      const user = userEvent.setup()
      renderBar({ configs: driverConfigs, ...driverProps })
      await user.click(screen.getByRole('button', { name: 'Driver' }))
      const popup = await screen.findByRole('dialog', { name: 'Driver' })
      expect(within(popup).getByRole('searchbox', { name: 'Search Driver' })).toBeInTheDocument()
      const group = within(popup).getByRole('group', { name: 'Driver' })
      expect(within(group).getAllByRole('checkbox').map(box => box.querySelector('.odc-orders-picker-name').textContent)).toEqual(['Ana Ruiz', 'Bruno Diaz', 'Carla Mora'])
      expect(within(group).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
      expect(popup.querySelectorAll('.odc-avatar')).toHaveLength(3)
      // nothing nested: no second trigger, no listbox, no pager, no «Items per page»
      expect(popup.querySelector('[aria-haspopup="listbox"]')).toBeNull()
      expect(within(popup).queryByRole('listbox')).toBeNull()
      expect(popup).not.toHaveTextContent(/Items per page|Select driver/)
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver' })).toBeNull())
    })

    it('filters the driver list as you type and toggles with the controller handler', async () => {
      const user = userEvent.setup()
      renderBar({ configs: driverConfigs, ...driverProps })
      await user.click(screen.getByRole('button', { name: 'Driver' }))
      await user.type(await screen.findByRole('searchbox', { name: 'Search Driver' }), 'bru')
      expect(screen.getAllByRole('checkbox')).toHaveLength(1)
      await user.click(screen.getByRole('checkbox', { name: 'Bruno Diaz' }))
      expect(controller.handleChangeDriver).toHaveBeenCalledWith(6)
      await user.clear(screen.getByRole('searchbox', { name: 'Search Driver' }))
      await user.type(screen.getByRole('searchbox', { name: 'Search Driver' }), 'zzz')
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
      expect(screen.getByRole('status')).toHaveTextContent('No results found')
    })

    it('marks the chosen drivers, counts them in the pill and clears them from inside the popover', async () => {
      const user = userEvent.setup()
      const { handleFilterValues } = renderBar({
        configs: driverConfigs,
        ...driverProps,
        filters: { ...EMPTY_FILTERS, driverIds: [5, 6, 7] }
      })
      await user.click(screen.getByRole('button', { name: 'Driver 3' })) // redesign F6c: the count of several, no «selected»
      const boxes = await screen.findAllByRole('checkbox')
      expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true'])
      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, driverIds: [] })
    })

    // redesign fix-qa C3 (B11): `main` showed the id of the group (`3. Night`); it comes back as a muted second text.
    it('opens the assignable driver group checklist: the name, its id as muted secondary text, same handler', async () => {
      const user = userEvent.setup()
      renderBar({ configs: driverConfigs, ...driverProps })
      // redesign fix-qa D1: the pill is named «Driver group»
      await user.click(screen.getByRole('button', { name: 'Driver group' }))
      const popup = await screen.findByRole('dialog', { name: 'Driver group' })
      const boxes = within(popup).getAllByRole('checkbox')
      expect(boxes.map(box => box.querySelector('.odc-orders-picker-name').textContent)).toEqual(['Night', 'Day shift with a very long name'])
      // redesign F6d-1 (P4-04): the id is back, as a labelled muted «ID 34» (a bare number read like a count: Q2-04)
      expect([...popup.querySelectorAll('.odc-orders-picker-meta')].map(node => node.textContent)).toEqual(['ID 3', 'ID 34'])
      expect(popup.querySelector('.odc-avatar')).toBeNull()
      expect(popup.querySelector('[aria-haspopup="listbox"]')).toBeNull()
      await user.click(within(popup).getByRole('checkbox', { name: 'Night ID 3' }))
      expect(controller.handleChangeGroup).toHaveBeenCalledWith(3)
    })

    it('sends the external id as the old header field did', async () => {
      const user = userEvent.setup()
      renderBar({ configs: { filter_order_options: { value: 'external_id' } } })
      await user.click(screen.getByRole('button', { name: 'External ID' }))
      fireEvent.change(await screen.findByLabelText('External ID', { selector: 'input' }), { target: { value: 'X-9' } })
      expect(controller.handleChangeExternalId).toHaveBeenCalledWith({ target: { value: 'X-9' } })
    })

    it('shows the selected driver in the pill', () => {
      renderBar({
        configs: { filter_order_options: { value: 'driver' } },
        filters: { ...EMPTY_FILTERS, driverIds: [5] }
      })
      expect(screen.getByRole('button', { name: 'Driver Ana Ruiz' })).toBeInTheDocument()
    })
  })

  describe('Filters button and the sheet', () => {
    it('opens the sheet and carries the number of active filters in its name', async () => {
      const user = userEvent.setup()
      const { setFilterModalOpen } = renderBar({
        filters: { ...EMPTY_FILTERS, businessIds: [1], customerName: 'ana' }
      })
      const button = screen.getByRole('button', { name: 'Filters 2' })
      expect(button).toHaveAttribute('name', 'filter-btn')
      await user.click(button)
      expect(setFilterModalOpen).toHaveBeenCalledWith(true)
    })

    // redesign F1b (D-05): the Date and Business pills filter in their own popover and never open the whole sheet.
    it('does not open the sheet from the Date and Business pills: each opens its own popover', async () => {
      const user = userEvent.setup()
      const { setFilterModalOpen } = renderBar()
      await user.click(screen.getByRole('button', { name: 'Date' }))
      expect(await screen.findByRole('dialog', { name: 'Select a date' })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      await user.click(screen.getByRole('button', { name: 'Business' }))
      expect(await screen.findByRole('dialog', { name: 'Business' })).toBeInTheDocument()
      expect(setFilterModalOpen).not.toHaveBeenCalled()
    })

    it('sends the Date pill presets and range through the sheet field handlers', async () => {
      const user = userEvent.setup()
      renderBar()
      await user.click(screen.getByRole('button', { name: 'Date' }))
      const popup = await screen.findByRole('dialog', { name: 'Select a date' })
      await user.click(within(popup).getByRole('button', { name: 'Today' }))
      expect(controller.handleChangeDateType).toHaveBeenCalledWith('today')
    })

    it('opens a checklist of businesses from the Business pill: search, logo, name, same handler', async () => {
      const user = userEvent.setup()
      renderBar({
        businessesList: {
          loading: false,
          businesses: [{ id: 1, name: 'Fast Bite', logo: 'https://img.test/fast.png' }, { id: 2, name: 'Green Bowl' }]
        }
      })
      await user.click(screen.getByRole('button', { name: 'Business' }))
      const popup = await screen.findByRole('dialog', { name: 'Business' })
      expect(within(popup).getByRole('searchbox', { name: 'Search Business' })).toBeInTheDocument()
      const boxes = within(popup).getAllByRole('checkbox')
      expect(boxes.map(box => box.querySelector('.odc-orders-picker-name').textContent)).toEqual(['Fast Bite', 'Green Bowl'])
      // a business is a rounded-square logo (C12), 20px by the stylesheet
      expect([...popup.querySelectorAll('.odc-avatar')].map(avatar => avatar.getAttribute('data-kind'))).toEqual(['business', 'business'])
      expect(popup.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://img.test/fast.png')
      await user.type(within(popup).getByRole('searchbox', { name: 'Search Business' }), 'green')
      expect(within(popup).getAllByRole('checkbox')).toHaveLength(1)
      await user.click(within(popup).getByRole('checkbox', { name: 'Green Bowl' }))
      expect(controller.handleChangeBusinesses).toHaveBeenCalledWith(2)
    })

    it('marks the chosen businesses, counts them in the pill and clears them from inside the popover', async () => {
      const user = userEvent.setup()
      const { handleFilterValues } = renderBar({
        filters: { ...EMPTY_FILTERS, businessIds: [1, 2] },
        businessesList: { loading: false, businesses: [{ id: 1, name: 'Fast Bite' }, { id: 2, name: 'Green Bowl' }, { id: 3, name: 'Pizza Hub' }] }
      })
      await user.click(screen.getByRole('button', { name: 'Business 2' })) // redesign F6c: the count of several
      const boxes = await screen.findAllByRole('checkbox')
      expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false'])
      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, businessIds: [] })
    })

    it('shows the current date and business in their pills', () => {
      renderBar({ filters: { ...EMPTY_FILTERS, dateType: 'today', businessIds: [1] } })
      expect(screen.getByRole('button', { name: 'Date Today' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Business Fast Bite' })).toBeInTheDocument()
    })
  })

  describe('active filters', () => {
    const active = {
      ...EMPTY_FILTERS,
      businessIds: [1],
      customerName: 'ana',
      deliveryTypes: [1, 2],
      metafield: [{ id: 'm1', key: 'floor', value: '3' }]
    }

    it('draws one chip per active filter with a readable label and value', () => {
      renderBar({ filters: active })
      const list = screen.getByRole('list', { name: 'Active filters' })
      const chips = within(list).getAllByRole('listitem')
      expect(chips.map(chip => chip.textContent)).toEqual(expect.arrayContaining([
        'Business: Fast Bite',
        'Customer name: ana',
        'Delivery type: Delivery, Pickup',
        'floor: 3'
      ]))
    })

    it('removes only that filter, for the manager and the shared context', async () => {
      const user = userEvent.setup()
      const { handleFilterValues, handleChangeFilterValues } = renderBar({ filters: active })
      await user.click(screen.getByRole('button', { name: 'Remove Business filter' }))
      const expected = { ...active, businessIds: [] }
      expect(handleFilterValues).toHaveBeenCalledWith(expected)
      expect(handleChangeFilterValues).toHaveBeenCalledWith(expected)
    })

    it('removes one metafield and the date as a whole', async () => {
      const user = userEvent.setup()
      const { handleFilterValues } = renderBar({ filters: active })
      await user.click(screen.getByRole('button', { name: 'Remove floor filter' }))
      expect(handleFilterValues).toHaveBeenLastCalledWith({ ...active, metafield: [] })
    })

    it('removes the date with its from and to values', async () => {
      const user = userEvent.setup()
      const filters = { ...EMPTY_FILTERS, dateType: 'term', deliveryFromDatetime: '2026-10-01 00:00:00', deliveryEndDatetime: '2026-10-03 23:59:59' }
      const { handleFilterValues } = renderBar({ filters })
      // redesign tramo A r5 (W0-QA3-02): no project format, so the visible default (never ISO)
      expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Date: 01 Oct 2026 – 03 Oct 2026')
      await user.click(screen.getByRole('button', { name: 'Remove Date filter' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, dateType: null, deliveryFromDatetime: null, deliveryEndDatetime: null })
    })

    it('clears the SLA chip like the SLA menu does', async () => {
      const user = userEvent.setup()
      const { handleFilterValues, setTimeStatus } = renderBar({ filters: { ...EMPTY_FILTERS, timeStatus: 'delayed' } })
      await user.click(screen.getByRole('button', { name: 'Remove SLA filter' }))
      expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY_FILTERS, timeStatus: null })
      expect(setTimeStatus).toHaveBeenCalledWith(null)
    })

    it('clears everything, search included, with the same result as the old link', async () => {
      const user = userEvent.setup()
      const { handleFilterValues, handleChangeFilterValues, handleChangeSearch } = renderBar({
        filters: active,
        searchValue: 'zzz'
      })
      const clears = screen.getAllByRole('button', { name: 'Clear filters' })
      expect(clears).toHaveLength(2)
      await user.click(clears[0])
      expect(handleChangeSearch).toHaveBeenCalledWith('')
      expect(handleFilterValues).toHaveBeenCalledWith(expect.objectContaining({ businessIds: [], customerName: null, metafield: [], timeStatus: null }))
      expect(handleChangeFilterValues).toHaveBeenCalledWith({})
    })

    // redesign 5.2 audit-3: same words as the sheet and the detail («Declined», «Fail-open», next to «Fraud status»)
    // «Logistic status», «Offer ID»), and one «Clear filters» on desktop: the bar marks that it has its own.
    it('names fraud, logistic status and offer like the filters sheet does', () => {
      const { unmount } = renderBar({ filters: { ...EMPTY_FILTERS, fraudStatus: 'invalid', logisticStatus: 1, offerId: '7' } })
      const list = screen.getByRole('list', { name: 'Active filters' })
      expect(list).toHaveTextContent('Fraud status: Declined')
      expect(list).toHaveTextContent('Logistic status: In progress')
      expect(list).toHaveTextContent('Offer ID: 7')
      unmount()
      renderBar({ filters: { ...EMPTY_FILTERS, fraudStatus: 'error' } })
      expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Fraud status: Fail-open')
    })

    it('marks the bar as having its own Clear filters, so the chips hide theirs on desktop', () => {
      renderBar({ filters: active })
      expect(screen.getByRole('group', { name: 'Order filters' })).toHaveAttribute('data-clear', '')
    })

    it('has no chips and no clear button when nothing narrows the list', () => {
      renderBar()
      expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    })

    it('with only a search, offers Clear filters but no chips', () => {
      renderBar({ searchValue: 'zzz' })
      expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(1)
      expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    })
  })

  describe('inline notice', () => {
    it('warns in the flow of the bar when filters are active', () => {
      renderBar({ filters: { ...EMPTY_FILTERS, customerName: 'ana' } })
      const notice = screen.getByText('Filters applied. You may miss new orders.').closest('[role="status"]')
      expect(notice).toHaveAttribute('data-tone', 'warning')
      expect(screen.getByRole('group', { name: 'Order filters' })).toContainElement(notice)
    })

    it('warns when only a search is active and is absent otherwise', () => {
      const { unmount } = renderBar({ searchValue: 'zzz' })
      expect(screen.getByText('Filters applied. You may miss new orders.')).toBeInTheDocument()
      unmount()
      renderBar()
      expect(screen.queryByText('Filters applied. You may miss new orders.')).toBeNull()
    })
  })
})
