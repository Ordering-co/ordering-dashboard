/* eslint-disable import/first */
// redesign drivers FC1 (D5; auditor 1; DR-02, DR-14): DriverTreePill, the drivers tree of `main` (AnalyticsDriversFilter) in a
// Product pill. The controller of `main` is replaced by a stand-in that hands its UIComponent what the real one hands it (usersList,
// groupList, and its own selection, «All» and «Filter», which must NOT be used), so what is under test is the new UI: what it
// paints, what the checks are (the ids the page holds), and what it asks the page for.
import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ controller: {}, last: null, mounts: 0 }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{}, (_key, text) => text],
    AnalyticsDriversFilter: function Controller (props) {
      mocks.last = props
      react.useEffect(() => { mocks.mounts += 1 }, [])
      const { UIComponent, ...rest } = props
      return react.createElement(UIComponent, { ...rest, ...mocks.controller })
    }
  }
})

import { DriverTreePill } from '../DriverTreePill'

const U = {
  ana: { id: 21, name: 'Ana', lastname: 'Ruiz' },
  bo: { id: 22, name: 'Bo', lastname: '' },
  cy: { id: 23, name: 'Cy', lastname: 'Diaz' },
  dan: { id: 24, name: 'Dan' },
  jose: { id: 25, name: 'José' }
}
const USERS = [U.ana, U.bo, U.cy, U.dan, U.jose]
// Ana is in two groups (Night and Late); Day has two drivers and none of them is «ana»
const GROUPS = [
  { id: 5, name: 'Night shift', isCollapse: false, children: [U.ana, U.bo] },
  { id: 6, name: 'Day shift', isCollapse: false, children: [U.cy, U.dan] },
  { id: 7, name: 'Late shift', isCollapse: false, children: [U.ana, U.jose] }
]
const FILTER_LIST = { lapse: 'today', userIds: null }

const setController = () => {
  mocks.last = null
  mocks.mounts = 0
  mocks.controller = {
    usersList: { loading: false, error: null, users: USERS, pagination: null },
    groupList: GROUPS,
    // the controller's own selection (everything checked, as it opens in `main`): it must not be read (DR-02)
    userIds: USERS.map(user => user.id),
    isAllCheck: 'all',
    handleChangeUserId: vi.fn(),
    handleChangeCollapse: vi.fn(),
    isParentCheck: vi.fn(() => 'all'),
    parentClick: vi.fn(),
    changeAllCheckStatus: vi.fn(),
    handleClickFilterButton: vi.fn()
  }
}

const Harness = ({ initial, onSetIds, onClear, onLearn, filterList = FILTER_LIST }) => {
  const [selected, setSelected] = useState(initial)
  return (
    <DriverTreePill
      label='Driver'
      value=''
      filterList={filterList}
      selected={selected}
      onSetIds={(ids) => { onSetIds(ids); setSelected(ids) }}
      onClear={(...args) => { onClear(...args); setSelected([]) }}
      onLearn={onLearn}
    />
  )
}

const mount = (initial = [], filterList = FILTER_LIST) => {
  const onSetIds = vi.fn()
  const onClear = vi.fn()
  const onLearn = vi.fn()
  const view = render(<Harness initial={initial} onSetIds={onSetIds} onClear={onClear} onLearn={onLearn} filterList={filterList} />)
  return { onSetIds, onClear, onLearn, ...view }
}
const open = async (user) => {
  await user.click(screen.getByRole('button', { name: /^Driver/ }))
  return screen.findByRole('dialog', { name: 'Driver' })
}
const groupBox = (popup, name) => within(popup).getByRole('checkbox', { name: new RegExp(`^${name}`) })
const toggleOf = (popup, name) => within(popup).getByRole('button', { name: new RegExp(`drivers of ${name}$`) })
const lastIds = (spy) => spy.mock.calls.at(-1)[0]

beforeEach(setController)
afterEach(() => document.getElementById('app-modals')?.remove())

