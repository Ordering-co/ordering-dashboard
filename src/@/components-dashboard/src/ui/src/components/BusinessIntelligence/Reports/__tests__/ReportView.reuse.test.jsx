/* eslint-disable import/first */
// redesign ecommerce FC (D1, D2): the pieces of /intelligence/reports that /intelligence/ecommerce_reports reuses. `ReportView` takes two optional
// props (`switchReports`, `learn`), `PeriodPill` is exported, and `Section` and `ReportItem` of the catalog are exported (`ReportItem` takes an
// optional `icon`). Without the props, the menu still lists the 22 reports of /intelligence/reports (Reports.test.jsx covers the rest).
// The stand-ins are the ones of Reports.test.jsx: the data hook, the body, usePeriodText and the controllers of the filter pills.
import React from 'react'
import dayjs from 'dayjs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  calls: [],
  result: {},
  collapsed: false,
  collapse: vi.fn(),
  configs: {},
  controllers: { stores: {}, brands: {}, countries: {}, groups: {}, drivers: {}, channels: {} }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  // a controller stand-in: it hands its UIComponent the props it was given plus what the real one computes
  const controller = key => function Controller (props) {
    const { UIComponent, ...rest } = props
    return react.createElement(UIComponent, { ...rest, ...runtime.controllers[key] })
  }
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useUtils: () => [{
      parseDate: (date) => dayjs(String(date).slice(0, 10)).format('D MMM YYYY')
    }],
    AnalyticsBusinessFilter: controller('stores'),
    ReportsBrandFilter: controller('brands'),
    CountryList: controller('countries'),
    ReportsDriverGroupFilter: controller('groups'),
    ReportsDriverFilter: controller('drivers'),
    ReportsAppIdFilter: controller('channels')
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
    ReportBody: (props) => react.createElement('div', { 'data-testid': 'report-body', 'data-report': String(props.report.id) })
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
import { EMPTY_REPORT_NAMES } from '../../AnalyticsKit/ReportFilterPills'
import { initialFilters } from '../reportFilters'
import { todayDay } from '../../../../../../utils/dateRange'
import { PeriodPill, ReportView } from '../ReportView'
import { ReportItem, Section } from '../ReportsCatalog'

const byId = (id) => ADVANCED_REPORTS.find(report => report.id === id)
const label = (item) => item.querySelector('.odc-menu-label').textContent

