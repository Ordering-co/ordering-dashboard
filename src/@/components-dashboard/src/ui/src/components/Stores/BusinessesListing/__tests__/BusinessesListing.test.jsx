/* eslint-disable import/first */
// redesign SL-F1 (A3): the page of /stores/list composes the pieces of Stores/StoresList (header, filters, selection bar, table) over
// the state of the DashboardBusinessList controller, and keeps, mounted where they were, the editor (`?id=`), the Sync side bar
// (`?header=sync`), the tutorial and the "no stores" modal, which must not open when the load failed
// (SL-04). The controller of the list, the controller of the switches, the editor, the side-bar bodies and the Modal / SideBar
// shells are stand-ins; the header, the filters, the bar and the table are the real pieces.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useHistory } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  controller: {},
  // the controller of the types row keeps its list in state; a new array on each render would loop through setBusinessTypes
  typesState: { loading: false, error: null, types: [{ id: null, name: 'All', enabled: true }, { id: 3, name: 'Restaurant', enabled: true }] },
  switchControllers: 0,
  visited: { businesses_page: true },
  user: { level: 0 },
  configs: {},
  collapsed: false,
  handleMenuCollapse: vi.fn(),
  emit: vi.fn(),
  // redesign stores 2.A: what the editor hands the list through `leaveGuardRef` (null: an editor with nothing to ask)
  editorGuard: null,
  // redesign stores 3.A: the props the controller and the filters row received on the last render
  controllerProps: null,
  filtersProps: null,
  phone: false
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useEvent: () => [{ emit: (...args) => mockState.emit(...args) }],
    useConfig: () => [{ configs: mockState.configs }],
    useSession: () => [{ user: mockState.user }],
    useUtils: () => [{ optimizeImage: (src) => src }],
    // the list controller: it hands its state to the UIComponent (BusinessesListingUI)
    // redesign stores 3.A: `controllerProps` keeps what the wrapper hands the controller (defaultBusinessType, propsToFetch)
    DashboardBusinessList: ({ UIComponent, ...props }) => {
      mockState.controllerProps = props
      return <UIComponent {...mockState.controller} {...props} />
    },
    // the controller of the types row
    BusinessTypeFilter: ({ UIComponent, onChangeBusinessType, ...props }) => (
      <UIComponent
        {...props}
        typesState={mockState.typesState}
        currentTypeSelected={null}
        handleChangeBusinessType={onChangeBusinessType}
      />
    ),
    CityList: ({ UIComponent, ...props }) => <UIComponent {...props} citiesList={{ cities: [], loading: false, error: null }} />,
    // redesign stores 3.B, G1-23: the switches of the list save through one saver for the page (StoreRowControllers)
    useApi: () => [{ setAccessToken: () => ({ businesses: () => ({ save: async (changes) => ({ content: { error: false, result: changes } }) }) }) }],
    useToast: () => [null, { showToast: () => {} }],
    ToastType: { Info: 'info', Success: 'success' },
    useAssistantRecordChanges: () => {},
    // the controller of a switch outside the page's saver (none here since 3.B): one per mount
    BusinessDetails: ({ UIComponent, ...props }) => {
      react.useEffect(() => { mockState.switchControllers += 1 }, [])
      const [state, setState] = react.useState({ business: props.business, loading: false })
      return (
        <UIComponent
          {...props}
          businessState={state}
          handleChangeActiveBusiness={async (value, isFeatured) => {
            setState(current => ({ ...current, business: { ...current.business, [isFeatured ? 'featured' : 'enabled']: value } }))
            return { ok: true }
          }}
        />
      )
    }
  }
})
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: () => null }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: mockState.collapsed }, { handleMenuCollapse: mockState.handleMenuCollapse }]
}))
vi.mock('../../../../utils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getStorageItem: vi.fn(async () => mockState.visited),
    setStorageItem: vi.fn(async () => {}),
    addQueryToUrl: vi.fn(),
    removeQueryToUrl: vi.fn()
  }
})
vi.mock('../../../Shared', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Modal: ({ open, children }) => (open ? <div role='dialog' aria-label='modal'>{children}</div> : null),
    SideBar: ({ id, open, onClose, children }) => (open
      ? (
        <aside data-testid={`sidebar-${id}`}>
          {children}
          <button type='button' onClick={onClose}>Close {id}</button>
        </aside>
        )
      : null)
  }
})
vi.mock('../../ImportersButton', () => ({ ImportersButton: () => <button type='button'>Importers</button> }))
// the real row of filters, seen through a spy on its props
vi.mock('../../StoresList/StoresFilters', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    StoresFilters: (props) => {
      mockState.filtersProps = props
      return <actual.StoresFilters {...props} />
    }
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
vi.mock('../../BusinessDetails', () => ({
  BusinessDetails: ({ businessId, onClose, businessTypes, leaveGuardRef, onPanelSizeChange, dockTop }) => {
    React.useImperativeHandle(leaveGuardRef, () => mockState.editorGuard, [])
    // (T10): the editor tells the list its width state (base · wide · full), as BusinessDetails does
    React.useEffect(() => { onPanelSizeChange?.(mockState.editorSize ?? 'base') }, [onPanelSizeChange])
    return (
      <section data-testid='editor' data-id={businessId} data-types={JSON.stringify(businessTypes)} data-dock-top={String(dockTop)}>
        <button type='button' onClick={onClose}>Close editor</button>
      </section>
    )
  }
}))
// redesign stores 3.D: Sync is a P/Sheet of its own (BusinessSyncSheet), no longer the legacy SideBar
vi.mock('../../BusinessSync', () => ({
  BusinessSyncSheet: ({ open, onClose }) => (open
    ? (
      <aside data-testid='sheet-store_sync'>
        <div data-testid='sync-body' />
        <button type='button' onClick={onClose}>Close store_sync</button>
      </aside>
      )
    : null)
}))
vi.mock('../../WizardBusiness', () => ({
  WizardBusiness: ({ isTutorialMode, openTutorialSidebarState, business, handleSucessUpdateBusiness }) => (
    <div data-testid='wizard' data-tutorial={String(isTutorialMode)} data-step={String(openTutorialSidebarState)} data-business={business?.id} data-categories={business?.categories?.length}>
      <button type='button' onClick={() => handleSucessUpdateBusiness({ id: business?.id, categories: [{ id: 1 }] })}>save category</button>
    </div>
  )
}))

import { addQueryToUrl, removeQueryToUrl } from '../../../../utils'
import { BusinessesListing } from '../index'

const STORES = [
  { id: 2, name: 'Fast Bite', slug: 'fast-bite', city_id: 10, enabled: true, featured: true, reviews: { total: 4 } },
  { id: 4, name: 'KCF', slug: 'kcf', city_id: 10, enabled: true, featured: false, reviews: { total: 0 } },
  { id: 6, name: "Dono's Pizza", slug: 'donos-pizza', city_id: 11, enabled: true, featured: false, reviews: { total: 5 } }
]

const makeController = (over = {}) => ({
  businessList: { loading: false, error: null, businesses: STORES },
  pagination: { currentPage: 1, pageSize: 10, total: 34, from: 1, to: 3 },
  searchValue: '',
  selectedBusinessActiveState: true,
  businessIds: [],
  inActiveBusinesses: { loading: false, businesses: [{ id: 99 }] },
  filterValues: {},
  businessTypeSelected: null,
  citiesList: [{ id: 10, name: 'Miami' }, { id: 11, name: 'Austin' }],
  countriesState: { enabled: false },
  isEatstreetProject: false,
  handleChangeBusinessActiveState: vi.fn(),
  handleChangeBusinessType: vi.fn(),
  loadMoreBusinesses: vi.fn(),
  handleSucessRemoveBusiness: vi.fn(),
  handleSucessAddBusiness: vi.fn(),
  handleSucessUpdateBusiness: vi.fn(),
  loadBusinesses: vi.fn(),
  onSearch: vi.fn(),
  getPageBusinesses: vi.fn(),
  handleChangeBusinessIds: vi.fn(),
  handleEnableAllBusiness: vi.fn(),
  handleDeleteMultiBusinesses: vi.fn(),
  setBusinessIds: vi.fn(),
  handleChangeFilterValues: vi.fn(),
  ...over
})

const NO_STORES = {
  businessList: { loading: false, error: null, businesses: [] },
  pagination: { currentPage: 1, pageSize: 10, total: 0 },
  inActiveBusinesses: { loading: false, businesses: [] }
}

const theme = { images: { dummies: { noBusinesses: 'no-businesses.png' }, tutorials: {} } }

const draw = (over = {}, { url = '/stores/list', props = {} } = {}) => {
  mockState.controller = makeController(over)
  const onBusinessRedirect = vi.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[url]}>
        <BusinessesListing isUseQuery onBusinessRedirect={onBusinessRedirect} {...props} />
      </MemoryRouter>
    </ThemeProvider>
  )
  return { ...utils, controller: mockState.controller, onBusinessRedirect }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.switchControllers = 0
  mockState.visited = { businesses_page: true }
  mockState.user = { level: 0 }
  mockState.configs = {}
  mockState.collapsed = false
  mockState.editorGuard = null
  mockState.controllerProps = null
  mockState.filtersProps = null
  mockState.phone = false
})

