/* eslint-disable import/first */
// redesign bi FB2 (D6; BI-10, BI-14, BI-18, BI-19; auditor 5, 6): the filter pills of the business reports. Stores, Brand, Country
// and Time zone are pills of the Product filter bar. The controllers of `main` (AnalyticsBusinessFilter, ReportsBrandFilter,
// CountryList) are used as they are and replaced here by stand-ins that hand their UIComponent what the real ones hand it, so
// what is under test is the new UI: what each pill paints, what it asks the page for, and with which options.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign reports FB2: `groups`, `drivers`, `channels` and `configs` are the stand-ins of the new pills (added; nothing above changes)
const mocks = vi.hoisted(() => ({
  stores: {},
  brands: {},
  countries: {},
  groups: {},
  drivers: {},
  channels: {},
  configs: {},
  last: {},
  mounts: {},
  // redesign the SDK and the session the store-name lookup reads (the lookup is the only thing in the bar that asks the API itself)
  lookup: { calls: [], rows: [], fail: false, level: 2 }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  // a controller stand-in: it hands its UIComponent the props it was given plus what the real one computes
  const controller = key => function Controller (props) {
    mocks.last[key] = props
    // redesign bi R1 (P-a): how many times the controller was mounted (each mount is the GET of `main`)
    react.useEffect(() => { mocks.mounts[key] = (mocks.mounts[key] ?? 0) + 1 }, [])
    const { UIComponent, ...rest } = props
    return react.createElement(UIComponent, { ...rest, ...mocks[key] })
  }
  return {
    useLanguage: () => [{}, (_key, text) => text],
    AnalyticsBusinessFilter: controller('stores'),
    ReportsBrandFilter: controller('brands'),
    CountryList: controller('countries'),
    // redesign reports FB2
    useConfig: () => [{ configs: mocks.configs }],
    ReportsDriverGroupFilter: controller('groups'),
    ReportsDriverFilter: controller('drivers'),
    ReportsAppIdFilter: controller('channels')
  }
})

// redesign the lookup reads the API and the session from their own modules
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'token-1', user: { level: mocks.lookup.level } }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test/v400/project',
    businesses: () => {
      const call = { select: null, where: null, options: null }
      const chain = {
        asDashboard: () => chain,
        select: (value) => { call.select = value; return chain },
        where: (value) => { call.where = value; return chain },
        get: async (options) => {
          call.options = options
          mocks.lookup.calls.push(call)
          if (mocks.lookup.fail) throw new Error('network')
          return { content: { error: false, result: mocks.lookup.rows } }
        }
      }
      return chain
    }
  }]
}))

// redesign reports R1 (Q-01, Q-03): EMPTY_REPORT_NAMES is the shape of the opt-in `names` prop
import { EMPTY_REPORT_NAMES, ReportFilterPills } from '../ReportFilterPills'

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const STORES = [
  { id: 1, name: 'Alpha Pizza', logo: null },
  { id: 2, name: 'Beta Burgers', logo: null },
  { id: 3, name: 'Gamma Grill', logo: null }
]
const BRANDS = [{ id: 10, name: 'Acme Foods' }, { id: 11, name: 'Zenith' }]
// redesign reports FB2
const GROUPS = [
  { id: 5, name: 'Night shift', enabled: true, drivers: [{ id: 21 }, { id: 22 }] },
  { id: 6, name: 'Day shift', enabled: true, drivers: [{ id: 23 }] }
]
const DRIVERS = [{ id: 21, name: 'Ana', lastname: 'Ruiz' }, { id: 22, name: 'Bo', lastname: '' }, { id: 23, name: 'Cy', lastname: 'Diaz' }]
const SITES = [{ id: 1, name: 'Web' }, { id: 2, name: 'App' }]
const COUNTRIES = [{ id: 1, code: 'CO', name: 'Colombia' }, { id: 2, code: 'US', name: 'United States' }]

const BASE = { lapse: 'today', businessIds: null, app_id: 'all', franchises_id: null, timeZone: BROWSER_ZONE }

const setControllers = () => {
  mocks.last = {}
  mocks.mounts = {}
  mocks.stores = {
    businessList: { loading: false, error: null, businesses: STORES, pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 3 } },
    businessIds: [],
    handleChangeBusinessId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    handleChangeBusinessPage: vi.fn(),
    handleChangeBusinessPageSize: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  mocks.brands = {
    brandList: { loading: false, error: null, brands: BRANDS, pagination: null },
    brandIds: null,
    handleChangeBrandId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
  mocks.countries = {
    countriesState: { loading: false, error: null, countries: [COUNTRIES[0]] },
    searchValue: null,
    onSearch: vi.fn(),
    handleClickFilterButton: vi.fn(),
    code: '',
    setCode: vi.fn(),
    actionState: { loading: false, error: null }
  }
  // redesign reports FB2
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
  mocks.lookup = { calls: [], rows: [], fail: false, level: 2 }
}

const bar = (overrides = {}) => {
  const handleChangeFilterList = vi.fn()
  const handleChangeCode = vi.fn()
  const props = { filterList: { ...BASE }, handleChangeFilterList, handleChangeCode, countryCode: '', ...overrides }
  const view = render(<ReportFilterPills {...props} />)
  const again = (next = {}) => view.rerender(<ReportFilterPills {...props} {...next} />)
  return { handleChangeFilterList, handleChangeCode, props, again, ...view }
}

// The exit transition of the overlays takes a moment in jsdom
const EXIT = { timeout: 4000 }
const pill = name => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const open = async (user, name) => {
  await user.click(pill(name))
  return screen.findByRole('dialog', { name })
}

// the bar's own button comes first; the chips keep a second «Clear filters» that the stylesheet hides while the bar's is there
const clearButton = () => screen.getAllByRole('button', { name: 'Clear filters' })[0]
// the text of a chip whose count is a figure node is split across nodes: read it whole
const chipText = (list) => within(list).getAllByRole('listitem').map(item => item.querySelector('.odc-chip-text')?.textContent).filter(Boolean)

beforeEach(setControllers)
afterEach(() => document.getElementById('app-modals')?.remove())

describe('ReportFilterPills · the bar', () => {
  it('is a group named «Filters» with the four pills and no «+N» menu', () => {
    bar()
    const group = screen.getByRole('group', { name: 'Filters' })
    ;['Stores', 'Brand', 'Country', 'Timezone'].forEach(name => {
      expect(within(group).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    })
    expect(document.querySelector('[data-filterbar-overflow]')).toBeNull()
    expect(screen.queryByText(/^\+\d/)).toBeNull()
  })

  // redesign the brand name no longer waits for its popover to open: the bar asks for the brand list to name the ids of the page
  it('every pill paints its value: Stores a count, Brand its name, Country its name, Time zone the zone', async () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    bar({ filterList: { ...BASE, businessIds: [1, 2], franchises_id: [10], timeZone: 'America/Bogota' }, countryCode: 'CO' })
    expect(pill('Stores')).toHaveTextContent('2')
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(pill('Country')).toHaveTextContent('Colombia')
    expect(pill('Timezone')).toHaveTextContent('America/Bogota')
  })

  it('the count of a pill is a figure node (decision 11) and a single store shows its name once it is known', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: { ...BASE, businessIds: [1, 2] } })
    expect(pill('Stores').querySelector('bdi.odc-figure')).toHaveTextContent('2')
    // the popover lists the stores, and the bar learns their names
    await open(user, 'Stores')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    again({ filterList: { ...BASE, businessIds: [2] } })
    expect(pill('Stores')).toHaveTextContent('Beta Burgers')
  })

  it('a store the bar has never seen still counts: one unknown store is «1», not its id', () => {
    bar({ filterList: { ...BASE, businessIds: [999] } })
    expect(pill('Stores').querySelector('bdi.odc-figure')).toHaveTextContent('1')
    expect(pill('Stores')).not.toHaveTextContent('999')
  })

  it('Country says «All» with no country and Time zone always says its zone', () => {
    bar()
    expect(pill('Country')).toHaveTextContent('All')
    expect(pill('Timezone')).toHaveTextContent(BROWSER_ZONE)
  })

  it('hands the Stores controller the filters of the page, franchise scoping included', async () => {
    const filterList = { ...BASE, franchises_id: [10] }
    bar({ filterList, countryCode: 'CO' })
    await open(userEvent.setup(), 'Stores')
    expect(mocks.last.stores).toMatchObject({ isFranchise: true, filterList, countryCode: 'CO', isSearchByName: true })
  })
})

