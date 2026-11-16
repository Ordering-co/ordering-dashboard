/* eslint-disable import/first */
// redesign reports FC1 (D1, D2, D3, D4, D5, D9; RP-01, RP-02, RP-08, RP-11, RP-12, RP-17; auditor 4, 7, 16): the page /intelligence/reports.
// The router is the real one, in memory. `useAdvancedReport` (the data), `ReportBody` and `usePeriodText` (lot C2) are stand-ins: the hook
// records what it was asked for, the body paints a marker. The controllers of the filter pills are stand-ins that hand their UIComponent what
// the real ones hand it (as the tests of the kit do). What is under test is the page: the catalog, the route, the shared filters and the focus.
import React from 'react'
import dayjs from 'dayjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MemoryRouter, useHistory, useLocation } from 'react-router-dom'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const runtime = vi.hoisted(() => ({
  calls: [],
  result: {},
  bodies: [],
  bodyMounts: 0,
  collapsed: false,
  collapse: vi.fn(),
  configs: {},
  configFile: {},
  learn: null,
  appIdList: { loading: false, ids: [], error: null },
  history: null,
  location: null,
  mounts: {},
  controllers: { stores: {}, brands: {}, countries: {}, groups: {}, drivers: {}, channels: {}, last: {} }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  // a controller stand-in: it hands its UIComponent the props it was given plus what the real one computes
  const controller = key => function Controller (props) {
    runtime.controllers.last[key] = props
    react.useEffect(() => { runtime.mounts[key] = (runtime.mounts[key] ?? 0) + 1 }, [])
    const { UIComponent, ...rest } = props
    return react.createElement(UIComponent, { ...rest, ...runtime.controllers[key] })
  }
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useUtils: () => [{
      // the project's format for a day: «D MMM YYYY»
      parseDate: (date) => dayjs(String(date).slice(0, 10)).format('D MMM YYYY')
    }],
    AnalyticsBusinessFilter: controller('stores'),
    ReportsBrandFilter: controller('brands'),
    CountryList: controller('countries'),
    ReportsDriverGroupFilter: controller('groups'),
    ReportsDriverFilter: controller('drivers'),
    ReportsAppIdFilter: controller('channels'),
    // redesign (n.º 21), the clicks report: the controller of the channels row (main's `AnalyticsStatusSubFilter`) only gives `appIdList`
    AnalyticsStatusSubFilter: ({ UIComponent, ...props }) => {
      runtime.controllers.last.channelsRow = props
      return react.createElement(UIComponent, { ...props, appIdList: runtime.appIdList })
    }
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: runtime.collapsed }, { handleMenuCollapse: runtime.collapse }]
}))
vi.mock('../../../../../../components/AdvancedReports/useAdvancedReport', () => {
  const useAdvancedReport = (args) => { runtime.calls.push(args); return runtime.result }
  return { useAdvancedReport, default: useAdvancedReport }
})
vi.mock('../ReportBody', async () => {
  const react = await import('react')
  return {
    ReportBody: (props) => {
      runtime.bodies.push(props)
      react.useEffect(() => { runtime.bodyMounts += 1 }, [])
      return react.createElement('div', { 'data-testid': 'report-body', 'data-report': String(props.report.id) })
    }
  }
})
vi.mock('../../../Shared/LearnDropDown', async () => {
  const react = await import('react')
  return {
    LearnDropDown: ({ learnOptions }) => {
      runtime.learn = learnOptions
      return react.createElement('button', { type: 'button' }, 'Learn')
    }
  }
})
vi.mock('../usePeriodText', () => ({
  usePeriodText: () => ({
    rangeText: (from, to) => `${from}..${to}`,
    periodText: (period) => String(period?.start),
    groupingText: (unit) => `by ${unit}`
  })
}))

import { ADVANCED_REPORTS, ADVANCED_REPORT_GROUPS } from '../../../../../../utils/advancedReports'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { Reports } from '../index'

const STORES = [{ id: 1, name: 'Alpha Pizza', logo: null }, { id: 2, name: 'Beta Burgers', logo: null }]
const BRANDS = [{ id: 10, name: 'Acme Foods' }]
const GROUP_NAMES = { sales: 'Sales', service: 'Stores and service', delivery: 'Delivery', drivers: 'Drivers', customers: 'Customers' }
const TODAY = '2026-10-10'
const DEFAULT_FROM = '2026-10-03'
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const byId = (id) => ADVANCED_REPORTS.find(report => report.id === id)

