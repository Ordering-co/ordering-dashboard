/* eslint-disable import/first */
// redesign CA-B7 (decisions 1-4): the campaigns page. The controller (K/CampaignListing), the table, the filter bar, the panel and the
// opens dialog are other pieces (CA-B1, CA-B3, CA-B4, CA-B6) and are stubs here that record what they receive: what is tested is how
// they are composed, what the page passes to each, and what the page owns (the URL, the open campaign, the toggle alert, the opens
// dialog, the focus). The header, `SplitView`, `AlertDialog` and `useCampaignEnabledToggle` are the real ones.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ controller: null, table: null, filters: null, panel: null, opens: null }))
const ctl = vi.hoisted(() => ({ props: {}, level: 0, subdomain: 'ordering' }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { id: 1, level: ctl.level } }],
  useApi: () => [{}, { configurations: { subdomain: ctl.subdomain } }],
  useUtils: () => [{ parseDate: value => String(value), parsePrice: value => String(value) }],
  // the controller hands its props to the UI as the real one does; the test plays the controller
  CampaignListing: ({ UIComponent, ...props }) => {
    seen.controller = props
    return <UIComponent {...props} {...ctl.props} />
  }
}))

// redesign CA-R2 (M2): a test can ask for the REAL table (DataTable's real rows, with their roving tabindex) instead of the stub
// the ids the person hid, read from the state the page hands to the table
const hiddenIds = () => seen.table.columnsState.columns.filter(column => !column.visible).map(column => column.id)

const flags = vi.hoisted(() => ({ realTable: false }))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../CampaignDirectory/CampaignsTable', async (importOriginal) => {
  const actual = await importOriginal()
  const Stub = (props) => {
    seen.table = props
    return (
      <div className='odc-table-scroll' role='region' aria-label='Campaigns table'>
        {props.campaigns.map(campaign => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={campaign.id} data-row-id={campaign.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpen(campaign)}>Open {campaign.id}</button>
            <button type='button' onClick={() => props.toggle.setEnabled(campaign, false)}>Switch off {campaign.id}</button>
            <button type='button' onClick={() => props.onOpenOpens(campaign)}>Opens {campaign.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onPageChange(2)}>To page 2</button>
        <button type='button' onClick={() => props.onPageSizeChange(25, 1)}>To 25 per page</button>
        <button type='button' onClick={() => props.onClearFilters()}>Table clear filters</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onNew()}>Table new</button>
      </div>
    )
  }
  const Table = (props) => {
    if (!flags.realTable) return Stub(props)
    seen.table = props
    return <actual.CampaignsTable {...props} />
  }
  // CM-1: the column choice and its manager (useCampaignColumns, CampaignColumnManager) are the real ones: they are the page's now
  return { ...actual, CampaignsTable: Table }
})

vi.mock('../../CampaignDirectory/CampaignsFilters', () => ({
  CampaignsFilters: (props) => {
    seen.filters = props
    return (
      <div data-testid='campaign-filters'>
        {/* as the filter bar: the column manager (the page's) is its `tools` slot */}
        <div role='group' aria-label='Campaign filter bar'>{props.tools}</div>
        <button type='button' onClick={() => props.onChange({ contact_type: ['email'], audience_type: ['fixed'] })}>Pick filters</button>
        <button type='button' onClick={() => props.onChange({ contact_type: [], audience_type: [] })}>Empty filters</button>
        <button type='button' onClick={() => props.onSearch('spring')}>Search spring</button>
        <button type='button' onClick={() => props.onClear()}>Filters clear</button>
      </div>
    )
  }
}))

vi.mock('../../CampaignDirectory/CampaignPanel', () => ({
  CampaignPanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='campaign-panel'>
        <span>Panel of {props.campaignId == null ? 'new' : props.campaignId}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onDirtyChange(true)}>Draft dirty</button>
        <button type='button' onClick={() => props.onDirtyChange(false)}>Draft clean</button>
        <button type='button' onClick={() => props.onOpenOpens(props.campaign)}>Panel opens</button>
        <button type='button' onClick={() => props.toggle.setEnabled(props.campaign, true)}>Panel switch on</button>
        <button
          type='button'
          onClick={() => {
            props.handleSuccessDeleteCampaign(props.campaignId)
            props.onClose()
          }}
        >
          Delete from panel
        </button>
      </div>
    )
  }
}))