describe('ReportFilterPills · Stores', () => {
  it('lists the stores of the controller as checkboxes with their name, and takes the selection from the page, not the controller', async () => {
    const user = userEvent.setup()
    mocks.stores.businessIds = [2] // the controller's own selection is not used (BI-10)
    bar({ filterList: { ...BASE, businessIds: [1] } })
    const popup = await open(user, 'Stores')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(4) // «All» of the page, then the three stores
    expect(within(popup).getByRole('checkbox', { name: 'Alpha Pizza' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('checkbox', { name: 'Beta Burgers' })).toHaveAttribute('aria-checked', 'false')
  })

  it('marking a store applies at once with a debounce, and keeps the rest of the filters', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, lapse: 'yesterday', app_id: '7', franchises_id: [10] } })
    const popup = await open(user, 'Stores')
    await user.click(within(popup).getByRole('checkbox', { name: 'Alpha Pizza' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith(
      { ...BASE, lapse: 'yesterday', app_id: '7', franchises_id: [10], businessIds: [1] },
      { debounce: true }
    )
  })

  it('adds to the stores that were already on, and unmarking the last one leaves null (BI-10: never [])', async () => {
    const user = userEvent.setup()
    const first = bar({ filterList: { ...BASE, businessIds: [1] } })
    const popup = await open(user, 'Stores')
    await user.click(within(popup).getByRole('checkbox', { name: 'Beta Burgers' }))
    expect(first.handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, businessIds: [1, 2] }, { debounce: true })
    await user.click(within(popup).getByRole('checkbox', { name: 'Alpha Pizza' }))
    expect(first.handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: null }, { debounce: true })
    expect(first.handleChangeFilterList.mock.calls.every(([next]) => next.businessIds === null || next.businessIds.length > 0)).toBe(true)
  })

  it('has no «Filter» button and never calls the controller\'s own apply or «All» (one step less than main)', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Stores')
    await user.click(within(popup).getByRole('checkbox', { name: 'Gamma Grill' }))
    await user.click(within(popup).getByRole('checkbox', { name: 'All' }))
    expect(within(popup).queryByRole('button', { name: 'Filter' })).toBeNull()
    expect(mocks.stores.handleClickFilterButton).not.toHaveBeenCalled()
    expect(mocks.stores.handleChangeAllCheck).not.toHaveBeenCalled()
    expect(mocks.stores.handleChangeBusinessId).not.toHaveBeenCalled()
  })

  // (owner decision 3 of the parity audit, 2026-10-27): main's «All» marked or unmarked every store of the visible page,
  // and the selection added up across pages
  describe('«All» of the visible page (main)', () => {
    it('marks every store of the page, after the ones already on from other pages', async () => {
      const user = userEvent.setup()
      const { handleChangeFilterList } = bar({ filterList: { ...BASE, businessIds: [9] } })
      const popup = await open(user, 'Stores')
      const all = within(popup).getByRole('checkbox', { name: 'All' })
      expect(all).toHaveAttribute('aria-checked', 'false')
      await user.click(all)
      expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: [9, 1, 2, 3] }, { debounce: true })
    })

    it('is mixed with some of the page on, and marks the rest', async () => {
      const user = userEvent.setup()
      const { handleChangeFilterList } = bar({ filterList: { ...BASE, businessIds: [2] } })
      const popup = await open(user, 'Stores')
      const all = within(popup).getByRole('checkbox', { name: 'All' })
      expect(all).toHaveAttribute('aria-checked', 'mixed')
      await user.click(all)
      expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: [2, 1, 3] }, { debounce: true })
    })

    it('with the whole page on it unmarks only the page, and an empty selection is null (BI-10)', async () => {
      const user = userEvent.setup()
      const kept = bar({ filterList: { ...BASE, businessIds: [9, 1, 2, 3] } })
      let popup = await open(user, 'Stores')
      expect(within(popup).getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'true')
      await user.click(within(popup).getByRole('checkbox', { name: 'All' }))
      expect(kept.handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: [9] }, { debounce: true })
      kept.unmount()
      const emptied = bar({ filterList: { ...BASE, businessIds: [1, 2, 3] } })
      popup = await open(user, 'Stores')
      await user.click(within(popup).getByRole('checkbox', { name: 'All' }))
      expect(emptied.handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: null }, { debounce: true })
    })

    it('is not offered while the page loads or has no stores', async () => {
      const user = userEvent.setup()
      mocks.stores.businessList = { ...mocks.stores.businessList, businesses: [] }
      bar()
      const popup = await open(user, 'Stores')
      expect(within(popup).queryByRole('checkbox', { name: 'All' })).toBeNull()
    })
  })

  it('the search goes to the server through the controller\'s onSearch, after a wait, and Enter sends it at once', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Stores')
    const search = within(popup).getByRole('searchbox', { name: 'Search Stores' })
    await user.type(search, 'alp')
    await waitFor(() => expect(mocks.stores.onSearch).toHaveBeenCalledWith('alp'), { timeout: 3000 })
    mocks.stores.onSearch.mockClear()
    await user.clear(search)
    await user.type(search, 'bet{Enter}')
    expect(mocks.stores.onSearch).toHaveBeenCalledWith('bet')
  })

  it('asks the controller for page 2 with the pager, which exists only with more than one page', async () => {
    const user = userEvent.setup()
    mocks.stores.businessList.pagination = { current_page: 1, page_size: 10, total_pages: 3, total: 25 }
    bar()
    const popup = await open(user, 'Stores')
    await user.click(within(popup).getByRole('button', { name: 'Next page' }))
    expect(mocks.stores.handleChangeBusinessPage).toHaveBeenCalledWith(2)
    expect(within(popup).getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  // redesign (regression): `main` had «Items per page» (10, 25, 50) and a button per page; with 84 stores the arrows alone
  // made page 9 eight clicks away
  describe('items per page and jumping to a page', () => {
    const MANY = { current_page: 1, page_size: 10, total_pages: 9, total: 84 }

    it('offers «Items per page» with 10, 25 and 50, and asks the controller for the size chosen', async () => {
      const user = userEvent.setup()
      mocks.stores.businessList.pagination = MANY
      bar()
      const popup = await open(user, 'Stores')
      await user.click(within(popup).getByRole('button', { name: /Items per page/ }))
      const sizes = await screen.findAllByRole('menuitemradio')
      expect(sizes.map(item => item.textContent)).toEqual(['10', '25', '50'])
      await user.click(sizes[1])
      expect(mocks.stores.handleChangeBusinessPageSize).toHaveBeenCalledWith(25)
    })

    it('has a page field, so page 9 of 9 is one entry and not eight clicks', async () => {
      const user = userEvent.setup()
      mocks.stores.businessList.pagination = MANY
      bar()
      const popup = await open(user, 'Stores')
      const field = within(popup).getByRole('textbox', { name: 'Page' })
      expect(field).toHaveValue('1')
      expect(within(popup).getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('of 9')
      await user.clear(field)
      await user.type(field, '9{Enter}')
      expect(mocks.stores.handleChangeBusinessPage).toHaveBeenCalledWith(9)
    })

    it('keeps the foot when a big page makes it one page, so the size can be taken back to 10', async () => {
      const user = userEvent.setup()
      mocks.stores.businessList.pagination = { current_page: 1, page_size: 50, total_pages: 1, total: 30 }
      bar()
      const popup = await open(user, 'Stores')
      expect(within(popup).getByRole('button', { name: /Items per page/ })).toBeInTheDocument()
    })

    // (owner decision 3, 2026-10-27): the «All» of main is back, and with many pages it still takes only the visible one
    it('with many pages, «All» takes only the stores of the visible page, as in main', async () => {
      const user = userEvent.setup()
      mocks.stores.businessList.pagination = MANY
      const { handleChangeFilterList } = bar()
      const popup = await open(user, 'Stores')
      await user.click(within(popup).getByRole('checkbox', { name: 'All' }))
      expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, businessIds: [1, 2, 3] }, { debounce: true })
    })
  })

  it('paints no pager for a single page', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Stores')
    expect(within(popup).queryByRole('navigation')).toBeNull()
  })

  it('shows skeletons while it loads, with no checkboxes', async () => {
    const user = userEvent.setup()
    mocks.stores.businessList = { ...mocks.stores.businessList, loading: true, businesses: [] }
    bar()
    const popup = await open(user, 'Stores')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(popup.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('says «No results found» for an empty answer', async () => {
    const user = userEvent.setup()
    mocks.stores.businessList = { ...mocks.stores.businessList, businesses: [] }
    bar()
    const popup = await open(user, 'Stores')
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
  })

  it('«Clear» in the popover empties the stores to null', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, businessIds: [1, 2] } })
    const popup = await open(user, 'Stores')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, businessIds: null }, { debounce: true })
  })
})

