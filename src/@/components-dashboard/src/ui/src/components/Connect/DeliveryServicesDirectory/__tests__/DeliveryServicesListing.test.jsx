/* eslint-disable import/first */
// redesign DS-B4 (decisions 1, 3, 4, 6, 7, 17 | M-DS1, M-DS2, M-DS5, M-DS7, M-DS10, M-DS21): the delivery services page. The controller
// (K/DeliveryServices) is played by `Host` with the props it gives; the table (B2) and the panel (B3) are stubs that record what they
// receive: what is tested is how they are composed and what the page owns (the URL, the open provider, the guard, the open checks and their
// three notices, the client-side pages, Install, the errors of the controller and who shows them). PageHeader, SearchField, SplitView,
// Pagination and AlertDialog are the real Product wrappers.
import React from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ table: null, panel: null, mounts: [], controller: null, closeRequests: 0 }))
const ctl = vi.hoisted(() => ({ props: {}, config: { configs: {}, loading: false }, panelDirty: false, pending: null, history: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [ctl.config],
  // the controller of the page (K/DeliveryServices), played by a probe: the wrapper of C/N/DeliveryServices is tested below
  DeliveryServices: (props) => {
    seen.controller = props
    return null
  }
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../ProvidersTable', () => ({
  ProvidersTable: (props) => {
    seen.table = props
    return (
      <div className='odc-table-scroll' role='region' aria-label='Providers table'>
        {props.companies.map(company => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={company.id} data-row-id={company.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpen(company)}>Open {company.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onClearSearch()}>Table clear search</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
      </div>
    )
  }
}))

vi.mock('../ProviderPanel', async () => {
  const React = await import('react')
  return {
    ProviderPanel: (props) => {
      seen.panel = props
      const [asking, setAsking] = React.useState(false)
      React.useEffect(() => { seen.mounts.push(props.company.id) }, [])
      // what RecordPanel does with `requestClose(proceed)`: ask when dirty, else go on
      React.useImperativeHandle(props.panelRef, () => ({
        requestClose: (proceed) => {
          seen.closeRequests++
          const next = typeof proceed === 'function' ? proceed : props.onClose
          if (ctl.panelDirty) {
            ctl.pending = next
            setAsking(true)
          } else {
            next?.()
          }
        }
      }), [props.onClose])
      return (
        <div data-testid='provider-panel'>
          <span>Panel of provider {props.company.id}</span>
          <span data-testid='panel-section'>{String(props.section)}</span>
          <span data-testid='panel-expanded'>{String(props.expanded)}</span>
          <button type='button' onClick={() => props.panelRef.current.requestClose()}>Close panel</button>
          <button type='button' onClick={() => props.onSectionChange('schedule')}>To schedule</button>
          <button type='button' onClick={() => props.onToggleExpanded()}>Open as page</button>
          {asking && <button type='button' onClick={() => { setAsking(false); ctl.pending?.() }}>Discard in panel</button>}
        </div>
      )
    }
  }
})

import { DeliveryServicesListingUI } from '../DeliveryServicesListing'
import { DeliveryServices } from '../../DeliveryServices'
import { LIVE_QUERY_PATHS } from '../../../../hooks/useDashboardNavigation'

const company = (id, extra = {}) => ({
  id,
  name: `Provider ${id}`,
  enabled: true,
  plugin_id: 10 + id,
  plugin_root: `https://plugins.example/${id}.zip`,
  plugin: { id: 10 + id, key: `plugin${id}` },
  schedule: [{ enabled: true }],
  driver_groups: [{ id: 100 + id }],
  ...extra
})
const COMPANIES = [
  company(1, { name: 'Uber Direct' }),
  company(2, { name: 'DoorDash', plugin_id: null, plugin: null }), // not installed
  company(3, { name: 'Lalamove', driver_groups: [] }), // installed, no group
  company(4, { name: 'Picker Express', enabled: false })
]

const baseCtl = (overrides = {}) => ({
  isUseQuery: true,
  deliveryServicesState: { companies: COMPANIES, loading: false, error: null },
  setDeliveryServicesState: vi.fn(),
  businessesList: { businesses: [{ id: 3 }], loading: false, error: null },
  paymethodsList: { paymethods: [{ id: 4 }], loading: false, error: null },
  actionState: { loading: false, error: null },
  scheduleState: { loading: false, error: false, change: null, companyId: null },
  groupsInfo: { loading: false, error: null, groups: {} },
  deliveryGroups: { groups: [], loading: false, error: null },
  setDeliveryGroups: vi.fn(),
  handleUpdateDeliveryService: vi.fn(() => Promise.resolve({ ok: true })),
  handleScheduleState: vi.fn(),
  resetScheduleState: vi.fn(),
  handleInstallSysPlugin: vi.fn(() => Promise.resolve({ ok: true })),
  reloadDeliveryServices: vi.fn(() => Promise.resolve()),
  reloadGroupsInfo: vi.fn(),
  getDeliveryGroups: vi.fn((id) => Promise.resolve({ id, name: `Group ${id}`, enabled: true })),
  actionDisabled: false,
  ...overrides
})

const Probe = () => {
  ctl.history = useHistory()
  return null
}
const Host = () => (
  <>
    <Probe />
    <DeliveryServicesListingUI {...ctl.props} />
  </>
)

const ROUTE = '/connect/delivery-services'
let view
const renderPage = (ctlOverrides = {}, route = ROUTE) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const utils = renderWithProviders(<Host />, { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(<Host />)
    }
  }
  return view
}

const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))
const click = (name) => userEvent.click(screen.getByRole('button', { name }))
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 30)))