vi.mock('../../CampaignDirectory/CampaignOpensDialog', () => ({
  CampaignOpensDialog: (props) => {
    seen.opens = props
    return props.open
      ? (
        <div role='dialog' aria-label='Opens dialog'>
          <span>Opens of {props.campaign?.name}</span>
          <button type='button' onClick={() => props.onOpenChange(false)}>Close opens</button>
        </div>
        )
      : null
  }
}))

import { CampaignListing } from '../index'

const campaign = (id, extra = {}) => ({ id, name: `Campaign ${id}`, contact_type: 'email', audience_type: 'fixed', status: 'sent', enabled: true, ...extra })
const CAMPAIGNS = [campaign(1), campaign(2), campaign(3)]

const baseCtl = (overrides = {}) => ({
  campaignList: { campaigns: CAMPAIGNS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 3 },
  filterValues: { clear: false, changes: {} },
  searchValue: '',
  getCampaignList: vi.fn(),
  setFilterValues: vi.fn(),
  setPaginationProps: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleUpdateCampaign: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  handleSuccessAddCampaign: vi.fn(),
  handleSuccessUpdateCampaign: vi.fn(),
  handleSuccessDeleteCampaign: vi.fn(),
  ...overrides
})

const ROUTE = '/marketing/campaign'
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

// The router's history, to play what the ⌘K palette does (navigate to a URL while the page is open)
const historyRef = { current: null }
const Capture = () => {
  historyRef.current = useHistory()
  return null
}

let view
const renderPage = (ctlOverrides = {}, route = ROUTE, pageProps = {}) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const element = () => <><Capture /><CampaignListing isUseQuery {...pageProps} /></>
  const utils = renderWithProviders(element(), { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props (a new list, a new page)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(element())
    }
  }
  return view
}

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that
// evaluates them against a width (1440: the split mode, the panel sits beside the list)
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
  infoShare.handleMenuCollapse.mockClear()
  ctl.level = 0
  ctl.subdomain = 'ordering'
  Object.keys(seen).forEach(key => { seen[key] = null })
  flags.realTable = false
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

const click = (name) => userEvent.click(screen.getByRole('button', { name }))