describe('ReportFilterPills · Brand', () => {
  it('lists every brand of the controller with a local search, and takes the selection from filterList.franchises_id', async () => {
    const user = userEvent.setup()
    mocks.brands.brandIds = [11] // not used
    bar({ filterList: { ...BASE, franchises_id: [10] } })
    const popup = await open(user, 'Brand')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(popup).getByRole('checkbox', { name: 'Acme Foods' })).toHaveAttribute('aria-checked', 'true')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Brand' }), 'zen')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(1)
    expect(mocks.brands.handleClickFilterButton).not.toHaveBeenCalled()
  })

  it('marking a brand applies at once with a debounce; unmarking the last leaves null', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, franchises_id: [10] } })
    const popup = await open(user, 'Brand')
    await user.click(within(popup).getByRole('checkbox', { name: 'Zenith' }))
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, franchises_id: [10, 11] }, { debounce: true })
    await user.click(within(popup).getByRole('checkbox', { name: 'Acme Foods' }))
    // the props are the page's: [10] is still on, so unchecking it empties the list
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, franchises_id: null }, { debounce: true })
  })

  it('unmarking the only brand, and «Clear», leave franchises_id null (BI-10: never [])', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, franchises_id: [10] } })
    const popup = await open(user, 'Brand')
    await user.click(within(popup).getByRole('checkbox', { name: 'Acme Foods' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, franchises_id: null }, { debounce: true })
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, franchises_id: null }, { debounce: true })
    expect(handleChangeFilterList.mock.calls.some(([next]) => Array.isArray(next.franchises_id) && next.franchises_id.length === 0)).toBe(false)
  })

  // redesign bi R1 (P-a): main mounted the brand controller with its modal, so GET franchises went out on every opening
  it('mounts the controller (its GET franchises) when the popover opens, and again on each opening, not with the pill', async () => {
    const user = userEvent.setup()
    bar()
    expect(mocks.mounts.brands).toBeUndefined()
    expect(mocks.last.brands).toBeUndefined()
    await open(user, 'Brand')
    expect(mocks.mounts.brands).toBe(1)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    await open(user, 'Brand')
    expect(mocks.mounts.brands).toBe(2)
    // the other pills do not mount it
    expect(mocks.mounts.stores).toBeUndefined()
  })

  it('hands the controller the fields it asks the API for, and the filters of the page', async () => {
    const filterList = { ...BASE, franchises_id: [10] }
    bar({ filterList })
    await open(userEvent.setup(), 'Brand')
    expect(mocks.last.brands.propsToFetch).toEqual(['id', 'name', 'enabled'])
    expect(mocks.last.brands.filterList).toBe(filterList)
  })

  it('shows skeletons while the brands load and says «No results found» for a search that finds none', async () => {
    const user = userEvent.setup()
    mocks.brands.brandList = { loading: true, error: null, brands: [], pagination: null }
    bar()
    const popup = await open(user, 'Brand')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    mocks.brands.brandList = { loading: false, error: null, brands: BRANDS, pagination: null }
    const again = await open(user, 'Brand')
    await user.type(within(again).getByRole('searchbox', { name: 'Search Brand' }), 'zzzz')
    expect(within(again).getByText('No results found')).toBeInTheDocument()
  })

  it('«Clear» appears once a brand is picked', async () => {
    const user = userEvent.setup()
    bar()
    const none = await open(user, 'Brand')
    expect(within(none).queryByRole('button', { name: 'Clear' })).toBeNull()
  })
})

describe('ReportFilterPills · Country', () => {
  beforeEach(() => {
    mocks.countries.countriesState.countries = COUNTRIES
  })

  it('opens by itself on the first load when the project has more than one country (auditor 6)', async () => {
    bar()
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    expect(pill('Country')).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens by itself when the countries arrive after the first render', async () => {
    mocks.countries.countriesState = { loading: true, error: null, countries: [] }
    const { again } = bar()
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    mocks.countries.countriesState = { loading: false, error: null, countries: COUNTRIES }
    again()
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })

  it('does not open by itself with a single country', () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    bar()
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    expect(pill('Country')).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not open again by itself after it was closed, or when the list is searched', async () => {
    const user = userEvent.setup()
    const { again } = bar()
    await screen.findByRole('dialog', { name: 'Country' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull(), EXIT)
    mocks.countries.countriesState = { loading: true, error: null, countries: [] }
    again()
    mocks.countries.countriesState = { loading: false, error: null, countries: COUNTRIES }
    again()
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
  })

  it('lists the countries as single-choice options and chooses one on the controller', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    expect(within(popup).getByRole('radiogroup', { name: 'Country' })).toBeInTheDocument()
    expect(within(popup).getAllByRole('radio')).toHaveLength(2)
    await user.click(within(popup).getByRole('radio', { name: 'United States' }))
    expect(mocks.countries.setCode).toHaveBeenCalledWith('US')
  })

  it('marks the controller\'s code as the checked option', async () => {
    mocks.countries.code = 'CO'
    bar({ countryCode: 'CO' })
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    expect(within(popup).getByRole('radio', { name: 'Colombia' })).toHaveAttribute('aria-checked', 'true')
    expect(within(popup).getByRole('radio', { name: 'United States' })).toHaveAttribute('aria-checked', 'false')
  })

  it('the arrows move between the options without choosing one', async () => {
    const user = userEvent.setup()
    mocks.countries.code = 'CO'
    bar({ countryCode: 'CO' })
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    act(() => within(popup).getByRole('radio', { name: 'Colombia' }).focus())
    await user.keyboard('{ArrowDown}')
    expect(within(popup).getByRole('radio', { name: 'United States' })).toHaveFocus()
    expect(mocks.countries.setCode).not.toHaveBeenCalledWith('US')
    await user.keyboard('{Enter}')
    expect(mocks.countries.setCode).toHaveBeenCalledWith('US')
  })

  it('«Filter» runs the controller\'s own apply (main\'s semantics, BI-19) and closes the popover', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    await user.click(within(popup).getByRole('button', { name: 'Filter' }))
    expect(mocks.countries.handleClickFilterButton).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull(), EXIT)
    await waitFor(() => expect(pill('Country')).toHaveFocus(), EXIT)
  })

  it('choosing alone applies nothing: the filter is applied with «Filter»', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList, handleChangeCode } = bar()
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    await user.click(within(popup).getByRole('radio', { name: 'United States' }))
    expect(handleChangeFilterList).not.toHaveBeenCalled()
    expect(handleChangeCode).not.toHaveBeenCalled()
  })

  it('the search goes to the server through the controller\'s onSearch', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Country' }), 'uni{Enter}')
    expect(mocks.countries.onSearch).toHaveBeenCalledWith('uni')
  })

  it('«Filter» is disabled while the countries load, and there are skeletons instead of options', async () => {
    const user = userEvent.setup()
    mocks.countries.countriesState = { loading: true, error: null, countries: [] }
    bar()
    const popup = await open(user, 'Country')
    expect(within(popup).queryAllByRole('radio')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(popup).getByRole('button', { name: 'Filter' })).toBeDisabled()
  })

  it('shows skeletons instead of options while the controller applies a country', async () => {
    mocks.countries.actionState = { loading: true, error: null }
    bar()
    const popup = await screen.findByRole('dialog', { name: 'Country' })
    expect(within(popup).queryAllByRole('radio')).toHaveLength(0)
    expect(popup.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })

  it('says «No results found» when a search finds no country', async () => {
    mocks.countries.countriesState = { loading: false, error: null, countries: [] }
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Country')
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
  })

  it('on opening it puts the controller\'s code back to the active country (a stale choice is not kept)', async () => {
    mocks.countries.code = 'US'
    bar({ countryCode: 'CO' })
    await screen.findByRole('dialog', { name: 'Country' })
    expect(mocks.countries.setCode).toHaveBeenCalledWith('CO')
  })

  it('the pill says the name of the active country', () => {
    bar({ countryCode: 'US' })
    expect(pill('Country')).toHaveTextContent('United States')
  })
})

describe('ReportFilterPills · Time zone', () => {
  it('lists the zones of the project as single-choice options, with a local search', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Timezone')
    expect(within(popup).getByRole('radiogroup', { name: 'Timezone' })).toBeInTheDocument()
    expect(within(popup).getAllByRole('radio').length).toBeGreaterThan(100)
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Timezone' }), 'bogota')
    expect(within(popup).getAllByRole('radio')).toHaveLength(1)
    expect(within(popup).getByRole('radio', { name: 'America/Bogota' })).toBeInTheDocument()
  })

  it('choosing a zone applies it and closes the popover (BI-18), keeping the rest of the filters', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, lapse: 'last_7', businessIds: [1] } })
    const popup = await open(user, 'Timezone')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Timezone' }), 'bogota')
    await user.click(within(popup).getByRole('radio', { name: 'America/Bogota' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, lapse: 'last_7', businessIds: [1], timeZone: 'America/Bogota' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Timezone' })).toBeNull(), EXIT)
    await waitFor(() => expect(pill('Timezone')).toHaveFocus(), EXIT)
  })

  it('the active zone is the checked option and has the tab stop', async () => {
    const user = userEvent.setup()
    bar({ filterList: { ...BASE, timeZone: 'America/New_York' } })
    const popup = await open(user, 'Timezone')
    // the list has ~400 zones: a role query by name computes the accessible name of every one of them (seconds on a loaded CI
    // runner), so the radios are found by state or by text and their name is checked on that one node
    const active = within(popup).getByRole('radio', { checked: true })
    expect(active).toHaveAccessibleName('America/New_York')
    expect(active).toHaveAttribute('tabindex', '0')
    const other = within(popup).getByText('America/Bogota').closest('[role="radio"]')
    expect(other).toHaveAccessibleName('America/Bogota')
    expect(other).toHaveAttribute('aria-checked', 'false')
    expect(other).toHaveAttribute('tabindex', '-1')
  })

  it('the keyboard chooses with Enter and closes', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar()
    const popup = await open(user, 'Timezone')
    const search = within(popup).getByRole('searchbox', { name: 'Search Timezone' })
    await user.type(search, 'madrid')
    await user.keyboard('{ArrowDown}')
    expect(within(popup).getByRole('radio', { name: 'Europe/Madrid' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, timeZone: 'Europe/Madrid' })
  })

  it('says «No results found» when the search finds no zone', async () => {
    const user = userEvent.setup()
    bar()
    const popup = await open(user, 'Timezone')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search Timezone' }), 'zzzzzz')
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
  })
})

