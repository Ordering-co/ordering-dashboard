/* eslint-disable import/first */
// redesign OC-D (M-1..M-4): the filter bar of the open carts queue. Each pill filters in its own popover and every action
// reaches the controller once (`onFiltersChange(partial)`); the search sends its raw text once, after a wait; the customer
// pill searches on the server through the UsersList controller (mocked here) and keeps the names of what was picked.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  configs: {},
  catalog: {}, // redesign OC-F1 (OC-Q1-06): what the runtime catalog of the API says for a key, over the default text
  usersList: { users: [], loading: false, error: null },
  paginationProps: { currentPage: 1, totalPages: 1 },
  usersListProps: null,
  onSearch: vi.fn(),
  getUsers: vi.fn()
}))

vi.mock('../../../../../../index', async () => {
  const { getDateTimeFormats } = await import('../../../../../../utils/settingsCustomSections')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
    useConfig: () => [{ configs: mockState.configs }],
    // the project's date format, day part only, as the real parseDate does
    useUtils: () => [{
      parseDate: (date, options = {}) => {
        const raw = mockState.configs.dates_general_format?.value
        const formats = getDateTimeFormats(typeof raw === 'string' && raw.trim() ? raw : 'DD MMM YYYY HH:mm')
        return dayjs(String(date).slice(0, 10)).format(options.dateOnly ? formats.dateFormat : `${formats.dateFormat} ${formats.timeFormat}`)
      }
    }],
    // the controller of the customer search: it hands its UIComponent the list and the search handler
    UsersList: ({ UIComponent, ...props }) => {
      mockState.usersListProps = props
      return (
        <UIComponent
          {...props}
          usersList={mockState.usersList}
          paginationProps={mockState.paginationProps}
          getUsers={mockState.getUsers}
          searchValue={null}
          onSearch={mockState.onSearch}
        />
      )
    }
  }
})

import { QueueFilters } from '../QueueFilters'

const BUSINESSES = [
  { id: 1, name: 'Sample Burgers', logo: null },
  { id: 2, name: 'Demo Bakery', logo: null },
  { id: 3, name: 'Test Wok', logo: null }
]
const CITIES = [
  { id: 10, name: 'Miami' },
  { id: 11, name: 'Austin' }
]
const USERS = [
  { id: 7, name: 'Ana', lastname: 'Ruiz', photo: null },
  { id: 8, name: 'Marco', lastname: 'Toss', photo: null }
]
const EMPTY = { businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: null } }

// What the controller does with a partial: a stateful stand-in, so the bar re-renders with the new filters
const renderBar = (initial = {}, { search = '' } = {}) => {
  const onFiltersChange = vi.fn()
  const onSearchChange = vi.fn()
  const onClearFilters = vi.fn()
  const Harness = () => {
    const [filters, setFilters] = useState({ ...EMPTY, ...initial })
    return (
      <QueueFilters
        view='followUp'
        search={search}
        onSearchChange={onSearchChange}
        filters={filters}
        onFiltersChange={(partial) => { onFiltersChange(partial); setFilters(current => ({ ...current, ...partial })) }}
        onClearFilters={onClearFilters}
        businesses={BUSINESSES}
        cities={CITIES}
      />
    )
  }
  render(<Harness />)
  return { onFiltersChange, onSearchChange, onClearFilters }
}

// the row's text without the initials of its avatar
const rowName = (row) => row.querySelector('.odc-orders-picker-name').textContent
const popup = (name) => screen.findByRole('dialog', { name })