describe('BusinessesListing · composition', () => {
  it('draws the header, the filters and the table over the controller state', async () => {
    draw()
    expect(screen.getByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
    expect(screen.getByText('34 stores')).toBeInTheDocument() // the total of the tab on screen
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'List view', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument() // redesign stores 3.A: the types are the first pill of the bar
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Stores list' })
    expect(within(table).getByText('Fast Bite')).toBeInTheDocument()
    expect(within(table).getAllByText('Miami', { selector: '.odc-sl-sub' })).toHaveLength(2) // the cities come from the controller
    expect(screen.queryByText('2 selected')).toBeNull()
  })

  // main the header has no Sync button any more (?header=sync still opens the sheet, below)
  it('wires the actions of the header: Refresh and Add new store, and no Sync', async () => {
    const user = userEvent.setup()
    const { controller } = draw()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(controller.loadBusinesses).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull()
    expect(screen.queryByTestId('sheet-store_sync')).toBeNull()

    // redesign stores 3.A, P-3: the primary button of the header is the only «Add new store» (the foot link is gone)
    const primary = screen.getByRole('button', { name: 'Add new store' })
    await user.click(primary)
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
  })

  // redesign (D2, Tiendas decision 9 A): the Google lookup of the old BusinessAddStore modal is on the add page now
  it('goes straight to the add page also when a country with Places is enabled (no modal in between)', async () => {
    const user = userEvent.setup()
    draw({ countriesState: { enabled: true } })
    await user.click(screen.getAllByRole('button', { name: 'Add new store' })[0])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
  })

  it('hides «Add new store» when a store owner may not register stores (allow_business_owner_register_business)', () => {
    mockState.user = { level: 2 }
    mockState.configs = { allow_business_owner_register_business: { value: '0' } }
    draw()
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  // redesign bugs E (R-1): the list reads the setting as the rest of the dashboard (on as '1', 1 or true)
  it('keeps «Add new store» for a store owner when the setting is on as true or 1', () => {
    mockState.user = { level: 2 }
    mockState.configs = { allow_business_owner_register_business: { value: true } }
    const first = draw()
    expect(screen.getAllByRole('button', { name: 'Add new store' }).length).toBeGreaterThan(0)
    first.unmount()
    mockState.configs = { allow_business_owner_register_business: { value: 1 } }
    draw()
    expect(screen.getAllByRole('button', { name: 'Add new store' }).length).toBeGreaterThan(0)
  })

  it('wires the filters, the tabs, the view switch and the pages to the controller', async () => {
    const user = userEvent.setup()
    const { controller } = draw()
    await user.click(screen.getByRole('button', { name: 'Type' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Type' })).getByRole('option', { name: 'Restaurant' }))
    expect(controller.handleChangeBusinessType).toHaveBeenCalledWith(3)
    expect(addQueryToUrl).toHaveBeenCalledWith({ type: 3 }) // and the address carries it
    await user.click(screen.getByRole('tab', { name: 'Inactive' }))
    expect(controller.handleChangeBusinessActiveState).toHaveBeenCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'Card view' }))
    expect(controller.getPageBusinesses).toHaveBeenLastCalledWith(50, 1)
    expect(removeQueryToUrl).toHaveBeenCalledWith(['page', 'pageSize'])
    await user.click(screen.getByRole('button', { name: 'List view' }))
    expect(controller.getPageBusinesses).toHaveBeenLastCalledWith(10, 1)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(controller.getPageBusinesses).toHaveBeenLastCalledWith(10, 2)
  })

  it('shows the selection bar with the selected ids and wires it to the controller', async () => {
    const user = userEvent.setup()
    const { controller } = draw({ businessIds: [2, 4] })
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(controller.setBusinessIds).toHaveBeenCalledWith([])
    await user.click(screen.getByRole('checkbox', { name: 'Select Dono\'s Pizza' }))
    expect(controller.handleChangeBusinessIds).toHaveBeenCalledWith(6)
  })

  // redesign stores 3.B, G1-23: no BusinessDetails controller per store; the switches save through the page's saver
  it('mounts no controller per store for its Enabled and Featured switches', async () => {
    draw()
    expect(screen.getByRole('switch', { name: 'Enable Fast Bite' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Featured Fast Bite' })).toBeInTheDocument()
    await act(async () => {})
    expect(mockState.switchControllers).toBe(0)
  })

  // redesign stores 3.B: the column manager is a tool of the filter bar, in the list view only
  it('puts the column manager at the end of the filter bar, and leaves it out of the card view', async () => {
    const user = userEvent.setup()
    draw()
    const manage = screen.getByRole('button', { name: 'Manage columns' })
    expect(manage.closest('.odc-filterbar-tools')).not.toBeNull()
    await user.click(manage)
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Ratings' }))
    expect(screen.queryByRole('columnheader', { name: 'Ratings' })).toBeNull()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Card view' }))
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })

  // redesign stores 3.B, decision 12a: the bar offers the verb of the tab
  it('offers the verb the selected stores need: Disable for enabled ones, Enable for disabled ones', () => {
    const { unmount } = draw({ businessIds: [2] })
    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument()
    unmount()
    const inactive = STORES.map(store => ({ ...store, enabled: false }))
    draw({ businessIds: [2], selectedBusinessActiveState: false, businessList: { loading: false, error: null, businesses: inactive } })
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable' })).toBeNull()
  })

  // redesign stores 3.B, review r1 #5: a load that failed with nothing to show has no column manager over its error
  it('leaves the column manager out when the load failed with nothing to show', () => {
    draw({ businessList: { loading: false, error: ['Network down'], businesses: [] } })
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })

  it('offers «Open menu» only with the sidebar collapsed', async () => {
    const user = userEvent.setup()
    const { unmount } = draw()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    unmount()
    mockState.collapsed = true
    draw()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(mockState.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('BusinessesListing · the editor (?id=)', () => {
  it('opens the editor for the store in the address at mount', () => {
    draw({}, { url: '/stores/list?id=4' })
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
  })

  it('has no editor without ?id=, opens it from a row and closes it back to the list', async () => {
    const user = userEvent.setup()
    const { onBusinessRedirect } = draw()
    expect(screen.queryByTestId('editor')).toBeNull()
    await user.click(within(screen.getByRole('table', { name: 'Stores list' })).getByText('KCF'))
    expect(onBusinessRedirect).toHaveBeenCalledWith(4)
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
    await user.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(onBusinessRedirect).toHaveBeenLastCalledWith()
    expect(screen.queryByTestId('editor')).toBeNull()
  })

  it('«Add your first store» asks the editor first and goes to the add, which goes on with the tutorial', async () => {
    mockState.visited = {}
    const user = userEvent.setup()
    draw({ ...NO_STORES }, { url: '/stores/list?id=4' })
    expect(screen.getByTestId('editor')).toBeInTheDocument()
    // redesign the «no stores» dialog opens over the page (as main's modal did); the user closes it first
    await user.click(within(await screen.findByRole('dialog', { name: 'You have no stores yet' })).getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('button', { name: 'Add your first store' }))
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add', state: { continueTutorial: true } })
    expect(screen.queryByTestId('sidebar-add_business_form')).toBeNull()
  })
})

// redesign stores 1.C, G1-25: the address was read only at mount. ⌘K (and any router navigation) that lands on
// /stores/list?id=… with the list already on screen must open, change or close the editor without remounting the page.
describe('BusinessesListing · the editor follows ?id= with the list mounted (G1-25)', () => {
  const drawWithHistory = (url = '/stores/list') => {
    mockState.controller = makeController()
    const routerRef = {}
    const Grab = () => { routerRef.history = useHistory(); return null }
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[url]}>
          <Grab />
          <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    return routerRef
  }

  it('opens the editor when the address gains ?id= (and ?section=)', () => {
    const router = drawWithHistory()
    expect(screen.queryByTestId('editor')).toBeNull()
    act(() => router.history.push('/stores/list?id=6&section=schedule'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '6')
  })

  it('moves the open editor to another store, and closes it when ?id= goes away', () => {
    const router = drawWithHistory('/stores/list?id=4')
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
    act(() => router.history.push('/stores/list?id=6'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '6')
    act(() => router.history.push('/stores/list?active=true'))
    expect(screen.queryByTestId('editor')).toBeNull()
  })

  it('writes back the keys of the list the destination left out (tab and page), as the list still shows them', () => {
    const router = drawWithHistory('/stores/list?active=true&page=1&pageSize=10')
    addQueryToUrl.mockClear()
    act(() => router.history.push('/stores/list?id=6&section=schedule'))
    expect(addQueryToUrl).toHaveBeenCalledWith({ active: true, page: 1, pageSize: 10 })
    addQueryToUrl.mockClear()
    act(() => router.history.push('/stores/list?id=4&active=true&page=1'))
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  // redesign bugs F row 22, F5: ⌘K from a list filtered by type kept the tab and the page but dropped the type
  it('writes back the type on screen when the destination left it out, and not when it carries one', () => {
    mockState.controller = makeController({ businessTypeSelected: 3 })
    const routerRef = {}
    const Grab = () => { routerRef.history = useHistory(); return null }
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/stores/list?active=true&page=1&pageSize=10&type=3']}>
          <Grab />
          <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    addQueryToUrl.mockClear()
    act(() => routerRef.history.push('/stores/list?id=6&section=schedule'))
    expect(addQueryToUrl).toHaveBeenCalledWith({ active: true, page: 1, pageSize: 10, type: 3 })
    addQueryToUrl.mockClear()
    act(() => routerRef.history.push('/stores/list?id=4&active=true&page=1&type=3'))
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('closes the Sync side bar when a store is opened over it, so the editor is not covered', () => {
    const router = drawWithHistory('/stores/list?header=sync&tab=deliverect')
    expect(screen.getByTestId('sheet-store_sync')).toBeInTheDocument()
    act(() => router.history.push('/stores/list?id=6'))
    expect(screen.queryByTestId('sheet-store_sync')).toBeNull()
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '6')
  })

  it('a navigation to the same store does not reopen or remount the editor', () => {
    const router = drawWithHistory('/stores/list?id=4')
    const editor = screen.getByTestId('editor')
    act(() => router.history.push('/stores/list?id=4&section=menu'))
    expect(screen.getByTestId('editor')).toBe(editor)
  })
})

// redesign stores 2.A (decision 4): what takes the editor away asks it first; it answers by calling `go` (nothing to
// ask, Discard, or a save that went well) or `onCancel` (Keep editing).
describe('BusinessesListing · leaving the editor asks it first', () => {
  const keeping = () => ({ requestLeave: vi.fn((go, onCancel) => { onCancel?.(); return true }) })
  const leaving = () => ({ requestLeave: vi.fn(go => { go(); return false }) })
  const drawWithHistory = (url) => {
    mockState.controller = makeController()
    const routerRef = {}
    const Grab = () => { routerRef.history = useHistory(); return null }
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[url]}>
          <Grab />
          <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    return routerRef
  }

  it('another store from a row: the editor stays when the user keeps editing, and moves when it lets go', async () => {
    const user = userEvent.setup()
    mockState.editorGuard = keeping()
    const { onBusinessRedirect } = draw({}, { url: '/stores/list?id=4' })
    await user.click(within(screen.getByRole('table', { name: 'Stores list' })).getByText("Dono's Pizza"))
    expect(mockState.editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
    expect(onBusinessRedirect).not.toHaveBeenCalled()

    mockState.editorGuard.requestLeave.mockImplementation(go => { go(); return false })
    await user.click(within(screen.getByRole('table', { name: 'Stores list' })).getByText("Dono's Pizza"))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '6')
    expect(onBusinessRedirect).toHaveBeenCalledWith(6)
  })

  // review F3-R3: «Add new store» of the header goes to the add page, which takes the editor away
  it('«Add new store» asks the editor before it leaves for the add page', async () => {
    const user = userEvent.setup()
    mockState.editorGuard = keeping()
    draw({}, { url: '/stores/list?id=4' })
    await user.click(screen.getAllByRole('button', { name: 'Add new store' })[0])
    expect(mockState.editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(mockState.emit).not.toHaveBeenCalledWith('go_to_page', { page: 'business_add' })

    mockState.editorGuard.requestLeave.mockImplementation(go => { go(); return false })
    await user.click(screen.getAllByRole('button', { name: 'Add new store' })[0])
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
  })

  it('the same store from a row does not ask', async () => {
    const user = userEvent.setup()
    mockState.editorGuard = keeping()
    draw({}, { url: '/stores/list?id=4' })
    await user.click(within(screen.getByRole('table', { name: 'Stores list' })).getByText('KCF'))
    expect(mockState.editorGuard.requestLeave).not.toHaveBeenCalled()
  })

  it('«Add your first store» with the editor open asks before it closes it', async () => {
    mockState.visited = {}
    mockState.editorGuard = keeping()
    const user = userEvent.setup()
    draw({ ...NO_STORES }, { url: '/stores/list?id=4' })
    await user.click(within(await screen.findByRole('dialog', { name: 'You have no stores yet' })).getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('button', { name: 'Add your first store' }))
    expect(mockState.editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editor')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-add_business_form')).toBeNull()
  })

  it('⌘K to another store asks; keeping editing puts the open store back in the address', () => {
    mockState.editorGuard = keeping()
    const router = drawWithHistory('/stores/list?id=4')
    addQueryToUrl.mockClear()
    act(() => router.history.push('/stores/list?id=6&section=menu'))
    expect(mockState.editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ id: '4' })
  })

  it('⌘K to another store or to the list goes when the editor lets go', () => {
    mockState.editorGuard = leaving()
    const router = drawWithHistory('/stores/list?id=4')
    act(() => router.history.push('/stores/list?id=6'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '6')
    act(() => router.history.push('/stores/list?active=true'))
    expect(mockState.editorGuard.requestLeave).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('editor')).toBeNull()
  })

  it('⌘K to the list without ?id= asks, and the editor stays when the user keeps editing', () => {
    mockState.editorGuard = keeping()
    const router = drawWithHistory('/stores/list?id=4')
    act(() => router.history.push('/stores/list?active=true'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-id', '4')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ id: '4' })
  })
})

// redesign stores 1.C, G1-05: the City pill said «No results found» while the countries were still loading
describe('BusinessesListing · City while the cities load (G1-05)', () => {
  it('the City pill says «Loading...» until the countries arrive', async () => {
    const user = userEvent.setup()
    draw({ citiesList: [], countriesState: { loading: true, enabled: false } })
    await user.click(screen.getByRole('button', { name: /^City/ }))
    expect(await screen.findByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('No results found')).toBeNull()
  })

  it('says «No results found» once they arrived and there are none', async () => {
    const user = userEvent.setup()
    draw({ citiesList: [], countriesState: { loading: false, enabled: false } })
    await user.click(screen.getByRole('button', { name: /^City/ }))
    expect(await screen.findByText('No results found')).toBeInTheDocument()
  })
})

describe('BusinessesListing · Sync (?header=sync)', () => {
  it('opens the Sync side bar at mount', () => {
    draw({}, { url: '/stores/list?header=sync' })
    expect(screen.getByTestId('sheet-store_sync')).toBeInTheDocument()
    expect(screen.getByTestId('sync-body')).toBeInTheDocument()
  })

  it('is closed without it', () => {
    draw()
    expect(screen.queryByTestId('sheet-store_sync')).toBeNull()
  })

  // redesign stores 3.D: the ⌘K actions open /stores/list?header=sync&tab=deliverect|itsacheckmate
  it.each(['deliverect', 'itsacheckmate'])('?header=sync&tab=%s opens the Sync sheet and keeps the tab', (tab) => {
    draw({}, { url: `/stores/list?header=sync&tab=${tab}` })
    expect(screen.getByTestId('sheet-store_sync')).toBeInTheDocument()
    expect(screen.getByTestId('sync-body')).toBeInTheDocument()
    expect(removeQueryToUrl).not.toHaveBeenCalledWith(['header', 'tab'])
    expect(document.querySelector('#store_sync')).toBeNull() // no legacy SideBar
  })
})

describe('BusinessesListing · the tutorial', () => {
  it('turns the tutorial on at the first visit and remembers it', async () => {
    mockState.visited = {}
    draw()
    await waitFor(() => expect(screen.getByTestId('wizard')).toHaveAttribute('data-tutorial', 'true'))
  })

  it('stays off after the first visit', async () => {
    draw()
    await act(async () => {})
    expect(screen.getByTestId('wizard')).toHaveAttribute('data-tutorial', 'false')
  })

  // the store is created on /stores/add, which already asks for the opening hours and the payment methods
  describe('coming back from /stores/add with the store', () => {
    const backFromAdd = () => {
      mockState.controller = makeController()
      const routerRef = {}
      const Grab = () => { routerRef.history = useHistory(); return null }
      render(
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[{ pathname: '/stores/list', state: { tutorialBusiness: { id: 9, slug: 'pizza' } } }]}>
            <Grab />
            <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
          </MemoryRouter>
        </ThemeProvider>
      )
      return routerRef
    }

    it('goes on with the category of that store', () => {
      backFromAdd()
      const wizard = screen.getByTestId('wizard')
      expect(wizard).toHaveAttribute('data-tutorial', 'true')
      expect(wizard).toHaveAttribute('data-step', 'new_category')
      expect(wizard).toHaveAttribute('data-business', '9')
    })

    it('a reload does not start it again: the store leaves the navigation state and the step stays open', async () => {
      const routerRef = backFromAdd()
      await waitFor(() => expect(routerRef.history.location.state).toBeUndefined())
      expect(routerRef.history.location.pathname).toBe('/stores/list')
      expect(screen.getByTestId('wizard')).toHaveAttribute('data-step', 'new_category')
    })

    it('what a step saved reaches the next step (the product needs the category)', async () => {
      const user = userEvent.setup()
      backFromAdd()
      await user.click(screen.getByRole('button', { name: 'save category' }))
      expect(screen.getByTestId('wizard')).toHaveAttribute('data-categories', '1')
      expect(mockState.controller.handleSucessUpdateBusiness).toHaveBeenCalledWith({ id: 9, categories: [{ id: 1 }] })
    })
  })
})

describe('BusinessesListing · the "no stores" modal', () => {
  it('opens when the project has no stores (active and inactive empty)', async () => {
    const user = userEvent.setup()
    draw({ ...NO_STORES })
    // redesign a P/Dialog with a title; same condition, same picture, same action
    const dialog = await screen.findByRole('dialog', { name: 'You have no stores yet' })
    await user.click(within(dialog).getByRole('button', { name: 'Add new store' }))
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
    // with no stores the header has no actions and the table says so
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
  })

  it('does NOT open when the load failed (SL-04); the table says so and retries', async () => {
    const user = userEvent.setup()
    const { controller } = draw({
      ...NO_STORES,
      businessList: { loading: false, error: ['Internal error'], businesses: [] }
    })
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText("We couldn't load the stores.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(controller.loadBusinesses).toHaveBeenCalledTimes(1)
  })

  // (row 9): the failed load has an empty list, but the tabs and the type pill stay next to the error
  it('keeps the Active/Inactive tabs and the Type pill next to the load error', async () => {
    draw({
      ...NO_STORES,
      businessList: { loading: false, error: ['Internal error'], businesses: [] }
    })
    await act(async () => {})
    expect(screen.getByText("We couldn't load the stores.")).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Inactive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
  })

  // a failed load is not «no stores»: the page keeps its head, tabs, Type and actions, and the error takes the table's place
  it('keeps Refresh and Add new store next to the load error, with the new text and Retry', async () => {
    const user = userEvent.setup()
    const { controller } = draw({
      ...NO_STORES,
      businessList: { loading: false, error: ['NETWORK_ERROR'], businesses: [] }
    })
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the stores.")
    expect(screen.queryByText(/NETWORK_ERROR|Network error/)).toBeNull()
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add new store' }))
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }))
    expect(controller.loadBusinesses).toHaveBeenCalledTimes(1)
  })

  // a search that finds nothing says so and clears itself, the filters and the type
  it('says nothing matches a search with no result and «Clear filters» there clears search, filters and type', async () => {
    const user = userEvent.setup()
    const { controller } = draw({
      ...NO_STORES,
      searchValue: 'zzqqxx',
      filterValues: { featured: true },
      businessTypeSelected: 3
    })
    await act(async () => {})
    expect(screen.getByText('No stores match your search or filters')).toBeInTheDocument()
    expect(screen.queryByText('No stores to show')).toBeNull()
    const empty = screen.getByText('No stores match your search or filters').closest('.odc-state')
    await user.click(within(empty).getByRole('button', { name: 'Clear filters' }))
    expect(controller.onSearch).toHaveBeenCalledWith('')
    expect(controller.handleChangeFilterValues).toHaveBeenCalledWith({})
    expect(controller.handleChangeBusinessType).toHaveBeenCalledWith(null)
  })

  it('a project without stores still says «No stores to show» with nothing to clear', async () => {
    draw(NO_STORES)
    await act(async () => {})
    expect(screen.queryByText('No stores match your search or filters')).toBeNull()
  })

  it('does not open while the stores are loading, nor when another tab has stores', async () => {
    const { unmount } = draw({ ...NO_STORES, businessList: { loading: true, error: null, businesses: [] } })
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
    draw({ ...NO_STORES, inActiveBusinesses: { loading: false, businesses: [{ id: 5 }] } })
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// redesign stores 3.A: ?type=, ?q=, schedule in propsToFetch (S8, P-2) and the phone header (S6, P-1)
describe('BusinessesListing · ?type= (S5)', () => {
  it('hands the controller the type of the address as a number', () => {
    draw({}, { url: '/stores/list?type=3' })
    expect(mockState.controllerProps.defaultBusinessType).toBe(3)
  })

  // redesign stores 3.A, review F2: the controller reads 0 as «no type», so the pill must not say one is on
  it.each(['0', '-2'])('hands nothing for ?type=%s (not a type id)', (value) => {
    draw({}, { url: `/stores/list?type=${value}` })
    expect(mockState.controllerProps.defaultBusinessType).toBeUndefined()
  })

  it('keeps a non-numeric type as the string', () => {
    draw({}, { url: '/stores/list?type=abc' })
    expect(mockState.controllerProps.defaultBusinessType).toBe('abc')
  })

  it('hands nothing without ?type=, and nothing without isUseQuery', () => {
    const { unmount } = draw()
    expect(mockState.controllerProps.defaultBusinessType).toBeUndefined()
    unmount()
    draw({}, { url: '/stores/list?type=3', props: { isUseQuery: false } })
    expect(mockState.controllerProps.defaultBusinessType).toBeUndefined()
  })

  it('gives the filters the type on screen as businessTypeSelected, not defaultBusinessType', () => {
    draw({ businessTypeSelected: 3 }, { url: '/stores/list?type=3' })
    expect(mockState.filtersProps.businessTypeSelected).toBe(3)
    expect(mockState.filtersProps.defaultBusinessType).toBeUndefined()
  })

  it('a change goes to the controller and writes ?type=; null (All types) removes it', () => {
    const { controller } = draw()
    act(() => mockState.filtersProps.handleChangeBusinessType(5))
    expect(controller.handleChangeBusinessType).toHaveBeenLastCalledWith(5)
    expect(addQueryToUrl).toHaveBeenCalledWith({ type: 5 })
    act(() => mockState.filtersProps.handleChangeBusinessType(null))
    expect(controller.handleChangeBusinessType).toHaveBeenLastCalledWith(null)
    expect(removeQueryToUrl).toHaveBeenCalledWith(['type'])
  })

  it('without isUseQuery the change reaches the controller and the address is left alone', () => {
    const { controller } = draw({}, { props: { isUseQuery: false } })
    act(() => mockState.filtersProps.handleChangeBusinessType(5))
    act(() => mockState.filtersProps.handleChangeBusinessType(null))
    expect(controller.handleChangeBusinessType).toHaveBeenCalledTimes(2)
    expect(addQueryToUrl).not.toHaveBeenCalledWith(expect.objectContaining({ type: expect.anything() }))
    expect(removeQueryToUrl).not.toHaveBeenCalledWith(['type'])
  })
})

describe('BusinessesListing · ?q= (S7)', () => {
  it('applies the search of the address once, through the list search, and removes ?q=', () => {
    const { controller } = draw({}, { url: '/stores/list?q=tim' })
    expect(controller.onSearch).toHaveBeenCalledTimes(1)
    expect(controller.onSearch).toHaveBeenCalledWith('tim')
    expect(removeQueryToUrl).toHaveBeenCalledWith(['q'])
  })

  it('does nothing without ?q= or without isUseQuery', () => {
    const { controller, unmount } = draw()
    expect(controller.onSearch).not.toHaveBeenCalled()
    unmount()
    const second = draw({}, { url: '/stores/list?q=tim', props: { isUseQuery: false } })
    expect(second.controller.onSearch).not.toHaveBeenCalled()
  })
})

// redesign bugs F rows 17 and 22: the controller's opt-ins, which only this page needs
describe('BusinessesListing · opt-ins of the controller (bugs F rows 17 and 22)', () => {
  it('asks the controller for the inactive probe and the countries', () => {
    draw()
    expect(mockState.controllerProps.fetchInactiveProbe).toBe(true)
    expect(mockState.controllerProps.fetchCountries).toBe(true)
  })

  it('hands the controller the sanitized ?q= as the search it starts with', () => {
    draw({}, { url: '/stores/list?q=%20%20bob%20%20smith%20' })
    expect(mockState.controllerProps.defaultSearchValue).toBe('bob smith')
  })

  it('hands nothing without ?q=, and nothing without isUseQuery', () => {
    const { unmount } = draw()
    expect(mockState.controllerProps.defaultSearchValue).toBeUndefined()
    unmount()
    draw({}, { url: '/stores/list?q=bob', props: { isUseQuery: false } })
    expect(mockState.controllerProps.defaultSearchValue).toBeUndefined()
  })
})

describe('BusinessesListing · propsToFetch (S8, P-2)', () => {
  // the default list of DashboardBusinessList today
  const TODAY = ['disabled_reason', 'id', 'alcohol', 'city', 'delivery_price', 'distance', 'delivery_time', 'ribbon', 'enabled', 'featured', 'food', 'groceries', 'header', 'laundry', 'logo', 'minimum', 'name', 'pickup_time', 'slug', 'reviews']

  it('asks for schedule on top of every field of today', () => {
    draw()
    const fields = mockState.controllerProps.propsToFetch
    expect(fields).toContain('schedule')
    TODAY.forEach(field => expect(fields).toContain(field))
    expect(fields).toHaveLength(TODAY.length + 1)
  })
})

describe('BusinessesListing · phone header (S6, P-1)', () => {
  it('moves Importers and Refresh to the «More actions» menu and keeps Add new store in view', async () => {
    mockState.phone = true
    const user = userEvent.setup()
    const { controller } = draw()
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add new store' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Refresh' }))
    expect(controller.loadBusinesses).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.queryByRole('menuitem', { name: 'Sync' })).toBeNull()
  })
})

// owner decision 35 (batch AE): a phone has no List / Card switch (its table draws cards in both views), so a Card view left from
// a wider window goes back to List once
describe('BusinessesListing · Card view when the window becomes a phone (decision 35)', () => {
  it('goes back to List once, with one fetch, and the switch is gone', async () => {
    const user = userEvent.setup()
    const { controller, rerender } = draw()
    await user.click(screen.getByRole('button', { name: 'Card view' }))
    expect(controller.getPageBusinesses).toHaveBeenLastCalledWith(50, 1)
    controller.getPageBusinesses.mockClear()
    mockState.phone = true
    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/stores/list']}>
          <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.queryByRole('button', { name: 'Card view' })).toBeNull()
    expect(controller.getPageBusinesses).toHaveBeenCalledTimes(1)
    expect(controller.getPageBusinesses).toHaveBeenLastCalledWith(10, 1)
  })

  it('does not fetch again when it is already List as the window becomes a phone', () => {
    const { controller, rerender } = draw()
    controller.getPageBusinesses.mockClear()
    mockState.phone = true
    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/stores/list']}>
          <BusinessesListing isUseQuery onBusinessRedirect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(controller.getPageBusinesses).not.toHaveBeenCalled()
  })

  it('does not fetch on a phone from the first render', () => {
    mockState.phone = true
    const { controller } = draw()
    expect(controller.getPageBusinesses).not.toHaveBeenCalled()
  })
})

// (T10, decision X-1): with the Overview (the 500px `base` panel) the list makes room for the editor, so the table narrows
// as in Orders, Customers, Drivers and Groups instead of hiding its last columns under the panel; `wide` keeps the strip and `full` is modal
describe('BusinessesListing · the editor docks beside the list', () => {
  const atWidth = (width) => {
    window.innerWidth = width
    window.dispatchEvent(new Event('resize'))
  }
  const listing = () => document.querySelector('.odc-stores-listing')
  afterEach(() => {
    mockState.editorSize = undefined
    atWidth(1024)
  })

  it('docks with the Overview panel on a wide window', () => {
    atWidth(1440)
    draw({}, { url: '/stores/list?id=4' })
    expect(listing()).toHaveAttribute('data-editor-docked')
  })

  it('does not dock without an editor, with a section open (wide), or on a narrow window', () => {
    atWidth(1440)
    const first = draw()
    expect(listing()).not.toHaveAttribute('data-editor-docked')
    first.unmount()

    mockState.editorSize = 'wide'
    const second = draw({}, { url: '/stores/list?id=4' })
    expect(listing()).not.toHaveAttribute('data-editor-docked')
    second.unmount()

    mockState.editorSize = 'base'
    atWidth(900)
    draw({}, { url: '/stores/list?id=4' })
    expect(listing()).not.toHaveAttribute('data-editor-docked')
  })
})

// redesign tanda AB (): docking the editor never moves the page header. The header keeps the whole width (the
// room for the panel is taken from what is under it) and the panel starts at the bottom edge of the PageHeader, which the list
// measures and hands to the editor as `dockTop`. jsdom does no layout: the bottom edge is a stub, the CSS is read as text.
describe('BusinessesListing · docked editor under the page header', () => {
  const CSS = readFileSync(path.resolve(__dirname, '../businesses-listing.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const atWidth = (width) => {
    window.innerWidth = width
    window.dispatchEvent(new Event('resize'))
  }
  const editor = () => screen.getByTestId('editor')
  let bottom
  let rectSpy
  let observers
  const OriginalResizeObserver = globalThis.ResizeObserver

  beforeEach(() => {
    bottom = 92
    observers = []
    rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isHead = this.classList?.contains('odc-pagehead')
      return { top: 0, left: 0, right: 0, width: 0, height: isHead ? bottom : 0, bottom: isHead ? bottom : 0, x: 0, y: 0, toJSON: () => ({}) }
    })
    globalThis.ResizeObserver = class {
      constructor (callback) { this.callback = callback; this.targets = []; observers.push(this) }
      observe (target) { this.targets.push(target) }
      unobserve () {}
      disconnect () { this.targets = [] }
    }
  })
  afterEach(() => {
    rectSpy.mockRestore()
    globalThis.ResizeObserver = OriginalResizeObserver
    mockState.editorSize = undefined
    atWidth(1024)
  })

  it('does not take room from the head: the docked padding goes to what is under the PageHeader, not to the whole page', () => {
    // the head (PageHeader) is out of the rule; the view row inside it and everything after it are in
    expect(CSS).toMatch(/\.odc-stores-listing\[data-editor-docked\] > :not\(\.odc-sl-head\)/)
    expect(CSS).toMatch(/\.odc-stores-listing\[data-editor-docked\] \.odc-sl-viewrow/)
    const docked = CSS.match(/\.odc-stores-listing\[data-editor-docked\](?! >| \.)\s*\{[^}]*\}/)
    expect(docked === null || !/padding-inline-end/.test(docked[0])).toBe(true)
    const rule = CSS.match(/\.odc-stores-listing\[data-editor-docked\] > :not\(\.odc-sl-head\)[^{]*\{([^}]*)\}/)
    expect(rule[1]).toMatch(/margin-inline-end:\s*var\(--od-x-store-panel\)/)
  })

  it('hands the editor the bottom edge of the PageHeader while docked', () => {
    atWidth(1440)
    draw({}, { url: '/stores/list?id=4' })
    expect(document.querySelector('.odc-stores-listing')).toHaveAttribute('data-editor-docked')
    expect(editor()).toHaveAttribute('data-dock-top', '92')
  })

  it('hands it nothing when it does not dock (a section open, a narrow window)', () => {
    atWidth(1440)
    mockState.editorSize = 'wide'
    const first = draw({}, { url: '/stores/list?id=4' })
    expect(editor()).toHaveAttribute('data-dock-top', 'null')
    first.unmount()

    mockState.editorSize = 'base'
    atWidth(900)
    draw({}, { url: '/stores/list?id=4' })
    expect(editor()).toHaveAttribute('data-dock-top', 'null')
  })

  it('measures again when the head changes size and when the window does', () => {
    atWidth(1440)
    draw({}, { url: '/stores/list?id=4' })
    expect(editor()).toHaveAttribute('data-dock-top', '92')
    const watched = observers.filter(observer => observer.targets.some(target => target.classList?.contains('odc-pagehead')))
    expect(watched.length).toBeGreaterThan(0)

    bottom = 128
    act(() => watched[0].callback([]))
    expect(editor()).toHaveAttribute('data-dock-top', '128')

    bottom = 56
    act(() => atWidth(1500))
    expect(editor()).toHaveAttribute('data-dock-top', '56')
  })

  it('stops watching once the editor closes and gives the panel back its y = 0', async () => {
    const user = userEvent.setup()
    atWidth(1440)
    draw({}, { url: '/stores/list?id=4' })
    expect(editor()).toHaveAttribute('data-dock-top', '92')
    const watched = observers.filter(observer => observer.targets.some(target => target.classList?.contains('odc-pagehead')))
    expect(watched.length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(document.querySelector('.odc-stores-listing')).not.toHaveAttribute('data-editor-docked')
    expect(watched.every(observer => observer.targets.length === 0)).toBe(true)
  })
})