describe('ReportFilterPills · chips and «Clear filters»', () => {
  it('has no chips and no «Clear filters» with the default filters', () => {
    bar()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'Clear filters' })).toHaveLength(0)
  })

  it('draws one chip per active value (the period and the channel are not here) and each removes its own value', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, lapse: 'yesterday', app_id: '7', businessIds: [1, 2], franchises_id: [10], timeZone: 'America/Bogota' }
    const { handleChangeFilterList, handleChangeCode } = bar({ filterList, countryCode: 'CO' })
    // redesign bi R1 (P-a): the brand name is known once its list was on screen
    await open(user, 'Brand')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    const chips = screen.getByRole('list', { name: 'Active filters' })
    // redesign bi R1 (P-c): the stores the bar has not seen are one chip («2 stores»), never their ids; the brand and the country have names
    expect(within(chips).getAllByRole('button', { name: /^Remove / })).toHaveLength(4)
    expect(chipText(chips)).toContain('2 stores')
    expect(within(chips).getByText('Brand: Acme Foods')).toBeInTheDocument()
    expect(within(chips).getByText('Timezone: America/Bogota')).toBeInTheDocument()
    expect(within(chips).queryByText(/yesterday|7/i)).toBeNull()

    await user.click(within(chips).getByRole('button', { name: 'Remove Brand Acme Foods filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, franchises_id: null }, { debounce: true })
    await user.click(within(chips).getByRole('button', { name: 'Remove Timezone America/Bogota filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, timeZone: BROWSER_ZONE })
    await user.click(within(chips).getByRole('button', { name: 'Remove 2 stores filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, businessIds: null }, { debounce: true })
    await user.click(within(chips).getByRole('button', { name: 'Remove Country Colombia filter' }))
    expect(handleChangeCode).toHaveBeenCalledWith('')
  })

  it('«Clear filters» goes back to the defaults: no stores, no brands, the browser zone and no country; period and channel stay', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, lapse: 'last_30', app_id: '7', businessIds: [1, 2], franchises_id: [10], timeZone: 'America/Bogota' }
    const { handleChangeFilterList, handleChangeCode } = bar({ filterList, countryCode: 'CO' })
    await user.click(clearButton())
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...filterList, businessIds: null, franchises_id: null, timeZone: BROWSER_ZONE })
    expect(handleChangeCode).toHaveBeenCalledWith('')
  })

  it('«Clear filters» leaves the country alone when there was none', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList, handleChangeCode } = bar({ filterList: { ...BASE, franchises_id: [10] } })
    await user.click(clearButton())
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, businessIds: null, franchises_id: null, timeZone: BROWSER_ZONE })
    expect(handleChangeCode).not.toHaveBeenCalled()
  })

  it('a changed zone alone is a filter: it shows «Clear filters»', () => {
    bar({ filterList: { ...BASE, timeZone: 'Asia/Tokyo' } })
    expect(clearButton()).toBeInTheDocument()
  })
})

// redesign bi R1 (P-c): the stores a country brought (level 2) have no name the bar knows; they never show an id
describe('ReportFilterPills · the chip of stores without a known name', () => {
  const chipList = () => screen.getByRole('list', { name: 'Active filters' })

  it('groups them in one chip, «_count_ stores», with the count as a figure node, and shows no id', () => {
    bar({ filterList: { ...BASE, businessIds: [101, 102, 103] } })
    expect(chipText(chipList())).toEqual(['3 stores'])
    expect(chipList().querySelector('.odc-chip-text bdi.odc-figure')).toHaveTextContent('3')
    expect(chipList().textContent).not.toMatch(/101|102|103/)
  })

  it('one store is «1 store» (the ONE form), and its × is named after the chip', () => {
    bar({ filterList: { ...BASE, businessIds: [101] } })
    expect(chipText(chipList())).toEqual(['1 store'])
    expect(within(chipList()).getByRole('button', { name: 'Remove 1 store filter' })).toBeInTheDocument()
  })

  it('its × removes all of them at once, with the usual debounce, leaving null (never [])', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, businessIds: [101, 102, 103] } })
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 3 stores filter' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, businessIds: null }, { debounce: true })
  })

  it('stores with a known name keep their own chip; only the unknown ones are grouped, and the group removes only them', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, businessIds: [1, 998, 999] }
    const { handleChangeFilterList } = bar({ filterList })
    // the popover lists the stores, and the bar learns their names
    await open(user, 'Stores')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    expect(chipText(chipList())).toEqual(['Stores: Alpha Pizza', '2 stores'])
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 2 stores filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, businessIds: [1] }, { debounce: true })
  })
})

// redesign bi R1 (F2): when the last chip or «Clear filters» takes its own control away the focus goes to the first pill, never to <body>
describe('ReportFilterPills · focus after removing the filters', () => {
  const TOKYO = { ...BASE, timeZone: 'Asia/Tokyo' }

  it('removing the last chip with its × puts the focus on the first pill (Stores)', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: TOKYO })
    await user.click(screen.getByRole('button', { name: 'Remove Timezone Asia/Tokyo filter' }))
    again({ filterList: BASE }) // the page applies the zone and the bar has no filter left
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(document.activeElement).not.toBe(document.body)
    expect(pill('Stores')).toHaveFocus()
  })

  it('«Clear filters» of the bar puts the focus on the first pill', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: TOKYO })
    await user.click(clearButton())
    again({ filterList: BASE })
    expect(screen.queryAllByRole('button', { name: 'Clear filters' })).toHaveLength(0)
    expect(pill('Stores')).toHaveFocus()
  })

  it('«Clear filters» of the chips does the same', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: TOKYO })
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[1])
    again({ filterList: BASE })
    expect(pill('Stores')).toHaveFocus()
  })

  it('with chips left it goes to the next chip, or the previous one when it was the last', async () => {
    const user = userEvent.setup()
    const filterList = { ...TOKYO, franchises_id: [10] }
    const { again } = bar({ filterList, countryCode: 'CO' })
    // chips in order: brand, country, zone
    await user.click(screen.getByRole('button', { name: 'Remove Country Colombia filter' }))
    again({ filterList, countryCode: '' })
    expect(screen.getByRole('button', { name: 'Remove Timezone Asia/Tokyo filter' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Remove Timezone Asia/Tokyo filter' }))
    again({ filterList: { ...filterList, timeZone: BROWSER_ZONE }, countryCode: '' })
    expect(screen.getByRole('button', { name: /^Remove Brand .* filter$/ })).toHaveFocus()
  })

  it('does not take the focus away from where the user already is', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: TOKYO })
    await user.click(screen.getByRole('button', { name: 'Remove Timezone Asia/Tokyo filter' }))
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    again({ filterList: BASE })
    expect(elsewhere).toHaveFocus()
    elsewhere.remove()
  })
})

// ---- redesign reports FB2 (D4, D5; RP-10, RP-18, RP-21; auditor 6, 7, 12) --------------------------------------------------------------
// The opt-in props of the 21 reports. Everything above runs without them and must stay as it is.

const ALL_PILLS = ['stores', 'brand', 'country', 'zone', 'driverGroup', 'driver', 'orderType', 'channel']
const LABEL = /^(Driver group|Driver|Order type|Channel|Stores|Brand|Country|Timezone)/
const DRIVER = /^Driver(?! group)/
const DRIVER_GROUP = /^Driver group/
// what each pill of the bar says first, in order
const pillOrder = () => within(screen.getByRole('group', { name: 'Filters' }))
  .getAllByRole('button')
  .map(node => node.textContent.match(LABEL)?.[1])
const openBy = async (user, name, dialog) => {
  await user.click(screen.getByRole('button', { name }))
  return screen.findByRole('dialog', { name: dialog })
}
const closeDialog = async (user, dialog) => {
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog', { name: dialog })).toBeNull(), EXIT)
}