describe('DriverTreePill', () => {
  it('mounts the controller (its GET) when the popover opens, with the fields main asks for', async () => {
    const user = userEvent.setup()
    mount()
    expect(mocks.mounts).toBe(0)
    await open(user)
    expect(mocks.mounts).toBe(1)
    expect(mocks.last.propsToFetch).toEqual(['id', 'name', 'driver_groups'])
  })

  it('paints the groups folded with their number of drivers; unfolding shows their drivers (aria-expanded)', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user)
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(3)
    expect(groupBox(popup, 'Night shift')).toHaveTextContent('2')
    expect(popup.querySelector('.odc-figure')).not.toBeNull()
    const toggle = toggleOf(popup, 'Night shift')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAccessibleName('Show drivers of Night shift')
    expect(within(popup).queryByRole('checkbox', { name: /Bo/ })).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Hide drivers of Night shift')
    expect(toggle.getAttribute('aria-controls')).toBeTruthy()
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(within(popup).getByRole('checkbox', { name: 'Bo' })).toBeInTheDocument()
    expect(within(popup).queryByRole('checkbox', { name: 'Cy Diaz' })).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(popup).queryByRole('checkbox', { name: 'Bo' })).toBeNull()
  })

  it('DR-02: with nothing applied nothing is checked, whatever the controller\'s own selection says', async () => {
    const user = userEvent.setup()
    mount([])
    const popup = await open(user)
    for (const name of ['Night shift', 'Day shift', 'Late shift']) {
      expect(groupBox(popup, name)).toHaveAttribute('aria-checked', 'false')
    }
    await user.click(toggleOf(popup, 'Night shift'))
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toHaveAttribute('aria-checked', 'false')
    expect(within(popup).getByRole('checkbox', { name: 'Bo' })).toHaveAttribute('aria-checked', 'false')
    expect(within(popup).queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('a group is checked when all its drivers are applied, mixed when some are, and the drivers read the applied ids', async () => {
    const user = userEvent.setup()
    mount([21, 22, 23])
    const popup = await open(user)
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'true')
    expect(groupBox(popup, 'Day shift')).toHaveAttribute('aria-checked', 'mixed')
    expect(groupBox(popup, 'Late shift')).toHaveAttribute('aria-checked', 'mixed') // Ana (21) yes, José (25) no
    await user.click(toggleOf(popup, 'Day shift'))
    expect(within(popup).getByRole('checkbox', { name: 'Cy Diaz' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'Dan' })).toHaveAttribute('aria-checked', 'false')
  })

  it('checking a group adds all its drivers; unchecking it removes them (and only them)', async () => {
    const user = userEvent.setup()
    const { onSetIds } = mount([23])
    const popup = await open(user)
    await user.click(groupBox(popup, 'Night shift'))
    expect(lastIds(onSetIds)).toEqual([23, 21, 22])
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'true')
    await user.click(groupBox(popup, 'Night shift'))
    expect(lastIds(onSetIds)).toEqual([23])
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'false')
  })

  it('a mixed group completes when pressed (adds the missing ones, no duplicates)', async () => {
    const user = userEvent.setup()
    const { onSetIds } = mount([21])
    const popup = await open(user)
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'mixed')
    await user.click(groupBox(popup, 'Night shift'))
    expect(lastIds(onSetIds)).toEqual([21, 22])
  })

  it('«the group G minus X»: check G, then uncheck X; and «G plus Y»: another group\'s driver on top', async () => {
    const user = userEvent.setup()
    const { onSetIds } = mount()
    const popup = await open(user)
    await user.click(groupBox(popup, 'Night shift'))
    expect(lastIds(onSetIds)).toEqual([21, 22])
    await user.click(toggleOf(popup, 'Night shift'))
    await user.click(within(popup).getByRole('checkbox', { name: 'Bo' }))
    expect(lastIds(onSetIds)).toEqual([21])
    expect(lastIds(onSetIds)).not.toContain(22)
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'mixed')

    await user.click(toggleOf(popup, 'Day shift'))
    await user.click(within(popup).getByRole('checkbox', { name: 'Dan' }))
    expect(lastIds(onSetIds)).toEqual([21, 24])
  })

  it('a driver of two groups is added once and is the same check in both', async () => {
    const user = userEvent.setup()
    const { onSetIds } = mount()
    const popup = await open(user)
    await user.click(toggleOf(popup, 'Night shift'))
    await user.click(toggleOf(popup, 'Late shift'))
    const anas = within(popup).getAllByRole('checkbox', { name: 'Ana Ruiz' })
    expect(anas).toHaveLength(2)
    await user.click(anas[0])
    expect(lastIds(onSetIds)).toEqual([21])
    for (const box of within(popup).getAllByRole('checkbox', { name: 'Ana Ruiz' })) {
      expect(box).toHaveAttribute('aria-checked', 'true')
    }
    // checking Late shift afterwards does not repeat Ana
    await user.click(groupBox(popup, 'Late shift'))
    expect(lastIds(onSetIds)).toEqual([21, 25])
    await user.click(anas[1])
    expect(lastIds(onSetIds)).toEqual([25])
  })

  it('searching «ana» keeps only the groups with a match, unfolded, with only the drivers that match', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user)
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Driver' }), 'ana')
    expect(within(popup).getAllByRole('checkbox', { name: /shift/ })).toHaveLength(2)
    expect(within(popup).queryByRole('checkbox', { name: /^Day shift/ })).toBeNull()
    expect(within(popup).getAllByRole('checkbox', { name: 'Ana Ruiz' })).toHaveLength(2)
    expect(within(popup).queryByRole('checkbox', { name: 'Bo' })).toBeNull()
    expect(within(popup).queryByRole('checkbox', { name: 'José' })).toBeNull()
    expect(toggleOf(popup, 'Night shift')).toHaveAttribute('aria-expanded', 'true')
  })

  it('the search ignores case and accents; with no match it says so', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user)
    const search = within(popup).getByRole('searchbox', { name: 'Search Driver' })
    await user.type(search, 'JOSE')
    expect(within(popup).getByRole('checkbox', { name: 'José' })).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(popup).getByRole('status')).toHaveTextContent('No results found')
  })

  it('teaches the bar every driver by name and last name, when the list has loaded', async () => {
    const user = userEvent.setup()
    const { onLearn } = mount()
    await open(user)
    expect(onLearn).toHaveBeenCalledWith('drivers', [[21, 'Ana Ruiz'], [22, 'Bo'], [23, 'Cy Diaz'], [24, 'Dan'], [25, 'José']])
  })

  it('does not teach anything while loading, and paints skeletons instead of rows', async () => {
    const user = userEvent.setup()
    mocks.controller.usersList = { loading: true, error: null, users: [], pagination: null }
    mocks.controller.groupList = null
    const { onLearn } = mount()
    const popup = await open(user)
    expect(popup.querySelector('.odc-bi-skeletons')).toHaveAttribute('aria-busy', 'true')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(onLearn).not.toHaveBeenCalled()
  })

  it('«Clear» appears once something is checked and calls onClear; it never uses the controller\'s «All» or «Filter»', async () => {
    const user = userEvent.setup()
    const { onClear } = mount([21])
    const popup = await open(user)
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(within(popup).queryByRole('button', { name: 'Clear' })).toBeNull()
    expect(within(popup).queryByRole('button', { name: 'Filter' })).toBeNull()
    expect(within(popup).queryByRole('button', { name: 'Select All' })).toBeNull()
    for (const key of ['handleClickFilterButton', 'changeAllCheckStatus', 'parentClick', 'handleChangeUserId', 'handleChangeCollapse']) {
      expect(mocks.controller[key]).not.toHaveBeenCalled()
    }
  })

  it('DR-14 keyboard: the fold button and the checks are native buttons that Tab reaches', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user)
    const toggle = toggleOf(popup, 'Night shift')
    expect(toggle.tagName).toBe('BUTTON')
    for (const box of within(popup).getAllByRole('checkbox')) expect(box.tagName).toBe('BUTTON')

    within(popup).getByRole('searchbox', { name: 'Search Driver' }).focus()
    await user.tab()
    expect(toggle).toHaveFocus()
    await user.tab()
    expect(groupBox(popup, 'Night shift')).toHaveFocus()
    await user.keyboard(' ')
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'true')
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