describe('wrapper: what it passes the controller', () => {
  it('searches by name and contact type and hands the controller the page UI', () => {
    renderPage()
    expect(seen.controller).toMatchObject({ isSearchByName: true, isSearchByContactType: true, isUseQuery: true })
  })

  it('reads the page and the page size from the URL', () => {
    renderPage({}, `${ROUTE}?page=3&pageSize=25`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('reads the page size even when there is no page (inventory 1.5: it was gated by the page)', () => {
    renderPage({}, `${ROUTE}?pageSize=50`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 50, controlType: 'pages' })
  })

  it('page 1 and 10 per page by default', () => {
    renderPage()
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('a page that is not a number falls back to 1 and keeps the valid page size', () => {
    renderPage({}, `${ROUTE}?page=abc&pageSize=25`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 25, controlType: 'pages' })
  })

  it('a page size that is not a number falls back to 10', () => {
    renderPage({}, `${ROUTE}?page=2&pageSize=abc`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 2, pageSize: 10, controlType: 'pages' })
  })

  it('without isUseQuery the URL is not read', () => {
    renderPage({}, `${ROUTE}?page=3&pageSize=25`, { isUseQuery: false })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })
})

describe('composition', () => {
  it('draws the header (title and count), the filter bar and the table, and no panel', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument()
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('42 campaigns')
    expect(screen.getByTestId('campaign-filters')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Campaigns table' })).toBeInTheDocument()
    expect(screen.queryByTestId('campaign-panel')).toBeNull()
  })

  it('shows no count until the controller knows the total', () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(document.querySelector('.odc-pagehead-count')).toBeNull()
  })

  it('the table gets the list, the loading state, the error, the pagination and the active campaign', () => {
    renderPage()
    expect(seen.table.campaigns).toBe(CAMPAIGNS)
    expect(seen.table.loading).toBe(false)
    expect(seen.table.error).toBeNull()
    expect(seen.table.pagination).toBe(ctl.props.paginationProps)
    expect(seen.table.activeId).toBeNull()
    expect(seen.table.hasFilters).toBe(false)
    expect(seen.table.toggle.pendingIds).toEqual([])
  })

  it('the help line with the support link is level 0 only, to the Ordering.co support page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Customer support' })).toHaveAttribute('href', 'https://www.ordering.co/support/')
    view.unmount()
    ctl.level = 2
    renderPage()
    expect(screen.queryByRole('link', { name: 'Customer support' })).toBeNull()
  })

  it('a project without a subdomain sends the support link to the same page, not www.undefined.com', () => {
    ctl.subdomain = undefined
    renderPage()
    expect(screen.getByRole('link', { name: 'Customer support' })).toHaveAttribute('href', 'https://www.ordering.co/support/')
  })

  it('the menu button shows while the sidebar is collapsed and opens it', async () => {
    infoShare.isCollapse = true
    renderPage()
    // the opener is PageHeader's `leading`, the first child of its lead block
    const menu = screen.getByRole('button', { name: 'Open menu' })
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('no menu button while the sidebar is open', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('Refresh asks for the page the list is on, at its size', async () => {
    renderPage({ paginationProps: { currentPage: 3, pageSize: 25, totalItems: 80, totalPages: 4 } })
    await click('Refresh')
    expect(ctl.props.getCampaignList).toHaveBeenCalledWith(3, 25)
  })

  it('Refresh shows busy while the list loads', () => {
    renderPage({ campaignList: { campaigns: CAMPAIGNS, loading: true, error: null } })
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true')
  })

  it('the table pages go to the controller', async () => {
    renderPage()
    await click('To page 2')
    expect(ctl.props.getCampaignList).toHaveBeenLastCalledWith(2, 10)
    await click('To 25 per page')
    expect(ctl.props.getCampaignList).toHaveBeenLastCalledWith(1, 25)
  })

  it('the table retry asks for the current page again', async () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 10, totalItems: 42, totalPages: 5 } })
    await click('Table retry')
    expect(ctl.props.getCampaignList).toHaveBeenCalledWith(2, 10)
  })

  // CM-1: the manager is the filter bar's tool (not a row above the table) and the page holds what it chose
  it('the column manager is in the filter bar, controlled by the page: hide and reset', async () => {
    renderPage()
    const bar = screen.getByRole('group', { name: 'Campaign filter bar' })
    expect(hiddenIds()).toEqual([])
    await click('Manage columns')
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Audience' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'In queue' }))
    expect(hiddenIds()).toEqual(['audience', 'in_queue'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(hiddenIds()).toEqual([])
    expect(within(bar).getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
    expect(document.querySelector('.odc-campaign-tools')).toBeNull()
  })

  it('keeps the header, the filter bar and the first row in place when the panel opens (same nodes, same list)', async () => {
    renderPage()
    const head = document.querySelector('.odc-campaign-head')
    const filters = screen.getByTestId('campaign-filters')
    const row = document.querySelector('[data-row-id="1"]')
    const list = head.parentElement
    expect(list.contains(filters)).toBe(true)
    expect(list.contains(row)).toBe(true)
    await click('Open 2')
    expect(screen.getByTestId('campaign-panel')).toBeInTheDocument()
    expect(document.querySelector('.odc-campaign-head')).toBe(head)
    expect(screen.getByTestId('campaign-filters')).toBe(filters)
    expect(document.querySelector('[data-row-id="1"]')).toBe(row)
    expect(head.parentElement).toBe(list)
    // the panel is beside the list, never inside it
    expect(list.contains(screen.getByTestId('campaign-panel'))).toBe(false)
  })
})

describe('filters and search', () => {
  it('shows the filters the controller holds, both keys complete', () => {
    renderPage({ filterValues: { clear: false, changes: { contact_type: ['sms'] } }, searchValue: 'sp' })
    expect(seen.filters.values).toEqual({ contact_type: ['sms'], audience_type: [] })
    expect(seen.filters.search).toBe('sp')
    expect(seen.table.hasFilters).toBe(true)
  })

  it('after «clear» the filters show empty even if changes are still there', () => {
    renderPage({ filterValues: { clear: true, changes: { contact_type: ['sms'] } } })
    expect(seen.filters.values).toEqual({ contact_type: [], audience_type: [] })
    expect(seen.table.hasFilters).toBe(false)
  })

  it('a null search shows as empty', () => {
    renderPage({ searchValue: null })
    expect(seen.filters.search).toBe('')
  })

  it('the pills call setFilterValues with the arrays', async () => {
    renderPage()
    await click('Pick filters')
    expect(ctl.props.setFilterValues).toHaveBeenCalledWith({ changes: { contact_type: ['email'], audience_type: ['fixed'] } })
  })

  it('emptying the last pill sends the complete empty arrays (the controller asks again without them)', async () => {
    renderPage({ filterValues: { clear: false, changes: { contact_type: ['email'], audience_type: [] } } })
    await click('Empty filters')
    expect(ctl.props.setFilterValues).toHaveBeenCalledWith({ changes: { contact_type: [], audience_type: [] } })
  })

  it('the search goes to handleChangeSearch', async () => {
    renderPage()
    await click('Search spring')
    expect(ctl.props.handleChangeSearch).toHaveBeenCalledWith('spring')
  })

  it('Clear filters resets the filters and the search', async () => {
    renderPage({ searchValue: 'spring', filterValues: { clear: false, changes: { contact_type: ['email'], audience_type: [] } } })
    await click('Filters clear')
    expect(ctl.props.setFilterValues).toHaveBeenCalledWith({ clear: true, changes: {} })
    expect(ctl.props.handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('the table\'s «Clear filters» does the same', async () => {
    renderPage({ searchValue: 'spring', filterValues: { clear: false, changes: { audience_type: ['dynamic'] } } })
    await click('Table clear filters')
    expect(ctl.props.setFilterValues).toHaveBeenCalledWith({ clear: true, changes: {} })
    expect(ctl.props.handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('does not ask the controller to change a search that is already empty', async () => {
    renderPage({ searchValue: '', filterValues: { clear: false, changes: { contact_type: ['email'], audience_type: [] } } })
    await click('Filters clear')
    expect(ctl.props.setFilterValues).toHaveBeenCalledWith({ clear: true, changes: {} })
    expect(ctl.props.handleChangeSearch).not.toHaveBeenCalled()
  })
})

describe('the panel and the URL', () => {
  it('«New campaign» opens the create panel (no id) and keeps the URL clean of an id', async () => {
    renderPage({}, `${ROUTE}?page=1&pageSize=10`)
    await click('New campaign')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(seen.panel.campaign).toEqual({})
    expect(seen.panel.campaignId).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(seen.table.activeId).toBeNull()
  })

  it('the empty state of the table can create too', async () => {
    renderPage()
    await click('Table new')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
  })

  it('creating while a campaign is open drops the id from the URL', async () => {
    renderPage()
    await click('Open 2')
    expect(urlParams().id).toBe('2')
    await click('New campaign')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
    expect(seen.table.activeId).toBeNull()
  })

  it('?add=1 (command palette) opens create once and takes `add` out of the URL', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await waitFor(() => expect(screen.getByText('Panel of new')).toBeInTheDocument())
    expect(urlParams().add).toBeUndefined()
    expect(seen.panel.campaignId).toBeNull()
  })

  it('?id= opens the panel with only the id, even before the list is there', () => {
    renderPage({ campaignList: { campaigns: [], loading: true, error: null } }, `${ROUTE}?id=2`)
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
    expect(seen.panel.campaign).toEqual({})
    expect(seen.panel.campaignId).toBe(2)
    expect(seen.table.activeId).toBe(2)
  })

  it('?id= of an ended campaign opens it too (no status is looked at)', () => {
    renderPage({ campaignList: { campaigns: [campaign(9, { status: 'ended' })], loading: false, error: null } }, `${ROUTE}?id=9`)
    expect(screen.getByText('Panel of 9')).toBeInTheDocument()
  })

  it('an ?id= that is not an id opens nothing', () => {
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('campaign-panel')).toBeNull()
  })

  it('?tab= from an old link is ignored: the panel opens and gets no tab', () => {
    renderPage({}, `${ROUTE}?id=2&tab=content`)
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
    expect(seen.panel).not.toHaveProperty('tab')
    expect(urlParams().tab).toBe('content') // left alone until the panel closes, as today
  })

  it('a row click opens the panel with the row and writes ?id=', async () => {
    renderPage()
    await click('Open 2')
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
    expect(seen.panel.campaign).toBe(CAMPAIGNS[1])
    expect(seen.panel.campaignId).toBe(2)
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeId).toBe(2)
  })

  it('the panel is told what it needs from the page', async () => {
    renderPage()
    await click('Open 1')
    expect(seen.panel.campaignList).toBe(ctl.props.campaignList)
    expect(seen.panel.handleSuccessAddCampaign).toBe(ctl.props.handleSuccessAddCampaign)
    expect(seen.panel.handleSuccessUpdateCampaign).toBe(ctl.props.handleSuccessUpdateCampaign)
    expect(typeof seen.panel.handleSuccessDeleteCampaign).toBe('function')
    expect(seen.panel.toggle.setEnabled).toBe(seen.table.toggle.setEnabled)
    expect(typeof seen.panel.onOpenOpens).toBe('function')
    expect(typeof seen.panel.onClose).toBe('function')
    expect(seen.panel.expanded).toBe(false)
    expect(typeof seen.panel.onExpandedChange).toBe('function')
  })

  it('opening another row switches the panel and the id', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 3')
    expect(screen.getByText('Panel of 3')).toBeInTheDocument()
    expect(urlParams().id).toBe('3')
    expect(seen.table.activeId).toBe(3)
  })

  it('shows the list\'s own version of the open campaign (a switch changed it)', async () => {
    renderPage()
    await click('Open 2')
    const updated = [CAMPAIGNS[0], { ...CAMPAIGNS[1], enabled: false }, CAMPAIGNS[2]]
    view.update({ campaignList: { campaigns: updated, loading: false, error: null } })
    expect(seen.panel.campaign).toBe(updated[1])
  })

  it('keeps the row it opened when it leaves the list (a filter, another page)', async () => {
    renderPage()
    await click('Open 2')
    view.update({ campaignList: { campaigns: [CAMPAIGNS[0]], loading: false, error: null } })
    expect(seen.panel.campaign).toBe(CAMPAIGNS[1])
  })

  it('closing removes id and tab and keeps page and pageSize', async () => {
    renderPage({}, `${ROUTE}?id=2&tab=content&page=1&pageSize=10`)
    await click('Close panel')
    expect(screen.queryByTestId('campaign-panel')).toBeNull()
    expect(urlParams()).toEqual({ page: '1', pageSize: '10' })
    expect(seen.table.activeId).toBeNull()
  })

  it('closing a create panel leaves the URL as it was', async () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } }, `${ROUTE}?page=2&pageSize=25`)
    await click('New campaign')
    await click('Close panel')
    expect(screen.queryByTestId('campaign-panel')).toBeNull()
    expect(urlParams()).toEqual({ page: '2', pageSize: '25' })
  })

  it('the panel can open as a page and is not expanded on the next campaign', async () => {
    renderPage()
    await click('Open 1')
    await click('Expand')
    expect(seen.panel.expanded).toBe(true)
    await click('Close panel')
    await click('Open 2')
    expect(seen.panel.expanded).toBe(false)
  })

  it('the panel is named after the campaign, and «New campaign» when creating', async () => {
    renderPage()
    await click('Open 2')
    expect(document.querySelector('aside[aria-label="Campaign 2"]')).not.toBeNull()
    await click('New campaign')
    expect(document.querySelector('aside[aria-label="New campaign"]')).not.toBeNull()
  })

  it('a panel opened by ?id= is named «Campaign» until the row is known', () => {
    renderPage({ campaignList: { campaigns: [], loading: true, error: null } }, `${ROUTE}?id=40`)
    expect(document.querySelector('aside[aria-label="Campaign"]')).not.toBeNull()
  })

  it('a delete from the panel reaches the controller and the panel closes', async () => {
    renderPage()
    await click('Open 2')
    await click('Delete from panel')
    expect(ctl.props.handleSuccessDeleteCampaign).toHaveBeenCalledWith(2)
    expect(screen.queryByTestId('campaign-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('closing the panel gives the focus back to the row', async () => {
    renderPage()
    await click('Open 2')
    act(() => { document.body.focus() })
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true))
  })

  it('closing a panel that was opened by ?id= (no opener) puts the focus on its row', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await click('Close panel')
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })

  it('after a delete the focus goes to the row that took its place', async () => {
    renderPage()
    await click('Open 2')
    await click('Delete from panel')
    view.update({ campaignList: { campaigns: [CAMPAIGNS[0], CAMPAIGNS[2]], loading: false, error: null } })
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })
})