const setControllers = () => {
  runtime.controllers.last = {}
  runtime.controllers.stores = {
    businessList: { loading: false, error: null, businesses: STORES, pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 2 } },
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
  runtime.controllers.brands = {
    brandList: { loading: false, error: null, brands: BRANDS, pagination: null },
    brandIds: null,
    handleChangeBrandId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
  // one country: the pill is not painted (countryWhenMany), as in a project with one country
  runtime.controllers.countries = {
    countriesState: { loading: false, error: null, countries: [{ id: 1, code: 'CO', name: 'Colombia' }] },
    searchValue: null,
    onSearch: vi.fn(),
    handleClickFilterButton: vi.fn(),
    code: '',
    setCode: vi.fn(),
    actionState: { loading: false, error: null }
  }
  runtime.controllers.groups = {
    driverGroupList: { loading: false, error: null, driverGroups: [{ id: 5, name: 'Night shift', enabled: true, drivers: [{ id: 21 }] }], pagination: null },
    driverGroupIds: null,
    handleChangeDriverGroupId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  runtime.controllers.drivers = {
    driverList: { loading: false, error: null, drivers: [{ id: 21, name: 'Ana', lastname: 'Ruiz' }], pagination: null },
    driverIds: null,
    handleChangeDriverId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  runtime.controllers.channels = {
    appIdList: { loading: false, error: null, appIds: [{ id: 7, name: 'Web' }], pagination: null },
    appIds: null,
    handleChangeAppId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
}

const Probe = () => {
  runtime.history = useHistory()
  runtime.location = useLocation()
  return null
}
const renderPage = (url = '/intelligence/reports') => render(
  <ConfigFileContext.Provider value={[runtime.configFile, vi.fn()]}>
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Reports />
    </MemoryRouter>
  </ConfigFileContext.Provider>
)

const lastCall = () => runtime.calls[runtime.calls.length - 1]
const queryOf = () => new URLSearchParams(runtime.location.search)
const titleOf = () => screen.getByRole('heading', { level: 1 })
const pill = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
// «Driver» is not «Driver group»
const named = (name) => new RegExp(`^${name}(?! group)`)
const normal = (node) => node.textContent.replace(/\s+/g, ' ').trim()
const EXIT = { timeout: 4000 }

const openReport = async (user, name) => {
  await user.click(screen.getByRole('button', { name }))
  await waitFor(() => expect(titleOf()).toHaveTextContent(name))
}
const switchTo = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Switch report' }))
  await user.click(await screen.findByRole('menuitemradio', { name: new RegExp(`^${name}`) }))
  await waitFor(() => expect(titleOf()).toHaveTextContent(name))
}
const openPill = async (user, name) => {
  await user.click(pill(name))
  // the range popover is named by its title, the others by their pill
  return screen.findByRole('dialog', { name: name === 'Period' ? 'Select a date' : name })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0))
  runtime.calls = []
  runtime.configFile = {}
  runtime.bodies = []
  runtime.bodyMounts = 0
  runtime.mounts = {}
  runtime.collapsed = false
  runtime.learn = null
  runtime.appIdList = { loading: false, ids: ['web', 'ios'], error: null }
  runtime.result = { data: null, data1: null, loading: false, updating: false, error: null, error1: null, retry: vi.fn() }
  runtime.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  setControllers()
})
afterEach(() => {
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

describe('the catalog (D2, RP-01, RP-02, auditor 4)', () => {
  it('is a page titled «Enterprise reports» with its description and the count of reports as a figure', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    const description = screen.getByText(/reports on sales, stores, delivery, drivers and customers/)
    expect(normal(description)).toBe('22 reports on sales, stores, delivery, drivers and customers. Open one to choose the period and filters.')
    expect(description.querySelector('bdi')).toHaveTextContent('22')
    expect(description.querySelector('.odc-figure')).not.toBeNull()
    expect(screen.queryByTestId('report-body')).toBeNull()
  })

  it('shows the 22 reports at once, as native buttons, in five sections with their heading', () => {
    renderPage()
    expect(ADVANCED_REPORT_GROUPS).toEqual(Object.keys(GROUP_NAMES))
    let total = 0
    ADVANCED_REPORT_GROUPS.forEach(group => {
      const section = screen.getByRole('region', { name: GROUP_NAMES[group] })
      expect(within(section).getByRole('heading', { level: 2, name: GROUP_NAMES[group] })).toBeInTheDocument()
      const names = within(section).getAllByRole('button').map(button => button.getAttribute('aria-labelledby') && normal(document.getElementById(button.getAttribute('aria-labelledby'))))
      expect(names).toEqual(ADVANCED_REPORTS.filter(report => report.group === group).map(report => report.name))
      within(section).getAllByRole('button').forEach(button => expect(button.tagName).toBe('BUTTON'))
      total += names.length
    })
    expect(total).toBe(22)
    expect(screen.getAllByRole('region')).toHaveLength(5)
  })

  // redesign a miles project does not read «in km» in the description of the distance reports
  it('describes the distance reports in miles for a miles project', () => {
    runtime.configs = { ...runtime.configs, distance_unit: { value: 'MI' } }
    renderPage()
    expect(screen.getByText('Average distance from each store to its customers, in miles, for each period.')).toBeInTheDocument()
    expect(screen.getByText('Distance covered by each driver, in miles, for each period.')).toBeInTheDocument()
    expect(screen.queryByText(/in km/)).toBeNull()
  })

  it('keeps «in km» in the description of the distance reports for a km project', () => {
    renderPage()
    expect(screen.getByText('Average distance from each store to its customers, in km, for each period.')).toBeInTheDocument()
  })

  it('every report button has its description as its accessible description, and a decorative icon', () => {
    renderPage()
    ADVANCED_REPORTS.forEach(report => {
      const button = screen.getByRole('button', { name: report.name })
      expect(button).toHaveAccessibleDescription(report.description)
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(button.getAttribute('type')).toBe('button')
    })
  })

  it('Tab reaches the search field and then each of the 22 reports, in the order of the page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.tab()
    expect(screen.getByRole('searchbox', { name: 'Find a report' })).toHaveFocus()
    const reached = []
    for (let step = 0; step < 22; step += 1) {
      await user.tab()
      reached.push(Number(document.activeElement.getAttribute('data-report-id')))
    }
    expect(reached).toEqual(ADVANCED_REPORT_GROUPS.flatMap(group => ADVANCED_REPORTS.filter(report => report.group === group).map(report => report.id)))
    expect(new Set(reached).size).toBe(22)
  })
})

describe('«Find a report» (D2)', () => {
  const search = async (user, text) => user.type(screen.getByRole('searchbox', { name: 'Find a report' }), text)
  const shown = () => screen.queryAllByRole('button').map(button => button.getAttribute('data-report-id')).filter(Boolean).map(Number)

  it('finds a report by its new name, in any case', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'ORDERS OVER time')
    expect(shown()).toEqual([13])
  })

  it('finds a report by the name main gave it, even with its typo', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'Range KM')
    expect(shown()).toContain(3)
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'Customer safisfaction')
    expect(shown()).toEqual([16])
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'Driver Time')
    expect(shown()).toContain(11)
  })

  it('finds a report by its Spanish alias, without accents', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'mapa de calor')
    expect(shown()).toEqual([9])
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'satisfacción')
    expect(shown()).toEqual([16])
  })

  // redesign the terms of the retired Ecommerce page (also searched by ⌘K) find reports 1 to 3 here too
  it('finds reports 1 to 3 by the names of the retired Ecommerce page, as ⌘K does', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'Discount dashboard')
    expect(shown()).toContain(2)
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'Dashboard with store map')
    expect(shown()).toContain(3)
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'Users')
    expect(shown()).toContain(1)
    await user.clear(screen.getByRole('searchbox', { name: 'Find a report' }))
    await search(user, 'reportes de ecommerce')
    expect([...shown()].sort((a, b) => a - b)).toEqual([1, 2, 3, 22])
  })

  it('finds a report by its description', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'rejected orders')
    expect(shown()).toContain(8)
  })

  it('does not paint the sections that have no result', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'satisfaction')
    expect(screen.getByRole('region', { name: 'Customers' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sales' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: 'Drivers' })).toBeNull()
  })

  it('with no result says so and «Clear search» brings the 22 back', async () => {
    const user = userEvent.setup()
    renderPage()
    await search(user, 'zzzz')
    expect(screen.getByText('No reports match “zzzz”')).toBeInTheDocument()
    expect(shown()).toEqual([])
    // the field has its own «Clear search» (the ×) too: the one of the empty state is the button inside it
    const empty = screen.getByText('No reports match “zzzz”').closest('.odc-state')
    await user.click(within(empty).getByRole('button', { name: 'Clear search' }))
    expect(shown()).toHaveLength(22)
    expect(screen.getByRole('searchbox', { name: 'Find a report' })).toHaveValue('')
  })
})

