/* eslint-disable import/first */
// redesign DL-B4 (decision 3 | M-DL10): the header of /delivery/drivers-list: title and count, Learn (level 0 only, as
// LearnDropDown does on main), Export CSV, «Add driver» (keeps the `tour_add` anchor), the menu button of a collapsed sidebar,
// and under it the filter row: the search and the status control. The export is a stub that records what it gets; the Product
// wrappers (PageHeader, SearchField, SegmentedControl, Button) and LearnDropDown are the real ones.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ level: 0, exportProps: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: { id: 1, level: runtime.level } }]
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../DriversExport', () => ({
  DriversExport: (props) => {
    runtime.exportProps = props
    return <button type='button' disabled={props.disabled}>Export CSV</button>
  }
}))

import { DriversHeader } from '../DriversHeader'

const LEARN = [{ value: 'drivers', name: 'Drivers list', url: 'https://help.ordering.co/drivers' }]
const EXPORT_PROPS = {
  defaultUserTypesSelected: [4],
  disabledActiveStateCondition: true,
  userTypesSelected: [4],
  selectedUserActiveState: true
}

const baseProps = () => ({
  title: 'Drivers',
  count: 17,
  learnOptions: LEARN,
  actionDisabled: false,
  onAddDriver: vi.fn(),
  exportProps: EXPORT_PROPS,
  search: '',
  onSearch: vi.fn(),
  status: 'all',
  onStatusChange: vi.fn(),
  showStatusFilter: true
})
const mount = (extra) => {
  const props = { ...baseProps(), ...extra }
  renderWithProviders(<DriversHeader {...props} />)
  return props
}
const statusGroup = () => screen.getByRole('group', { name: 'Status' })
const searchBox = () => screen.getByRole('searchbox', { name: 'Search' })

beforeEach(() => {
  vi.clearAllMocks()
  runtime.level = 0
  runtime.exportProps = null
  infoShare.isCollapse = false
})

describe('DriversHeader · title, count and buttons', () => {
  it('draws the title as the h1 with the count, and names its buttons', () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Drivers' })).toHaveClass('odc-pagehead-title')
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('17 drivers')
    expect(screen.getByRole('button', { name: 'Add driver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learn/ })).toBeInTheDocument()
  })

  it('says «1 driver» for one and shows no count until the total is known', () => {
    mount({ count: 1 })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 driver')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 drivers')
  })

  it('shows no count when the total is null', () => {
    mount({ count: null })
    expect(document.querySelector('.odc-pagehead-count')).toBeNull()
  })

  it('«Add driver» is the one primary button, keeps main\'s `data-tour="tour_add"` anchor and calls onAddDriver', async () => {
    const user = userEvent.setup()
    const props = mount()
    const add = screen.getByRole('button', { name: 'Add driver' })
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(add).toHaveAttribute('data-tour', 'tour_add')
    expect(document.querySelectorAll('[data-tour="tour_add"]')).toHaveLength(1)
    await user.click(add)
    expect(props.onAddDriver).toHaveBeenCalledTimes(1)
  })

  it('with actionDisabled «Add driver» is really disabled (and keeps the anchor) and the export is disabled too, as main', async () => {
    const user = userEvent.setup()
    const props = mount({ actionDisabled: true })
    const add = screen.getByRole('button', { name: 'Add driver' })
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('data-tour', 'tour_add')
    await user.click(add)
    expect(props.onAddDriver).not.toHaveBeenCalled()
    expect(runtime.exportProps.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  })

  it('passes the export what main\'s former header passed it, enabled when the actions are', () => {
    mount()
    expect(runtime.exportProps).toMatchObject({ ...EXPORT_PROPS, disabled: false })
  })

  it('«Add driver» is not the "Add new driver" of the foot nor "Add user"', () => {
    mount()
    expect(screen.queryByRole('button', { name: /add user/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add new driver/i })).toBeNull()
  })
})

describe('DriversHeader · Learn, as main (only a level-zero session with options)', () => {
  it('level 0 with options: Learn is there and opens the help links', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /Learn/ }))
    expect(await screen.findByRole('menuitem', { name: /Drivers list/ })).toBeInTheDocument()
  })

  it.each([1, 2, 5])('level %i: no Learn', (level) => {
    runtime.level = level
    mount()
    expect(screen.queryByRole('button', { name: /Learn/ })).toBeNull()
  })

  it('level 0 without options: no Learn', () => {
    mount({ learnOptions: [] })
    expect(screen.queryByRole('button', { name: /Learn/ })).toBeNull()
  })
})