beforeEach(() => {
  vi.clearAllMocks()
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  mockState.usersList = { users: USERS, loading: false, error: null }
  mockState.paginationProps = { currentPage: 1, totalPages: 1 }
  mockState.usersListProps = null
  mockState.catalog = {}
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('search · cart number', () => {
  it('is named «Search cart number», takes digits on a phone keypad and sends the raw text once, after a wait', async () => {
    const user = userEvent.setup()
    const { onSearchChange } = renderBar()
    const field = screen.getByRole('searchbox', { name: 'Search cart number' })
    expect(field).toHaveAttribute('placeholder', 'Search cart number')
    expect(field).toHaveAttribute('inputmode', 'numeric')
    await user.type(field, '#18 3')
    expect(onSearchChange).not.toHaveBeenCalled() // never per keystroke
    await waitFor(() => expect(onSearchChange).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSearchChange).toHaveBeenCalledWith('#18 3')
  })

  it('Enter sends it at once, and only once', async () => {
    const user = userEvent.setup()
    const { onSearchChange } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search cart number' }), '183{Enter}')
    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('183')
    await act(() => new Promise(resolve => setTimeout(resolve, 900)))
    expect(onSearchChange).toHaveBeenCalledTimes(1)
  })

  it('«Clear search» empties it and sends «» once', async () => {
    const user = userEvent.setup()
    const { onSearchChange } = renderBar({}, { search: '183' })
    expect(screen.getByRole('searchbox', { name: 'Search cart number' })).toHaveValue('183')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('')
  })
})

describe('Business pill', () => {
  it('lists the businesses, and each check is one partial with the new ids', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Business' }))
    const box = await popup('Business')
    expect(within(box).getAllByRole('checkbox').map(rowName)).toEqual(['Sample Burgers', 'Demo Bakery', 'Test Wok'])
    await user.click(within(box).getByRole('checkbox', { name: /Sample Burgers/ }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenLastCalledWith({ businessIds: [1] })
    await user.click(within(box).getByRole('checkbox', { name: /Demo Bakery/ }))
    expect(onFiltersChange).toHaveBeenCalledTimes(2)
    expect(onFiltersChange).toHaveBeenLastCalledWith({ businessIds: [1, 2] })
    // the pill and the chips read the names at once
    expect(screen.getByRole('button', { name: /^Business\s*2$/ })).toBeInTheDocument()
    await user.click(within(box).getByRole('checkbox', { name: /Sample Burgers/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ businessIds: [2] })
  })

  it('«Clear» in the popover empties only the business ids', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar({ businessIds: [1, 2] })
    await user.click(screen.getByRole('button', { name: /^Business/ }))
    const box = await popup(/Business/)
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ businessIds: [] })
  })

  it('a single business shows its name in the pill', () => {
    renderBar({ businessIds: [2] })
    expect(screen.getByRole('button', { name: /^Business\s*Demo Bakery$/ })).toBeInTheDocument()
  })
})

describe('City pill', () => {
  it('each check is one partial with the new city ids', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'City' }))
    const box = await popup('City')
    await user.click(within(box).getByRole('checkbox', { name: /Miami/ }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenLastCalledWith({ cityIds: [10] })
    await user.click(within(box).getByRole('checkbox', { name: /Austin/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ cityIds: [10, 11] })
  })

  it('a single city shows its name in the pill', () => {
    renderBar({ cityIds: [10] })
    expect(screen.getByRole('button', { name: /^City\s*Miami$/ })).toBeInTheDocument()
  })
})