describe('the route (D1, auditor 16)', () => {
  it('opening a report pushes ?id=<n>, paints its title (the h1), its description and its body', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Orders over time')
    expect(runtime.location.pathname).toBe('/intelligence/reports')
    expect(queryOf().get('id')).toBe('13')
    expect(titleOf()).toHaveTextContent('Orders over time')
    expect(screen.getByText('Orders per period, with the total.')).toBeInTheDocument()
    expect(screen.getByTestId('report-body')).toHaveAttribute('data-report', '13')
    expect(screen.queryByRole('searchbox', { name: 'Find a report' })).toBeNull()
  })

  it('asks the data hook for the endpoints of the report, with the filters that are sent', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Average ticket by site and order type')
    expect(lastCall()).toMatchObject({ endpoint: 'sites_sales_average', endpoint1: 'order_types_sales_average', enabled: true })
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY, timeZone: BROWSER_ZONE, businessIds: null })
    expect(runtime.bodies[runtime.bodies.length - 1]).toMatchObject({ report: byId(18), result: runtime.result, filters: lastCall().filters })
  })

  it.each(['23', 'abc', '0', '', '1.5'])('?id=%s opens the catalog and takes the id out of the address', async (id) => {
    renderPage(`/intelligence/reports?id=${id}&other=1`)
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    expect(screen.queryByTestId('report-body')).toBeNull()
    await waitFor(() => expect(queryOf().has('id')).toBe(false))
    expect(queryOf().get('other')).toBe('1')
  })

  it('a valid ?id on a fresh load opens that report', () => {
    renderPage('/intelligence/reports?id=7')
    expect(titleOf()).toHaveTextContent('Driver schedule')
    expect(screen.getByTestId('report-body')).toHaveAttribute('data-report', '7')
  })

  it('«All reports» goes back to the catalog with a push and no id', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Orders over time')
    const before = runtime.history.length
    await user.click(screen.getByRole('button', { name: 'All reports' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    expect(queryOf().has('id')).toBe(false)
    expect(runtime.history.length).toBe(before + 1)
  })

  it('Back in the browser goes from a report to the catalog, and Forward returns to the report', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Sales over time')
    act(() => runtime.history.goBack())
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    act(() => runtime.history.goForward())
    expect(titleOf()).toHaveTextContent('Sales over time')
  })

  it('reads ?id again on every change of the address, also when the page is already open (⌘K pushes it through the router)', () => {
    renderPage()
    act(() => runtime.history.push('/intelligence/reports?id=5'))
    expect(titleOf()).toHaveTextContent('Service times by delivery company')
    act(() => runtime.history.push('/intelligence/reports?id=12'))
    expect(titleOf()).toHaveTextContent('Top drivers by orders')
    expect(lastCall().endpoint).toBe('drivers_top_orders_v2')
  })

  it('«Switch report» lists the 22 in the order of the catalog, as one choice, with the current one checked and a separator between groups', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=14')
    await user.click(screen.getByRole('button', { name: 'Switch report' }))
    const items = await screen.findAllByRole('menuitemradio')
    expect(items).toHaveLength(22)
    const ordered = ADVANCED_REPORT_GROUPS.flatMap(group => ADVANCED_REPORTS.filter(report => report.group === group))
    expect(items.map(item => item.querySelector('.odc-menu-label').textContent)).toEqual(ordered.map(report => report.name))
    items.forEach(item => expect(item).toHaveAttribute('aria-checked', item.querySelector('.odc-menu-label').textContent === 'Sales over time' ? 'true' : 'false'))
    expect(screen.getAllByRole('separator')).toHaveLength(4)
    // the first of each group says the group
    ;['Sales', 'Stores and service', 'Delivery', 'Drivers', 'Customers'].forEach(group => {
      expect(screen.getAllByText(group).some(node => node.classList.contains('odc-menu-description'))).toBe(true)
    })
  })

  it('choosing another report in the menu pushes its ?id and swaps the report; the body is mounted again for it', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    expect(runtime.bodyMounts).toBe(1)
    await switchTo(user, 'Orders by SLA status')
    expect(queryOf().get('id')).toBe('21')
    expect(screen.getByTestId('report-body')).toHaveAttribute('data-report', '21')
    expect(runtime.bodyMounts).toBe(2)
    expect(lastCall().endpoint).toBe('sla_orders')
  })

  it('has the button that opens the side menu when it is collapsed, in the catalog and in a report', async () => {
    const user = userEvent.setup()
    runtime.collapsed = true
    renderPage()
    // the opener is PageHeader's `leading`: the first child of the lead block, before the title
    const catalogOpener = screen.getByRole('button', { name: 'Open menu' })
    expect(catalogOpener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(catalogOpener)
    await user.click(catalogOpener)
    expect(runtime.collapse).toHaveBeenCalledWith(false)
    await openReport(user, 'Orders over time')
    const reportOpener = screen.getByRole('button', { name: 'Open menu' })
    expect(reportOpener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(reportOpener)
    await user.click(reportOpener)
    expect(runtime.collapse).toHaveBeenCalledTimes(2)
  })

  it('has no side-menu button when the menu is open', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

describe('the filter bar of each report (D4, D5; auditor 7)', () => {
  it('report 21 has Driver group, Driver and Stores, and no Brand; report 13 has Stores and Brand and no driver pill', async () => {
    renderPage('/intelligence/reports?id=21')
    const bar = screen.getByRole('group', { name: 'Filters' })
    ;['Driver group', 'Driver', 'Stores', 'Timezone'].forEach(name => expect(within(bar).getByRole('button', { name: named(name) })).toBeInTheDocument())
    expect(within(bar).queryByRole('button', { name: /^Brand/ })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Order type/ })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Channel/ })).toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'All reports' }))
    await openReport(user, 'Orders over time')
    const bar13 = screen.getByRole('group', { name: 'Filters' })
    ;['Stores', 'Brand', 'Timezone'].forEach(name => expect(within(bar13).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument())
    expect(within(bar13).queryByRole('button', { name: /^Driver/ })).toBeNull()
  })

  it('report 15 has Channel and Timezone, and no stores', () => {
    renderPage('/intelligence/reports?id=15')
    const bar = screen.getByRole('group', { name: 'Filters' })
    expect(within(bar).getByRole('button', { name: /^Channel/ })).toBeInTheDocument()
    expect(within(bar).queryByRole('button', { name: /^Stores/ })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Brand/ })).toBeNull()
  })

  it('report 8 has the Order type pill', () => {
    renderPage('/intelligence/reports?id=8')
    expect(within(screen.getByRole('group', { name: 'Filters' })).getByRole('button', { name: /^Order type/ })).toBeInTheDocument()
  })

  it('report 10 has Stores but does not narrow them by brand, even with a brand chosen in another report', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const brand = await openPill(user, 'Brand')
    await user.click(within(brand).getByRole('checkbox', { name: 'Acme Foods' }))
    expect(lastCall().filters.franchises_id).toEqual([10])
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    await switchTo(user, 'Distance by driver')
    expect(within(screen.getByRole('group', { name: 'Filters' })).queryByRole('button', { name: /^Brand/ })).toBeNull()
    expect(lastCall().filters.franchises_id).toBeNull()
    await openPill(user, 'Stores')
    expect(runtime.controllers.last.stores).toMatchObject({ isFranchise: false })
    expect(runtime.controllers.last.stores.filterList.franchises_id).toBeNull()
    // the brand is still the page's: report 13 has it again
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    await switchTo(user, 'Orders over time')
    expect(lastCall().filters.franchises_id).toEqual([10])
  })

  it('the bar of a report is mounted once per report (the country opens by itself only in the first, D-21: see the describe below)', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    expect(runtime.mounts.countries).toBe(1)
    await switchTo(user, 'Sales over time')
    expect(runtime.mounts.countries).toBe(2)
    expect(runtime.controllers.last.countries).toMatchObject({ isSearchByName: true })
  })

  it('hands the bar the country-when-many, pills and wrapping options of the registry, and the page filters', () => {
    renderPage('/intelligence/reports?id=9')
    const bar = screen.getByRole('group', { name: 'Filters' })
    expect(bar.closest('.odc-bi-filters')).not.toBeNull()
    ;['Brand', 'Stores', 'Driver group', 'Driver', 'Timezone'].forEach(name => expect(within(bar).getByRole('button', { name: named(name) })).toBeInTheDocument())
    expect(runtime.controllers.last.countries.whenMany).toBe(true)
  })
})

