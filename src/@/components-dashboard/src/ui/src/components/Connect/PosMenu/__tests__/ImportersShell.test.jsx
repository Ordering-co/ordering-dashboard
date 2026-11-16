/* eslint-disable import/first */
// redesign IM-A (decisions D1, D2, D5): /connect/importers is the Connect shell (PosMenu) with the kind `importer`. The
// controller (PosMenuBusinessList), the store panel of the lote B (ImporterStorePanel), the POS panel and the help box are stubs that
// record what they receive; the table (PosMenuTable) and the Product wrappers the page is made of are the real ones. The three cases
// of the old ImportersUI test (open by ?id=, close when the store is not in the page, wait while the list loads) live here now.
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ controller: null, panel: null, help: null }))
const ctl = vi.hoisted(() => ({ props: {} }))
const device = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (src) => src, parseDate: (value) => value }],
  useSession: () => [{ user: { id: 1, level: 0 }, token: 'tok-1' }],
  useApi: () => [{ project: 'proj-1' }],
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  // the controller hands its props to the UI as the real one does; the test plays the controller
  PosMenuBusinessList: ({ UIComponent, ...props }) => {
    seen.controller = props
    return <UIComponent {...props} {...ctl.props} />
  }
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => device.phone }))

// the panel of the lote B: a stub with the id of the store it got and a way to close it
vi.mock('../../Importers/ImporterStorePanel', () => ({
  ImporterStorePanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='importer-store-panel'>
        <span data-testid='importer-panel-id'>{String(props.business.id)}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
      </div>
    )
  }
}))

// the POS panel and its details must never mount for an importer
const posPanel = vi.hoisted(() => ({ mounted: vi.fn() }))
vi.mock('../PosStorePanel', () => ({
  PosStorePanel: () => {
    posPanel.mounted()
    return <div data-testid='pos-store-panel' />
  }
}))

vi.mock('../../InfoHelpBox', () => ({
  InfoHelpBox: (props) => {
    seen.help = props
    return props.open
      ? (
        <div role='dialog' aria-label='Help'>
          <p>{props.data.name}</p>
          <p>{props.data.description}</p>
          <button type='button' onClick={props.handleOnClose}>Close help</button>
        </div>
        )
      : null
  }
}))

import { PosMenu } from '../index'

const BUSINESSES = [
  { id: 7, name: 'Fast Bite', city_id: 1, enabled: true, disabled_reason: 'No orders in 30 days' },
  { id: 8, name: 'Pizza Hub', city_id: 1, enabled: true }
]

const baseCtl = (overrides = {}) => ({
  businessList: { loading: false, error: null, businesses: BUSINESSES },
  integrationsList: { loading: false, error: null, thirdPartyIntegrations: [] },
  pagination: { currentPage: 1, pageSize: 10, total: 32, totalPages: 4, from: 1, to: 10 },
  searchValue: '',
  selectedBusinessActiveState: true,
  handleChangeBusinessActiveState: vi.fn(),
  handleSucessUpdateBusiness: vi.fn(),
  handleInstallPosIntegration: vi.fn(),
  installingPluginRoot: null,
  getIntegrations: vi.fn(),
  loadBusinesses: vi.fn(),
  refreshBusinesses: vi.fn(),
  onSearch: vi.fn(),
  onBusinessRedirect: vi.fn(),
  getPageBusinesses: vi.fn(),
  filterValues: {},
  businessTypeSelected: null,
  inActiveBusinesses: { loading: false, businesses: [{ id: 99 }] },
  citiesList: [{ id: 1, name: 'Miami' }],
  ...overrides
})

const ROUTE = '/connect/importers'
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent.trim())

let view
const renderPage = (ctlOverrides = {}, route = ROUTE, pageProps = {}) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  view = renderWithProviders(<PosMenu isUseQuery kind='importer' {...pageProps} />, { initialEntries: [route] })
  return view
}