// ---- redesign drivers R1 (F7) -------------------------------------------------------------------------------------------------------------
// The fold button of each group is a Product IconButton at the size that is SEEN at 32 and has the 44x44 area on a phone (decision 12);
// `sm` was seen at 28 (product.css: .odc-btn[data-size='sm']).
describe('DriverTreePill · size of the fold button (drivers R1, F7)', () => {
  it('is the default size (md): 32 visible and 44 of area on a phone, never sm (28)', async () => {
    const user = userEvent.setup()
    mount()
    const popup = await open(user)
    for (const name of ['Night shift', 'Day shift', 'Late shift']) {
      const toggle = toggleOf(popup, name)
      expect(toggle).toHaveAttribute('data-icon-only')
      expect(toggle).toHaveAttribute('data-size', 'md')
    }
  })
})

// ---- redesign (row 7, intelligence-drivers P4; D-31) ---------------------------------------------------------------------------
// With groups chosen in the Driver group pill (`filterList.driver_groups_ids`) the tree lists only those groups and their drivers, as
// /intelligence/reports narrows the Driver pill (`driversByGroup`: availableDriverIds). With none chosen, or a group the tree cannot
// place, it lists every group, as before.
describe('DriverTreePill · narrowed by the driver groups chosen (row 7, P4)', () => {
  const chosen = (...ids) => ({ ...FILTER_LIST, driver_groups_ids: ids })
  const groupNames = (popup) => within(popup).getAllByRole('checkbox', { name: /shift/ }).map(box => box.textContent.replace(/\d+$/, ''))

  it('one group chosen: only that group is listed, with its drivers', async () => {
    const user = userEvent.setup()
    mount([], chosen(6))
    const popup = await open(user)
    expect(groupNames(popup)).toEqual(['Day shift'])
    await user.click(toggleOf(popup, 'Day shift'))
    expect(within(popup).getByRole('checkbox', { name: 'Cy Diaz' })).toBeInTheDocument()
    expect(within(popup).getByRole('checkbox', { name: 'Dan' })).toBeInTheDocument()
    expect(within(popup).queryByRole('checkbox', { name: 'Ana Ruiz' })).toBeNull()
    expect(within(popup).queryByRole('button', { name: /drivers of Night shift$/ })).toBeNull()
  })

  it('several groups chosen: those groups, in the order of the tree', async () => {
    const user = userEvent.setup()
    mount([], chosen(7, 5))
    const popup = await open(user)
    expect(groupNames(popup)).toEqual(['Night shift', 'Late shift'])
  })

  it('no group chosen (null, [] or absent): every group, as today', async () => {
    const user = userEvent.setup()
    const none = mount([], { ...FILTER_LIST, driver_groups_ids: null })
    let popup = await open(user)
    expect(groupNames(popup)).toEqual(['Night shift', 'Day shift', 'Late shift'])
    none.unmount()
    document.getElementById('app-modals')?.remove()
    mount([], chosen())
    popup = await open(user)
    expect(groupNames(popup)).toEqual(['Night shift', 'Day shift', 'Late shift'])
  })

  it('a group the tree does not know (cannot place its drivers): not narrowed, like the kit pill with a group it has not seen', async () => {
    const user = userEvent.setup()
    mount([], chosen(5, 99))
    const popup = await open(user)
    expect(groupNames(popup)).toEqual(['Night shift', 'Day shift', 'Late shift'])
  })

  it('a driver applied outside the groups chosen stays applied (as in /intelligence/reports): it is not removed, and «Clear» is there', async () => {
    const user = userEvent.setup()
    const { onSetIds, onClear } = mount([23], chosen(5))
    const popup = await open(user)
    expect(onSetIds).not.toHaveBeenCalled()
    expect(groupBox(popup, 'Night shift')).toHaveAttribute('aria-checked', 'false')
    await user.click(groupBox(popup, 'Night shift'))
    expect(lastIds(onSetIds)).toEqual([23, 21, 22])
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('the search works inside the narrowed tree', async () => {
    const user = userEvent.setup()
    mount([], chosen(6))
    const popup = await open(user)
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Driver' }), 'ana')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(popup).getByRole('status')).toHaveTextContent('No results found')
  })
})