describe('the filters belong to the page (D4)', () => {
  it('a new load starts with the defaults of main: the last 7 days plus today, no filter, the zone of the browser', () => {
    renderPage('/intelligence/reports?id=13')
    expect(lastCall().filters).toEqual({
      from: DEFAULT_FROM,
      to: TODAY,
      businessIds: null,
      drivers_ids: null,
      franchises_id: null,
      driver_companies_ids: null,
      driver_groups_ids: null,
      delivery_types_ids: null,
      app_ids: null,
      timeZone: BROWSER_ZONE
    })
    expect(lastCall().countryCode).toBe('')
    expect(pill('Period')).toHaveTextContent('Last 7 days')
  })

  it('the period and a store chosen in report 13 stay in report 14, and are not sent by report 15 (it has no stores); report 13 has them again', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const period = await openPill(user, 'Period')
    await user.click(within(period).getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    const stores = await openPill(user, 'Stores')
    await user.click(within(stores).getByRole('checkbox', { name: 'Alpha Pizza' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    expect(lastCall().filters).toMatchObject({ from: '2026-09-10', to: TODAY, businessIds: [1] })
    expect(pill('Period')).toHaveTextContent('Last 30 days')

    await switchTo(user, 'Sales over time')
    expect(lastCall()).toMatchObject({ endpoint: 'sales_v2' })
    expect(lastCall().filters).toMatchObject({ from: '2026-09-10', to: TODAY, businessIds: [1] })
    // redesign reports R1 (Q-01): this line pinned the defect (the bar forgot the names with each change of report, so one store read as «1»).
    // The store keeps its name now; the filter that is sent (above) is the same
    expect(pill('Stores')).toHaveTextContent('Alpha Pizza')

    await switchTo(user, 'Registered users')
    expect(lastCall()).toMatchObject({ endpoint: 'users_v2' })
    expect(lastCall().filters).toMatchObject({ from: '2026-09-10', to: TODAY, businessIds: null, franchises_id: null })
    expect(pill('Period')).toHaveTextContent('Last 30 days')

    await switchTo(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ from: '2026-09-10', to: TODAY, businessIds: [1] })
  })

  it('the stores controller of report 21 does not get a brand the report does not show, and what it writes keeps the page brand', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const brand = await openPill(user, 'Brand')
    await user.click(within(brand).getByRole('checkbox', { name: 'Acme Foods' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand' })).toBeNull(), EXIT)
    await switchTo(user, 'Orders by SLA status')
    expect(lastCall().filters.franchises_id).toBeNull()
    const stores = await openPill(user, 'Stores')
    expect(runtime.controllers.last.stores.filterList.franchises_id).toBeNull()
    await user.click(within(stores).getByRole('checkbox', { name: 'Beta Burgers' }))
    expect(lastCall().filters).toMatchObject({ businessIds: [2], franchises_id: null })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    await switchTo(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ businessIds: [2], franchises_id: [10] })
  })

  it('a custom range is applied once, with «Done» (RP-07)', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const dialog = await openPill(user, 'Period')
    await user.click(dialog.querySelector('[data-day="2026-10-06"]'))
    await user.click(dialog.querySelector('[data-day="2026-10-08"]'))
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY })
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(lastCall().filters).toMatchObject({ from: '2026-10-06', to: '2026-10-08' })
    await waitFor(() => expect(pill('Period')).toHaveTextContent('6 Oct 2026 – 8 Oct 2026'), EXIT)
  })

  it('the presets are Today, Yesterday, Last 7 days and Last 30 days, with the labels of Business (not the shared LAST_7_DAYS)', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const dialog = await openPill(user, 'Period')
    const group = within(dialog).getByRole('group', { name: 'Period' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'])
    expect(within(group).getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('button', { name: 'Yesterday' }))
    expect(lastCall().filters).toMatchObject({ from: '2026-10-09', to: '2026-10-09' })
  })

  it('the country is the page\'s: choosing the same one again takes it away; applying one is a change of the filters (stores cleared by the controller)', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const stores = await openPill(user, 'Stores')
    await user.click(within(stores).getByRole('checkbox', { name: 'Alpha Pizza' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    expect(lastCall().filters.businessIds).toEqual([1])
    act(() => runtime.controllers.last.countries.handleChangeCode('CO'))
    expect(lastCall().countryCode).toBe('CO')
    act(() => runtime.controllers.last.countries.handleChangeFilterList({ ...runtime.controllers.last.countries.filterList, businessIds: null }))
    expect(lastCall().filters.businessIds).toBeNull()
    act(() => runtime.controllers.last.countries.handleChangeCode('CO'))
    expect(lastCall().countryCode).toBe('')
  })

  it('the line under the bar says the dates of the period and, when the answer has period labels, how the API grouped it', async () => {
    renderPage('/intelligence/reports?id=13')
    const line = () => document.querySelector('.odc-rp-period-line')
    expect(normal(line())).toBe(`${DEFAULT_FROM}..${TODAY}`)
    runtime.result = { ...runtime.result, data: { axis: { x: { labels: ['Week 2026-39', 'Week 2026-40'] } } } }
    const user = userEvent.setup()
    await switchTo(user, 'Sales over time')
    expect(normal(line())).toBe(`${DEFAULT_FROM}..${TODAY} · by week`)
  })
})

// redesign reports R1 (Q-01, Q-02, Q-03): the bar is mounted once per report, so the names it has learned and «Clear filters» belong to the page
describe('changing report keeps the names and clears everything (R1, Q-01, Q-02, Q-03)', () => {
  const chips = () => screen.getByRole('list', { name: 'Active filters' })
  const closeDialog = async (user, name) => {
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name })).toBeNull(), EXIT)
  }

  it('Q-01: a brand chosen in report 13 keeps its name in the pill and in the chip of report 14 (not a count, not its id)', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const brand = await openPill(user, 'Brand')
    await user.click(within(brand).getByRole('checkbox', { name: 'Acme Foods' }))
    await closeDialog(user, 'Brand')
    expect(pill('Brand')).toHaveTextContent('Acme Foods')

    await switchTo(user, 'Sales over time')
    expect(lastCall()).toMatchObject({ endpoint: 'sales_v2' })
    expect(lastCall().filters.franchises_id).toEqual([10])
    expect(pill('Brand')).toHaveTextContent('Acme Foods')
    expect(within(chips()).getByText('Brand: Acme Foods')).toBeInTheDocument()
    expect(chips().textContent).not.toMatch(/\b10\b/)
  })

  it('Q-01: a store keeps its name too, and a brand nobody named reads «1 brand», never the id', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const stores = await openPill(user, 'Stores')
    await user.click(within(stores).getByRole('checkbox', { name: 'Alpha Pizza' }))
    await closeDialog(user, 'Stores')
    await switchTo(user, 'Sales over time')
    expect(pill('Stores')).toHaveTextContent('Alpha Pizza')
    expect(within(chips()).getByText('Stores: Alpha Pizza')).toBeInTheDocument()
    // the brand list of the controller has no name for this one
    runtime.controllers.brands.brandList = { loading: false, error: null, brands: [{ id: 34, name: null }], pagination: null }
    const brand = await openPill(user, 'Brand')
    await user.click(within(brand).getByRole('checkbox'))
    await closeDialog(user, 'Brand')
    expect(normal(chips())).toContain('1 brand')
    expect(chips().textContent).not.toMatch(/34/)
  })

  it('Q-03: a driver group chosen in report 11 still scopes the list of drivers in report 21', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=11')
    const group = await openPill(user, 'Driver group')
    await user.click(within(group).getByRole('checkbox', { name: 'Night shift' }))
    await closeDialog(user, 'Driver group')
    await user.click(screen.getByRole('button', { name: named('Driver') }))
    await screen.findByRole('dialog', { name: 'Driver' })
    expect(runtime.controllers.last.drivers.availableDriverIds).toEqual([21])
    await closeDialog(user, 'Driver')

    await switchTo(user, 'Orders by SLA status')
    expect(lastCall().filters.driver_groups_ids).toEqual([5])
    await user.click(screen.getByRole('button', { name: named('Driver') }))
    await screen.findByRole('dialog', { name: 'Driver' })
    expect(runtime.controllers.last.drivers.availableDriverIds).toEqual([21])
  })

  it('Q-02: «Clear filters» in report 21 also clears the brand the page held, and report 13 comes up with none', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const brand = await openPill(user, 'Brand')
    await user.click(within(brand).getByRole('checkbox', { name: 'Acme Foods' }))
    await closeDialog(user, 'Brand')
    expect(lastCall().filters.franchises_id).toEqual([10])

    await switchTo(user, 'Orders by SLA status')
    const stores = await openPill(user, 'Stores')
    await user.click(within(stores).getByRole('checkbox', { name: 'Beta Burgers' }))
    await closeDialog(user, 'Stores')
    expect(lastCall().filters).toMatchObject({ businessIds: [2], franchises_id: null })
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(lastCall().filters).toMatchObject({ businessIds: null, franchises_id: null })

    await switchTo(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ businessIds: null, franchises_id: null })
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(pill('Brand')).not.toHaveTextContent('Acme Foods')
  })

  it('Q-02: «Clear filters» sets the zone of the browser and the country to none, and leaves the period alone', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    const period = await openPill(user, 'Period')
    await user.click(within(period).getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    const zone = await openPill(user, 'Timezone')
    // narrow the 400 zones first, as a person would: a role query over all of them takes seconds on a loaded runner
    await user.click(zone.querySelector('input[type="search"]'))
    await user.paste('Tokyo')
    await user.click(within(zone).getByRole('radio', { name: 'Asia/Tokyo' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Timezone' })).toBeNull(), EXIT)
    act(() => runtime.controllers.last.countries.handleChangeCode('CO'))
    expect(lastCall()).toMatchObject({ countryCode: 'CO' })
    expect(lastCall().filters.timeZone).toBe('Asia/Tokyo')

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(lastCall().filters).toMatchObject({ from: '2026-09-10', to: TODAY, timeZone: BROWSER_ZONE })
    expect(lastCall().countryCode).toBe('')
  })
})

// redesign (row 3, D-29): the period and the filters of the report travel in the address
describe('the period and the filters travel in the address (D-29)', () => {
  it('a fresh load with the params starts from them: the request, the period pill and the pills of ids', () => {
    renderPage('/intelligence/reports?id=13&from=2026-09-01&to=2026-09-30&stores=1,2&brands=10&country=co&zone=Europe/Madrid')
    expect(lastCall().filters).toMatchObject({ from: '2026-09-01', to: '2026-09-30', businessIds: [1, 2], franchises_id: [10], timeZone: 'Europe/Madrid' })
    expect(lastCall().countryCode).toBe('CO')
    expect(pill('Period')).toHaveTextContent('1 Sep 2026 – 30 Sep 2026')
  })

  // redesign a shared link learns the brand name on load; the stores, with no API in this test, stay a count
  it('the ids that come with the address: the brand gets its name, the stores a count, never «undefined» nor the id', async () => {
    renderPage('/intelligence/reports?id=13&stores=1,2&brands=10')
    const bar = screen.getByRole('group', { name: 'Filters' })
    expect(normal(pill('Stores'))).toBe('Stores 2')
    await waitFor(() => expect(normal(pill('Brand'))).toBe('Brand Acme Foods'))
    expect(bar.textContent).not.toMatch(/undefined|null|NaN/)
    // the chips say the same (a figure node splits the text: read it whole)
    const chips = [...document.querySelectorAll('.odc-chip-text')].map(node => normal(node))
    expect(chips).toEqual(['Brand: Acme Foods', '2 stores'])
  })

  it('writes the address of the report on load: the period it uses, with the id kept and a replace (no new entry)', async () => {
    renderPage('/intelligence/reports?id=13')
    await waitFor(() => expect(queryOf().get('from')).toBe(DEFAULT_FROM))
    expect(runtime.location.search).toBe(`?id=13&from=${DEFAULT_FROM}&to=${TODAY}`)
    expect(runtime.history.length).toBe(1)
  })

  it('changing a filter replaces the address: Back still goes to the catalog', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Orders over time')
    const entries = runtime.history.length
    const period = await openPill(user, 'Period')
    await user.click(within(period).getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    await waitFor(() => expect(queryOf().get('from')).toBe('2026-09-10'))
    const stores = await openPill(user, 'Stores')
    await user.click(within(stores).getByRole('checkbox', { name: 'Alpha Pizza' }))
    await waitFor(() => expect(queryOf().get('stores')).toBe('1'))
    expect(runtime.location.search).toBe(`?id=13&from=2026-09-10&to=${TODAY}&stores=1`)
    expect(runtime.history.length).toBe(entries)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stores' })).toBeNull(), EXIT)
    act(() => runtime.history.goBack())
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    expect(runtime.location.search).toBe('')
  })

  it('the country and the zone of the page are in the address, and the zone only when it is not the browser\'s', async () => {
    renderPage('/intelligence/reports?id=13')
    act(() => runtime.controllers.last.countries.handleChangeCode('CO'))
    await waitFor(() => expect(queryOf().get('country')).toBe('CO'))
    expect(queryOf().has('zone')).toBe(false)
    act(() => runtime.controllers.last.countries.handleChangeCode('CO'))
    await waitFor(() => expect(queryOf().has('country')).toBe(false))
  })

  it('«All reports» takes every filter out of the address; opening a report writes its own', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13&from=2026-09-01&to=2026-09-30&stores=1')
    await user.click(screen.getByRole('button', { name: 'All reports' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    await waitFor(() => expect(runtime.location.search).toBe(''))
    await openReport(user, 'Sales over time')
    await waitFor(() => expect(queryOf().get('stores')).toBe('1'))
    expect(queryOf().get('from')).toBe('2026-09-01')
  })

  it('switching report writes the params of the new one: the brand goes where there is no Brand pill, the day comes with report 7', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13&stores=1&brands=10')
    await switchTo(user, 'Distance by driver')
    await waitFor(() => expect(queryOf().has('brands')).toBe(false))
    expect(runtime.location.search).toBe(`?id=10&from=${DEFAULT_FROM}&to=${TODAY}&stores=1`)
    await switchTo(user, 'Driver schedule')
    await waitFor(() => expect(queryOf().get('day')).toBe(TODAY))
    expect(runtime.location.search).toBe(`?id=7&day=${TODAY}`)
    // the page keeps its filters between reports (D4): the brand is back with report 13
    await switchTo(user, 'Orders over time')
    await waitFor(() => expect(queryOf().get('brands')).toBe('10'))
  })

  it('⌘K pushes a bare ?id of another report: the address gets the filters of the page for it', async () => {
    renderPage('/intelligence/reports?id=13&stores=1')
    act(() => runtime.history.push('/intelligence/reports?id=14'))
    expect(titleOf()).toHaveTextContent('Sales over time')
    await waitFor(() => expect(queryOf().get('stores')).toBe('1'))
    expect(queryOf().get('id')).toBe('14')
  })

  it('report 7 starts from the day of the address and writes it back', async () => {
    renderPage('/intelligence/reports?id=7&day=2026-10-01&from=2026-09-01&to=2026-09-30')
    expect(lastCall().filters).toMatchObject({ from: '2026-10-01', to: '2026-10-01' })
    await waitFor(() => expect(runtime.location.search).toBe('?id=7&day=2026-10-01'))
  })

  it('anything invalid falls back to the defaults and the address is corrected; params that are not filters stay', async () => {
    renderPage('/intelligence/reports?id=13&from=nope&to=2026-09-30&stores=x&country=Colombia&utm=mail')
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY, businessIds: null })
    expect(lastCall().countryCode).toBe('')
    await waitFor(() => expect(runtime.location.search).toBe(`?id=13&utm=mail&from=${DEFAULT_FROM}&to=${TODAY}`))
  })

  it('the catalog on a fresh load ignores filter params and takes them out', async () => {
    renderPage('/intelligence/reports?from=2026-09-01&to=2026-09-30&stores=1&utm=mail')
    expect(screen.getByRole('heading', { level: 1, name: 'Enterprise reports' })).toBeInTheDocument()
    await waitFor(() => expect(runtime.location.search).toBe('?utm=mail'))
    const user = userEvent.setup()
    await openReport(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY, businessIds: null })
  })
})