// jsdom answers matchMedia with `matches: false`: one is installed that evaluates the (min|max)-width queries against a width
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
beforeEach(() => {
  window.history.replaceState(null, '', ROUTE)
  window.localStorage.clear()
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  ctl.config = { configs: {}, loading: false }
  ctl.panelDirty = false
  ctl.pending = null
  seen.table = null
  seen.panel = null
  seen.mounts = []
  seen.closeRequests = 0
})

afterEach(() => {
  cleanup()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('composition', () => {
  it('draws the header with the title and the count, the search, the table and the pagination; no Learn, no panel yet', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Delivery services/ })).toBeInTheDocument()
    expect(screen.getByText('4 providers')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Providers table' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–4 of 4')
    expect(screen.queryByTestId('learn')).toBeNull()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
  })

  it('says «1 provider» for one', () => {
    renderPage({ deliveryServicesState: { companies: [COMPANIES[0]], loading: false, error: null } })
    expect(screen.getByText('1 provider')).toBeInTheDocument()
  })

  it('has the menu button, with a name, only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    infoShare.isCollapse = true
    view.update({})
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('gives the table the page it shows and the state of the load (the list does not fetch)', () => {
    renderPage()
    expect(seen.table.companies).toEqual(COMPANIES)
    expect(seen.table).toMatchObject({
      groupsInfo: ctl.props.groupsInfo,
      configs: {},
      configsLoading: false,
      actionDisabled: false,
      activeId: null,
      installingId: null,
      loading: false,
      error: null,
      searchValue: '',
      pageSize: 10
    })
    expect(typeof seen.table.onOpen).toBe('function')
    expect(typeof seen.table.onToggle).toBe('function')
    expect(typeof seen.table.onInstall).toBe('function')
  })

  // redesign DS-B4 (extra 3): the dictionary of configs of useConfig() and whether it is still loading
  it('gives the table the configs dictionary and, while it loads, configsLoading', () => {
    const dictionary = { plugin1_key: { id: 5, key: 'plugin1_key', value: 'x' } }
    ctl.config = { configs: dictionary, loading: true }
    renderPage()
    expect(seen.table.configs).toBe(dictionary)
    expect(seen.table.configsLoading).toBe(true)
  })

  it('Retry reloads the providers and Clear search empties the search', async () => {
    const { reloadDeliveryServices } = baseCtl()
    renderPage({ reloadDeliveryServices, deliveryServicesState: { companies: [], loading: false, error: ['boom'] } })
    expect(seen.table.error).toEqual(['boom'])
    await click('Table retry')
    expect(reloadDeliveryServices).toHaveBeenCalledTimes(1)
    cleanup()
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(seen.table.searchValue).toBe('zzz')
    await click('Table clear search')
    expect(seen.table.searchValue).toBe('')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })

  it('has no pagination and no count when the load failed or while the first load runs', () => {
    renderPage({ deliveryServicesState: { companies: [], loading: false, error: ['boom'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(screen.queryByText(/providers?$/)).toBeNull()
    view.update({ deliveryServicesState: { companies: [], loading: true, error: null } })
    expect(seen.table.loading).toBe(true)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('a reload that keeps the providers does not turn the table into skeletons', () => {
    renderPage({ deliveryServicesState: { companies: COMPANIES, loading: true, error: null } })
    expect(seen.table.loading).toBe(false)
    expect(seen.table.companies).toEqual(COMPANIES)
  })

  // The resize separator is only drawn once the split view has measured the tokens (no layout in jsdom), so its name
  // («Resize the provider panel», the storage key `od.delivery-services.panel`) is checked in the browser, not here.
  it('puts the provider panel beside the list, named after the provider', async () => {
    renderPage()
    await click('Open 1')
    expect(screen.getByRole('complementary', { name: 'Uber Direct' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Providers table' })).toBeInTheDocument()
  })
})

describe('search and pages (M-DS7: sanitised, client side)', () => {
  const many = Array.from({ length: 25 }, (_, index) => company(index + 1, { name: index % 5 === 0 ? `Alpha ${index + 1}` : `Beta ${index + 1}` }))
  const manyState = { companies: many, loading: false, error: null }

  it('shows 10 per page, the count of all, and writes ?page and ?pageSize as the list did', () => {
    renderPage({ deliveryServicesState: manyState })
    expect(screen.getByText('25 providers')).toBeInTheDocument()
    expect(seen.table.companies.map(item => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
  })

  it('does not write them without isUseQuery', () => {
    renderPage({ deliveryServicesState: manyState, isUseQuery: false })
    expect(urlParams().page).toBeUndefined()
  })

  it('Next shows the next ten and writes ?page=2', async () => {
    renderPage({ deliveryServicesState: manyState })
    await click('Next page')
    expect(seen.table.companies.map(item => item.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(urlParams().page).toBe('2')
  })

  it('a new page size keeps the first item in view', async () => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?page=2&pageSize=10`)
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(seen.table.companies).toHaveLength(25)
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '25' })
  })

  it('filters by name, as main did (a local, case-insensitive filter), and counts the filtered', async () => {
    renderPage({ deliveryServicesState: manyState })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'alpha')
    expect(seen.table.companies.map(item => item.name)).toEqual(['Alpha 1', 'Alpha 6', 'Alpha 11', 'Alpha 16', 'Alpha 21'])
    expect(screen.getByText('5 providers')).toBeInTheDocument()
    expect(seen.table.searchValue).toBe('alpha')
  })

  it('searching does not ask the controller for anything (no refetch per keystroke)', async () => {
    const onSearch = vi.fn()
    renderPage({ deliveryServicesState: manyState, onSearch })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'alpha')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('searching from page 3 goes back to page 1 (M-DS7: no empty, mute table)', async () => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?page=3&pageSize=10`)
    expect(seen.table.companies.map(item => item.id)).toEqual([21, 22, 23, 24, 25])
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'beta')
    expect(urlParams().page).toBe('1')
    expect(seen.table.companies.length).toBeGreaterThan(0)
    expect(seen.table.companies[0].name).toBe('Beta 2')
  })

  it('a search with no match leaves the table to say so; Clear search brings everything back on page 1', async () => {
    renderPage({ deliveryServicesState: manyState })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nothing like it')
    expect(seen.table.companies).toEqual([])
    expect(screen.getByText('0 providers')).toBeInTheDocument()
    await click('Table clear search')
    expect(seen.table.companies).toHaveLength(10)
  })

  it('?pageSize=-5 does not break the page (main threw a RangeError) and is 10', () => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?pageSize=-5`)
    expect(seen.table.pageSize).toBe(10)
    expect(seen.table.companies).toHaveLength(10)
    expect(urlParams().pageSize).toBe('10')
  })

  it.each(['7', '1.5', 'abc', '0', '100'])('?pageSize=%s is not an option: 10', (value) => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?pageSize=${value}`)
    expect(seen.table.pageSize).toBe(10)
    expect(urlParams().pageSize).toBe('10')
  })

  it('?pageSize=25 and 50 are kept', () => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?pageSize=25`)
    expect(seen.table.pageSize).toBe(25)
    expect(seen.table.companies).toHaveLength(25)
  })

  it('?page=99 is the last page (not an empty table) and the address says so', () => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?page=99`)
    expect(seen.table.companies.map(item => item.id)).toEqual([21, 22, 23, 24, 25])
    expect(urlParams().page).toBe('3')
  })

  it.each(['0', '-2', '1.5', 'abc'])('?page=%s is page 1', (value) => {
    renderPage({ deliveryServicesState: manyState }, `${ROUTE}?page=${value}`)
    expect(seen.table.companies[0].id).toBe(1)
    expect(urlParams().page).toBe('1')
  })

  it('keeps ?page=99 in the address until the providers have loaded (an empty first render must not overwrite it)', () => {
    renderPage({ deliveryServicesState: { companies: [], loading: true, error: null } }, `${ROUTE}?page=3`)
    expect(urlParams().page).toBe('3')
    view.update({ deliveryServicesState: manyState })
    expect(seen.table.companies.map(item => item.id)).toEqual([21, 22, 23, 24, 25])
  })
})

describe('opening a provider (decision 6; the three notices of main)', () => {
  it('a provider without plugin: the notice of main in a dialog, no panel, no request', async () => {
    renderPage()
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(dialog).toHaveTextContent('The DoorDash plugin is not installed. Use Install to add it before opening configuration.')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalled()
  })

  it('an installed provider without a group: its notice, and no group is asked for', async () => {
    renderPage()
    await click('Open 3')
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Lalamove is installed, but no driver delivery group is linked to this delivery company.')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalled()
  })

  it('a group that does not load: its notice with the group id, and no panel', async () => {
    renderPage({ getDeliveryGroups: vi.fn(() => Promise.resolve(undefined)) })
    await click('Open 1')
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Could not load driver delivery group (ID: 101) for Uber Direct.')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('a link ?id= to a provider that cannot open: the notice, and ?id= and ?tab= leave the address (main kept them)', async () => {
    renderPage({}, `${ROUTE}?id=2&tab=schedule&page=1&pageSize=10`)
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('The DoorDash plugin is not installed.')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
  })

  it('a failed open while another provider is open leaves that one open and its address alone', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 2')
    await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
    expect(urlParams().id).toBe('1')
  })

  it('a provider that can open: asks for its group, opens the panel with the group plus its plugin and schedule, and writes ?id=', async () => {
    renderPage()
    await click('Open 1')
    expect(await screen.findByText('Panel of provider 1')).toBeInTheDocument()
    expect(ctl.props.getDeliveryGroups).toHaveBeenCalledWith(101)
    expect(seen.panel.curDriversGroup).toEqual({
      id: 101,
      name: 'Group 101',
      enabled: true,
      plugin: COMPANIES[0].plugin,
      schedule: COMPANIES[0].schedule
    })
    expect(seen.panel.deliveryServiceId).toBe(1)
    expect(seen.panel.driverGroupId).toBe(101)
    expect(urlParams().id).toBe('1')
    expect(urlParams().tab).toBeUndefined() // the address is not rewritten to general
    expect(seen.table.activeId).toBe(1)
  })

  it('gives the panel what main gave the details, plus the company and its state', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(seen.panel).toMatchObject({
      deliveryServicesState: ctl.props.deliveryServicesState,
      setDeliveryServicesState: ctl.props.setDeliveryServicesState,
      scheduleState: ctl.props.scheduleState,
      businesses: [{ id: 3 }],
      businessesLoading: false,
      paymethods: [{ id: 4 }],
      handleScheduleState: ctl.props.handleScheduleState,
      resetScheduleState: ctl.props.resetScheduleState,
      deliveryGroups: ctl.props.deliveryGroups,
      setDeliveryGroups: ctl.props.setDeliveryGroups,
      actionDisabled: false,
      expanded: false
    })
    expect(seen.panel.company).toBe(COMPANIES[0])
    expect(seen.panel.panelRef).toBeDefined()
    expect(typeof seen.panel.onClose).toBe('function')
    expect(typeof seen.panel.onSectionChange).toBe('function')
    expect(typeof seen.panel.onToggleExpanded).toBe('function')
  })

  it('mounts the panel with the key of the provider: another provider is a new panel (no late answer of the first lands in the second)', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('Open 4')
    await screen.findByText('Panel of provider 4')
    expect(seen.mounts).toEqual([1, 4])
  })

  it('a slow answer of the first provider does not open it over the second one', async () => {
    let releaseFirst
    const getDeliveryGroups = vi.fn((id) => (id === 101
      ? new Promise(resolve => { releaseFirst = () => resolve({ id, name: 'Slow' }) })
      : Promise.resolve({ id, name: 'Fast' })))
    renderPage({ getDeliveryGroups })
    await click('Open 1')
    await click('Open 4')
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
    await act(async () => { releaseFirst() })
    expect(screen.getByText('Panel of provider 4')).toBeInTheDocument()
    expect(urlParams().id).toBe('4')
  })

  // redesign DS-B4 (extra 2): the company is read from the controller's state at every render
  it('gives the panel the company fresh from the state (its switch reads company.enabled) and its status', async () => {
    renderPage()
    await click('Open 4')
    await screen.findByText('Panel of provider 4')
    expect(seen.panel.company.enabled).toBe(false)
    expect(seen.panel.statusLabel).toBe('Paused')
    expect(seen.panel.statusFamily).toBe('cancel')
    view.update({ deliveryServicesState: { companies: COMPANIES.map(item => item.id === 4 ? { ...item, enabled: true } : item), loading: false, error: null } })
    expect(seen.panel.company.enabled).toBe(true)
    expect(seen.panel.statusLabel).toBe('Active')
    expect(seen.panel.statusFamily).toBe('done')
  })

  it('the status of the panel is read from the configs dictionary, like the list', async () => {
    ctl.config = { configs: { plugin1_id: { id: 5, key: 'plugin1_client_id', value: '' } }, loading: false }
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(seen.panel.statusLabel).toBe('Credentials incomplete')
    expect(seen.panel.statusFamily).toBe('review')
  })

  it('while the configs load, the panel is given no status (a word that could be wrong is not drawn)', async () => {
    ctl.config = { configs: {}, loading: true }
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(seen.panel.statusLabel).toBeUndefined()
    expect(seen.panel.statusFamily).toBeUndefined()
  })
})

describe('the address (M-DS21)', () => {
  it('?id= opens the provider as soon as there are providers, at the section of ?tab=', async () => {
    renderPage({ deliveryServicesState: { companies: [], loading: true, error: null } }, `${ROUTE}?id=1&tab=schedule`)
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    view.update({ deliveryServicesState: { companies: COMPANIES, loading: false, error: null } })
    expect(await screen.findByText('Panel of provider 1')).toBeInTheDocument()
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    expect(seen.table.activeId).toBe(1)
  })

  it('an ?id= that is not a number opens nothing', async () => {
    renderPage({}, `${ROUTE}?id=abc`)
    await settle()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalled()
  })

  // /connect/delivery-services?id=99999 said nothing and kept the id in the address (PosMenu says «not found» and cleans it)
  it('an ?id= that is not in the list says so in a dialog, opens nothing, asks for nothing and leaves the address clean', async () => {
    renderPage({}, `${ROUTE}?id=999&tab=schedule&page=1&pageSize=10`)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(dialog).toHaveTextContent("Sorry, we couldn't find this provider.")
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalled()
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
  })

  it('...and waits for the providers: while they load an unknown ?id= says nothing, once they are in it does', async () => {
    renderPage({ deliveryServicesState: { companies: [], loading: true, error: null } }, `${ROUTE}?id=999`)
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(urlParams().id).toBe('999')
    view.update({ deliveryServicesState: { companies: COMPANIES, loading: false, error: null } })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent("Sorry, we couldn't find this provider.")
    expect(urlParams().id).toBeUndefined()
  })

  it('...and an unknown ?id= while another provider is open says so and leaves that one open', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    act(() => { ctl.history.push(`${ROUTE}?id=999`) })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent("Sorry, we couldn't find this provider.")
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
  })

  // the ⌘K entry `integration:delivery:<id>` goes to `/connect/delivery-services?id=<id>` while the page is already on screen
  it('?id= that changes while the page is on screen opens that provider (a ⌘K link from this same page)', async () => {
    renderPage()
    await settle()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    act(() => { ctl.history.push(`${ROUTE}?id=4`) })
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
    act(() => { ctl.history.push(`${ROUTE}?id=1&tab=businesses`) })
    expect(await screen.findByText('Panel of provider 1')).toBeInTheDocument()
    expect(screen.getByTestId('panel-section')).toHaveTextContent('businesses')
  })

  it('the providers changing (a switch, an install) does not reopen what was closed with the same ?id= in the router', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await screen.findByText('Panel of provider 1')
    await click('Close panel')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    view.update({ deliveryServicesState: { companies: COMPANIES.map(item => ({ ...item })), loading: false, error: null } })
    await settle()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
  })

  it('a section change writes ?tab= and a provider that is opened next starts at Credentials again (no tab)', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('To schedule')
    expect(urlParams().tab).toBe('schedule')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    await click('Open 4')
    await screen.findByText('Panel of provider 4')
    expect(urlParams().id).toBe('4')
    expect(urlParams().tab).toBeUndefined()
    expect(screen.getByTestId('panel-section')).toHaveTextContent('undefined')
  })

  it('closing removes id and tab from the address, keeps page and pageSize, and drops the active row', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=schedule&page=1&pageSize=10`)
    await screen.findByText('Panel of provider 1')
    await click('Close panel')
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
    expect(seen.table.activeId).toBeNull()
  })

  it('«Open as page» is the panel\'s to ask, the page keeps the state, and closing resets it', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('Open as page')
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('true')
    await click('Close panel')
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false')
  })

  it('closing gives the focus back to the row that was open', async () => {
    renderPage({}, `${ROUTE}?id=4`)
    await screen.findByText('Panel of provider 4')
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="4"]')).toHaveFocus())
  })

  // redesign DS-R1-05 (review r1): Uber → Shipday → X by mouse. SplitView gives the focus back to the control that had it when the panel
  // OPENED (the first provider's row), and a focus already in the list is left alone: the row of the provider that was closed must win.
  it('after switching provider by mouse, closing gives the focus to the row of the provider that was closed, not the first one\'s', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('Open 4')
    await screen.findByText('Panel of provider 4')
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="4"]')).toHaveFocus())
    expect(document.querySelector('[data-row-id="1"]')).not.toHaveFocus()
  })
})

describe('the address loses ?id= while a panel is open (DS-R1-01 follow-up)', () => {
  // ⌘K to «Delivery services» (no id) or the Back button: the page did not cause it, and the panel must not outlive its address unasked
  it('a clean panel closes, and id and tab leave the address', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('To schedule')
    expect(urlParams()).toMatchObject({ id: '1', tab: 'schedule' })
    act(() => { ctl.history.push(ROUTE) })
    await waitFor(() => expect(screen.queryByTestId('provider-panel')).toBeNull())
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(seen.table.activeId).toBeNull()
    expect(seen.closeRequests).toBe(1)
  })

  it('a dirty panel asks through the same guard; the address agrees with the open panel meanwhile, and Discard closes it', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('To schedule')
    ctl.panelDirty = true
    act(() => { ctl.history.push(ROUTE) })
    await screen.findByRole('button', { name: 'Discard in panel' })
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
    expect(urlParams()).toMatchObject({ id: '1', tab: 'schedule' }) // «Keep editing» is just not answering: id and tab are back
    await click('Discard in panel')
    await waitFor(() => expect(screen.queryByTestId('provider-panel')).toBeNull())
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
  })

  it('our own close by the X is one request to the guard, not two; and with no panel open nothing is asked', async () => {
    renderPage()
    act(() => { ctl.history.push(ROUTE) })
    await settle()
    expect(seen.closeRequests).toBe(0)
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('Close panel')
    await settle()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(seen.closeRequests).toBe(1)
  })

  it('opening another provider through the address is still the open path (one question at most), not a close', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    act(() => { ctl.history.push(`${ROUTE}?id=4`) })
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
    expect(seen.closeRequests).toBe(1) // the guard of the switch, as before
    expect(urlParams().id).toBe('4')
  })
})

describe('the stores count of the row (DS-R1-02)', () => {
  // redesign DS-R1-02 (review r1): saving Businesses changes the group's `business`, the source of the row's «N stores»
  it('gives the panel onStoresChanged, which asks the controller for the stores of the providers again (reloadGroupsInfo)', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(ctl.props.reloadGroupsInfo).not.toHaveBeenCalled()
    expect(typeof seen.panel.onStoresChanged).toBe('function')
    act(() => { seen.panel.onStoresChanged() })
    expect(ctl.props.reloadGroupsInfo).toHaveBeenCalledTimes(1)
  })

  it('does not break when the controller gives no reloadGroupsInfo', async () => {
    renderPage({ reloadGroupsInfo: undefined })
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    expect(() => act(() => { seen.panel.onStoresChanged() })).not.toThrow()
  })
})

describe('the focus after a notice of the page (DS-R1-06)', () => {
  // redesign DS-R1-06 (review r1): a ?id= to a provider that cannot open has no control to go back to; OK used to leave the focus on <body>
  // (in the app: «Skip to content»). It goes to the list now. jsdom does not reproduce the loss (its dialog layer hands the focus back to the
  // search box either way), so this one guards the invariant and is green with and without `returnFocus`; the panel's own test is the red one.
  it('OK of a notice that has no origin puts the focus in the list, not on <body>', async () => {
    renderPage()
    await settle()
    document.activeElement?.blur() // a ⌘K link: the palette closed and nothing in the page has the focus
    expect(document.activeElement).toBe(document.body)
    act(() => { ctl.history.push(`${ROUTE}?id=2`) })
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.querySelector('.odc-dsl-frame').contains(document.activeElement)).toBe(true))
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('the guard: another provider with the panel dirty (decision 17)', () => {
  it('a clean panel lets another provider open at once', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await click('Open 4')
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })

  it('a dirty panel asks first: nothing changes, nor the address, until the question is answered', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    ctl.panelDirty = true
    await click('Open 4')
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
    expect(urlParams().id).toBe('1')
    expect(ctl.props.getDeliveryGroups).toHaveBeenCalledTimes(1)
    await click('Discard in panel')
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
    expect(urlParams().id).toBe('4')
  })

  it('the same provider again does not ask', async () => {
    renderPage()
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    ctl.panelDirty = true
    await click('Open 1')
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })

  // redesign DS-R1-01 (review r1): the palette only pushes the address, with no remount, because ROUTE is in LIVE_QUERY_PATHS of
  // useDashboardNavigation (its own test pins the no-remount). If the route left that list, ⌘K would mount the page again and drop the draft
  // before this guard could ask: so this test is the real path only while the route is there.
  it('the route is one the palette does not mount again (so the ⌘K test below is the real path: no remount)', () => {
    expect(LIVE_QUERY_PATHS).toContain(ROUTE)
  })

  it('a ⌘K link to another provider over a dirty panel asks too', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await screen.findByText('Panel of provider 1')
    ctl.panelDirty = true
    act(() => { ctl.history.push(`${ROUTE}?id=4`) })
    await screen.findByRole('button', { name: 'Discard in panel' })
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
    await click('Discard in panel')
    expect(await screen.findByText('Panel of provider 4')).toBeInTheDocument()
  })
})

describe('the switch (M-DS1, M-DS5)', () => {
  it('the switch of a row saves { enabled } on THE ROW\'s provider and returns the answer to the switch', async () => {
    const answer = { ok: false, error: ['no'] }
    const handleUpdateDeliveryService = vi.fn(() => Promise.resolve(answer))
    renderPage({ handleUpdateDeliveryService })
    await expect(seen.table.onToggle(COMPANIES[3], true)).resolves.toBe(answer)
    expect(handleUpdateDeliveryService).toHaveBeenCalledWith(4, { enabled: true })
  })

  // redesign D-5 (owner, 2026-10-19): pausing a provider asks first (decision 25, C8); resuming stays one click. ONE dialog
  // serves the row switch and the panel switch: the page hands both the same `confirmPause(company)`.
  describe('pausing a provider asks first (D-5)', () => {
    it('hands the table and the panel the same question', async () => {
      renderPage()
      await click('Open 1')
      await screen.findByText('Panel of provider 1')
      expect(seen.table.confirmPause).toEqual(expect.any(Function))
      expect(seen.panel.confirmPause).toBe(seen.table.confirmPause)
    })

    it('names the provider, says what stops, and Pause provider answers true; Cancel writes nothing', async () => {
      const handleUpdateDeliveryService = vi.fn(() => Promise.resolve({ ok: true }))
      renderPage({ handleUpdateDeliveryService })
      let answer
      act(() => { seen.table.confirmPause(COMPANIES[0]).then(value => { answer = value }) })
      const dialog = await screen.findByRole('alertdialog', { name: 'Pause Uber Direct?' })
      expect(dialog).toHaveTextContent('New orders stop going to Uber Direct until you resume it.')
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(answer).toBe(false))
      expect(handleUpdateDeliveryService).not.toHaveBeenCalled()

      act(() => { seen.table.confirmPause(COMPANIES[0]).then(value => { answer = value }) })
      await userEvent.click(await screen.findByRole('button', { name: 'Pause provider' }))
      await waitFor(() => expect(answer).toBe(true))
      expect(handleUpdateDeliveryService).not.toHaveBeenCalled() // the question writes nothing: the switch does, after a «yes»
    })

    it('a provider with no name is asked about by its id, as the list names it', async () => {
      renderPage()
      act(() => { seen.table.confirmPause({ ...COMPANIES[0], id: 9, name: '  ' }) })
      expect(await screen.findByRole('alertdialog', { name: 'Pause #9?' })).toBeInTheDocument()
    })
  })

  // redesign DS-B4 (extra 4): a failed switch says so under itself, and only there
  it('a failed switch of a row shows no dialog even though the controller leaves its error in actionState (state first)', async () => {
    const handleUpdateDeliveryService = vi.fn(async () => {
      act(() => view.update({ actionState: { loading: false, error: ['The provider cannot be paused.'] } }))
      return { ok: false, error: ['The provider cannot be paused.'] }
    })
    renderPage({ handleUpdateDeliveryService })
    await act(async () => { await seen.table.onToggle(COMPANIES[0], false) })
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('...and when the answer comes first', async () => {
    const handleUpdateDeliveryService = vi.fn(() => Promise.resolve({ ok: false, error: ['The provider cannot be paused.'] }))
    renderPage({ handleUpdateDeliveryService })
    await act(async () => { await seen.table.onToggle(COMPANIES[0], false) })
    act(() => view.update({ actionState: { loading: false, error: ['The provider cannot be paused.'] } }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the switch of the panel\'s header is the same: no dialog for its failure', async () => {
    const handleUpdateDeliveryService = vi.fn(() => Promise.resolve({ ok: false, error: ['Nope.'] }))
    renderPage({ handleUpdateDeliveryService })
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await act(async () => { await seen.panel.handleUpdateDeliveryService(1, { enabled: false }) })
    act(() => view.update({ actionState: { loading: false, error: ['Nope.'] } }))
    await settle()
    expect(handleUpdateDeliveryService).toHaveBeenCalledWith(1, { enabled: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the other saves keep the dialog: a failed schedule Update from the panel opens it', async () => {
    const handleUpdateDeliveryService = vi.fn(() => Promise.resolve({ ok: false, error: ['Bad schedule.'] }))
    renderPage({ handleUpdateDeliveryService })
    await click('Open 1')
    await screen.findByText('Panel of provider 1')
    await act(async () => { await seen.panel.handleUpdateDeliveryService(1, { schedule: '[]' }) })
    act(() => view.update({ actionState: { loading: false, error: ['Bad schedule.'] } }))
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Bad schedule.')
  })

  it('an error of the controller that no switch owns opens the dialog, as main\'s Alert «Ordering», and OK closes it', async () => {
    renderPage()
    act(() => view.update({ actionState: { loading: false, error: ['Something else.'] } }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(dialog).toHaveTextContent('Something else.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failed switch does not hide the next error of another kind', async () => {
    const handleUpdateDeliveryService = vi.fn(() => Promise.resolve({ ok: false, error: ['Nope.'] }))
    renderPage({ handleUpdateDeliveryService })
    await act(async () => { await seen.table.onToggle(COMPANIES[0], false) })
    act(() => view.update({ actionState: { loading: false, error: ['Nope.'] } }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    act(() => view.update({ actionState: { loading: false, error: ['Other.'] } }))
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Other.')
  })
})

describe('Install (decision 4)', () => {
  // jsdom cannot spy on `location.reload`, but it reports «Not implemented: navigation» through console.error when it is called
  let consoleError
  const reloaded = () => consoleError.mock.calls.some(call => String(call[0]).includes('Not implemented: navigation'))
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { consoleError.mockRestore() })

  it('posts plugin_root, marks the company as installing meanwhile, then asks for the providers again — and never reloads the page', async () => {
    let release
    const handleInstallSysPlugin = vi.fn(() => new Promise(resolve => { release = () => resolve({ ok: true }) }))
    const reloadDeliveryServices = vi.fn(() => Promise.resolve())
    renderPage({ handleInstallSysPlugin, reloadDeliveryServices })
    let done
    act(() => { done = seen.table.onInstall(COMPANIES[1]) })
    expect(handleInstallSysPlugin).toHaveBeenCalledWith('https://plugins.example/2.zip')
    expect(seen.table.installingId).toBe(2)
    await act(async () => { release(); await done })
    expect(reloadDeliveryServices).toHaveBeenCalledTimes(1)
    expect(seen.table.installingId).toBeNull()
    expect(reloaded()).toBe(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // main: with the controller's handleInstallDeliveryService the install waits until the provider is linked, and the
  // controller puts the new list (and its groups) in place: no second request for the providers
  it('installs through handleInstallDeliveryService when the controller has it: busy until the provider is linked, no reload', async () => {
    let release
    const handleInstallDeliveryService = vi.fn(() => new Promise(resolve => { release = () => resolve({ installed: true, company: { ...COMPANIES[1], plugin_id: 9 } }) }))
    const handleInstallSysPlugin = vi.fn(() => Promise.resolve({ ok: true }))
    const reloadDeliveryServices = vi.fn(() => Promise.resolve())
    renderPage({ handleInstallDeliveryService, handleInstallSysPlugin, reloadDeliveryServices })
    let done
    act(() => { done = seen.table.onInstall(COMPANIES[1]) })
    expect(handleInstallDeliveryService).toHaveBeenCalledWith(COMPANIES[1])
    expect(handleInstallSysPlugin).not.toHaveBeenCalled()
    expect(seen.table.installingId).toBe(2)
    let result
    await act(async () => { release(); result = await done })
    expect(result).toEqual({ ok: true })
    expect(reloadDeliveryServices).not.toHaveBeenCalled()
    expect(seen.table.installingId).toBeNull()
    expect(reloaded()).toBe(false)
  })

  // (row 27, delivery-services P-9, D-39 (a)): the installed provider's record opens on Credentials
  it('after the install the record of the installed provider opens on Credentials, with ?id= in the address', async () => {
    const handleInstallDeliveryService = vi.fn(() => Promise.resolve({ installed: true, company: { ...COMPANIES[1], plugin_id: 9 } }))
    renderPage({ handleInstallDeliveryService })
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    let result
    await act(async () => { result = await seen.table.onInstall(COMPANIES[1]) })
    expect(result).toEqual({ ok: true })
    expect(await screen.findByText('Panel of provider 2')).toBeInTheDocument()
    expect(ctl.props.getDeliveryGroups).toHaveBeenCalledWith(102)
    expect(screen.getByTestId('panel-section')).toHaveTextContent('undefined') // Credentials: no section in ?tab=
    expect(urlParams().id).toBe('2')
    expect(urlParams().tab).toBeUndefined()
    expect(seen.table.activeId).toBe(2)
    expect(seen.table.installingId).toBeNull()
  })

  // (review L2|L7): the controller can wait ~15 s; what the person opened meanwhile is not replaced by the installed record
  it('...if another provider is opened while the install is pending, the install does not open its record over it', async () => {
    let release
    const handleInstallDeliveryService = vi.fn(() => new Promise(resolve => { release = () => resolve({ installed: true, company: { ...COMPANIES[1], plugin_id: 9 } }) }))
    renderPage({ handleInstallDeliveryService })
    let done
    act(() => { done = seen.table.onInstall(COMPANIES[1]) })
    await click('Open 1')
    expect(await screen.findByText('Panel of provider 1')).toBeInTheDocument()
    await act(async () => { release(); await done })
    await settle()
    expect(screen.getByText('Panel of provider 1')).toBeInTheDocument()
    expect(screen.queryByText('Panel of provider 2')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalledWith(102)
    expect(urlParams().id).toBe('1')
    expect(seen.table.installingId).toBeNull()
  })

  it('...an installed provider that has no group does not open anything, and no dialog follows the install', async () => {
    const handleInstallDeliveryService = vi.fn(() => Promise.resolve({ installed: true, company: { ...COMPANIES[1], plugin_id: 9, driver_groups: [] } }))
    renderPage({ handleInstallDeliveryService })
    let result
    await act(async () => { result = await seen.table.onInstall(COMPANIES[1]) })
    await settle()
    expect(result).toEqual({ ok: true })
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctl.props.getDeliveryGroups).not.toHaveBeenCalled()
    expect(urlParams().id).toBeUndefined()
  })

  it('...a provider that did not install opens nothing', async () => {
    const handleInstallDeliveryService = vi.fn(() => Promise.resolve({ installed: false, company: null }))
    renderPage({ handleInstallDeliveryService })
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    await settle()
    expect(screen.queryByTestId('provider-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('...a failed handleInstallDeliveryService says nothing of its own: the controller\'s actionState error is the dialog', async () => {
    const handleInstallDeliveryService = vi.fn(async () => {
      act(() => view.update({ actionState: { loading: false, error: ['Plugin refused.'] } }))
      return { installed: false, company: null }
    })
    renderPage({ handleInstallDeliveryService })
    let result
    await act(async () => { result = await seen.table.onInstall(COMPANIES[1]) })
    await settle()
    expect(result).toEqual({ ok: false })
    expect(await screen.findAllByText('Plugin refused.')).toHaveLength(1)
    expect(seen.table.installingId).toBeNull()
  })

  it('...and without plugin_root the controller\'s own answer still says why (handleInstallSysPlugin)', async () => {
    const handleInstallDeliveryService = vi.fn()
    const handleInstallSysPlugin = vi.fn(() => Promise.resolve({ ok: false, error: ['This provider has no plugin to install.'] }))
    renderPage({ handleInstallDeliveryService, handleInstallSysPlugin })
    await act(async () => { await seen.table.onInstall(company(9, { plugin_id: null, plugin_root: null })) })
    expect(handleInstallDeliveryService).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('This provider has no plugin to install.')
  })

  it('keeps the search and the page: the install does not touch them', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'door')
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    expect(seen.table.searchValue).toBe('door')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('door')
  })

  it('a failed install shows its error ONCE, though the controller also leaves it in actionState', async () => {
    const handleInstallSysPlugin = vi.fn(async () => {
      act(() => view.update({ actionState: { loading: false, error: ['Plugin refused.'] } }))
      return { ok: false, error: ['Plugin refused.'] }
    })
    renderPage({ handleInstallSysPlugin })
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    await settle()
    expect(await screen.findAllByText('Plugin refused.')).toHaveLength(1)
    expect(ctl.props.reloadDeliveryServices).not.toHaveBeenCalled()
    expect(seen.table.installingId).toBeNull()
  })

  it('...and the state of the controller arriving after the person closed the dialog does not open it again', async () => {
    const handleInstallSysPlugin = vi.fn(() => Promise.resolve({ ok: false, error: ['Plugin refused.'] }))
    renderPage({ handleInstallSysPlugin })
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    await userEvent.click(await screen.findByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    act(() => view.update({ actionState: { loading: false, error: ['Plugin refused.'] } }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // redesign DS-B4 (extra 5): without plugin_root the controller answers and does not touch actionState
  it('an install without plugin_root shows the controller\'s answer in the dialog', async () => {
    const handleInstallSysPlugin = vi.fn(() => Promise.resolve({ ok: false, error: ['This provider has no plugin to install.'] }))
    renderPage({ handleInstallSysPlugin })
    await act(async () => { await seen.table.onInstall(company(9, { plugin_id: null, plugin_root: null })) })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('This provider has no plugin to install.')
    expect(ctl.props.reloadDeliveryServices).not.toHaveBeenCalled()
  })

  it('an error the controller reports for a second install is shown again', async () => {
    const handleInstallSysPlugin = vi.fn(() => Promise.resolve({ ok: false, error: ['Plugin refused.'] }))
    renderPage({ handleInstallSysPlugin })
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    await userEvent.click(await screen.findByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await act(async () => { await seen.table.onInstall(COMPANIES[1]) })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Plugin refused.')
  })
})

describe('phone (decision 3)', () => {
  it('opening a provider at 390px shows its panel as the screen, with its name', async () => {
    restoreViewport()
    restoreViewport = installViewport(390)
    renderPage()
    await click('Open 1')
    expect(await screen.findByText('Panel of provider 1')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Uber Direct' })).toBeInTheDocument()
    expect(document.querySelector('.odc-split-list')).toHaveAttribute('hidden')
  })
})

describe('the export of the page (C/N/DeliveryServices)', () => {
  it('mounts the controller with the new UI and the pagination settings of main', () => {
    window.history.replaceState(null, '', `${ROUTE}?page=2&pageSize=25`)
    renderWithProviders(<DeliveryServices isUseQuery />, { initialEntries: [`${ROUTE}?page=2&pageSize=25`] })
    expect(seen.controller.UIComponent).toBe(DeliveryServicesListingUI)
    expect(seen.controller.isUseQuery).toBe(true)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 2, pageSize: 25, controlType: 'pages' })
  })

  it('without isUseQuery the settings are the defaults', () => {
    renderWithProviders(<DeliveryServices />, { initialEntries: [`${ROUTE}?page=2&pageSize=25`] })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })
})
