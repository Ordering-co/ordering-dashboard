/* eslint-disable import/first */
// redesign UC-B3 (decisions 2 and 3; M-C2, M-C6, M-C7): the one-row filter bar of the customers list. It holds no filter state:
// it shows what the controller (K/UsersList) holds and reports every action once, as a complete `multiFilterValues`.
import React, { useState } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  configs: {},
  catalog: {} // what the runtime catalog of the API says for a key, over the default text
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
    }]
  }
})

import { USERS_FILTER_INITIAL_VALUES } from '../../../../../../components/UsersFilter'
import { CustomersFilters } from '../CustomersFilters'

const INITIAL = JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))
const LEVELS = { loading: false, levels: [{ id: 4, name: 'Gold' }, { id: 5, name: 'Silver' }] }

// What the controller does with what the bar writes: a stateful stand-in, so the bar re-renders with the new values
const renderBar = ({ search = '', order = null, values = INITIAL, levels = LEVELS } = {}) => {
  const onSearch = vi.fn()
  const onOrderFilterChange = vi.fn()
  const onMultiFilterChange = vi.fn()
  const onClearAll = vi.fn()
  const Harness = () => {
    const [searchValue, setSearchValue] = useState(search)
    const [orderFilterValue, setOrder] = useState(order)
    const [multiFilterValues, setMulti] = useState(values)
    return (
      <CustomersFilters
        searchValue={searchValue}
        onSearch={(text) => { onSearch(text); setSearchValue(text) }}
        orderFilterValue={orderFilterValue}
        onOrderFilterChange={(value) => { onOrderFilterChange(value); setOrder(value) }}
        multiFilterValues={multiFilterValues}
        onMultiFilterChange={(next) => { onMultiFilterChange(next); setMulti(next) }}
        loyaltyLevels={levels}
        onClearAll={onClearAll}
      />
    )
  }
  render(<Harness />)
  return { onSearch, onOrderFilterChange, onMultiFilterChange, onClearAll }
}

const popup = (name) => screen.findByRole('dialog', { name })
const lastWrite = (spy) => spy.mock.calls[spy.mock.calls.length - 1][0]

beforeEach(() => {
  vi.clearAllMocks()
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  mockState.catalog = {}
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('search · name, email or phone (decision 2)', () => {
  it('is named «Search name, email or phone», in the label and in the placeholder', () => {
    renderBar()
    const field = screen.getByRole('searchbox', { name: 'Search name, email or phone' })
    expect(field).toHaveAttribute('placeholder', 'Search name, email or phone')
  })

  it('sends the text once, 750 ms after the last key, never per keystroke', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search name, email or phone' }), 'ana ruiz')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSearch).toHaveBeenCalledWith('ana ruiz')
  })

  it('does not send before the 750 ms have passed', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search name, email or phone' }), 'a')
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('a'), { timeout: 3000 })
  })

  it('«Clear search» empties it and sends «» at once, and only once', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar({ search: 'ana' })
    const field = screen.getByRole('searchbox', { name: 'Search name, email or phone' })
    expect(field).toHaveValue('ana')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('')
    expect(field).toHaveValue('')
    await new Promise(resolve => setTimeout(resolve, 900))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('shows a search that arrives from outside (⌘K, «Clear filters») when the user is not typing', () => {
    renderBar({ search: '555' })
    expect(screen.getByRole('searchbox', { name: 'Search name, email or phone' })).toHaveValue('555')
  })
})