describe('ReportFilterPills · the pills prop (FB2)', () => {
  it('without it, the four pills of Business in their order', () => {
    bar()
    expect(pillOrder()).toEqual(['Stores', 'Brand', 'Country', 'Timezone'])
  })

  it('paints only the pills it lists, in its order (report 21: group, driver, stores, zone)', () => {
    bar({ pills: ['driverGroup', 'driver', 'stores', 'zone'] })
    expect(pillOrder()).toEqual(['Driver group', 'Driver', 'Stores', 'Timezone'])
    expect(screen.queryByRole('button', { name: /^Brand/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Country/ })).toBeNull()
  })

  it('knows the eight pills', () => {
    bar({ pills: ALL_PILLS })
    expect(pillOrder()).toEqual(['Stores', 'Brand', 'Country', 'Timezone', 'Driver group', 'Driver', 'Order type', 'Channel'])
  })

  it('puts the node of `leading` (the period pill of the page) before the pills, in the same bar', () => {
    bar({ pills: ['brand', 'zone'], leading: <button type='button' data-testid='period'>Today</button> })
    const group = screen.getByRole('group', { name: 'Filters' })
    const lead = within(group).getByTestId('period')
    expect(lead.compareDocumentPosition(within(group).getByRole('button', { name: /^Brand/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('ReportFilterPills · storesByBrand (FB2, report 10)', () => {
  it('false: the Stores controller is not scoped by the brand (no franchise filter reaches it)', async () => {
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: ['stores', 'zone'], storesByBrand: false })
    await open(userEvent.setup(), 'Stores')
    expect(mocks.last.stores.isFranchise).toBeFalsy()
    expect(mocks.last.stores.filterList.franchises_id).toBeFalsy()
  })

  it('true (the default) keeps the franchise scoping of Business', async () => {
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: ['stores', 'brand', 'zone'] })
    await open(userEvent.setup(), 'Stores')
    expect(mocks.last.stores.isFranchise).toBe(true)
    expect(mocks.last.stores.filterList.franchises_id).toEqual([10])
  })
})

describe('ReportFilterPills · driversByGroup (FB2, reports 7, 9, 10, 11, 12, 21)', () => {
  const PILLS = ['driverGroup', 'driver', 'zone']
  // the bar learns who is in each group when the group list was on screen
  const seeGroups = async (user) => {
    await openBy(user, DRIVER_GROUP, 'Driver group')
    await closeDialog(user, 'Driver group')
  }

  it('by default the driver list is scoped by the groups chosen (availableDriverIds of main)', async () => {
    const user = userEvent.setup()
    bar({ filterList: { ...BASE, driver_groups_ids: [5] }, pills: PILLS })
    await seeGroups(user)
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toEqual([21, 22])
  })

  it('several groups add their drivers, each once', async () => {
    const user = userEvent.setup()
    mocks.groups.driverGroupList.driverGroups = [
      { id: 5, name: 'Night shift', enabled: true, drivers: [{ id: 21 }, { id: 22 }] },
      { id: 6, name: 'Day shift', enabled: true, drivers: [{ id: 22 }, { id: 23 }] }
    ]
    bar({ filterList: { ...BASE, driver_groups_ids: [5, 6] }, pills: PILLS })
    await seeGroups(user)
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toEqual([21, 22, 23])
  })

  // redesign (row 5): report 12 no longer opts out; the opt-out stays a prop of the bar
  it('false: the list is not scoped (the opt-out)', async () => {
    const user = userEvent.setup()
    bar({ filterList: { ...BASE, driver_groups_ids: [5] }, pills: PILLS, driversByGroup: false })
    await seeGroups(user)
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toBeUndefined()
  })

  it('no group chosen: not scoped; a group the bar has not seen yet: not scoped either (it cannot know its drivers)', async () => {
    const user = userEvent.setup()
    const none = bar({ pills: PILLS })
    await seeGroups(user)
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toBeUndefined()
    none.unmount()
    mocks.last = {}
    bar({ filterList: { ...BASE, driver_groups_ids: [5] }, pills: PILLS })
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toBeUndefined()
  })
})

describe('ReportFilterPills · countryWhenMany (FB2, auditor 6)', () => {
  it('true with a single country: no Country pill (as main hides its button)', () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    bar({ countryWhenMany: true })
    expect(screen.queryByRole('button', { name: /^Country/ })).toBeNull()
    expect(pillOrder()).toEqual(['Stores', 'Brand', 'Timezone'])
  })

  it('true with two countries: the pill is there and opens by itself, as today', async () => {
    mocks.countries.countriesState.countries = COUNTRIES
    bar({ countryWhenMany: true })
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    expect(pill('Country')).toBeInTheDocument()
  })

  it('false (the default) keeps the pill with a single country', () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    bar()
    expect(pill('Country')).toBeInTheDocument()
  })
})

// redesign (row 3, review F-3): a country code that came with the address is dropped when the project does not have it, on the
// first load of the countries (a search that narrows the list later drops nothing)
describe('ReportFilterPills · a country the project does not have (review F-3)', () => {
  it('is dropped once the countries load, with or without the pill', async () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    const { handleChangeCode } = bar({ countryWhenMany: true, countryCode: 'MX' })
    await waitFor(() => expect(handleChangeCode).toHaveBeenCalledWith(''))
  })

  it('a country of the project stays, whatever its case', () => {
    mocks.countries.countriesState.countries = COUNTRIES
    const kept = bar({ countryOpensItself: false, countryCode: 'CO' })
    expect(kept.handleChangeCode).not.toHaveBeenCalled()
    cleanup()
    const lower = bar({ countryOpensItself: false, countryCode: 'us' })
    expect(lower.handleChangeCode).not.toHaveBeenCalled()
  })

  it('waits for the countries: nothing is dropped while they load', () => {
    mocks.countries.countriesState = { loading: true, error: null, countries: [] }
    const { handleChangeCode } = bar({ countryCode: 'MX' })
    expect(handleChangeCode).not.toHaveBeenCalled()
  })
})

// redesign (D-21 option B): the country opens by itself only the first time of a visit, on the pages that say so
describe('ReportFilterPills · countryOpensItself (D-21)', () => {
  beforeEach(() => {
    mocks.countries.countriesState.countries = COUNTRIES
  })

  it('by default it opens by itself and tells the page, once, that it did', async () => {
    const onCountryOpened = vi.fn()
    bar({ countryWhenMany: true, onCountryOpened })
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    await waitFor(() => expect(onCountryOpened).toHaveBeenCalledTimes(1))
  })

  it('false: with several countries the pill is there, closed, and the page is not told it opened', async () => {
    const onCountryOpened = vi.fn()
    bar({ countryWhenMany: true, countryOpensItself: false, onCountryOpened })
    expect(pill('Country')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    expect(onCountryOpened).not.toHaveBeenCalled()
  })

  it('false: the closed pill still opens by hand, and shows the countries', async () => {
    const user = userEvent.setup()
    bar({ countryWhenMany: true, countryOpensItself: false })
    const popup = await open(user, 'Country')
    expect(within(popup).getByRole('radio', { name: 'Colombia' })).toBeInTheDocument()
  })

  it('false: with a single country and countryWhenMany there is still no pill', () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    bar({ countryWhenMany: true, countryOpensItself: false })
    expect(screen.queryByRole('button', { name: /^Country/ })).toBeNull()
  })

  it('false without countryWhenMany does not depend on countryWhenMany: the pill stays closed too', () => {
    bar({ countryOpensItself: false })
    expect(pill('Country')).toHaveAttribute('aria-expanded', 'false')
  })

  it('a single country never tells the page that it opened', () => {
    mocks.countries.countriesState.countries = [COUNTRIES[0]]
    const onCountryOpened = vi.fn()
    bar({ onCountryOpened })
    expect(onCountryOpened).not.toHaveBeenCalled()
  })
})

describe('ReportFilterPills · the new pills apply at once (RP-10)', () => {
  it('marking a driver applies { drivers_ids: [id] } with a debounce; unmarking the last leaves null, never []', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList, again, props } = bar({ pills: ['driver', 'zone'] })
    const popup = await openBy(user, DRIVER, 'Driver')
    await user.click(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, drivers_ids: [21] }, { debounce: true })
    // the page applied it: now Ana is on and unchecking her empties the list
    again({ filterList: { ...props.filterList, drivers_ids: [21] } })
    await user.click(within(screen.getByRole('dialog', { name: 'Driver' })).getByRole('checkbox', { name: 'Ana Ruiz' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, drivers_ids: null }, { debounce: true })
    expect(handleChangeFilterList.mock.calls.some(([next]) => Array.isArray(next.drivers_ids) && next.drivers_ids.length === 0)).toBe(false)
  })

  it('a group, an order type and a channel do the same with their own keys', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ pills: ['driverGroup', 'orderType', 'channel'] })
    await user.click(within(await openBy(user, DRIVER_GROUP, 'Driver group')).getByRole('checkbox', { name: 'Day shift' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, driver_groups_ids: [6] }, { debounce: true })
    await closeDialog(user, 'Driver group')
    await user.click(within(await openBy(user, /^Order type/, 'Order type')).getByRole('checkbox', { name: 'Eat in' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, delivery_types_ids: [3] }, { debounce: true })
    await closeDialog(user, 'Order type')
    await user.click(within(await openBy(user, /^Channel/, 'Channel')).getByRole('checkbox', { name: 'App' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, app_ids: [2] }, { debounce: true })
  })

  it('the pill says the name of one value and the count of several (a figure node)', () => {
    bar({ filterList: { ...BASE, delivery_types_ids: [2], drivers_ids: [21, 22] }, pills: ['orderType', 'driver', 'zone'] })
    expect(screen.getByRole('button', { name: /^Order type/ })).toHaveTextContent('Pickup')
    expect(screen.getByRole('button', { name: DRIVER }).querySelector('bdi.odc-figure')).toHaveTextContent('2')
  })
})