// redesign (D-21, option B): the country opens by itself only the first time of the visit
describe('the country opens by itself only the first time of the visit (D-21)', () => {
  const TWO = [{ id: 1, code: 'CO', name: 'Colombia' }, { id: 2, code: 'US', name: 'United States' }]
  beforeEach(() => {
    runtime.controllers.countries.countriesState = { loading: false, error: null, countries: TWO }
  })

  it('opens on the first report with several countries and not on the second one of the same visit; the pill stays', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull(), EXIT)
    await switchTo(user, 'Sales over time')
    expect(runtime.mounts.countries).toBe(2)
    expect(pill('Country')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    // by hand it still opens
    const popup = await openPill(user, 'Country')
    expect(within(popup).getByRole('radio', { name: 'Colombia' })).toBeInTheDocument()
  })

  it('a report without the Country pill does not use the first time: the first one that has it opens it', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=7')
    expect(screen.queryByRole('button', { name: /^Country/ })).toBeNull()
    await switchTo(user, 'Orders over time')
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })

  it('a new visit (the page mounted again) opens it again', async () => {
    const first = renderPage('/intelligence/reports?id=13')
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    first.unmount()
    document.getElementById('app-modals')?.remove()
    renderPage('/intelligence/reports?id=13')
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })

  it('the first report is left before its countries arrived: the first one that has them opens', async () => {
    const user = userEvent.setup()
    runtime.controllers.countries.countriesState = { loading: true, error: null, countries: [] }
    renderPage('/intelligence/reports?id=13')
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    runtime.controllers.countries.countriesState = { loading: false, error: null, countries: TWO }
    await switchTo(user, 'Sales over time')
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })

  it('a project with one country never shows the pill nor opens it', async () => {
    runtime.controllers.countries.countriesState = { loading: false, error: null, countries: [TWO[0]] }
    renderPage('/intelligence/reports?id=13')
    expect(screen.queryByRole('button', { name: /^Country/ })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
  })
})