// redesign CA-R2 (M2): the stub table above cannot see what the real DataTable does with the focus. Here the REAL table draws the
// rows (their roving tabindex, `data-row-id`), and only the panel and the controller are played. When a campaign is deleted the
// browser hands the focus back to the table's tab stop (the first row, once the deleted row and the open row are gone); the page must
// take it from there to the row that took the deleted one's place.
describe('after a delete, with the real table (M2)', () => {
  const list = (...ids) => ({ campaigns: ids.map(id => campaign(id)), loading: false, error: null })
  const rowOf = id => document.querySelector(`tr[data-row-id="${id}"]`)

  const deleteFromPanel = async (openId, remaining, { restoreFocusTo = 'first' } = {}) => {
    await userEvent.click(rowOf(openId))
    await click('Delete from panel')
    // the dialog gives the focus back to the table's tab stop, not to the row that took the place
    const stop = restoreFocusTo === 'first' ? document.querySelector('tr[data-row-id][tabindex="0"]') ?? document.querySelector('tr[data-row-id]') : null
    if (stop) act(() => { stop.focus() })
    view.update({ campaignList: list(...remaining) })
  }

  const renderReal = (...ids) => {
    flags.realTable = true
    renderPage({ campaignList: list(...ids), paginationProps: { currentPage: 1, pageSize: 10, totalItems: ids.length, totalPages: 1 } })
  }

  it('a row in the middle: the focus goes to the next one, not to the first', async () => {
    renderReal(1, 2, 3, 4)
    await deleteFromPanel(2, [1, 3, 4])
    await waitFor(() => expect(document.activeElement).toBe(rowOf(3)))
    // and it stays there (the page does not give it up to a focus that came back late)
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(document.activeElement).toBe(rowOf(3))
  })

  it('the last row: the focus goes to the previous one', async () => {
    renderReal(1, 2, 3)
    await deleteFromPanel(3, [1, 2])
    await waitFor(() => expect(document.activeElement).toBe(rowOf(2)))
  })

  it('the first row: the focus goes to the one that is now first', async () => {
    renderReal(1, 2, 3)
    await deleteFromPanel(1, [2, 3], { restoreFocusTo: null })
    await waitFor(() => expect(document.activeElement).toBe(rowOf(2)))
  })

  it('the only row: the focus goes to the «New campaign» button', async () => {
    renderReal(1)
    await deleteFromPanel(1, [], { restoreFocusTo: null })
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'New campaign' })[0]))
    expect(document.activeElement.closest('.odc-campaign-head')).not.toBeNull()
  })

  it('closing the panel without deleting still gives the focus back to the row that was open', async () => {
    renderReal(1, 2, 3)
    await userEvent.click(rowOf(2))
    act(() => { document.body.focus() })
    await click('Close panel')
    await waitFor(() => expect(document.activeElement).toBe(rowOf(2)))
  })

  it('a focus the person put on a control of the list (not a row) is left alone', async () => {
    renderReal(1, 2, 3)
    await userEvent.click(rowOf(2))
    await click('Delete from panel')
    const columns = screen.getByRole('button', { name: 'Manage columns' })
    act(() => { columns.focus() })
    view.update({ campaignList: list(1, 3) })
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(document.activeElement).toBe(columns)
  })
})

