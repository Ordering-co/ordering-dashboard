/* eslint-disable import/first */
// redesign DT-B4 (DT-05, decision 3 | auditor 10): the scope of the drivers' time calendar: the Driver group pill (one choice, «All
// drivers» takes the group away) and the Drivers pill (a checklist that applies on each check). The controllers of `main`
// (DriversGroupsList, DriversList) are replaced by stand-ins that hand their UIComponent what the real ones hand it, so what is under
// test is the new UI: what each pill paints, what it asks the page for and with which props the controllers are mounted.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ groups: {}, drivers: {}, last: {}, mounts: {} }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const controller = key => function Controller (props) {
    mocks.last[key] = props
    react.useEffect(() => { mocks.mounts[key] = (mocks.mounts[key] ?? 0) + 1 }, [])
    const { UIComponent, ...rest } = props
    // as the real DriversList does with `useDriversByProps`: the list is the one the page hands over (the drivers of the group)
    const byProps = key === 'drivers' && props.useDriversByProps
      ? { driversList: { drivers: props.driversList?.drivers ?? [], loading: false, error: null } }
      : {}
    return react.createElement(UIComponent, { ...rest, ...mocks[key], ...byProps })
  }
  return {
    useLanguage: () => [{}, (_key, text) => text],
    DriversGroupsList: controller('groups'),
    DriversList: controller('drivers')
  }
})

import { FilterBar } from '../../../Shared/Product'
import { ScopePills } from '../ScopePills'

const GROUPS = [
  { id: 5, name: 'Night shift', enabled: true, drivers: [{ id: 21, name: 'Ana', lastname: 'Ruiz' }, { id: 22, name: 'Bo', lastname: '' }] },
  { id: 6, name: 'Day shift', enabled: true, drivers: [{ id: 23, name: 'Cy', lastname: 'Diaz' }] }
]
const DRIVERS = [
  { id: 21, name: 'Ana', lastname: 'Ruiz' },
  { id: 22, name: 'Bo', lastname: '' },
  { id: 23, name: 'Cy', lastname: 'Diaz' }
]

const setControllers = () => {
  mocks.last = {}
  mocks.mounts = {}
  mocks.groups = {
    driversGroupsState: { groups: GROUPS, loading: false, error: null },
    pagination: { currentPage: 1, pageSize: 5, totalPages: 1, totalItems: 2 },
    searchValue: '',
    onSearch: vi.fn(),
    getHeaderDriversGroups: vi.fn()
  }
  mocks.drivers = {
    driversList: { drivers: DRIVERS, loading: false, error: null },
    pagination: { currentPage: 1, pageSize: 10, totalPages: 1, total: 3 },
    searchValue: null,
    setSearchValue: vi.fn(),
    handleChangePage: vi.fn()
  }
}

const EXIT = { timeout: 4000 }

const mount = (extra = {}) => {
  const props = {
    selectedGroup: null,
    onGroupChange: vi.fn(),
    driverIds: [],
    driverNames: {},
    onToggleDriver: vi.fn(),
    onClearDrivers: vi.fn(),
    ...extra
  }
  render(<div><ScopePills {...props} /></div>)
  return props
}
const open = async (user, label) => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
  return screen.findByRole('dialog', { name: label })
}

beforeEach(setControllers)
afterEach(() => document.getElementById('app-modals')?.remove())