describe('report 7 · the day of the schedule (D3)', () => {
  it('starts on today, asks for that one day and does not touch the range of the page', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=7')
    expect(lastCall()).toMatchObject({ endpoint: 'drivers_operation_events' })
    expect(lastCall().filters).toMatchObject({ from: TODAY, to: TODAY })
    expect(screen.getByRole('combobox', { name: /^Day / })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Period/ })).toBeNull()
    const line = document.querySelector('.odc-rp-period-line')
    expect(normal(line)).toBe(`${TODAY}..${TODAY}`)
    await switchTo(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY })
  })

  it('a day chosen is what the report asks for, and it starts on today again each time report 7 is opened', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=7')
    await user.click(screen.getByRole('combobox', { name: /^Day / }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(dialog.querySelector('[data-day="2026-10-08"]'))
    await waitFor(() => expect(lastCall().filters).toMatchObject({ from: '2026-10-08', to: '2026-10-08' }), EXIT)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    await switchTo(user, 'Orders over time')
    expect(lastCall().filters).toMatchObject({ from: DEFAULT_FROM, to: TODAY })
    await switchTo(user, 'Driver schedule')
    expect(lastCall().filters).toMatchObject({ from: TODAY, to: TODAY })
    // never a request for the old day under the new report
    expect(runtime.calls.filter(call => call.endpoint === 'drivers_operation_events').pop().filters.from).toBe(TODAY)
  })
})