describe('ReportFilterPills · chips and «Clear filters» of the new pills (FB2)', () => {
  const chipList = () => screen.getByRole('list', { name: 'Active filters' })
  const PILLS = ['driverGroup', 'driver', 'orderType', 'channel', 'zone']
  const FILTERS = { ...BASE, driver_groups_ids: [5], drivers_ids: [21, 99], delivery_types_ids: [1], app_ids: [7] }

  it('a chip per value; a name that is not known reads as a count (_count_), the order types always have theirs', () => {
    bar({ filterList: FILTERS, pills: PILLS })
    expect(chipText(chipList())).toEqual(['1 driver group', '2 drivers', 'Order type: Delivery', '1 channel'])
    expect(chipList().textContent).not.toMatch(/\b(5|21|99|7)\b/)
    expect(within(chipList()).getByRole('button', { name: 'Remove 1 driver group filter' })).toBeInTheDocument()
    expect(within(chipList()).getByRole('button', { name: 'Remove 2 drivers filter' })).toBeInTheDocument()
  })

  it('a name the bar has seen reads as the name', async () => {
    const user = userEvent.setup()
    bar({ filterList: { ...FILTERS, drivers_ids: [21] }, pills: PILLS })
    await openBy(user, DRIVER_GROUP, 'Driver group')
    await closeDialog(user, 'Driver group')
    await openBy(user, DRIVER, 'Driver')
    await closeDialog(user, 'Driver')
    expect(chipText(chipList())).toEqual(['Driver group: Night shift', 'Driver: Ana Ruiz', 'Order type: Delivery', '1 channel'])
  })

  it('each × removes its own value and leaves null (never [])', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: FILTERS, pills: PILLS })
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 1 driver group filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...FILTERS, driver_groups_ids: null }, { debounce: true })
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 2 drivers filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...FILTERS, drivers_ids: null }, { debounce: true })
    await user.click(within(chipList()).getByRole('button', { name: 'Remove Order type Delivery filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...FILTERS, delivery_types_ids: null }, { debounce: true })
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 1 channel filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...FILTERS, app_ids: null }, { debounce: true })
  })

  it('a value of a pill the report does not show has no chip and does not make «Clear filters» appear', () => {
    bar({ filterList: { ...BASE, drivers_ids: [21], delivery_types_ids: [1] }, pills: ['stores', 'zone'] })
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'Clear filters' })).toHaveLength(0)
  })

  it('«Clear filters» of a report nulls every filter key of the page, also those of pills it does not show (D4); from and to stay', async () => {
    const user = userEvent.setup()
    const filterList = {
      ...BASE,
      from: '2026-10-01',
      to: '2026-10-07',
      businessIds: [1],
      drivers_ids: [21],
      driver_companies_ids: [3],
      driver_groups_ids: [5],
      delivery_types_ids: [1],
      app_ids: [7],
      franchises_id: [10],
      timeZone: 'America/Bogota'
    }
    const { handleChangeFilterList, handleChangeCode } = bar({ filterList, pills: ['stores', 'zone'], countryCode: 'CO' })
    await user.click(clearButton())
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({
      ...filterList,
      businessIds: null,
      drivers_ids: null,
      franchises_id: null,
      driver_companies_ids: null,
      driver_groups_ids: null,
      delivery_types_ids: null,
      app_ids: null,
      timeZone: BROWSER_ZONE
    })
    expect(handleChangeCode).toHaveBeenCalledWith('')
  })

  it('without `pills`, «Clear filters» touches only the four keys of Business (nothing else is added)', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, businessIds: [1] } })
    await user.click(clearButton())
    const [next] = handleChangeFilterList.mock.calls[0]
    expect(Object.keys(next).sort()).toEqual(['app_id', 'businessIds', 'franchises_id', 'lapse', 'timeZone'])
  })
})

// ---- redesign reports R1 (Q-01, Q-02, Q-03) -----------------------------------------------------------------------------------------------
// The page mounts the bar once per report (`key={report.id}`), so what the bar has learned must be able to live outside it: the opt-in
// `names` / `onNamesChange` props. And «Clear filters» of the page's reports is the page's own function: `onClearFilters`.

// a host that keeps the names as the page does, and can mount the bar again (a change of report)
const Host = ({ initial = EMPTY_REPORT_NAMES, onNames, ...props }) => {
  const [names, setNames] = React.useState(initial)
  const [mount, setMount] = React.useState(0)
  return (
    <>
      <button type='button' onClick={() => setMount(current => current + 1)}>Remount bar</button>
      <ReportFilterPills
        key={mount}
        {...props}
        names={names}
        onNamesChange={(next) => { onNames?.(next); setNames(next) }}
      />
    </>
  )
}
const hostProps = (overrides = {}) => ({
  filterList: { ...BASE },
  handleChangeFilterList: vi.fn(),
  handleChangeCode: vi.fn(),
  countryCode: '',
  ...overrides
})

describe('ReportFilterPills · names and onNamesChange (R1, Q-01, Q-03)', () => {
  it('reads the names it is given instead of its own memory: the brand pill and chip say the name with nothing opened', () => {
    bar({
      filterList: { ...BASE, franchises_id: [10] },
      pills: ['brand', 'zone'],
      names: { ...EMPTY_REPORT_NAMES, brands: { 10: 'Acme Foods' } },
      onNamesChange: vi.fn()
    })
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Brand: Acme Foods'])
  })

  it('tells what it learns with onNamesChange(next): the whole object, in the same shape, with the new names', async () => {
    const user = userEvent.setup()
    const onNamesChange = vi.fn()
    bar({ pills: ['brand', 'driverGroup', 'zone'], names: EMPTY_REPORT_NAMES, onNamesChange })
    await open(user, 'Brand')
    expect(onNamesChange).toHaveBeenCalled()
    expect(onNamesChange.mock.calls.at(-1)[0]).toEqual({ ...EMPTY_REPORT_NAMES, brands: { 10: 'Acme Foods', 11: 'Zenith' } })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    // the object it was given is not changed in place
    expect(EMPTY_REPORT_NAMES.brands).toEqual({})
  })

  it('a name that is already known is not news: no onNamesChange when the same list comes again', async () => {
    const user = userEvent.setup()
    const onNamesChange = vi.fn()
    bar({
      pills: ['brand', 'zone'],
      names: { ...EMPTY_REPORT_NAMES, brands: { 10: 'Acme Foods', 11: 'Zenith' } },
      onNamesChange
    })
    await open(user, 'Brand')
    expect(onNamesChange).not.toHaveBeenCalled()
  })

  it('mounted again with the same names (a change of report), the pill and the chip keep the name of the brand', async () => {
    const user = userEvent.setup()
    render(<Host {...hostProps({ filterList: { ...BASE, franchises_id: [10] }, pills: ['brand', 'zone'] })} />)
    // redesign the first bar names the brand by asking for the list once
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(mocks.mounts.brands).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Remount bar' }))
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Brand: Acme Foods'])
    // the page kept the name, so the new bar asks for nothing
    expect(mocks.mounts.brands).toBe(1)
  })

  it('mounted again with the same names, the list of drivers is still scoped by the group chosen (availableDriverIds)', async () => {
    const user = userEvent.setup()
    render(<Host {...hostProps({ filterList: { ...BASE, driver_groups_ids: [5] }, pills: ['driverGroup', 'driver', 'zone'] })} />)
    await openBy(user, DRIVER_GROUP, 'Driver group')
    await closeDialog(user, 'Driver group')
    await user.click(screen.getByRole('button', { name: 'Remount bar' }))
    await openBy(user, DRIVER, 'Driver')
    expect(mocks.last.drivers.availableDriverIds).toEqual([21, 22])
  })

  it('without the props the memory is the bar\'s own, as before: mounted again it forgets (Business does not pass them)', () => {
    const view = bar({ filterList: { ...BASE, franchises_id: [10] }, pills: ['brand', 'zone'] })
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(mocks.mounts.brands).toBe(1)
    view.unmount()
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: ['brand', 'zone'] })
    // redesign it forgot, and the new bar asks for the list again to name the brand
    expect(mocks.mounts.brands).toBe(2)
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
  })
})

describe('ReportFilterPills · the chip of a brand without a known name (R1, Q-01)', () => {
  const chipList = () => screen.getByRole('list', { name: 'Active filters' })

  it('in a report (with `pills`) one brand is «1 brand», never its id; its × is named after the chip and removes it', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, franchises_id: [34] }
    const { handleChangeFilterList } = bar({ filterList, pills: ['stores', 'brand', 'zone'] })
    expect(chipText(chipList())).toEqual(['1 brand'])
    expect(chipList().querySelector('.odc-chip-text bdi.odc-figure')).toHaveTextContent('1')
    expect(chipList().textContent).not.toMatch(/34/)
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 1 brand filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, franchises_id: null }, { debounce: true })
  })

  it('several are one chip, «2 brands», whose × removes all of them; a known one keeps its own chip', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, franchises_id: [10, 34, 35] }
    const { handleChangeFilterList } = bar({ filterList, pills: ['brand', 'zone'], names: { ...EMPTY_REPORT_NAMES, brands: { 10: 'Acme Foods' } }, onNamesChange: vi.fn() })
    expect(chipText(chipList())).toEqual(['Brand: Acme Foods', '2 brands'])
    await user.click(within(chipList()).getByRole('button', { name: 'Remove 2 brands filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, franchises_id: [10] }, { debounce: true })
  })

  // redesign id 34 is not in the brand list (a brand that was disabled or deleted); Business keeps its chip as it was
  it('in Business (no `pills`) the chip is the one it has always been', () => {
    bar({ filterList: { ...BASE, franchises_id: [34] } })
    expect(chipText(chipList())).toEqual(['Brand: 34'])
  })
})