describe('DriversHeader · the menu button of a collapsed sidebar (as main)', () => {
  it('is not drawn while the sidebar is open', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('is drawn when it is collapsed and opens the sidebar', async () => {
    infoShare.isCollapse = true
    const user = userEvent.setup()
    mount()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    // the header root keeps its page class (drivers-filters.css reads it) on the page header itself
    expect(opener.closest('.odc-dl-head')).toHaveClass('odc-pagehead')
    await user.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('DriversHeader · search', () => {
  it('is a search box named «Search» with the placeholder «Search name, email or phone»', () => {
    mount()
    expect(searchBox()).toHaveAttribute('placeholder', 'Search name, email or phone')
  })

  it('sends the text once, 750 ms after the last key, never per keystroke', async () => {
    const user = userEvent.setup()
    const { onSearch } = mount()
    await user.type(searchBox(), 'ana')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSearch).toHaveBeenCalledWith('ana')
  })

  it('Enter sends it at once', async () => {
    const user = userEvent.setup()
    const { onSearch } = mount()
    await user.type(searchBox(), 'ana{Enter}')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('ana')
  })

  it('shows the value the page holds and clears it at once with the X', async () => {
    const user = userEvent.setup()
    const { onSearch } = mount({ search: 'ana' })
    expect(searchBox()).toHaveValue('ana')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
    expect(searchBox()).toHaveValue('')
  })

  it('never says «Filters applied. You may miss new orders.» (M-DL10), with a search or a status chosen', () => {
    mount({ search: 'ana', status: 'busy' })
    expect(screen.queryByText(/filters applied/i)).toBeNull()
    expect(screen.queryByText(/miss new orders/i)).toBeNull()
  })
})

describe('DriversHeader · status filter (decision 3)', () => {
  it('is a group named «Status» with All, Available, Busy and Offline, All chosen', () => {
    mount()
    const buttons = within(statusGroup()).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['All', 'Available', 'Busy', 'Offline'])
    expect(within(statusGroup()).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(statusGroup()).getByRole('button', { name: 'Busy' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the status the page holds', () => {
    mount({ status: 'offline' })
    expect(within(statusGroup()).getByRole('button', { name: 'Offline' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(statusGroup()).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it.each([['Available', 'available'], ['Busy', 'busy'], ['Offline', 'offline']])('choosing %s reports «%s» once', async (name, value) => {
    const user = userEvent.setup()
    const { onStatusChange } = mount()
    await user.click(within(statusGroup()).getByRole('button', { name }))
    expect(onStatusChange).toHaveBeenCalledTimes(1)
    expect(onStatusChange).toHaveBeenCalledWith(value)
  })

  it('goes back to «all» from another status', async () => {
    const user = userEvent.setup()
    const { onStatusChange } = mount({ status: 'busy' })
    await user.click(within(statusGroup()).getByRole('button', { name: 'All' }))
    expect(onStatusChange).toHaveBeenCalledWith('all')
  })

  it('is not drawn when showStatusFilter is false (level 2: its list is /professionals)', () => {
    mount({ showStatusFilter: false })
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Offline' })).toBeNull()
    // the search stays
    expect(searchBox()).toBeInTheDocument()
  })
})

describe('DriversHeader · notice slot', () => {
  it('draws the node the page gives (the level 5 without groups notice) under the bar', () => {
    mount({ notice: <p role='status'>You manage no driver groups.</p> })
    expect(screen.getByRole('status')).toHaveTextContent('You manage no driver groups.')
  })

  it('draws nothing when there is no notice', () => {
    mount()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// redesign DM-B4 (decision 1 | M-DL12): the same header for /delivery/drivers-managers; `role` is opt-in and the texts come from directoryCopy
describe('DriversHeader · role «managers» (DM-B4)', () => {
  const managers = (extra) => mount({ title: 'Drivers managers', role: 'managers', showStatusFilter: false, ...extra })

  it('says «2 managers» for several and «1 manager» for one', () => {
    managers({ count: 2 })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('2 managers')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('driver')
  })

  it('says «1 manager» (not «1 managers») for one', () => {
    managers({ count: 1 })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 manager')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 managers')
  })

  it('the primary action is «Add driver manager», keeps the tour anchor and calls onAddDriver', async () => {
    const user = userEvent.setup()
    const props = managers()
    const add = screen.getByRole('button', { name: 'Add driver manager' })
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(add).toHaveAttribute('data-tour', 'tour_add')
    expect(add).toHaveAttribute('title', 'Add driver manager')
    expect(screen.queryByRole('button', { name: 'Add driver' })).toBeNull()
    expect(document.querySelectorAll('[data-tour="tour_add"]')).toHaveLength(1)
    await user.click(add)
    expect(props.onAddDriver).toHaveBeenCalledTimes(1)
  })

  it('hands the export the role, next to what it always gets', () => {
    managers()
    expect(runtime.exportProps).toMatchObject({ ...EXPORT_PROPS, disabled: false, role: 'managers' })
  })

  it('draws no status control when the page says so', () => {
    managers()
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
  })

  it('with role «drivers» or none, the texts are the drivers\' ones', () => {
    mount({ role: 'drivers', count: 2 })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('2 drivers')
    expect(screen.getByRole('button', { name: 'Add driver' })).toBeInTheDocument()
  })
})
