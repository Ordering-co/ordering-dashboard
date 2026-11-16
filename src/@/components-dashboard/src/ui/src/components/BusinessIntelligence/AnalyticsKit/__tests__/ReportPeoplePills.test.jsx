/* eslint-disable import/first */
// redesign reports FB2 (D4, D5; RP-10, RP-18, RP-21; auditor 6, 7, 12): the four pills of the report filters that
// ReportFilterPills does not have for /intelligence/business: Driver group, Driver, Order type and Channel. The controllers of
// `main` (ReportsDriverGroupFilter, ReportsDriverFilter, ReportsAppIdFilter) are replaced by stand-ins that hand their
// UIComponent what the real ones hand it, so what is under test is the new UI: what each pill paints, what it asks the page for,
// and with which options. Order type has no controller in `main` (its UI reads the config), so it reads `useConfig`.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ groups: {}, drivers: {}, channels: {}, configs: {}, last: {}, mounts: {} }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const controller = key => function Controller (props) {
    mocks.last[key] = props
    react.useEffect(() => { mocks.mounts[key] = (mocks.mounts[key] ?? 0) + 1 }, [])
    const { UIComponent, ...rest } = props
    return react.createElement(UIComponent, { ...rest, ...mocks[key] })
  }
  return {
    useLanguage: () => [{}, (_key, text) => text],
    useConfig: () => [{ configs: mocks.configs }],
    ReportsDriverGroupFilter: controller('groups'),
    ReportsDriverFilter: controller('drivers'),
    ReportsAppIdFilter: controller('channels')
  }
})

import { ChannelPill, DriverGroupPill, DriverPill, OrderTypePill, orderTypeLabels } from '../ReportPeoplePills'

const GROUPS = [
  { id: 5, name: 'Night shift', enabled: true, drivers: [{ id: 21 }, { id: 22 }] },
  { id: 6, name: 'Day shift', enabled: true, drivers: [{ id: 23 }] }
]
const DRIVERS = [
  { id: 21, name: 'Ana', lastname: 'Ruiz' },
  { id: 22, name: 'Bo', lastname: '' },
  { id: 23, name: 'Cy', lastname: 'Diaz' }
]
const SITES = [{ id: 1, name: 'Web' }, { id: 2, name: 'App' }]
const FILTER_LIST = { lapse: 'today', businessIds: null }