// redesign a link that comes with `stores=2` / `brands=1` (shared, or a reload) has ids and no names, because the lists are only
// asked for when a popover opens. The bar asks once for what it needs to name them; nothing is asked when every id is already named.
describe('ReportFilterPills · names of the ids that come with the page', () => {
  const chipList = () => screen.getByRole('list', { name: 'Active filters' })
  const REPORT = ['stores', 'brand', 'zone']

  it('a brand id with no name is resolved from the brand list: the pill and the chip say the name, nothing opened', async () => {
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: REPORT })
    expect(mocks.mounts.brands).toBe(1)
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(chipText(chipList())).toEqual(['Brand: Acme Foods'])
  })

  it('asks for the brand list once, however many ids are unnamed, and not at all when they are all named', () => {
    bar({ filterList: { ...BASE, franchises_id: [10, 11] }, pills: REPORT })
    expect(mocks.mounts.brands).toBe(1)
    expect(pill('Brand')).toHaveTextContent('2')
    expect(chipText(chipList())).toEqual(['Brand: Acme Foods', 'Brand: Zenith'])
    cleanup()
    mocks.mounts = {}
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: REPORT, names: { ...EMPTY_REPORT_NAMES, brands: { 10: 'Acme Foods' } }, onNamesChange: vi.fn() })
    expect(mocks.mounts.brands).toBeUndefined()
  })

  it('a brand that is not in the list is never shown by its id: it stays a count, and the list is not asked again', () => {
    const { again } = bar({ filterList: { ...BASE, franchises_id: [34] }, pills: REPORT })
    expect(mocks.mounts.brands).toBe(1)
    expect(pill('Brand').querySelector('bdi.odc-figure')).toHaveTextContent('1')
    expect(pill('Brand')).not.toHaveTextContent('34')
    expect(chipText(chipList())).toEqual(['1 brand'])
    again({ filterList: { ...BASE, franchises_id: [34, 35] } })
    expect(mocks.mounts.brands).toBe(1)
  })

  it('in Business (no `pills`) the brand of the link is named too', () => {
    bar({ filterList: { ...BASE, franchises_id: [10] } })
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(chipText(chipList())).toEqual(['Brand: Acme Foods'])
  })

  it('the brand list is not asked for when the report has no Brand pill', () => {
    bar({ filterList: { ...BASE, franchises_id: [10] }, pills: ['stores', 'zone'] })
    expect(mocks.mounts.brands).toBeUndefined()
  })

  it('a store id with no name is looked up by id (id and name only) and named in the pill and the chip', async () => {
    mocks.lookup.rows = [{ id: 2, name: 'Beta Burgers' }]
    bar({ filterList: { ...BASE, businessIds: [2] }, pills: REPORT })
    await waitFor(() => expect(pill('Stores')).toHaveTextContent('Beta Burgers'))
    expect(mocks.lookup.calls).toHaveLength(1)
    expect(mocks.lookup.calls[0].select).toEqual(['id', 'name'])
    expect(mocks.lookup.calls[0].where).toEqual({ conditions: [{ attribute: 'id', value: 2 }], conector: 'OR' })
    expect(mocks.lookup.calls[0].options).toEqual({ query: { page: 1, page_size: 1 } })
    expect(chipText(chipList())).toEqual(['Stores: Beta Burgers'])
  })

  it('several unnamed stores go in one request; the ones it finds are named and the rest stay one count', async () => {
    mocks.lookup.rows = [{ id: 2, name: 'Beta Burgers' }]
    bar({ filterList: { ...BASE, businessIds: [2, 999] }, pills: REPORT })
    await waitFor(() => expect(chipText(chipList())).toEqual(['Stores: Beta Burgers', '1 store']))
    expect(mocks.lookup.calls).toHaveLength(1)
    expect(mocks.lookup.calls[0].where.conditions.map(condition => condition.value)).toEqual([2, 999])
    expect(chipList().textContent).not.toMatch(/999/)
  })

  it('shows the count while the lookup is on its way, and keeps it when the lookup fails (no id as a name, no crash)', async () => {
    mocks.lookup.fail = true
    bar({ filterList: { ...BASE, businessIds: [2] }, pills: REPORT })
    expect(pill('Stores').querySelector('bdi.odc-figure')).toHaveTextContent('1')
    await waitFor(() => expect(mocks.lookup.calls).toHaveLength(1))
    expect(chipText(chipList())).toEqual(['1 store'])
  })

  it('asks nothing for a store the bar already knows, and asks only once for one nobody can name', async () => {
    const { again } = bar({ filterList: { ...BASE, businessIds: [1] }, pills: REPORT, names: { ...EMPTY_REPORT_NAMES, stores: { 1: 'Alpha Pizza' } }, onNamesChange: vi.fn() })
    expect(mocks.lookup.calls).toHaveLength(0)
    again({ filterList: { ...BASE, businessIds: [1, 999] } })
    await waitFor(() => expect(mocks.lookup.calls).toHaveLength(1))
    again({ filterList: { ...BASE, businessIds: [1, 999] }, pills: ['stores', 'brand', 'country', 'zone'] })
    await act(async () => {})
    expect(mocks.lookup.calls).toHaveLength(1)
  })

  it('a superadmin (level 0) asks the backoffice list, as the Stores controller does', async () => {
    mocks.lookup.level = 0
    const fetchMock = vi.fn(async () => ({ json: async () => ({ error: false, result: [{ id: 2, name: 'Beta Burgers' }] }) }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      bar({ filterList: { ...BASE, businessIds: [2] }, pills: REPORT })
      await waitFor(() => expect(pill('Stores')).toHaveTextContent('Beta Burgers'))
      expect(mocks.lookup.calls).toHaveLength(0)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toMatch(/^https:\/\/api\.test\/v400\/project\/backoffice\/businesses\?params=id,name&page=1&page_size=1&where=/)
      expect(init.headers.Authorization).toBe('Bearer token-1')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('the store lookup does not run when the report has no Stores pill', async () => {
    bar({ filterList: { ...BASE, businessIds: [2] }, pills: ['brand', 'zone'] })
    await act(async () => {})
    expect(mocks.lookup.calls).toHaveLength(0)
  })

  it('tells the page what it learned (onNamesChange), so a change of report keeps the names', async () => {
    mocks.lookup.rows = [{ id: 2, name: 'Beta Burgers' }]
    const onNamesChange = vi.fn()
    bar({ filterList: { ...BASE, businessIds: [2], franchises_id: [10] }, pills: REPORT, names: EMPTY_REPORT_NAMES, onNamesChange })
    await waitFor(() => expect(onNamesChange.mock.calls.some(([next]) => next.stores[2] === 'Beta Burgers')).toBe(true))
    expect(onNamesChange.mock.calls.some(([next]) => next.brands[10] === 'Acme Foods')).toBe(true)
  })
})

describe('ReportFilterPills · onClearFilters (R1, Q-02)', () => {
  const FILTERS = { ...BASE, businessIds: [1], franchises_id: [10], driver_groups_ids: [5], timeZone: 'America/Bogota' }

  it('«Clear filters» of the bar calls it and writes no patch of its own (nor touches the country)', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    const { handleChangeFilterList, handleChangeCode } = bar({ filterList: FILTERS, pills: ['stores', 'zone'], countryCode: 'CO', onClearFilters })
    await user.click(clearButton())
    expect(onClearFilters).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).not.toHaveBeenCalled()
    expect(handleChangeCode).not.toHaveBeenCalled()
  })

  it('«Clear filters» of the chips does the same', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    const { handleChangeFilterList } = bar({ filterList: FILTERS, pills: ['stores', 'zone'], onClearFilters })
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[1])
    expect(onClearFilters).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).not.toHaveBeenCalled()
  })

  it('the focus still goes to the first pill once the page has cleared', async () => {
    const user = userEvent.setup()
    const { again } = bar({ filterList: { ...BASE, timeZone: 'Asia/Tokyo' }, pills: ['stores', 'zone'], onClearFilters: vi.fn() })
    await user.click(clearButton())
    again({ filterList: BASE })
    expect(screen.queryAllByRole('button', { name: 'Clear filters' })).toHaveLength(0)
    expect(pill('Stores')).toHaveFocus()
  })

  it('without it, «Clear filters» is the patch it has always written', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: FILTERS, pills: ['stores', 'zone'] })
    await user.click(clearButton())
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList.mock.calls[0][0]).toMatchObject({ businessIds: null, franchises_id: null, driver_groups_ids: null, timeZone: BROWSER_ZONE })
  })
})