// jsdom answers matchMedia with `matches: false`; 1440 puts the panel beside the list (the split mode)
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
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  Object.keys(seen).forEach(key => { seen[key] = null })
  posPanel.mounted.mockClear()
  device.phone = false
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('the page', () => {
  it('has the title, the new description, the store count, Refresh, the Active / Inactive tabs and the search', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Importers' })).toBeInTheDocument()
    expect(screen.getByText("Bring a store's menu from DoorDash, Uber Eats, GloriaFood or another Ordering.co store.")).toBeInTheDocument()
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('32 stores')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(ctl.props.refreshBusinesses).toHaveBeenCalledTimes(1) // main #399
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Inactive' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('the table is called «Stores» and has no column manager, only ID and Business', () => {
    renderPage()
    expect(screen.getByRole('table', { name: 'Stores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    expect(headers()).toEqual(['ID', 'Business'])
  })

  it('the Inactive tab adds «Disabled reason», with the reason of the store', () => {
    renderPage({ selectedBusinessActiveState: false }, `${ROUTE}?active=false`)
    expect(headers()).toEqual(['ID', 'Business', 'Disabled reason'])
    expect(screen.getByText('No orders in 30 days')).toBeInTheDocument()
  })

  it('on the phone a card has the city alone as its line and no status, and the list is called «Stores»', () => {
    device.phone = true
    renderPage({ businessList: { loading: false, error: null, businesses: [{ id: 7, name: 'Fast Bite', city_id: 1, enabled: true, third_party_integrations: [] }] } })
    expect(screen.getByRole('list', { name: 'Stores' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: 'Open Fast Bite' }).closest('li') ?? screen.getByRole('link', { name: 'Open Fast Bite' })
    expect(within(card).getByText('Miami')).toBeInTheDocument()
    expect(card.querySelector('.odc-status')).toBeNull()
    expect(within(card).queryByText('Not connected')).toBeNull()
  })

  // redesign bugs-d row 57 (IM-09): the importer path reads no integration, so the controller does not load them
  it('the controller is told to skip the integrations it never uses', () => {
    renderPage()
    expect(seen.controller.skipIntegrations).toBe(true)
  })

  it('the controller gets no integrationType (main did not send one)', () => {
    renderPage()
    expect(seen.controller.integrationType).toBeUndefined()
    expect(seen.controller).toMatchObject({
      asDashboard: true,
      isSearchByBusinessName: true,
      isSearchByBusinessEmail: true,
      isSearchByBusinessPhone: true,
      defaultActive: true,
      paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'pages' }
    })
  })

  it('Learn opens the help with the text about importing menus, not the one of POS', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Learn' }))
    const help = screen.getByRole('dialog', { name: 'Help' })
    expect(within(help).getByText('Importers')).toBeInTheDocument()
    expect(seen.help.data.description).toMatch(/^Open a store and choose where its menu comes from/)
    expect(seen.help.data.description).toMatch(/the Logs tab keeps the source files of the last imports/)
    expect(seen.help.data.description).not.toMatch(/^Connect with any of our available integrations/)
    expect(seen.help.data.more_info).toBe('https://docs.ordering.co/docs/products/dashboard/help-community-ai-agents/')
    await userEvent.click(within(help).getByRole('button', { name: 'Close help' }))
    expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull()
  })
})

// J2 row 38 (connect-importers P6): the page links to the CSV importers of Stores (stores, categories, products), which stay where
// they are (/stores/list › Importers); the link opens that panel (?header=importers, the ⌘K address of it)
describe('the CSV importers of Stores', () => {
  it('the header links to /stores/list?header=importers, and following it goes there', async () => {
    ctl.props = baseCtl()
    renderWithProviders(
      <>
        <PosMenu isUseQuery kind='importer' />
        <Route render={({ location }) => <output data-testid='where'>{`${location.pathname}${location.search}`}</output>} />
      </>,
      { initialEntries: [ROUTE] }
    )
    const link = screen.getByRole('link', { name: 'Import from a CSV file' })
    expect(link).toHaveAttribute('href', '/stores/list?header=importers')
    await userEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/stores/list?header=importers')
  })

  it('only on Importers: POS and Sales channels have no such link', () => {
    ctl.props = baseCtl()
    renderWithProviders(<PosMenu isUseQuery kind='pos' />, { initialEntries: ['/connect/pos-menu'] })
    expect(screen.queryByRole('link', { name: 'Import from a CSV file' })).toBeNull()
  })
})

describe('opening a store', () => {
  it('a row opens the panel of the importer with the row and writes ?id=; closing clears it', async () => {
    renderPage()
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    await userEvent.click(within(screen.getByRole('row', { name: /Fast Bite/ })).getByText('Fast Bite'))
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledWith(7)
    expect(screen.getByTestId('importer-panel-id')).toHaveTextContent('7')
    expect(seen.panel.business).toBe(BUSINESSES[0])
    expect(seen.panel.expanded).toBe(false)
    expect(typeof seen.panel.onExpandedChange).toBe('function')
    ctl.props.onBusinessRedirect.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledTimes(1)
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledWith()
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
  })

  it('opens the panel when the URL id matches a loaded store', async () => {
    renderPage({}, `${ROUTE}?active=true&page=1&pageSize=10&id=8`)
    expect(await screen.findByTestId('importer-store-panel')).toBeInTheDocument()
    expect(screen.getByTestId('importer-panel-id')).toHaveTextContent('8')
    expect(seen.panel.business).toBe(BUSINESSES[1])
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
  })

  it('closes the panel and clears the URL id when the store is not in the loaded page (it asks for no store)', () => {
    renderPage({}, `${ROUTE}?active=true&page=1&pageSize=10&id=2147`)
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledTimes(1)
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledWith()
    expect(seen.panel).toBeNull()
  })

  it('does not open the panel while the list is still loading, and does not clear the id', () => {
    renderPage({ businessList: { loading: true, error: null, businesses: [] } }, `${ROUTE}?active=true&id=8`)
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
  })

  // redesign IM-R1-1 (review r1 #1): the controller's first render is an empty list that is not loading yet; the ?id= check
  // must wait for the list to answer, or a fresh load with ?id= closes the panel and drops the id
  it('keeps ?id= while the list has not answered yet (empty and not loading), then opens when it arrives', () => {
    renderPage({ businessList: { loading: false, error: null, businesses: [] }, pagination: { currentPage: 1, pageSize: 10, total: 0 } }, `${ROUTE}?active=true&id=8`)
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
    ctl.props = { ...baseCtl(), businessList: { loading: true, error: null, businesses: [] } }
    view.rerender(<PosMenu isUseQuery kind='importer' />)
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
    ctl.props = baseCtl()
    view.rerender(<PosMenu isUseQuery kind='importer' />)
    expect(screen.getByTestId('importer-panel-id')).toHaveTextContent('8')
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
  })

  it('closes and clears ?id= once the list has answered empty (a project with no stores)', () => {
    renderPage({ businessList: { loading: true, error: null, businesses: [] } }, `${ROUTE}?active=true&id=8`)
    ctl.props = { ...baseCtl(), businessList: { loading: false, error: null, businesses: [] }, pagination: { currentPage: 1, pageSize: 10, total: 0 } }
    view.rerender(<PosMenu isUseQuery kind='importer' />)
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledWith()
  })

  it('opens when the list finishes loading with the store in it', () => {
    renderPage({ businessList: { loading: true, error: null, businesses: [] } }, `${ROUTE}?active=true&id=8`)
    ctl.props = baseCtl()
    view.rerender(<PosMenu isUseQuery kind='importer' />)
    expect(screen.getByTestId('importer-panel-id')).toHaveTextContent('8')
    expect(ctl.props.onBusinessRedirect).not.toHaveBeenCalled()
  })

  it('never mounts the POS panel, and ?section= is neither read nor written', async () => {
    renderPage({}, `${ROUTE}?active=true&id=7&section=custom_fields`)
    expect(screen.getByTestId('importer-store-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('pos-store-panel')).toBeNull()
    expect(posPanel.mounted).not.toHaveBeenCalled()
    expect(seen.panel.initialSection).toBeUndefined()
    expect(seen.panel.onSectionChange).toBeUndefined()
  })
})

describe('the other kinds do what they did', () => {
  it('pos keeps its title, its column manager, its help and the POS panel', async () => {
    renderPage({}, '/connect/pos-menu', { kind: 'pos' })
    expect(screen.getByRole('heading', { level: 1, name: 'POS & menu sync' })).toBeInTheDocument()
    expect(seen.controller.skipIntegrations).toBeFalsy()
    expect(seen.controller.integrationType).toBe('pos')
    expect(screen.getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status'])
    await userEvent.click(screen.getByRole('button', { name: 'Learn' }))
    expect(seen.help.data.description).toMatch(/^Connect with any of our available integrations/)
  })

  it('pos asks for the store of an id that is not in the page: the POS panel mounts', () => {
    renderPage({}, '/connect/pos-menu?id=2147', { kind: 'pos' })
    expect(screen.getByTestId('pos-store-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('importer-store-panel')).toBeNull()
  })

  it('sales_channel keeps its title and its column manager', () => {
    renderPage({}, '/connect/sales-channels', { kind: 'sales_channel' })
    expect(screen.getByRole('heading', { level: 1, name: 'Sales channels' })).toBeInTheDocument()
    expect(seen.controller.integrationType).toBe('sales_channel')
    expect(seen.controller.skipIntegrations).toBeFalsy()
    expect(screen.getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
  })
})