describe('the two pills', () => {
  it('are two pills with «All» when nothing is chosen, side by side (a fragment)', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Driver group All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drivers All' })).toBeInTheDocument()
  })

  it('go into the filters slot of the bar without «+N» (no overflowLabel)', () => {
    render(<FilterBar label='Calendar filters' filters={<ScopePills selectedGroup={null} driverIds={[]} driverNames={{}} />} />)
    const bar = screen.getByRole('group', { name: 'Calendar filters' })
    expect(within(bar).getByRole('button', { name: /^Driver group/ })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: /^Drivers/ })).toBeInTheDocument()
  })

  it('the group pill says the name of the group', () => {
    mount({ selectedGroup: GROUPS[0] })
    expect(screen.getByRole('button', { name: 'Driver group Night shift' })).toBeInTheDocument()
  })

  it('the drivers pill says the name of one driver, learned when it was checked, and the count of several', () => {
    const { rerender } = render(
      <ScopePills selectedGroup={null} driverIds={[21]} driverNames={{ 21: 'Ana Ruiz' }} onToggleDriver={vi.fn()} onClearDrivers={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Drivers Ana Ruiz' })).toBeInTheDocument()
    rerender(
      <ScopePills selectedGroup={null} driverIds={[21, 22, 23]} driverNames={{ 21: 'Ana Ruiz' }} onToggleDriver={vi.fn()} onClearDrivers={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Drivers 3' })).toBeInTheDocument()
  })

  it('the drivers pill falls back to the id of a driver whose name nobody has seen', () => {
    mount({ driverIds: [99] })
    expect(screen.getByRole('button', { name: 'Drivers 99' })).toBeInTheDocument()
  })
})

describe('the Driver group pill', () => {
  it('mounts the controller of main (its GET) when the popover opens, with the props of today\'s header selector', async () => {
    const user = userEvent.setup()
    mount()
    expect(mocks.mounts.groups).toBeUndefined()
    await open(user, 'Driver group')
    expect(mocks.mounts.groups).toBe(1)
    const props = mocks.last.groups
    expect(props.isHeaderComponent).toBe(true)
    expect(props.asDashboard).toBe(true)
    expect(props.paginationSettings).toEqual({ initialPage: 1, pageSize: 5, controlType: 'pages' })
    // (P-1, live 2026-10-20): keep the bare `drivers`. The API ignores sub-fields of the relation and, asked for
    // `drivers.lastname` (or any `drivers.x`), returns the groups with no drivers at all; it never sends a driver's lastname here.
    expect(props.propsToFetch).toEqual(['id', 'enabled', 'drivers', 'name', 'timezone']) // the zone of the group
  })

  it('is a single choice: «All drivers» first, then each group with its number of drivers; the chosen one is checked', async () => {
    const user = userEvent.setup()
    mount({ selectedGroup: GROUPS[1] })
    const popup = await open(user, 'Driver group')
    const list = within(popup).getByRole('radiogroup', { name: 'Driver group' })
    const radios = within(list).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
    expect(radios[0]).toHaveAccessibleName('All drivers')
    expect(radios[1]).toHaveAccessibleName('Night shift')
    expect(radios[1]).toHaveAccessibleDescription('Drivers 2')
    expect(radios[2]).toHaveAccessibleDescription('Drivers 1')
    expect(within(popup).queryByRole('checkbox')).toBeNull()
  })

  it('«All drivers» is the chosen one when there is no group', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user, 'Driver group')
    expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveAttribute('aria-checked', 'true')
  })

  it('choosing a group reports it whole (with its drivers) and closes the popover', async () => {
    const user = userEvent.setup()
    const { onGroupChange } = mount()
    const popup = await open(user, 'Driver group')
    await user.click(within(popup).getByRole('radio', { name: 'Day shift' }))
    expect(onGroupChange).toHaveBeenCalledTimes(1)
    expect(onGroupChange).toHaveBeenCalledWith(GROUPS[1])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver group' })).toBeNull(), EXIT)
  })

  it('«All drivers» takes the group away: onGroupChange(null), and closes', async () => {
    const user = userEvent.setup()
    const { onGroupChange } = mount({ selectedGroup: GROUPS[0] })
    const popup = await open(user, 'Driver group')
    await user.click(within(popup).getByRole('radio', { name: 'All drivers' }))
    expect(onGroupChange).toHaveBeenCalledTimes(1)
    expect(onGroupChange).toHaveBeenCalledWith(null)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver group' })).toBeNull(), EXIT)
  })

  it('the arrows move the focus between the options and do not choose; Enter chooses', async () => {
    const user = userEvent.setup()
    const { onGroupChange } = mount()
    const popup = await open(user, 'Driver group')
    const all = within(popup).getByRole('radio', { name: 'All drivers' })
    act(() => all.focus())
    await user.keyboard('{ArrowDown}')
    expect(within(popup).getByRole('radio', { name: 'Night shift' })).toHaveFocus()
    expect(onGroupChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onGroupChange).toHaveBeenCalledWith(GROUPS[0])
  })

  it('has a server search: after a wait, and Enter sends it at once', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user, 'Driver group')
    const search = within(popup).getByRole('searchbox', { name: 'Search Driver group' })
    await user.type(search, 'nig')
    await waitFor(() => expect(mocks.groups.onSearch).toHaveBeenCalledWith('nig'), { timeout: 3000 })
    mocks.groups.onSearch.mockClear()
    await user.clear(search)
    await user.type(search, 'day{Enter}')
    expect(mocks.groups.onSearch).toHaveBeenCalledWith('day')
  })

  it('says «No results found» when a search brings no group, and keeps «All drivers»', async () => {
    const user = userEvent.setup()
    mocks.groups.driversGroupsState = { groups: [], loading: false, error: null }
    mount()
    const popup = await open(user, 'Driver group')
    expect(within(popup).getByRole('status')).toHaveTextContent('No results found')
    expect(within(popup).getByRole('radio', { name: 'All drivers' })).toBeInTheDocument()
  })

  it('shows skeletons for the groups while they load, and «All drivers» stays', async () => {
    const user = userEvent.setup()
    mocks.groups.driversGroupsState = { groups: [], loading: true, error: null }
    mount()
    const popup = await open(user, 'Driver group')
    expect(popup.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(within(popup).getByRole('radio', { name: 'All drivers' })).toBeInTheDocument()
    expect(within(popup).queryByText('No results found')).toBeNull()
  })

  it('pages with getHeaderDriversGroups(page, pageSize) of the controller', async () => {
    const user = userEvent.setup()
    mocks.groups.pagination = { currentPage: 1, pageSize: 5, totalPages: 3, totalItems: 12 }
    mount()
    const popup = await open(user, 'Driver group')
    await user.click(within(popup).getByRole('button', { name: 'Next page' }))
    expect(mocks.groups.getHeaderDriversGroups).toHaveBeenCalledWith(2, 5)
  })

  it('has no pager when everything fits one page', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user, 'Driver group')
    expect(within(popup).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('the Drivers pill', () => {
  it('without a group mounts the controller of today\'s driver selector, searching on the server', async () => {
    const user = userEvent.setup()
    mount({ driverIds: [21] })
    expect(mocks.mounts.drivers).toBeUndefined()
    await open(user, 'Drivers')
    expect(mocks.mounts.drivers).toBe(1)
    const props = mocks.last.drivers
    expect(props.disableDriverLocationsSockets).toBe(true)
    expect(props.disableSocketRoomDriver).toBe(true)
    expect(props.isSearchByName).toBe(true)
    expect(props.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    expect(props.propsToFetch).toEqual(['id', 'name', 'lastname', 'cellphone', 'photo'])
    expect(props.filterValues).toEqual({ driverIds: [21] })
    expect(props.useDriversByProps).toBeFalsy()
  })

  it('lists each driver as a checkbox with name and last name; the checks are the ids the page holds', async () => {
    const user = userEvent.setup()
    mount({ driverIds: [21] })
    const popup = await open(user, 'Drivers')
    const boxes = within(popup).getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'Bo' })).toHaveAttribute('aria-checked', 'false')
    expect(within(popup).getByRole('checkbox', { name: 'Cy Diaz' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a check applies at once: onToggleDriver(id, full name); the popover stays open', async () => {
    const user = userEvent.setup()
    const { onToggleDriver } = mount()
    const popup = await open(user, 'Drivers')
    await user.click(within(popup).getByRole('checkbox', { name: 'Cy Diaz' }))
    expect(onToggleDriver).toHaveBeenCalledTimes(1)
    expect(onToggleDriver).toHaveBeenCalledWith(23, 'Cy Diaz')
    expect(screen.getByRole('dialog', { name: 'Drivers' })).toBeInTheDocument()
  })

  it('has no «Clear» while nothing is chosen', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user, 'Drivers')
    expect(within(popup).queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('«Clear» is in the foot once something is chosen, and clears them all', async () => {
    const user = userEvent.setup()
    const { onClearDrivers } = mount({ driverIds: [21, 22] })
    const popup = await open(user, 'Drivers')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(onClearDrivers).toHaveBeenCalledTimes(1)
  })

  it('has a server search (name and last name, after a wait; Enter at once)', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user, 'Drivers')
    const search = within(popup).getByRole('searchbox', { name: 'Search Drivers' })
    await user.type(search, 'ana')
    await waitFor(() => expect(mocks.drivers.setSearchValue).toHaveBeenCalledWith('ana'), { timeout: 3000 })
    mocks.drivers.setSearchValue.mockClear()
    await user.clear(search)
    await user.type(search, 'bo{Enter}')
    expect(mocks.drivers.setSearchValue).toHaveBeenCalledWith('bo')
  })

  it('pages the drivers of the server with handleChangePage', async () => {
    const user = userEvent.setup()
    mocks.drivers.pagination = { currentPage: 1, pageSize: 10, totalPages: 3, total: 25 }
    mount()
    const popup = await open(user, 'Drivers')
    await user.click(within(popup).getByRole('button', { name: 'Next page' }))
    expect(mocks.drivers.handleChangePage).toHaveBeenCalledWith(2)
  })

  it('says «No results found» for an empty answer', async () => {
    const user = userEvent.setup()
    mocks.drivers.driversList = { drivers: [], loading: false, error: null }
    mount()
    const popup = await open(user, 'Drivers')
    expect(within(popup).getByRole('status')).toHaveTextContent('No results found')
  })

  it('shows skeletons while the answer comes, not «No results found»', async () => {
    const user = userEvent.setup()
    mocks.drivers.driversList = { drivers: [], loading: true, error: null }
    mount()
    const popup = await open(user, 'Drivers')
    expect(popup.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(within(popup).queryByText('No results found')).toBeNull()
  })

  it('with a group, lists the drivers of that group (the controller works by props) and has no pager', async () => {
    const user = userEvent.setup()
    mocks.drivers.pagination = { currentPage: 1, pageSize: 10, totalPages: 3, total: 25 }
    mount({ selectedGroup: GROUPS[0] })
    const popup = await open(user, 'Drivers')
    const props = mocks.last.drivers
    expect(props.useDriversByProps).toBeTruthy()
    expect(props.driversList).toBe(GROUPS[0])
    expect(within(popup).getAllByRole('checkbox').map(box => box.getAttribute('aria-label') ?? box.textContent)).toEqual(['Ana Ruiz', 'Bo #22'])
    expect(within(popup).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  // the drivers of a group come without `lastname`, so two «Driver» looked the same
  it('with a group, drivers without a last name get their email, or «#id», so none looks like another', async () => {
    const user = userEvent.setup()
    const group = {
      id: 7,
      name: 'Mixed',
      enabled: true,
      drivers: [
        { id: 31, name: 'Driver' },
        { id: 32, name: 'Driver' },
        { id: 33, name: 'Driver', email: 'third@example.com' },
        { id: 34, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com' }
      ]
    }
    const { onToggleDriver } = mount({ selectedGroup: group })
    const popup = await open(user, 'Drivers')
    const names = within(popup).getAllByRole('checkbox').map(box => box.textContent)
    expect(names).toEqual(['Driver #31', 'Driver #32', 'Driver third@example.com', 'Ana Ruiz'])
    expect(new Set(names).size).toBe(names.length)
    // what the page learns for the pill stays the plain full name
    await user.click(within(popup).getByRole('checkbox', { name: 'Driver #32' }))
    expect(onToggleDriver).toHaveBeenCalledWith(32, 'Driver')
  })

  it('with a group, the search filters the list of the group in the page itself, without a request', async () => {
    const user = userEvent.setup()
    mount({ selectedGroup: GROUPS[0] })
    const popup = await open(user, 'Drivers')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Drivers' }), 'ruiz')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Drivers' }), 'zzz')
    expect(within(popup).queryByRole('checkbox')).toBeNull()
    expect(within(popup).getByRole('status')).toHaveTextContent('No results found')
    expect(mocks.drivers.setSearchValue).not.toHaveBeenCalled()
  })
})