// ---- redesign drivers FA (D5, auditor 1) --------------------------------------------------------------------------------------------------
// The opt-in `driverPill` prop: a component the bar paints instead of the kit's DriverPill, in the same place. Without it the bar is the
// one every other page uses.
describe('ReportFilterPills · driverPill (drivers FA)', () => {
  // a stand-in for the page's own driver pill: it records the props it was given and lets the test call them
  const received = []
  const StubDriverPill = (props) => {
    received.push(props)
    return (
      <div data-testid='driver-stub'>
        <span>{props.label}</span>
        <span data-testid='driver-stub-value'>{props.value}</span>
        <span data-testid='driver-stub-selected'>{JSON.stringify(props.selected)}</span>
        <button type='button' onClick={() => props.onSetIds([3, 4])}>Set two</button>
        <button type='button' onClick={() => props.onSetIds([])}>Set none</button>
        <button type='button' onClick={() => props.onClear()}>Clear all</button>
        <button type='button' onClick={() => props.onLearn('drivers', [[3, 'Ana']])}>Learn Ana</button>
      </div>
    )
  }
  const lastProps = () => received.at(-1)

  beforeEach(() => { received.length = 0 })

  it('paints the stub instead of the kit\'s DriverPill, in its place, with label, value and selected of filterList.drivers_ids', () => {
    bar({ filterList: { ...BASE, drivers_ids: [3, 4] }, pills: ['stores', 'driver', 'zone'], driverPill: StubDriverPill })
    expect(screen.getByTestId('driver-stub')).toBeInTheDocument()
    // the kit's pill is a button named «Driver…»; the stub paints none
    expect(screen.queryByRole('button', { name: DRIVER })).toBeNull()
    expect(mocks.last.drivers).toBeUndefined()
    expect(lastProps().label).toBe('Driver')
    expect(lastProps().selected).toEqual([3, 4])
    expect(screen.getByTestId('driver-stub-selected')).toHaveTextContent('[3,4]')
    expect(lastProps().filterList).toEqual({ ...BASE, drivers_ids: [3, 4] })
    // same place: after Stores and before Timezone
    const group = screen.getByRole('group', { name: 'Filters' })
    const stub = screen.getByTestId('driver-stub')
    expect(within(group).getByRole('button', { name: /^Stores/ }).compareDocumentPosition(stub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stub.compareDocumentPosition(within(group).getByRole('button', { name: /^Timezone/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the stub gets the same value the kit\'s pill shows for the same filters (two drivers nobody named are a count)', () => {
    const filterList = { ...BASE, drivers_ids: [3, 4] }
    const kit = bar({ filterList, pills: ['driver'] })
    const kitValue = screen.getByRole('button', { name: DRIVER }).querySelector('bdi.odc-figure')
    expect(kitValue).toHaveTextContent('2')
    kit.unmount()
    bar({ filterList, pills: ['driver'], driverPill: StubDriverPill })
    // the figure node of the count, the same one the kit's pill is handed (decision 11)
    expect(screen.getByTestId('driver-stub-value').querySelector('bdi.odc-figure')).toHaveTextContent('2')
  })

  it('onSetIds sets the whole list at once with the debounce: [3, 4] -> drivers_ids [3, 4], [] -> null (never [])', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, lapse: 'yesterday', app_id: '7' }, pills: ['driver'], driverPill: StubDriverPill })
    await user.click(screen.getByRole('button', { name: 'Set two' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, lapse: 'yesterday', app_id: '7', drivers_ids: [3, 4] }, { debounce: true })
    await user.click(screen.getByRole('button', { name: 'Set none' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...BASE, lapse: 'yesterday', app_id: '7', drivers_ids: null }, { debounce: true })
    expect(handleChangeFilterList.mock.calls.some(([next]) => Array.isArray(next.drivers_ids) && next.drivers_ids.length === 0)).toBe(false)
  })

  it('onClear is onSetIds([]): drivers_ids null with the debounce', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, drivers_ids: [3, 4] }, pills: ['driver'], driverPill: StubDriverPill })
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...BASE, drivers_ids: null }, { debounce: true })
  })

  it('after onLearn(\'drivers\', [[3, \'Ana\']]) the chip says «Driver: Ana» and its × removes the 3', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, drivers_ids: [3] }
    const { handleChangeFilterList } = bar({ filterList, pills: ['driver'], driverPill: StubDriverPill })
    // before it learns, the driver is a count
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['1 driver'])
    await user.click(screen.getByRole('button', { name: 'Learn Ana' }))
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(chipText(chips)).toEqual(['Driver: Ana'])
    // the pill reads the name too: the value it is given now names the driver
    expect(screen.getByTestId('driver-stub-value')).toHaveTextContent('Ana')
    await user.click(within(chips).getByRole('button', { name: 'Remove Driver Ana filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, drivers_ids: null }, { debounce: true })
  })

  it('removing one chip of several leaves the others (the × removes only its driver)', async () => {
    const user = userEvent.setup()
    const filterList = { ...BASE, drivers_ids: [3, 5] }
    const { handleChangeFilterList } = bar({ filterList, pills: ['driver'], driverPill: StubDriverPill })
    await user.click(screen.getByRole('button', { name: 'Learn Ana' }))
    await user.click(within(screen.getByRole('list', { name: 'Active filters' })).getByRole('button', { name: 'Remove Driver Ana filter' }))
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ ...filterList, drivers_ids: [5] }, { debounce: true })
  })

  it('the rest of the driver pill stays: «Clear filters» appears with a driver on and nulls drivers_ids', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = bar({ filterList: { ...BASE, drivers_ids: [3] }, pills: ['driver', 'zone'], driverPill: StubDriverPill })
    await user.click(clearButton())
    expect(handleChangeFilterList.mock.calls[0][0]).toMatchObject({ drivers_ids: null, timeZone: BROWSER_ZONE })
  })

  it('`driverPill` without \'driver\' in `pills` paints nothing of it', () => {
    bar({ pills: ['stores', 'zone'], driverPill: StubDriverPill })
    expect(screen.queryByTestId('driver-stub')).toBeNull()
    expect(received).toHaveLength(0)
  })

  it('without `driverPill`, `pills={[\'driver\']}` still paints the kit\'s DriverPill (the usual one)', async () => {
    const user = userEvent.setup()
    bar({ pills: ['driver'] })
    expect(screen.queryByTestId('driver-stub')).toBeNull()
    const popup = await openBy(user, DRIVER, 'Driver')
    expect(within(popup).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(mocks.last.drivers).toBeDefined()
  })
})

// ---- redesign drivers R1 (F1) -------------------------------------------------------------------------------------------------------------
// The name of a person is written as it is: a driver called «Driver Test» is not cut to «Test». Only the names of groups (that the API may
// already start with the label, «Driver Group: Shipday») lose the label.
describe('ReportFilterPills · a driver named «Driver …» (drivers R1, F1)', () => {
  const namesWith = (overrides) => ({ ...EMPTY_REPORT_NAMES, ...overrides })
  const pillValueText = () => document.querySelector('.odc-pill-value')?.textContent
  const received = []
  const StubDriverPill = (props) => {
    received.push(props)
    return <span data-testid='driver-stub-value'>{props.value}</span>
  }

  beforeEach(() => { received.length = 0 })

  it('the kit\'s pill reads «Driver Test» whole and its chip «Driver: Driver Test»', () => {
    bar({ filterList: { ...BASE, drivers_ids: [31] }, pills: ['driver'], names: namesWith({ drivers: { 31: 'Driver Test' } }) })
    expect(pillValueText()).toBe('Driver Test')
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Driver: Driver Test'])
  })

  it('with `driverPill` the value it is given is «Driver Test» and the chip «Driver: Driver Test»', () => {
    bar({ filterList: { ...BASE, drivers_ids: [31] }, pills: ['driver'], names: namesWith({ drivers: { 31: 'Driver Test' } }), driverPill: StubDriverPill })
    expect(screen.getByTestId('driver-stub-value')).toHaveTextContent(/^Driver Test$/)
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Driver: Driver Test'])
  })

  it('two drivers called «Driver» and «Driver three» each keep their whole name in the chips', () => {
    bar({ filterList: { ...BASE, drivers_ids: [32, 33] }, pills: ['driver'], names: namesWith({ drivers: { 32: 'Driver', 33: 'Driver three' } }) })
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Driver: Driver', 'Driver: Driver three'])
  })

  it('a driver called just «Driver» is «Driver» in the pill', () => {
    bar({ filterList: { ...BASE, drivers_ids: [32] }, pills: ['driver'], names: namesWith({ drivers: { 32: 'Driver' } }) })
    expect(pillValueText()).toBe('Driver')
  })

  it('a group the API already named with the label is still read without it: «Driver Group: Shipday» is «Shipday»', () => {
    bar({ filterList: { ...BASE, driver_groups_ids: [5] }, pills: ['driverGroup'], names: namesWith({ groups: { 5: 'Driver Group: Shipday' } }) })
    expect(pillValueText()).toBe('Shipday')
    expect(chipText(screen.getByRole('list', { name: 'Active filters' }))).toEqual(['Driver group: Shipday'])
  })

  it('the other pills are unchanged: a store called «Stores Plus» still loses the label', () => {
    bar({ filterList: { ...BASE, businessIds: [1] }, pills: ['stores'], names: namesWith({ stores: { 1: 'Stores: Plus' } }) })
    expect(pillValueText()).toBe('Plus')
  })
})