describe('the focus (D1)', () => {
  it('opening a report puts the focus on its title, which is the h1 with tabindex -1', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Customer satisfaction' }))
    await waitFor(() => expect(titleOf()).toHaveFocus())
    expect(titleOf()).toHaveAttribute('tabindex', '-1')
    expect(titleOf()).toHaveTextContent('Customer satisfaction')
  })

  it('«All reports» puts the focus on the button of that report in the catalog', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Top drivers by orders')
    await user.click(screen.getByRole('button', { name: 'All reports' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Top drivers by orders' })).toHaveFocus())
  })

  it('Back in the browser also returns the focus to the report that was open', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, 'Order heat map')
    act(() => runtime.history.goBack())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Order heat map' })).toHaveFocus())
  })

  it('switching report puts the focus on the title of the new one', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13')
    await switchTo(user, 'Sales by brand')
    await waitFor(() => expect(titleOf()).toHaveFocus())
  })
})

// redesign (n.º 21, P2 of ecommerce-reports): the Clicks report of the old ecommerce page is report 22 of this one, in the Customers group
describe('report 22 · Clicks on stores, products and categories (n.º 21)', () => {
  const CLICKS = 'Clicks on stores, products and categories'
  // (option B): no client records clicks on categories, so their card is only painted when the answer brings some
  const CARDS = ['Clicks on stores', 'Clicks on products']
  const NO_CATEGORIES = 'Clicks on categories are not recorded yet.'
  const click = (id, name, total) => ({ object_id: id, name, total })
  const card = (name) => screen.getByRole('region', { name })
  // the request the clicks hook would make: the query string `buildParams` makes of the filters it was given
  const queryOfClicks = () => lastCall().buildParams(lastCall().filters)

  it('is in the catalog, in Customers after Customer satisfaction, with its description', () => {
    renderPage()
    const section = screen.getByRole('region', { name: 'Customers' })
    const buttons = within(section).getAllByRole('button')
    expect(buttons.map(button => Number(button.getAttribute('data-report-id')))).toEqual([15, 16, 22])
    expect(within(section).getByRole('button', { name: CLICKS })).toHaveAccessibleDescription('What customers opened most in the apps and websites, in the period.')
  })

  it('is found by its name, its description, «Real time» of main and its Spanish aliases', async () => {
    const user = userEvent.setup()
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Find a report' })
    const shown = () => screen.queryAllByRole('button').map(button => button.getAttribute('data-report-id')).filter(Boolean).map(Number)
    await user.type(search, 'categories')
    expect(shown()).toContain(22)
    await user.clear(search)
    await user.type(search, 'Real time')
    expect(shown()).toEqual([22])
    await user.clear(search)
    await user.type(search, 'clics')
    expect(shown()).toEqual([22])
  })

  it('?id=22 opens the clicks view in the shell of the report: title, description, two cards and no report body', () => {
    renderPage('/intelligence/reports?id=22')
    expect(titleOf()).toHaveTextContent(CLICKS)
    expect(screen.getByText('What customers opened most in the apps and websites, in the period.')).toBeInTheDocument()
    const view = document.querySelector('[data-slot="clicks-view"]')
    expect(view).toHaveClass('odc-root', 'odc-rp-page')
    expect(view).toHaveAttribute('data-report', '22')
    expect(screen.queryByTestId('report-body')).toBeNull()
    expect(CARDS.map(name => card(name))).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'All reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch report' })).toBeInTheDocument()
    // the Learn of «Real time» in main
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(runtime.learn).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'business_reports' })]))
  })

  it('opening it from the catalog pushes ?id=22, and the address carries the period of the clicks', async () => {
    const user = userEvent.setup()
    renderPage()
    await openReport(user, CLICKS)
    expect(queryOf().get('id')).toBe('22')
    await waitFor(() => expect(queryOf().get('from')).toBe(DEFAULT_FROM))
    expect(queryOf().get('to')).toBe(TODAY)
    // the channel is not a param of the address
    expect(queryOf().has('channels')).toBe(false)
    await waitFor(() => expect(titleOf()).toHaveFocus())
    expect(titleOf()).toHaveAttribute('tabindex', '-1')
  })

  it('asks for the same request as the clicks of the ecommerce page: tracking_events, the last 7 days plus today, no channel', () => {
    renderPage('/intelligence/reports?id=22')
    expect(lastCall()).toMatchObject({ endpoint: 'tracking_events', enabled: true })
    expect(lastCall().buildParams).toEqual(expect.any(Function))
    expect(queryOfClicks()).toBe(`timezone=${BROWSER_ZONE}&from=${DEFAULT_FROM} 00:00:00&to=${TODAY} 23:59:59`)
  })

  it('has Period first, then Brand and Timezone, the line of dates and the row of channels; no Stores, Driver, Order type or Channel pill', () => {
    renderPage('/intelligence/reports?id=22')
    const bar = screen.getByRole('group', { name: 'Filters' })
    const names = within(bar).getAllByRole('button').map(button => button.textContent)
    expect(names[0]).toMatch(/^Period/)
    expect(names.some(name => /^Brand/.test(name))).toBe(true)
    expect(names.some(name => /^Time ?zone/i.test(name))).toBe(true)
    ;['Stores', 'Driver', 'Order type'].forEach(name => expect(within(bar).queryByRole('button', { name: new RegExp(`^${name}`) })).toBeNull())
    expect(normal(document.querySelector('.odc-rp-period-line'))).toBe(`${DEFAULT_FROM}..${TODAY}`)
    const row = screen.getByRole('group', { name: 'Channel' })
    expect(within(row).getAllByRole('button').map(button => button.textContent)).toEqual(['All channels', 'web', 'ios'])
    expect(within(row).getByRole('button', { name: 'All channels' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('choosing a channel asks for app_id=<id>, and «All channels» takes it out of the request again', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=22')
    await user.click(screen.getByRole('button', { name: 'web' }))
    expect(queryOfClicks()).toContain('&app_id=web')
    await user.click(screen.getByRole('button', { name: 'All channels' }))
    expect(queryOfClicks()).not.toContain('app_id')
  })

  it('paints one card per type with the rows of the answer, sorted by clicks, and an empty card for a missing key', () => {
    runtime.result = {
      ...runtime.result,
      data: { click: { Business: [click(1, 'Alpha Pizza', '3'), click(2, 'Beta Burgers', '9')], Category: [click(4, 'Drinks', 2)] } }
    }
    renderPage('/intelligence/reports?id=22')
    const storeRows = within(within(card('Clicks on stores')).getByRole('table', { name: 'Top 10: Clicks on stores' })).getAllByRole('row').slice(1)
    expect(storeRows.map(row => within(row).getByRole('rowheader').textContent)).toEqual(['Beta Burgers', 'Alpha Pizza'])
    expect(normal(card('Clicks on stores').querySelector('.odc-ec-clicks-summary'))).toBe('12 clicks · 2 in the list')
    expect(within(card('Clicks on categories')).getByRole('table', { name: 'Top 10: Clicks on categories' })).toHaveTextContent('Drinks')
    expect(within(card('Clicks on products')).getByText('No clicks in this period.')).toBeInTheDocument()
    expect(screen.queryByText(NO_CATEGORIES)).toBeNull()
  })

  it('without clicks on categories leaves their card and its CSV out, and says why', () => {
    runtime.result = {
      ...runtime.result,
      data: { click: { Business: [click(1, 'Alpha Pizza', '3'), click(2, 'Beta Burgers', '9')], Product: [click(7, 'Fries', 4)] } }
    }
    renderPage('/intelligence/reports?id=22')
    const storeRows = within(within(card('Clicks on stores')).getByRole('table', { name: 'Top 10: Clicks on stores' })).getAllByRole('row').slice(1)
    expect(storeRows.map(row => within(row).getByRole('rowheader').textContent)).toEqual(['Beta Burgers', 'Alpha Pizza'])
    expect(normal(card('Clicks on stores').querySelector('.odc-ec-clicks-summary'))).toBe('12 clicks · 2 in the list')
    expect(within(card('Clicks on products')).getByRole('table', { name: 'Top 10: Clicks on products' })).toHaveTextContent('Fries')
    expect(screen.queryByRole('region', { name: 'Clicks on categories' })).toBeNull()
    expect(screen.queryByRole('button', { name: /CSV: Clicks on categories/ })).toBeNull()
    expect(screen.getByText(NO_CATEGORIES).closest('[role="note"]')).toHaveClass('odc-notice')
  })

  it('says nothing about categories while it loads or after an error', () => {
    runtime.result = { ...runtime.result, loading: true }
    const { unmount } = renderPage('/intelligence/reports?id=22')
    expect(screen.queryByText(NO_CATEGORIES)).toBeNull()
    unmount()
    runtime.result = { ...runtime.result, loading: false, error: 'boom' }
    renderPage('/intelligence/reports?id=22')
    expect(screen.queryByText(NO_CATEGORIES)).toBeNull()
  })

  it('keeps its CSV: one download per card, off while there is nothing to download', () => {
    runtime.result = { ...runtime.result, data: { click: { Business: [click(1, 'Alpha Pizza', 3)] } } }
    renderPage('/intelligence/reports?id=22')
    expect(within(card('Clicks on stores')).getByRole('button', { name: /CSV/i })).toBeEnabled()
    expect(within(card('Clicks on products')).getByRole('button', { name: /CSV/i })).toBeDisabled()
  })

  it('«Switch report» lists the 22 with Clicks checked; choosing another opens its report, and the way back keeps the period', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=22')
    await user.click(screen.getByRole('button', { name: 'Switch report' }))
    const items = await screen.findAllByRole('menuitemradio')
    expect(items).toHaveLength(22)
    const checked = items.filter(item => item.getAttribute('aria-checked') === 'true')
    expect(checked.map(item => item.querySelector('.odc-menu-label').textContent)).toEqual([CLICKS])
    expect(items[items.length - 1].querySelector('.odc-menu-label').textContent).toBe(CLICKS)
    await user.click(items.find(item => item.querySelector('.odc-menu-label').textContent === 'Orders over time'))
    await waitFor(() => expect(titleOf()).toHaveTextContent('Orders over time'))
    expect(queryOf().get('id')).toBe('13')
    expect(screen.getByTestId('report-body')).toHaveAttribute('data-report', '13')
    await switchTo(user, CLICKS)
    expect(queryOf().get('id')).toBe('22')
    expect(queryOfClicks()).toContain(`from=${DEFAULT_FROM} 00:00:00`)
  })

  it('the channel survives a change of report and comes back; the other reports do not carry it', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=22')
    await user.click(screen.getByRole('button', { name: 'ios' }))
    await switchTo(user, 'Orders over time')
    expect(lastCall().buildParams).toBeUndefined()
    expect(lastCall().filters).not.toHaveProperty('app_id')
    await switchTo(user, CLICKS)
    expect(queryOfClicks()).toContain('&app_id=ios')
  })

  it('a period chosen in another report stays in the clicks', async () => {
    const user = userEvent.setup()
    renderPage('/intelligence/reports?id=13&from=2026-09-10&to=2026-10-10')
    await switchTo(user, CLICKS)
    expect(queryOfClicks()).toContain('from=2026-09-10 00:00:00&to=2026-10-10 23:59:59')
  })
})