describe('Customer pill · server search with the UsersList controller', () => {
  it('asks the controller for customers by name and id, 20 at a time, and only mounts it once the popover opens', async () => {
    const user = userEvent.setup()
    renderBar()
    expect(mockState.usersListProps).toBeNull() // no request while the popover is closed
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    await popup('Customer')
    expect(mockState.usersListProps).toMatchObject({
      defaultUserTypesSelected: [3],
      isSearchByUserId: true,
      isSearchByUserName: true,
      paginationSettings: { initialPage: 1, pageSize: 20, controlType: 'pages' }
    })
    expect(mockState.usersListProps.propsToFetch).toEqual(expect.arrayContaining(['name', 'lastname', 'photo']))
  })

  it('typing sends the text to the controller once, after a wait, and the list shows the customers', async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const box = await popup('Customer')
    expect(within(box).getAllByRole('checkbox').map(rowName)).toEqual(['Ana Ruiz', 'Marco Toss'])
    await user.type(within(box).getByRole('searchbox', { name: 'Search Customer' }), 'ana')
    expect(mockState.onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(mockState.onSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(mockState.onSearch).toHaveBeenCalledWith('ana')
  })

  it('picking one is one partial, and the pill and the chip read the name, which outlives the next search', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const box = await popup('Customer')
    await user.click(within(box).getByRole('checkbox', { name: /Ana Ruiz/ }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ customerIds: [7] })
    expect(screen.getByRole('button', { name: /^Customer\s*Ana Ruiz$/ })).toBeInTheDocument()
    expect(screen.getByText('Customer: Ana Ruiz')).toBeInTheDocument()
    // the next search no longer brings her: her name stays, and she stays in the list to be unchecked
    mockState.usersList = { users: [USERS[1]], loading: false, error: null }
    await user.click(within(box).getByRole('checkbox', { name: /Marco Toss/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ customerIds: [7, 8] })
    expect(screen.getByRole('button', { name: /^Customer\s*2$/ })).toBeInTheDocument()
    expect(screen.getByText('Customer: Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Customer: Marco Toss')).toBeInTheDocument()
  })

  it('says it is loading while the first answer comes', async () => {
    const user = userEvent.setup()
    mockState.usersList = { users: [], loading: true, error: null }
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const box = await popup('Customer')
    expect(within(box).getByRole('status')).toHaveTextContent('Loading...')
    await user.keyboard('{Escape}')
  })

  it('says what failed, with a retry that asks for the first page again', async () => {
    const user = userEvent.setup()
    mockState.usersList = { users: [], loading: false, error: ['boom'] }
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const box = await popup('Customer')
    expect(within(box).getByText("We couldn't load the customers.")).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Retry' }))
    expect(mockState.getUsers).toHaveBeenCalledWith(1)
  })

  it('an empty answer reads «No results found»', async () => {
    const user = userEvent.setup()
    mockState.usersList = { users: [], loading: false, error: null }
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const box = await popup('Customer')
    expect(within(box).getByRole('status')).toHaveTextContent('No results found')
  })
})

describe('Last activity pill', () => {
  beforeEach(() => {
    // Friday 9 October 2026, 15:30 local: only the clock is faked, the timers stay real
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 9, 15, 30, 0) })
  })
  afterEach(() => vi.useRealTimers())

  const startOf = (month, day) => new Date(2026, month, day, 0, 0, 0, 0)
  const endOf = (month, day) => new Date(2026, month, day, 23, 59, 59, 999)

  it.each([
    ['Today', startOf(9, 9), endOf(9, 9)],
    ['Yesterday', startOf(9, 8), endOf(9, 8)],
    ['Last 7 days', startOf(9, 3), endOf(9, 9)],
    ['Last 30 days', startOf(8, 10), endOf(9, 9)]
  ])('«%s» is one partial with Dates at the local start and end of day', async (preset, from, to) => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Last activity' }))
    const box = await popup('Select a date')
    await user.click(within(box).getByRole('button', { name: preset }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    const { lastActivity } = onFiltersChange.mock.calls[0][0]
    expect(lastActivity.from).toBeInstanceOf(Date)
    expect(lastActivity.to).toBeInstanceOf(Date)
    expect(lastActivity.from.getTime()).toBe(from.getTime())
    expect(lastActivity.to.getTime()).toBe(to.getTime())
    // the pill and the chip name the preset
    expect(screen.getByRole('button', { name: new RegExp(`^Last activity\\s*${preset}$`) })).toBeInTheDocument()
    expect(screen.getByText(`Last activity: ${preset}`)).toBeInTheDocument()
  })

  // redesign OC-F1 (OC-Q1-06): the shared keys of the catalog can carry a typo («Last 7 dyas»); the presets own their keys
  it('the presets take their text from their own keys, not from the shared LAST_7_DAYS, TODAY, YESTERDAY or LAST_30_DAYS', async () => {
    const user = userEvent.setup()
    mockState.catalog = { LAST_7_DAYS: 'Last 7 dyas', LAST_30_DAYS: 'Last 30 dyas', TODAY: 'Tdoay', YESTERDAY: 'Yesterdya' }
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Last activity' }))
    const box = await popup('Select a date')
    ;['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'].forEach(name => {
      expect(within(box).getByRole('button', { name })).toBeInTheDocument()
    })
    expect(within(box).queryByRole('button', { name: 'Last 7 dyas' })).toBeNull()
  })

  it('a custom range is applied once, on «Done», and is written in the project format', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Last activity' }))
    const box = await popup('Select a date')
    await user.click(box.querySelector('[data-day="2026-10-10"]'))
    await user.click(box.querySelector('[data-day="2026-10-12"]'))
    expect(onFiltersChange).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    const { lastActivity } = onFiltersChange.mock.calls[0][0]
    expect(lastActivity.from.getTime()).toBe(startOf(9, 10).getTime())
    expect(lastActivity.to.getTime()).toBe(endOf(9, 12).getTime())
    expect(screen.getByText('Last activity: 10-10-2026 – 12-10-2026')).toBeInTheDocument()
  })
})

describe('chips and «Clear filters»', () => {
  const FULL = {
    businessIds: [1, 2],
    customerIds: [7],
    cityIds: [10],
    lastActivity: { from: new Date(2026, 9, 3, 0, 0, 0, 0), to: new Date(2026, 9, 5, 23, 59, 59, 999) }
  }

  it('draws one chip per value, each with its own accessible remove button', () => {
    renderBar(FULL)
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(within(chips).getAllByRole('listitem').map(item => item.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Business: Sample Burgers'),
      expect.stringContaining('Business: Demo Bakery'),
      expect.stringContaining('City: Miami'),
      expect.stringContaining('Last activity: 03-10-2026 – 05-10-2026')
    ]))
    expect(within(chips).getByRole('button', { name: 'Remove Business Sample Burgers filter' })).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: 'Remove Business Demo Bakery filter' })).toBeInTheDocument()
  })

  it('removing a business chip removes that one value and nothing else, in one call', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar(FULL)
    await user.click(screen.getByRole('button', { name: 'Remove Business Sample Burgers filter' }))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ businessIds: [2] })
  })

  it('removing the city and the date chips empties just those', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderBar(FULL)
    await user.click(screen.getByRole('button', { name: 'Remove City Miami filter' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ cityIds: [] })
    await user.click(screen.getByRole('button', { name: /^Remove Last activity .* filter$/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ lastActivity: { from: null, to: null } })
    expect(onFiltersChange).toHaveBeenCalledTimes(2)
  })

  it('«Clear filters» calls onClearFilters once and only exists when something narrows', async () => {
    const user = userEvent.setup()
    const { onClearFilters, onFiltersChange } = renderBar(FULL)
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clears[clears.length - 1])
    expect(onClearFilters).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('a search alone is a narrowing too: «Clear filters» shows, with no chips', () => {
    renderBar({}, { search: '183' })
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })

  it('with nothing applied there is no «Clear filters» and no chips', () => {
    renderBar()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })
})