const setControllers = () => {
  runtime.controllers.stores = {
    businessList: { loading: false, error: null, businesses: [{ id: 1, name: 'Alpha Pizza', logo: null }], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 1 } },
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
    brandList: { loading: false, error: null, brands: [{ id: 10, name: 'Acme Foods' }], pagination: null },
    brandIds: null,
    handleChangeBrandId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
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
    driverGroupList: { loading: false, error: null, driverGroups: [], pagination: null },
    driverGroupIds: null,
    handleChangeDriverGroupId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  runtime.controllers.drivers = {
    driverList: { loading: false, error: null, drivers: [], pagination: null },
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

const renderView = (extra = {}, reportId = 13) => {
  const props = {
    report: byId(reportId),
    filters: initialFilters(todayDay(), 'UTC'),
    countryCode: '',
    scheduleDay: todayDay(),
    names: EMPTY_REPORT_NAMES,
    onChangeFilters: vi.fn(),
    onChangeCode: vi.fn(),
    onChangeDay: vi.fn(),
    onChangeNames: vi.fn(),
    onClearFilters: vi.fn(),
    onBack: vi.fn(),
    onSwitch: vi.fn(),
    ...extra
  }
  return { props, ...render(<ReportView {...props} />) }
}
const openSwitch = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Switch report' }))
  return screen.findAllByRole('menuitemradio')
}

beforeEach(() => {
  vi.clearAllMocks()
  runtime.calls = []
  runtime.collapsed = false
  runtime.result = { data: null, data1: null, loading: false, updating: false, error: null, error1: null, retry: vi.fn() }
  runtime.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  setControllers()
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('ReportView · switchReports', () => {
  const SWITCH = [
    { id: 1, name: 'Users', groupLabel: 'Delivery' },
    { id: 2, name: 'Discounts', groupLabel: 'Delivery' },
    { id: 3, name: 'Store map', groupLabel: 'Stores and service' },
    { id: 4, name: 'Clicks', groupLabel: 'Customers' }
  ]

  it('lists the entries it is given, in that order, with the group said on the first of each groupLabel and a separator between groups', async () => {
    const user = userEvent.setup()
    renderView({ switchReports: SWITCH })
    const items = await openSwitch(user)
    expect(items.map(label)).toEqual(['Users', 'Discounts', 'Store map', 'Clicks'])
    expect(screen.getAllByRole('separator')).toHaveLength(2)
    const described = items.map(item => item.querySelector('.odc-menu-description')?.textContent ?? null)
    expect(described).toEqual(['Delivery', null, 'Stores and service', 'Customers'])
  })

  it('checks nothing when the open report is not in the list', async () => {
    const user = userEvent.setup()
    renderView({ switchReports: SWITCH }, 13)
    expect((await openSwitch(user)).filter(item => item.getAttribute('aria-checked') === 'true')).toHaveLength(0)
  })

  it('checks the open report when it is in the list, and choosing an entry calls onSwitch with its id', async () => {
    const user = userEvent.setup()
    const { props } = renderView({ switchReports: [{ id: 13, name: 'Orders', groupLabel: 'Sales' }, ...SWITCH] }, 13)
    const items = await openSwitch(user)
    expect(items.filter(item => item.getAttribute('aria-checked') === 'true').map(label)).toEqual(['Orders'])
    await user.click(items.find(item => label(item) === 'Clicks'))
    expect(props.onSwitch).toHaveBeenCalledWith(4)
  })

  it('without switchReports the menu still lists the 22 reports in the order of the catalog, with 4 separators', async () => {
    const user = userEvent.setup()
    renderView()
    const items = await openSwitch(user)
    expect(items).toHaveLength(22)
    const ordered = ADVANCED_REPORT_GROUPS.flatMap(group => ADVANCED_REPORTS.filter(report => report.group === group))
    expect(items.map(label)).toEqual(ordered.map(report => report.name))
    expect(screen.getAllByRole('separator')).toHaveLength(4)
    expect(items.filter(item => item.getAttribute('aria-checked') === 'true').map(label)).toEqual(['Orders over time'])
  })
})

describe('ReportView · learn', () => {
  it('hands the node to the header, which paints it', () => {
    renderView({ learn: <button type='button'>Learn more</button> })
    expect(within(screen.getByRole('heading', { level: 1 }).closest('.odc-pagehead')).getByRole('button', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('paints nothing extra without it', () => {
    renderView()
    expect(screen.queryByRole('button', { name: 'Learn more' })).toBeNull()
  })
})

describe('PeriodPill', () => {
  it('is exported and shows the preset that matches the range', () => {
    const today = todayDay()
    render(<PeriodPill from={today} to={today} today={today} onApplyRange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Period/ })).toHaveTextContent('Today')
  })
})

describe('the catalog pieces', () => {
  const texts = { name: 'Some report', description: 'What it measures.' }

  it('ReportItem keeps the icon of the registry when no icon is given, and the id on the button', () => {
    render(<ul><ReportItem report={{ id: 13 }} texts={texts} onOpen={vi.fn()} /></ul>)
    const button = screen.getByRole('button', { name: 'Some report' })
    expect(button).toHaveAttribute('data-report-id', '13')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button.querySelector('[data-testid="custom-icon"]')).toBeNull()
  })

  it('ReportItem paints the icon it is given instead of the registry icon, and opens with the id', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const Custom = ({ className }) => <svg data-testid='custom-icon' className={className} aria-hidden='true' />
    render(<ul><ReportItem report={{ id: 4 }} texts={texts} icon={Custom} onOpen={onOpen} /></ul>)
    const button = screen.getByRole('button', { name: 'Some report' })
    expect(button.querySelector('[data-testid="custom-icon"]')).toHaveClass('odc-rp-item-icon')
    expect(button.querySelectorAll('svg')).toHaveLength(1)
    await user.click(button)
    expect(onOpen).toHaveBeenCalledWith(4)
  })

  it('Section is a region named by its heading', () => {
    render(<Section title='Delivery'><li>one</li></Section>)
    const region = screen.getByRole('region', { name: 'Delivery' })
    expect(within(region).getByRole('heading', { level: 2, name: 'Delivery' })).toBeInTheDocument()
    expect(within(region).getByText('one')).toBeInTheDocument()
  })
})