describe('the sheet of styles (D9, decision 5)', () => {
  const file = path.join(__dirname, '..', 'reports.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only names its own classes with the odc-rp prefix', () => {
    const own = (strip(read()).match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-rp-'))
    expect(own).toEqual([])
    expect(strip(read())).toMatch(/\.odc-rp-page/)
  })

  it('breaks at the phone, below 768, and on the two columns of the catalog, from 768', () => {
    const queries = (strip(read()).match(/@media[^{]+/g) ?? []).filter(query => !/^@media\s+print\b/.test(query))
    expect(queries.some(query => /max-width:\s*767px/.test(query))).toBe(true)
    expect(queries.some(query => /min-width:\s*768px/.test(query))).toBe(true)
    queries.forEach(query => expect(query).toMatch(/\b(?:767|768)px\b/))
  })

  it('does not import styled-components nor the old styles of the page', () => {
    ;['index.js', 'ReportsCatalog.jsx', 'ReportView.jsx', 'reportFilters.js'].forEach(name => {
      const source = readFileSync(path.join(__dirname, '..', name), 'utf8')
      expect(source).not.toMatch(/styled-components/)
      expect(source).not.toMatch(/from '\.\/styles'/)
      expect(source).not.toMatch(/ReportsSlaOrders|SideBar/)
    })
  })
})

// (W1, owner decision 28 B): the report header opts into PageHeader's `wideTitle` (the title gets the whole row in a narrow
// header, ); the catalog's header does not.
describe('report headers take the whole row for the title (decision 28)', () => {
  it('marks the lead block of a report and of the clicks view, not the catalog', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    expect(document.querySelector('.odc-pagehead-lead')).not.toHaveAttribute('data-wide-title')
    await openReport(user, 'Orders over time')
    expect(document.querySelector('[data-slot="reports-view"] .odc-pagehead-lead')).toHaveAttribute('data-wide-title', '')
    unmount()
    renderPage('/intelligence/reports?id=22')
    expect(document.querySelector('[data-slot="clicks-view"] .odc-pagehead-lead')).toHaveAttribute('data-wide-title', '')
  })
})

// api-core filters tracking_events by the country of the store (country_code); report 22 keeps its Country pill
// (owner decision 12 C) and sends the chosen country.
describe('report 22 filters by country', () => {
  const TWO = [{ id: 1, code: 'CO', name: 'Colombia' }, { id: 2, code: 'US', name: 'United States' }]
  beforeEach(() => {
    runtime.controllers.countries.countriesState = { loading: false, error: null, countries: TWO }
  })

  it('sends the country as country_code, with no «not filtered» notice', () => {
    renderPage('/intelligence/reports?id=22&country=US')
    expect(lastCall().buildParams(lastCall().filters)).toContain('&country_code=US')
    expect(screen.queryByText('This report is not filtered by country yet.')).toBeNull()
    expect(pill('Country')).toBeInTheDocument()
  })

  it('sends no country without one chosen', () => {
    renderPage('/intelligence/reports?id=22')
    expect(lastCall().buildParams(lastCall().filters)).not.toMatch(/country/i)
  })
})