describe('page and page size in the URL', () => {
  it('writes ?page and ?pageSize once the controller knows the pages', () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' })
  })

  it('writes them again when the page changes', () => {
    renderPage()
    view.update({ paginationProps: { currentPage: 3, pageSize: 10, totalItems: 42, totalPages: 5 } })
    expect(urlParams()).toMatchObject({ page: '3', pageSize: '10' })
  })

  it('writes nothing before the pages are known', () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(urlParams().page).toBeUndefined()
  })

  it('without isUseQuery the address is never written', () => {
    renderPage({}, ROUTE, { isUseQuery: false })
    expect(urlParams().page).toBeUndefined()
  })
})

describe('a page left empty asks again', () => {
  it('goes to the page before when the last page is empty', () => {
    renderPage({
      campaignList: { campaigns: [], loading: false, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3 }
    })
    expect(ctl.props.getCampaignList).toHaveBeenCalledWith(2, 10)
  })

  it('asks for the same page when it is not the last', () => {
    renderPage({
      campaignList: { campaigns: [], loading: false, error: null },
      paginationProps: { currentPage: 2, pageSize: 10, totalItems: 40, totalPages: 4 }
    })
    expect(ctl.props.getCampaignList).toHaveBeenCalledWith(2, 10)
  })

  it('does not ask while loading, on a single page or on an error', () => {
    renderPage({
      campaignList: { campaigns: [], loading: true, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3 }
    })
    view.update({ campaignList: { campaigns: [], loading: false, error: ['boom'] } })
    view.update({ campaignList: { campaigns: [], loading: false, error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 1 } })
    expect(ctl.props.getCampaignList).not.toHaveBeenCalled()
  })
})