describe('Orders · segmented control, one click', () => {
  it('has the four options of today, All chosen when the value is null', () => {
    renderBar()
    const group = screen.getByRole('group', { name: 'Orders' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['All', 'No orders', 'With orders', 'With 5+ orders'])
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['No orders', 0],
    ['With orders', 1],
    ['With 5+ orders', 5]
  ])('«%s» writes %s in one click', async (name, value) => {
    const user = userEvent.setup()
    const { onOrderFilterChange } = renderBar()
    await user.click(within(screen.getByRole('group', { name: 'Orders' })).getByRole('button', { name }))
    expect(onOrderFilterChange).toHaveBeenCalledTimes(1)
    expect(onOrderFilterChange).toHaveBeenCalledWith(value)
    expect(within(screen.getByRole('group', { name: 'Orders' })).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
  })

  it('«All» writes null', async () => {
    const user = userEvent.setup()
    const { onOrderFilterChange } = renderBar({ order: 5 })
    const group = screen.getByRole('group', { name: 'Orders' })
    expect(within(group).getByRole('button', { name: 'With 5+ orders' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('button', { name: 'All' }))
    expect(onOrderFilterChange).toHaveBeenCalledWith(null)
  })

  it('shows «No orders» (0) as chosen, not «All»', () => {
    renderBar({ order: 0 })
    expect(screen.getByRole('button', { name: 'No orders' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  // redesign UC-R1 (I-02): live, the control sat in the pills' overflow group: it was always «active» (so «+4 · 1 active» with no
  // filter on), it was parked in «+N» as a pill (where it cannot work) and at 390 it overlapped the pills
  it('is not one of the bar\'s pills: it is outside the group the bar overflows into «+N»', () => {
    renderBar()
    const bar = screen.getByRole('group', { name: 'Customer filters' })
    expect(within(bar).queryByRole('group', { name: 'Orders' })).toBeNull()
    expect(bar.querySelector('.odc-filterbar-filters')).not.toContainElement(screen.getByRole('group', { name: 'Orders' }))
    expect(bar.querySelector('.odc-cf-orders')).toBeNull()
  })

  it('comes right before the bar, so it is the first control of the filters area', () => {
    renderBar()
    const orders = screen.getByRole('group', { name: 'Orders' }).closest('.odc-cf-orders')
    const bar = screen.getByRole('group', { name: 'Customer filters' })
    expect(orders.nextElementSibling).toBe(bar)
  })

  it('is marked active only while an option other than «All» is chosen', () => {
    renderBar()
    expect(screen.getByRole('group', { name: 'Orders' }).closest('.odc-cf-orders')).not.toHaveAttribute('data-active')
    cleanup()
    renderBar({ order: 0 })
    expect(screen.getByRole('group', { name: 'Orders' }).closest('.odc-cf-orders')).toHaveAttribute('data-active')
    cleanup()
    renderBar({ order: 5 })
    expect(screen.getByRole('group', { name: 'Orders' }).closest('.odc-cf-orders')).toHaveAttribute('data-active')
  })

  it('no pill of the bar is marked active when only the default Orders option is on (nothing for «+N · n active» to count)', () => {
    renderBar()
    const bar = screen.getByRole('group', { name: 'Customer filters' })
    expect(bar.querySelectorAll('[data-active]')).toHaveLength(0)
  })

  it('stays out of the bar\'s pills when an option is chosen too, and keeps its own click', async () => {
    const user = userEvent.setup()
    const { onOrderFilterChange } = renderBar({ order: 1 })
    const bar = screen.getByRole('group', { name: 'Customer filters' })
    expect(bar.querySelector('.odc-filterbar-filters [data-active]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'No orders' }))
    expect(onOrderFilterChange).toHaveBeenCalledWith(0)
  })
})

describe('Verified pill', () => {
  it('writes phoneVerified and emailVerified as a complete object: null, true or false', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Verified' }))
    const box = await popup('Verified')
    const phone = within(box).getByRole('radiogroup', { name: 'Phone' })
    const email = within(box).getByRole('radiogroup', { name: 'Email' })
    expect([...within(phone).getAllByRole('radio')].map(radio => radio.textContent)).toEqual(['Any', 'Yes', 'No'])
    await user.click(within(phone).getByRole('radio', { name: 'Yes' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...INITIAL, phoneVerified: true })
    await user.click(within(email).getByRole('radio', { name: 'No' }))
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...INITIAL, phoneVerified: true, emailVerified: false })
    await user.click(within(phone).getByRole('radio', { name: 'Any' }))
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...INITIAL, emailVerified: false })
  })

  it('the pill says what it holds', () => {
    renderBar({ values: { ...INITIAL, phoneVerified: true, emailVerified: false } })
    expect(screen.getByRole('button', { name: /^Verified\s*Phone: Yes, Email: No$/ })).toBeInTheDocument()
  })
})

describe('Sign-up date pill', () => {
  beforeEach(() => {
    // Friday 9 October 2026, 15:30 local: only the clock is faked, the timers stay real
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 9, 15, 30, 0) })
  })
  afterEach(() => vi.useRealTimers())

  it('offers Any and the four presets', async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Sign up date' }))
    const box = await popup('Select a date')
    expect(within(box).getAllByRole('button').filter(button => button.hasAttribute('aria-pressed')).map(button => button.textContent))
      .toEqual(['Any', 'Today', 'Yesterday', 'Last 7 days', 'Last 30 days'])
  })

  it.each([
    ['Today', 'today', '2026-10-09 00:00:00'],
    ['Yesterday', 'yesterday', '2026-10-08 00:00:00'],
    ['Last 7 days', 'last7', '2026-10-02 00:00:00'],
    ['Last 30 days', 'last30', '2026-09-09 00:00:00']
  ])('«%s» writes one complete object with the start only, as today', async (name, dateType, from) => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Sign up date' }))
    const box = await popup('Select a date')
    await user.click(within(box).getByRole('button', { name }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).toHaveBeenCalledWith({ ...INITIAL, dateType, deliveryFromDatetime: from, deliveryEndDatetime: null })
    expect(screen.getByRole('button', { name: new RegExp(`^Sign up date\\s*${name}$`) })).toBeInTheDocument()
  })

  it('a custom range is applied once, on «Done», as term from 00:00:00 to 23:59:59, and is written in the project format', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Sign up date' }))
    const box = await popup('Select a date')
    await user.click(box.querySelector('[data-day="2026-10-02"]'))
    await user.click(box.querySelector('[data-day="2026-10-05"]'))
    expect(onMultiFilterChange).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).toHaveBeenCalledWith({
      ...INITIAL,
      dateType: 'term',
      deliveryFromDatetime: '2026-10-02 00:00:00',
      deliveryEndDatetime: '2026-10-05 23:59:59'
    })
    expect(screen.getByText('Sign up date: 02-10-2026 – 05-10-2026')).toBeInTheDocument()
  })

  it('«Any» clears the three date keys', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ values: { ...INITIAL, dateType: 'term', deliveryFromDatetime: '2026-10-02 00:00:00', deliveryEndDatetime: '2026-10-05 23:59:59' } })
    await user.click(screen.getByRole('button', { name: /^Sign up date/ }))
    const box = await popup('Select a date')
    await user.click(within(box).getByRole('button', { name: 'Any' }))
    expect(onMultiFilterChange).toHaveBeenCalledWith({ ...INITIAL, dateType: 'default' })
  })

  it('the presets take their text from their own keys, not from the shared TODAY or LAST_7_DAYS', async () => {
    const user = userEvent.setup()
    mockState.catalog = { TODAY: 'Tdoay', LAST_7_DAYS: 'Last 7 dyas' }
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Sign up date' }))
    const box = await popup('Select a date')
    expect(within(box).getByRole('button', { name: 'Today' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
  })
})

describe('Loyalty level pill', () => {
  it('lists Any and each level, and writes the id of the level (a number) or null', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Loyalty level' }))
    const box = await popup('Loyalty level')
    const group = within(box).getByRole('radiogroup', { name: 'Loyalty level' })
    expect(within(group).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Any', 'Gold', 'Silver'])
    await user.click(within(group).getByRole('radio', { name: 'Gold' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).toHaveBeenCalledWith({ ...INITIAL, loyaltyLevel: 4 })
    expect(screen.getByRole('button', { name: /^Loyalty level\s*Gold$/ })).toBeInTheDocument()
    await user.click(within(group).getByRole('radio', { name: 'Any' }))
    expect(lastWrite(onMultiFilterChange)).toEqual(INITIAL)
  })

  it('says it is loading while the levels come, and keeps the choice it holds', async () => {
    const user = userEvent.setup()
    renderBar({ levels: { loading: true, levels: [] }, values: { ...INITIAL, loyaltyLevel: 4 } })
    await user.click(screen.getByRole('button', { name: /^Loyalty level/ }))
    const box = await popup('Loyalty level')
    expect(within(box).getByText('Loading...')).toBeInTheDocument()
  })
})

describe('«Filters» button · the sheet (M-C6)', () => {
  it('is a named button, with no count when the sheet holds nothing', () => {
    renderBar()
    const button = screen.getByRole('button', { name: 'Filters' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('counts the active fields of the sheet, and only those', () => {
    renderBar({ values: { ...INITIAL, id: '3', email: 'a@', phoneVerified: true, loyaltyLevel: 4 } })
    expect(screen.getByRole('button', { name: /^Filters\s*2$/ })).toBeInTheDocument()
  })

  it('opens the sheet, and «Apply» writes a complete object through onMultiFilterChange', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ values: { ...INITIAL, phoneVerified: true } })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const box = await popup('Filters')
    await user.type(within(box).getByLabelText('Name'), 'Ana')
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).toHaveBeenCalledWith({ ...INITIAL, phoneVerified: true, name: 'Ana' })
    expect(screen.getByRole('button', { name: /^Filters\s*1$/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull())
  })
})

describe('chips and «Clear filters» (M-C7)', () => {
  const FULL = {
    ...INITIAL,
    name: 'Ana',
    ordersCount: { value: '3', condition: 'gt' },
    phoneVerified: true,
    loyaltyLevel: 4,
    dateType: 'term',
    deliveryFromDatetime: '2026-10-01 00:00:00',
    deliveryEndDatetime: '2026-10-05 23:59:59'
  }

  it('draws one chip per active value, each with its own accessible remove button', () => {
    renderBar({ values: FULL })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect([...chips.querySelectorAll('.odc-chip-text')].map(item => item.textContent)).toEqual([
      'Name: Ana',
      'Amount of orders: > 3',
      'Phone verified: Yes',
      'Sign up date: 01-10-2026 – 05-10-2026',
      'Loyalty level: Gold'
    ])
    expect(within(chips).getByRole('button', { name: 'Remove Name: Ana filter' })).toBeInTheDocument()
  })

  it('a value only ⌘K can seed is never invisible', () => {
    renderBar({ values: { ...INITIAL, cellphone: '555', enabled: false } })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(within(chips).getByText('Phone number: 555')).toBeInTheDocument()
    expect(within(chips).getByText('Status: Inactive')).toBeInTheDocument()
  })

  it('removing a chip clears that one value, writes a complete object and leaves the rest', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ values: FULL })
    await user.click(screen.getByRole('button', { name: 'Remove Name: Ana filter' }))
    expect(onMultiFilterChange).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).toHaveBeenCalledWith({ ...FULL, name: null })
    expect(screen.queryByText('Name: Ana')).toBeNull()
  })

  it('removing the date chip clears the three date keys together; the amount of orders goes back to = and empty', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ values: FULL })
    await user.click(screen.getByRole('button', { name: /^Remove Sign up date: .* filter$/ }))
    expect(lastWrite(onMultiFilterChange)).toEqual({ ...FULL, dateType: null, deliveryFromDatetime: null, deliveryEndDatetime: null })
    await user.click(screen.getByRole('button', { name: /^Remove Amount of orders: .* filter$/ }))
    expect(lastWrite(onMultiFilterChange).ordersCount).toEqual({ value: '', condition: 'eq' })
  })

  it('a chip is a partial object in, a complete one out: a controller that starts with {} still gets every key', async () => {
    const user = userEvent.setup()
    const { onMultiFilterChange } = renderBar({ values: { name: 'Ana' } })
    await user.click(screen.getByRole('button', { name: 'Remove Name: Ana filter' }))
    expect(onMultiFilterChange).toHaveBeenCalledWith(INITIAL)
  })

  it('«Clear filters» calls onClearAll once and does not write anything itself', async () => {
    const user = userEvent.setup()
    const { onClearAll, onMultiFilterChange, onSearch, onOrderFilterChange } = renderBar({ values: FULL })
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clears[clears.length - 1])
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onMultiFilterChange).not.toHaveBeenCalled()
    expect(onSearch).not.toHaveBeenCalled()
    expect(onOrderFilterChange).not.toHaveBeenCalled()
  })

  // redesign UC-R2b (Q-04): both «Clear filters» buttons unmount with the filters; the focus must not fall to <body>
  describe('focus after «Clear filters» (Q-04)', () => {
    const renderClearing = () => {
      const Harness = () => {
        const [searchValue, setSearchValue] = useState('ana')
        const [orderFilterValue, setOrder] = useState(0)
        const [multiFilterValues, setMulti] = useState(FULL)
        return (
          <CustomersFilters
            searchValue={searchValue}
            onSearch={setSearchValue}
            orderFilterValue={orderFilterValue}
            onOrderFilterChange={setOrder}
            multiFilterValues={multiFilterValues}
            onMultiFilterChange={setMulti}
            loyaltyLevels={LEVELS}
            onClearAll={() => { setSearchValue(''); setOrder(null); setMulti(INITIAL) }}
          />
        )
      }
      render(<Harness />)
    }

    it.each([
      ['the button of the bar', (clears) => clears[0]],
      ['the button of the chips', (clears) => clears[clears.length - 1]]
    ])('with %s, the focus lands in the search field, not <body>', async (_label, pick) => {
      const user = userEvent.setup()
      renderClearing()
      const clears = screen.getAllByRole('button', { name: 'Clear filters' })
      expect(clears.length).toBeGreaterThan(1)
      const button = pick(clears)
      button.focus()
      expect(document.activeElement).toBe(button)
      await user.keyboard('{Enter}')
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull())
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search name, email or phone' }))
    })
  })

  it('a search alone narrows: «Clear filters» shows, with no chips', () => {
    renderBar({ search: 'ana' })
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })

  it('an Orders option alone narrows, «No orders» (0) included', () => {
    renderBar({ order: 0 })
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('with nothing applied there is no «Clear filters» and no chips', () => {
    renderBar()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })
})