const setControllers = () => {
  mocks.last = {}
  mocks.mounts = {}
  mocks.groups = {
    driverGroupList: { loading: false, error: null, driverGroups: GROUPS, pagination: null },
    driverGroupIds: null,
    handleChangeDriverGroupId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  mocks.drivers = {
    driverList: { loading: false, error: null, drivers: DRIVERS, pagination: null },
    driverIds: null,
    handleChangeDriverId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  mocks.channels = {
    appIdList: { loading: false, error: null, appIds: SITES, pagination: null },
    appIds: null,
    handleChangeAppId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
  mocks.configs = { order_types_allowed: { value: '1|2|3|4|5' } }
}

const EXIT = { timeout: 4000 }

const mount = (Pill, label, extra = {}) => {
  const onToggle = vi.fn()
  const onClear = vi.fn()
  const onLearn = vi.fn()
  const props = { label, value: '', filterList: FILTER_LIST, selected: [], onToggle, onClear, onLearn, ...extra }
  const view = render(<Pill {...props} />)
  return { onToggle, onClear, onLearn, props, ...view }
}
const open = async (user, label) => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
  return screen.findByRole('dialog', { name: label })
}

beforeEach(setControllers)
afterEach(() => document.getElementById('app-modals')?.remove())

describe('DriverGroupPill', () => {
  it('lists the groups of the controller as checkboxes; the checks are the page\'s, not the controller\'s', async () => {
    const user = userEvent.setup()
    mocks.groups.driverGroupIds = [6] // the controller's own selection is not used
    mount(DriverGroupPill, 'Driver group', { selected: [5] })
    const popup = await open(user, 'Driver group')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(popup).getByRole('checkbox', { name: 'Night shift' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'Day shift' })).toHaveAttribute('aria-checked', 'false')
  })

  it('marking a group tells the bar which one (and its name); it never uses the controller\'s «All» or «Filter»', async () => {
    const user = userEvent.setup()
    const { onToggle } = mount(DriverGroupPill, 'Driver group')
    const popup = await open(user, 'Driver group')
    await user.click(within(popup).getByRole('checkbox', { name: 'Day shift' }))
    expect(onToggle).toHaveBeenCalledWith(6, 'Day shift')
    expect(within(popup).queryByRole('button', { name: 'Filter' })).toBeNull()
    expect(within(popup).queryByRole('checkbox', { name: 'All' })).toBeNull()
    expect(mocks.groups.handleClickFilterButton).not.toHaveBeenCalled()
    expect(mocks.groups.handleChangeAllCheck).not.toHaveBeenCalled()
    expect(mocks.groups.handleChangeDriverGroupId).not.toHaveBeenCalled()
  })

  it('teaches the bar the names and the drivers of each group (the drivers pill is scoped with them)', async () => {
    const user = userEvent.setup()
    const { onLearn } = mount(DriverGroupPill, 'Driver group')
    await open(user, 'Driver group')
    expect(onLearn).toHaveBeenCalledWith('groups', [[5, 'Night shift'], [6, 'Day shift']])
    expect(onLearn).toHaveBeenCalledWith('members', [[5, [21, 22]], [6, [23]]])
  })

  it('has a server search, as main: after a wait, and Enter sends it at once', async () => {
    const user = userEvent.setup()
    mount(DriverGroupPill, 'Driver group')
    const popup = await open(user, 'Driver group')
    const search = within(popup).getByRole('searchbox', { name: 'Search Driver group' })
    await user.type(search, 'nig')
    await waitFor(() => expect(mocks.groups.onSearch).toHaveBeenCalledWith('nig'), { timeout: 3000 })
    mocks.groups.onSearch.mockClear()
    await user.clear(search)
    await user.type(search, 'day{Enter}')
    expect(mocks.groups.onSearch).toHaveBeenCalledWith('day')
  })

  it('mounts the controller (its GET) when the popover opens, not with the pill', async () => {
    const user = userEvent.setup()
    mount(DriverGroupPill, 'Driver group')
    expect(mocks.mounts.groups).toBeUndefined()
    await open(user, 'Driver group')
    expect(mocks.mounts.groups).toBe(1)
    expect(mocks.last.groups.propsToFetch).toEqual(['id', 'name', 'enabled', 'drivers'])
  })

  it('«Clear» appears with a selection and empties it', async () => {
    const user = userEvent.setup()
    const none = mount(DriverGroupPill, 'Driver group')
    const first = await open(user, 'Driver group')
    expect(within(first).queryByRole('button', { name: 'Clear' })).toBeNull()
    none.unmount()
    const { onClear } = mount(DriverGroupPill, 'Driver group', { selected: [5] })
    const popup = await open(user, 'Driver group')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('shows skeletons while it loads and «No results found» for an empty answer', async () => {
    const user = userEvent.setup()
    mocks.groups.driverGroupList = { loading: true, error: null, driverGroups: [], pagination: null }
    mount(DriverGroupPill, 'Driver group')
    const popup = await open(user, 'Driver group')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver group' })).toBeNull(), EXIT)
    mocks.groups.driverGroupList = { loading: false, error: null, driverGroups: [], pagination: null }
    const again = await open(user, 'Driver group')
    expect(within(again).getByText('No results found')).toBeInTheDocument()
  })
})

describe('DriverPill', () => {
  it('lists the drivers with their full name, server search by name and last name, and the page\'s checks', async () => {
    const user = userEvent.setup()
    mount(DriverPill, 'Driver', { selected: [21] })
    const popup = await open(user, 'Driver')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(3)
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'Bo' })).toHaveAttribute('aria-checked', 'false')
    expect(mocks.last.drivers).toMatchObject({
      isSearchByName: true,
      isSearchByLastName: true,
      propsToFetch: ['id', 'name', 'lastname', 'driver_groups.id']
    })
  })

  it('hands the controller the drivers the groups allow (availableDriverIds), or nothing', async () => {
    const user = userEvent.setup()
    const scoped = mount(DriverPill, 'Driver', { availableDriverIds: [21, 22] })
    await open(user, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toEqual([21, 22])
    scoped.unmount()
    mocks.last = {}
    mount(DriverPill, 'Driver')
    await open(user, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toBeUndefined()
  })

  it('marking a driver tells the bar the id and the full name; the controller\'s own selection is never used', async () => {
    const user = userEvent.setup()
    const { onToggle } = mount(DriverPill, 'Driver')
    const popup = await open(user, 'Driver')
    await user.click(within(popup).getByRole('checkbox', { name: 'Cy Diaz' }))
    expect(onToggle).toHaveBeenCalledWith(23, 'Cy Diaz')
    expect(mocks.drivers.handleChangeDriverId).not.toHaveBeenCalled()
    expect(mocks.drivers.handleClickFilterButton).not.toHaveBeenCalled()
    expect(mocks.drivers.handleChangeAllCheck).not.toHaveBeenCalled()
  })

  it('teaches the bar the full names', async () => {
    const user = userEvent.setup()
    const { onLearn } = mount(DriverPill, 'Driver')
    await open(user, 'Driver')
    expect(onLearn).toHaveBeenCalledWith('drivers', [[21, 'Ana Ruiz'], [22, 'Bo'], [23, 'Cy Diaz']])
  })

  it('the search goes to the server through the controller\'s onSearch', async () => {
    const user = userEvent.setup()
    mount(DriverPill, 'Driver')
    const popup = await open(user, 'Driver')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Driver' }), 'ruiz{Enter}')
    expect(mocks.drivers.onSearch).toHaveBeenCalledWith('ruiz')
  })

  it('shows skeletons while it loads', async () => {
    const user = userEvent.setup()
    mocks.drivers.driverList = { loading: true, error: null, drivers: [], pagination: null }
    mount(DriverPill, 'Driver')
    const popup = await open(user, 'Driver')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })
})

describe('OrderTypePill', () => {
  it('lists the order types the project allows (config), by name, with no search and no controller', async () => {
    const user = userEvent.setup()
    mocks.configs = { order_types_allowed: { value: '1|2|4' } }
    mount(OrderTypePill, 'Order type', { selected: [2] })
    const popup = await open(user, 'Order type')
    expect(within(popup).getAllByRole('checkbox').map(box => box.textContent)).toEqual(['Delivery', 'Pickup', 'Curbside'])
    expect(within(popup).getByRole('checkbox', { name: 'Pickup' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).queryByRole('searchbox')).toBeNull()
  })

  it('with no allowed types in the config it lists the five rather than an empty popover', async () => {
    const user = userEvent.setup()
    mocks.configs = {}
    mount(OrderTypePill, 'Order type')
    const popup = await open(user, 'Order type')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(5)
  })

  it('marking a type tells the bar its id; «Clear» empties the selection', async () => {
    const user = userEvent.setup()
    const { onToggle, onClear } = mount(OrderTypePill, 'Order type', { selected: [1] })
    const popup = await open(user, 'Order type')
    await user.click(within(popup).getByRole('checkbox', { name: 'Eat in' }))
    expect(onToggle).toHaveBeenCalledWith(3, 'Eat in')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('orderTypeLabels names the five types of main, so a chip reads a name without opening the popover', () => {
    expect(orderTypeLabels((_key, text) => text)).toEqual({ 1: 'Delivery', 2: 'Pickup', 3: 'Eat in', 4: 'Curbside', 5: 'Drive thru' })
  })
})

describe('ChannelPill', () => {
  it('lists the sites of the controller (no search in main either) and takes the checks from the page', async () => {
    const user = userEvent.setup()
    mocks.channels.appIds = [2] // not used
    mount(ChannelPill, 'Channel', { selected: [1] })
    const popup = await open(user, 'Channel')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(popup).getByRole('checkbox', { name: 'Web' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'App' })).toHaveAttribute('aria-checked', 'false')
    expect(within(popup).queryByRole('searchbox')).toBeNull()
    expect(mocks.last.channels.propsToFetch).toEqual(['id', 'name', 'code'])
  })

  it('marking a channel tells the bar id and name; the bar learns the names; the controller\'s apply is never called', async () => {
    const user = userEvent.setup()
    const { onToggle, onLearn } = mount(ChannelPill, 'Channel')
    const popup = await open(user, 'Channel')
    await user.click(within(popup).getByRole('checkbox', { name: 'App' }))
    expect(onToggle).toHaveBeenCalledWith(2, 'App')
    expect(onLearn).toHaveBeenCalledWith('channels', [[1, 'Web'], [2, 'App']])
    expect(mocks.channels.handleClickFilterButton).not.toHaveBeenCalled()
    expect(mocks.channels.handleChangeAllCheck).not.toHaveBeenCalled()
  })

  it('shows skeletons while it loads and says «No results found» for an empty answer', async () => {
    const user = userEvent.setup()
    mocks.channels.appIdList = { loading: true, error: null, appIds: [], pagination: null }
    mount(ChannelPill, 'Channel')
    const popup = await open(user, 'Channel')
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Channel' })).toBeNull(), EXIT)
    mocks.channels.appIdList = { loading: false, error: null, appIds: [], pagination: null }
    const again = await open(user, 'Channel')
    expect(within(again).getByText('No results found')).toBeInTheDocument()
  })
})