describe('the status switch (one hook for the table and the panel)', () => {
  it('a switch that works shows no alert and asks the controller', async () => {
    renderPage()
    await click('Switch off 2')
    expect(ctl.props.handleUpdateCampaign).toHaveBeenCalledWith(2, { enabled: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a switch that fails shows the alert with the reason, once, and OK closes it', async () => {
    renderPage({ handleUpdateCampaign: vi.fn(() => Promise.resolve({ ok: false, error: ['Not allowed'] })) })
    await click('Switch off 2')
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("We couldn't change the campaign")).toBeInTheDocument()
    expect(within(alert).getByText('Not allowed')).toBeInTheDocument()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('the panel switches through the same hook (and the same alert), after the confirmation of turning on', async () => {
    renderPage({ handleUpdateCampaign: vi.fn(() => Promise.resolve({ ok: false, error: null })) })
    await click('Open 1')
    await click('Panel switch on')
    expect(ctl.props.handleUpdateCampaign).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Activate "Campaign 1"?' })).getByRole('button', { name: 'Activate campaign' }))
    expect(ctl.props.handleUpdateCampaign).toHaveBeenCalledWith(1, { enabled: true })
    const alert = await screen.findByRole('alertdialog', { name: "We couldn't change the campaign" })
    expect(within(alert).getByText('Something went wrong. Try again.')).toBeInTheDocument()
  })

  // redesign D-6 (owner, 2026-10-19): the confirmation of turning a campaign on is drawn ONCE by the page, for the panel and the table
  it('turning on asks once and Cancel writes nothing; turning off stays immediate', async () => {
    renderPage()
    await click('Open 1')
    await click('Panel switch on')
    const dialogs = await screen.findAllByRole('alertdialog')
    expect(dialogs).toHaveLength(1)
    expect(within(dialogs[0]).getByText("It starts sending to the customers who match its rules. Sent messages can't be undone.")).toBeInTheDocument()
    await userEvent.click(within(dialogs[0]).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleUpdateCampaign).not.toHaveBeenCalled()
    await click('Switch off 2')
    expect(ctl.props.handleUpdateCampaign).toHaveBeenCalledWith(2, { enabled: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('the opens dialog', () => {
  it('is closed until the table asks for it', () => {
    renderPage()
    expect(screen.queryByRole('dialog', { name: 'Opens dialog' })).toBeNull()
    expect(seen.opens.open).toBe(false)
  })

  it('opens from the table with the campaign, and closes', async () => {
    renderPage()
    await click('Opens 3')
    const dialog = screen.getByRole('dialog', { name: 'Opens dialog' })
    expect(within(dialog).getByText('Opens of Campaign 3')).toBeInTheDocument()
    expect(seen.opens.campaign).toBe(CAMPAIGNS[2])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close opens' }))
    expect(screen.queryByRole('dialog', { name: 'Opens dialog' })).toBeNull()
  })

  it('opens from the panel too', async () => {
    renderPage()
    await click('Open 1')
    await click('Panel opens')
    expect(screen.getByRole('dialog', { name: 'Opens dialog' })).toBeInTheDocument()
    expect(seen.opens.campaign).toBe(CAMPAIGNS[0])
  })

  it('keeps the campaign\'s name while the dialog fades out', async () => {
    renderPage()
    await click('Opens 3')
    await userEvent.click(screen.getByRole('button', { name: 'Close opens' }))
    expect(seen.opens.open).toBe(false)
    expect(seen.opens.campaign).toBe(CAMPAIGNS[2])
  })
})

describe('unsaved changes in the create form (CA-B6 reports them)', () => {
  const dirtyCreate = async (route = ROUTE) => {
    renderPage({}, route)
    await click('New campaign')
    await click('Draft dirty')
  }

  it('a row click with a dirty draft asks first and changes nothing', async () => {
    await dirtyCreate()
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
    expect(seen.table.activeId).toBeNull()
  })

  it('the focus starts on «Keep editing»; keeping it closes the question and nothing changes', async () => {
    await dirtyCreate()
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    const keep = within(dialog).getByRole('button', { name: 'Keep editing' })
    await waitFor(() => expect(keep).toHaveFocus())
    await userEvent.click(keep)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
    // and the draft is still dirty: asking again works
    await click('Open 3')
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
  })

  it('discarding opens the row that was clicked', async () => {
    await dirtyCreate()
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByText('Panel of 2')).toBeInTheDocument())
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeId).toBe(2)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('«New campaign» with a dirty draft asks; discarding starts a new, empty panel', async () => {
    await dirtyCreate()
    const first = seen.panel
    await click('New campaign')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(seen.panel).not.toBe(first) // remounted: the draft starts over
    // the new draft is clean: a row opens with no question
    await click('Open 1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 1')).toBeInTheDocument()
  })

  it('«New campaign» with a clean draft does nothing new and asks nothing', async () => {
    renderPage()
    await click('New campaign')
    await click('New campaign')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
  })

  it('«New campaign» with a dirty draft: keep editing leaves the draft where it is', async () => {
    await dirtyCreate()
    await click('New campaign')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
  })

  it('?add=1 arriving while the draft is dirty asks first', async () => {
    await dirtyCreate()
    // the palette navigates to ?add=1 while the page is open
    act(() => { historyRef.current.push(`${ROUTE}?add=1`) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
  })

  it('a clean draft (the form reported false) opens the row at once', async () => {
    await dirtyCreate()
    await click('Draft clean')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
  })

  it('closing the panel forgets the draft: the next row opens with no question', async () => {
    await dirtyCreate()
    await click('Close panel')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
  })

  it('viewing a campaign never asks (nothing to lose)', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
  })
})
