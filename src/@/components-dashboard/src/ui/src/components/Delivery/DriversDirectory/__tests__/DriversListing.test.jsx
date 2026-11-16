/* eslint-disable import/first */
// redesign DL-B5 (decisions 1-5, 7 | M-DL1..M-DL13): the drivers page. The controller (K/UsersList), the table, the panel, the export, the
// add form and ConfirmAdmin are other pieces (DL-B1..B4 and legacy ones) and are stubs here that record what they receive: what is tested is
// how they are composed, what the page passes to each, and what the page owns (the URL, the open driver, the status filter, the selection
// bar, the dialogs and the focus). The wrapper (`Delivery/DeliveryUsersListing`) is the real one, so the status and the flags the controller
// gets are the ones it builds. The Product wrappers (PageHeader, SearchField, SegmentedControl, InlineNotice, SelectionBar, SplitView,
// Pagination, Sheet, dialogs), the header and `useDriverToggles` are the real ones.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ controller: null, table: null, panel: null, exportProps: null, addForm: null, confirmAdmin: null }))
const ctl = vi.hoisted(() => ({ props: {}, session: { id: 1, level: 0 }, flags: {}, configs: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: ctl.session }],
  useConfig: () => [{ configs: ctl.configs }],
  // the controller hands its props to the UI as the real one does; the test plays the controller
  UsersList: ({ UIComponent, ...props }) => {
    seen.controller = { ...props, UIComponent }
    return <UIComponent {...props} {...ctl.props} />
  }
}))

vi.mock('../../../../utils/navigationHelpers', async (importOriginal) => ({
  ...(await importOriginal()),
  getUserType: (type) => !!ctl.flags[type]
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../DriversExport', () => ({
  DriversExport: (props) => {
    seen.exportProps = props
    return <button type='button' disabled={props.disabled}>Export CSV</button>
  }
}))

vi.mock('../DriversTable', () => ({
  DriversTable: (props) => {
    seen.table = props
    const ids = props.users.map(user => user.id)
    return (
      <div className='odc-table-scroll' role='region' aria-label='Drivers table'>
        {props.users.map(user => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={user.id} data-row-id={user.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpenUser(user)}>Open {user.id}</button>
            <button type='button' onClick={() => props.selection.onToggle(user.id)}>Select {user.id}</button>
            <button type='button' onClick={() => props.onToggle(user, 'available', false)}>Online off {user.id}</button>
            <button type='button' onClick={() => props.onToggle(user, 'enabled', false)}>Active off {user.id}</button>
            <button type='button' onClick={() => props.onToggle(user, 'enabled', true)}>Active on {user.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.selection.onToggleAll(ids)}>Select page</button>
        <button type='button' onClick={() => props.onClearFilters()}>Table clear filters</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onAddDriver()}>Table add</button>
      </div>
    )
  }
}))

vi.mock('../DriverPanel', () => ({
  DriverPanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='driver-panel'>
        <span>Panel of driver {props.userId}</span>
        <span data-testid='panel-section'>{props.section}</span>
        <span data-testid='panel-row'>{props.user ? `row ${props.user.id} available=${String(props.user.available)}` : 'no row'}</span>
        <span data-testid='panel-patch'>{props.patch ? JSON.stringify(props.patch) : 'no patch'}</span>
        <span data-testid='panel-custom-fields'>{String(props.customFieldsOpen)}</span>
        <span data-testid='panel-expanded'>{String(props.expanded)}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onSectionChange('schedule')}>To schedule</button>
        <button type='button' onClick={() => props.onCustomFieldsOpenChange(true)}>Custom fields</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onToggle(props.user ?? { id: props.userId }, 'available', true)}>Panel online on</button>
        <button type='button' onClick={() => props.onDirtyChange?.(true)}>Schedule dirty</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, level: 1 })}>Save as admin</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, name: 'Renamed' })}>Save name</button>
        <button
          type='button'
          onClick={() => {
            props.handleSuccessDeleteUser({ id: props.userId, level: 4 })
            props.onClose()
          }}
        >
          Delete from panel
        </button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(true)}>Profile dirty</button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(false)}>Profile clean</button>
      </div>
    )
  }
}))

vi.mock('../../UserAddForm', () => ({
  UserAddForm: (props) => {
    seen.addForm = props
    return (
      <div data-testid='add-form'>
        <button type='button' onClick={() => props.handleSuccessAdd({ id: 99, level: 4 })}>Add succeeded</button>
        <button type='button' onClick={props.onClose}>Close form</button>
      </div>
    )
  }
}))

vi.mock('../../../Shared/ConfirmAdmin', () => ({
  ConfirmAdmin: (props) => {
    seen.confirmAdmin = props
    return props.open
      ? (
        <div role='dialog' aria-label={props.title}>
          <p>{props.description}</p>
          <button type='button' onClick={() => props.onConfirm('code-1')}>{props.confirmLabel}</button>
          <button type='button' onClick={props.onClose}>Cancel admin</button>
        </div>
        )
      : null
  }
}))

vi.mock('../../../Shared', () => ({ Alert: () => null, SideBar: ({ children }) => <div>{children}</div> }))

import { addQueryToUrl, removeQueryToUrl } from '../../../../utils'
import { DeliveryUsersListing } from '../../DeliveryUsersListing'
import { DRIVERS_PROPS_TO_FETCH, DriversListing } from '../DriversListing'

const driver = (id, extra = {}) => ({ id, name: `Name${id}`, lastname: 'Lopez', email: `d${id}@example.com`, enabled: true, available: true, busy: false, level: 4, ...extra })
const DRIVERS = [driver(1), driver(2), driver(3)]
// redesign DL-R1 (Q-4): a full page, for the tests that read the range of the foot (the range stops at the rows on screen)
const FULL_PAGE = Array.from({ length: 10 }, (_, index) => driver(index + 1))

const baseCtl = (overrides = {}) => ({
  usersList: { users: DRIVERS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 3 },
  paginationDetail: { total: 42, current_page: 1, total_pages: 5 },
  getUsers: vi.fn(),
  searchValue: '',
  onSearch: vi.fn(),
  userTypesSelected: [4],
  selectedUserActiveState: true,
  handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  handleChangeAvailable: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  handleChangeBusyUser: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  selectedUsers: [],
  handleSelectedUsers: vi.fn(),
  setSelectedUsers: vi.fn(),
  deleteUsersActionState: { loading: false, error: null },
  handleDeleteSeveralUsers: vi.fn(),
  handleSuccessUpdate: vi.fn(),
  handleSuccessAddUser: vi.fn(),
  handleSuccessDeleteUser: vi.fn(),
  actionDisabled: false,
  actionStatus: { loading: false, error: null },
  driversGroupsState: { groups: [], loading: false, error: null },
  ...overrides
})

const PAGE_PROPS = {
  isUseQuery: true,
  isDriversPage: true,
  headerTitle: 'Drivers',
  learnOptions: [{ value: 'drivers', name: 'Drivers list', url: 'https://help.ordering.co/drivers' }],
  defaultUserTypesSelected: [4],
  disabledActiveStateCondition: true,
  // as src/pages/DeliveryDriversList
  onUserRedirect: (id) => (id ? addQueryToUrl({ id }) : removeQueryToUrl(['id', 'tab']))
}

const ROUTE = '/delivery/drivers-list'
// the controller's answer for `?page=2&pageSize=25` (the page writes what the controller reports after each load)
const PAGE_TWO = { paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4, from: 26, to: 28 } }
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
  const element = () => <><Capture /><DeliveryUsersListing {...PAGE_PROPS} {...pageProps} /></>
  const utils = renderWithProviders(element(), { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props (a new list, a new selection)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(element())
    }
  }
  return view
}

// redesign DM-B5: /delivery/drivers-managers, as src/pages/DriversManagersList builds it
const MANAGERS = [driver(1, { level: 5 }), driver(2, { level: 5 }), driver(3, { level: 5 })]
const MANAGERS_ROUTE = '/delivery/drivers-managers'
const renderManagers = (ctlOverrides = {}, route = MANAGERS_ROUTE, pageProps = {}) => renderPage(
  { usersList: { users: MANAGERS, loading: false, error: null }, userTypesSelected: [5], ...ctlOverrides },
  route,
  {
    isDriversPage: false,
    isDriversManagersPage: true,
    headerTitle: 'Drivers managers',
    defaultUserTypesSelected: [5],
    onUserRedirect: (id) => (id ? addQueryToUrl({ id }) : removeQueryToUrl(['id', 'tab'])),
    ...pageProps
  }
)

const statusGroup = () => screen.getByRole('group', { name: 'Status' })
const statusButton = (name) => within(statusGroup()).getByRole('button', { name })

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
  ctl.session = { id: 1, level: 0 }
  ctl.flags = {}
  ctl.configs = {}
  Object.keys(seen).forEach(key => { seen[key] = null })
  window.localStorage.clear()
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('composition', () => {
  it('draws the header with the count, the search, the status control, the table and the pagination', () => {
    renderPage({ usersList: { users: FULL_PAGE, loading: false, error: null } })
    expect(screen.getByRole('heading', { name: /Drivers/ })).toBeInTheDocument()
    expect(screen.getByText('42 drivers')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(statusGroup()).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Drivers table' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 42')
    expect(screen.queryByTestId('driver-panel')).toBeNull()
  })

  it('keeps main\'s tour anchor on «Add driver» and gives the export what main\'s header gave it', () => {
    renderPage()
    expect(document.querySelector('[data-tour="tour_add"]')).toHaveTextContent('Add driver')
    expect(seen.exportProps).toMatchObject({
      defaultUserTypesSelected: [4],
      disabledActiveStateCondition: true,
      userTypesSelected: [4],
      selectedUserActiveState: true,
      disabled: false
    })
  })

  it('gives the table the list, the state of the load, the selection and whether a filter narrows it', () => {
    renderPage({ selectedUsers: [2] })
    expect(seen.table.users).toBe(DRIVERS)
    expect(seen.table).toMatchObject({ loading: false, error: null, pageSize: 10, activeUserId: null, hasFilters: false, actionDisabled: false })
    expect(seen.table.selection.selectedIds).toEqual([2])
    expect(seen.table.selection.onToggle).toBe(ctl.props.handleSelectedUsers)
    expect(seen.table.pendingKeys).toEqual([])
  })

  it('has no pagination when the load failed or nothing is known yet', () => {
    renderPage({ usersList: { users: [], loading: false, error: ['boom'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(seen.table.error).toEqual(['boom'])
  })

  it('a failed load goes to the table, whose Retry asks the same page again', async () => {
    renderPage({ paginationProps: { currentPage: 3, pageSize: 25, totalItems: 80, totalPages: 4 } })
    await userEvent.click(screen.getByRole('button', { name: 'Table retry' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(3, 25)
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    infoShare.isCollapse = true
    view.update({})
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('«Add driver» in the header, in the empty table and «Table add» all open the sheet titled «Add driver»', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const dialog = await screen.findByRole('dialog', { name: 'Add driver' })
    expect(within(dialog).getByTestId('add-form')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close form' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    act(() => seen.table.onAddDriver())
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })
})

describe('wrapper: what it passes the controller', () => {
  it('turns on full-name search, the live drivers room and keeps the flags it had', () => {
    renderPage()
    expect(seen.controller.UIComponent).toBe(DriversListing)
    expect(seen.controller).toMatchObject({
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true,
      liveDriversRoom: true,
      isDriver: true,
      isDriversPage: true
    })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('reads ?page and ?pageSize as main does', () => {
    renderPage({}, `${ROUTE}?page=3&pageSize=25`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('asks for what main\'s controller asks for, plus the two verification fields, once each', () => {
    renderPage()
    const props = seen.controller.propsToFetch
    expect(props).toEqual(DRIVERS_PROPS_TO_FETCH)
    expect(new Set(props).size).toBe(props.length)
    expect(props).toEqual(expect.arrayContaining(['schedule', 'push_tokens', 'available', 'busy', 'enabled', 'phone_verified', 'email_verified']))
  })

  it('keeps the controller\'s own list: nothing it asks for by default is dropped', () => {
    const source = readFileSync(resolve(__dirname, '../../../../../../components/UsersList/index.js'), 'utf8')
    const block = source.match(/const defaultProps = \{\s*propsToFetch: \[([\s\S]*?)\]/)[1]
    const controllerList = [...block.matchAll(/'([a-z_]+)'/g)].map(match => match[1])
    expect(controllerList.length).toBeGreaterThan(20)
    expect(DRIVERS_PROPS_TO_FETCH).toEqual([...controllerList, 'phone_verified', 'email_verified'])
  })

  // redesign DM-B5 (decisions 1-3 | audit 3): the managers page is this page with `role='managers'`
  it('/delivery/drivers-managers draws this page with role managers and the controller props that suit it', () => {
    renderManagers()
    expect(seen.controller.UIComponent).toBe(DriversListing)
    expect(seen.controller).toMatchObject({
      role: 'managers',
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true,
      isDriver: true,
      propsToFetch: DRIVERS_PROPS_TO_FETCH,
      isDriversManagersPage: true
    })
    ;['statusFilter', 'onStatusFilterChange', 'liveDriversRoom'].forEach(key => {
      expect(seen.controller).not.toHaveProperty(key)
    })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    expect(seen.controller).toHaveProperty('searchSeed')
  })

  it('/delivery/drivers-list is the drivers role and keeps its status props', () => {
    renderPage()
    expect(seen.controller.role).toBe('drivers')
    expect(seen.controller).toHaveProperty('statusFilter')
    expect(seen.controller).toHaveProperty('onStatusFilterChange')
    expect(seen.controller.liveDriversRoom).toBe(true)
  })

  it('isDriversPage wins when both flags come', () => {
    renderManagers({}, '/delivery/drivers-managers', { isDriversPage: true })
    expect(seen.controller.role).toBe('drivers')
    expect(seen.controller).toHaveProperty('statusFilter')
  })
})

describe('status filter (?status=)', () => {
  it('is «All» and absent from the URL by default, and the controller gets «all»', () => {
    renderPage()
    expect(statusButton('All')).toHaveAttribute('aria-pressed', 'true')
    expect(seen.controller.statusFilter).toBe('all')
    expect(urlParams().status).toBeUndefined()
  })

  it('?status=busy gives the controller «busy» and the control shows Busy', () => {
    renderPage({}, `${ROUTE}?status=busy`)
    expect(seen.controller.statusFilter).toBe('busy')
    expect(statusButton('Busy')).toHaveAttribute('aria-pressed', 'true')
    expect(statusButton('All')).toHaveAttribute('aria-pressed', 'false')
    expect(seen.table.hasFilters).toBe(true)
  })

  it.each(['', 'all', 'unknown', 'inactive', 'BUSY'])('?status=%s is «all»', (value) => {
    renderPage({}, `${ROUTE}?status=${value}`)
    expect(seen.controller.statusFilter).toBe('all')
    expect(statusButton('All')).toHaveAttribute('aria-pressed', 'true')
  })

  it('choosing a state writes ?status= and gives the controller the new state', async () => {
    renderPage()
    await userEvent.click(statusButton('Offline'))
    expect(urlParams().status).toBe('offline')
    expect(seen.controller.statusFilter).toBe('offline')
    expect(statusButton('Offline')).toHaveAttribute('aria-pressed', 'true')
  })

  it('«All» takes ?status= out of the address and keeps the rest', async () => {
    renderPage(PAGE_TWO, `${ROUTE}?status=available&page=2&pageSize=25`)
    await userEvent.click(statusButton('All'))
    expect(urlParams()).toEqual({ page: '2', pageSize: '25' })
    expect(seen.controller.statusFilter).toBe('all')
  })

  it('the table\'s «Clear filters» clears the search and the status together', async () => {
    renderPage({ searchValue: 'ada' }, `${ROUTE}?status=busy`)
    expect(seen.table.hasFilters).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(urlParams().status).toBeUndefined()
    expect(seen.controller.statusFilter).toBe('all')
  })

  it('a search alone counts as a filter', () => {
    renderPage({ searchValue: 'ada' })
    expect(seen.table.hasFilters).toBe(true)
  })

  it('level 2 has no filter, and a ?status= in its address never reaches the controller (its list is /professionals)', () => {
    ctl.session = { id: 1, level: 2 }
    renderPage({}, `${ROUTE}?status=busy`)
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(seen.controller.statusFilter).toBe('all')
  })

  it('does not touch the address without isUseQuery, and does not read it', async () => {
    renderPage({}, `${ROUTE}?status=busy`, { isUseQuery: false })
    expect(seen.controller.statusFilter).toBe('all')
    await userEvent.click(statusButton('Offline'))
    expect(urlParams()).toEqual({ status: 'busy' })
    expect(seen.controller.statusFilter).toBe('offline')
  })
})

describe('the panel: ?id=, ?tab= and rows', () => {
  it('a row opens the panel with that row, writes ?id= (as main\'s onUserRedirect) and marks the row active', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByText('Panel of driver 2')).toBeInTheDocument()
    expect(seen.panel.user).toBe(DRIVERS[1])
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeUserId).toBe(2)
  })

  it('the panel is told what it needs from the page', async () => {
    renderPage({ actionDisabled: true })
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(seen.panel).toMatchObject({
      userId: 1,
      section: 'profile',
      expanded: false,
      customFieldsOpen: false,
      actionDisabled: true,
      onToggle: expect.any(Function),
      pendingKeys: []
    })
    expect(seen.panel.handleSuccessUpdate).toEqual(expect.any(Function))
    expect(seen.panel.profileProps.onDirtyChange).toEqual(expect.any(Function))
  })

  it('?id= opens the row when the driver is on the page', () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(screen.getByText('Panel of driver 2')).toBeInTheDocument()
    expect(seen.panel.user).toBe(DRIVERS[1])
    expect(urlParams().id).toBe('2')
  })

  it('?id= opens by id with no row when the driver is on another page (the panel loads it)', () => {
    renderPage({}, `${ROUTE}?id=77`)
    expect(screen.getByText('Panel of driver 77')).toBeInTheDocument()
    expect(seen.panel.user).toBeNull()
  })

  it('waits for the first list: nothing opens while it loads, then the row does', () => {
    renderPage({ usersList: { users: [], loading: true, error: null }, paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10 } }, `${ROUTE}?id=2`)
    expect(screen.queryByTestId('driver-panel')).toBeNull()
    view.update({ usersList: { users: DRIVERS, loading: false, error: null } })
    expect(screen.getByText('Panel of driver 2')).toBeInTheDocument()
    expect(seen.panel.user).toBe(DRIVERS[1])
  })

  it('still opens it when the list failed (the panel does not need the list)', () => {
    renderPage({ usersList: { users: [], loading: false, error: ['boom'] }, paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10 } }, `${ROUTE}?id=5`)
    expect(screen.getByText('Panel of driver 5')).toBeInTheDocument()
  })

  it.each(['abc', '0', '-3', '1.5'])('?id=%s opens nothing', (value) => {
    renderPage({}, `${ROUTE}?id=${value}`)
    expect(screen.queryByTestId('driver-panel')).toBeNull()
  })

  it('?tab=schedule selects that section and leaves ?tab= in the address', () => {
    renderPage({}, `${ROUTE}?id=2&tab=schedule`)
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    expect(urlParams()).toMatchObject({ id: '2', tab: 'schedule' })
  })

  it.each(['driver_group', 'saved_places', 'logs', 'advanced_logs', 'push_tokens', 'orders', 'metafields', 'personalization'])('keeps main\'s tab key «%s»', (tab) => {
    renderPage({}, `${ROUTE}?id=2&tab=${tab}`)
    expect(screen.getByTestId('panel-section')).toHaveTextContent(tab === 'personalization' ? 'personalization' : tab)
  })

  it('an unknown ?tab= is the Profile', () => {
    renderPage({}, `${ROUTE}?id=2&tab=nonsense`)
    expect(screen.getByTestId('panel-section')).toHaveTextContent('profile')
  })

  it('changing the section writes ?tab=', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'To schedule' }))
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    expect(urlParams().tab).toBe('schedule')
  })

  it('opening another driver starts at Profile and takes ?tab= out', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=schedule`)
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByTestId('panel-section')).toHaveTextContent('profile')
    expect(urlParams()).toMatchObject({ id: '2' })
    expect(urlParams().tab).toBeUndefined()
  })

  it('closing removes id and tab (main\'s onUserRedirect()) and keeps page, pageSize and status', async () => {
    renderPage(PAGE_TWO, `${ROUTE}?id=2&tab=schedule&status=busy&page=2&pageSize=25`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByTestId('driver-panel')).toBeNull()
    expect(urlParams()).toMatchObject({ status: 'busy', page: '2', pageSize: '25' })
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
  })

  it('without onUserRedirect the page writes the address itself', async () => {
    renderPage({}, ROUTE, { onUserRedirect: undefined })
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(urlParams().id).toBe('3')
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(urlParams().id).toBeUndefined()
  })

  it('does not reopen it after it is closed, nor when the list reloads', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    view.update({ usersList: { users: [...DRIVERS], loading: false, error: null } })
    expect(screen.queryByTestId('driver-panel')).toBeNull()
  })

  it('the panel follows the list: the row it holds is the list\'s own one', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    view.update({ usersList: { users: [driver(1, { available: false }), DRIVERS[1], DRIVERS[2]], loading: false, error: null } })
    expect(screen.getByTestId('panel-row')).toHaveTextContent('row 1 available=false')
  })

  it('a driver that left the page keeps its panel with the row it had', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    view.update({ usersList: { users: [DRIVERS[0]], loading: false, error: null } })
    expect(screen.getByText('Panel of driver 2')).toBeInTheDocument()
    expect(seen.panel.user).toBe(DRIVERS[1])
  })

  it('the panel is named after the driver', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(document.querySelector('[aria-label="Name2 Lopez"]')).not.toBeNull()
  })

  it('the panel can open as a page, and is not expanded on the next driver after closing', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('true')
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false')
  })

  it('Custom fields is a dialog of the panel without an address, and a new driver closes it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Custom fields' }))
    expect(screen.getByTestId('panel-custom-fields')).toHaveTextContent('true')
    expect(urlParams().tab).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByTestId('panel-custom-fields')).toHaveTextContent('false')
  })

  it('a router navigation to another driver (⌘K) while the page is open opens it, with its tab', async () => {
    renderPage()
    act(() => historyRef.current.push(`${ROUTE}?id=3&tab=logs`))
    await waitFor(() => expect(screen.getByText('Panel of driver 3')).toBeInTheDocument())
    expect(screen.getByTestId('panel-section')).toHaveTextContent('logs')
  })

  it('closing the panel gives the focus back to the row', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    act(() => { document.body.focus() })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true))
  })

  it('closing a panel that was opened by ?id= (no opener) puts the focus on its row', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })
})

describe('?add=1', () => {
  it('opens the add form once and takes itself out of the address', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
    expect(urlParams().add).toBeUndefined()
  })

  it('waits for the list to stop loading', async () => {
    renderPage({ usersList: { users: [], loading: true, error: null } }, `${ROUTE}?add=1`)
    expect(screen.queryByTestId('add-form')).toBeNull()
    view.update({ usersList: { users: DRIVERS, loading: false, error: null } })
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('does not open while the controller keeps the actions off (a level 5 manager without groups)', () => {
    ctl.session = { id: 1, level: 5 }
    renderPage({ actionDisabled: true }, `${ROUTE}?add=1`)
    expect(screen.queryByTestId('add-form')).toBeNull()
  })

  it('does not open for a read-only delivery manager', () => {
    ctl.flags = { readOnlyDeliveryManager: true }
    renderPage({}, `${ROUTE}?add=1`)
    expect(screen.queryByTestId('add-form')).toBeNull()
  })

  it('the form is the drivers one: isDriversPage, the groups state and no title of its own', async () => {
    const groups = { groups: [{ id: 1 }], loading: false, error: null }
    renderPage({ driversGroupsState: groups }, `${ROUTE}?add=1`)
    await screen.findByTestId('add-form')
    expect(seen.addForm).toMatchObject({ isDriversPage: true, driversGroupsState: groups, showTitle: false })
  })

  it('opening it closes the open driver, like main', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(screen.getByTestId('driver-panel')).toBeInTheDocument()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await screen.findByTestId('add-form')
    expect(screen.queryByTestId('driver-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  // redesign DL-R1 (Q-5): the form opened by `?add=1` has no trigger to give the focus back to: it went to the top of the document
  it('Escape on the form opened by ?add=1 puts the focus on «Add driver» (Q-5)', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await screen.findByTestId('add-form')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-tour="tour_add"]')))
  })

  it('the form\'s own close button puts the focus on «Add driver» too (Q-5)', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await userEvent.click(await screen.findByRole('button', { name: 'Close form' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-tour="tour_add"]')))
  })

  // redesign DL-R2 (Q-5): the sheet leaves in `--od-duration-slow` (420ms) and hands the focus back when the exit ends: «Add driver» must
  // still have it after that. The steal is played at 450ms (what was measured: «Skip to content» at 449 and 475ms).
  describe('a late focus steal at the end of the sheet exit (Q-5, DL-R2)', () => {
    let skip
    // The steal is timed from the close itself (the event that closes the sheet), as the sheet's exit is: timed from when userEvent
    // resolved, it drifted 50-150ms later on a loaded runner, past the end of the watch, and the test failed on a focus the page never lost.
    const stealAfter = (type, ms) => {
      document.addEventListener(type, () => { setTimeout(() => skip.focus(), ms) }, { capture: true, once: true })
    }
    const wait = (ms) => act(() => new Promise(resolve => setTimeout(resolve, ms)))
    beforeEach(() => {
      skip = document.createElement('a')
      skip.href = '#main'
      skip.textContent = 'Skip to content'
      document.body.prepend(skip)
    })
    afterEach(() => { skip.remove() })

    it('Escape: the focus is still on «Add driver» after the steal', async () => {
      renderPage({}, `${ROUTE}?add=1`)
      await screen.findByTestId('add-form')
      stealAfter('keydown', 450)
      await userEvent.keyboard('{Escape}')
      await wait(1100)
      expect(document.activeElement).toBe(document.querySelector('[data-tour="tour_add"]'))
    })

    it('the form\'s close: the same', async () => {
      renderPage({}, `${ROUTE}?add=1`)
      const close = await screen.findByRole('button', { name: 'Close form' })
      stealAfter('click', 475)
      await userEvent.click(close)
      await wait(1100)
      expect(document.activeElement).toBe(document.querySelector('[data-tour="tour_add"]'))
    })

    it('a key pressed after the close wins: the focus is not taken back', async () => {
      renderPage({}, `${ROUTE}?add=1`)
      await screen.findByTestId('add-form')
      await userEvent.keyboard('{Escape}')
      await wait(60)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      skip.focus()
      await wait(700)
      expect(document.activeElement).toBe(skip)
    })
  })

  it('opening a driver closes the form', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await screen.findByTestId('add-form')
    act(() => seen.table.onOpenUser(DRIVERS[0]))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    expect(seen.panel.userId).toBe(1)
  })

  it('a new driver goes to the controller, and with no filter nothing is reloaded', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith({ id: 99, level: 4 })
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Close form' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
  })

  it('with a status filter on, a new driver reloads page 1', async () => {
    renderPage({ paginationProps: { currentPage: 3, pageSize: 25, totalItems: 80, totalPages: 4 } }, `${ROUTE}?status=busy`)
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith({ id: 99, level: 4 })
    expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 25)
  })
})

describe('actionDisabled and read-only', () => {
  it('turn off Add, the export and the switches together', () => {
    renderPage({ actionDisabled: true })
    expect(document.querySelector('[data-tour="tour_add"]')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
    expect(seen.table.actionDisabled).toBe(true)
  })

  it('a read-only delivery manager gets the same', () => {
    ctl.flags = { readOnlyDeliveryManager: true }
    renderPage()
    expect(document.querySelector('[data-tour="tour_add"]')).toBeDisabled()
    expect(seen.table.actionDisabled).toBe(true)
  })
})

describe('level 5 without groups', () => {
  const groupsAnswered = () => ({ groups: [], loading: false, error: null })

  it('says why the actions are off once the controller has answered', () => {
    ctl.session = { id: 1, level: 5 }
    renderPage({ actionDisabled: true })
    expect(screen.queryByText(/don't administer/)).toBeNull()
    view.update({ driversGroupsState: groupsAnswered() })
    expect(screen.getByText("You don't administer any driver group, so adding, exporting, deleting and changing drivers is turned off.")).toBeInTheDocument()
  })

  it('says nothing before the controller knows (it starts with the actions off) nor while it asks', () => {
    ctl.session = { id: 1, level: 5 }
    renderPage({ actionDisabled: true })
    expect(screen.queryByText(/don't administer/)).toBeNull()
    view.update({ driversGroupsState: { groups: [], loading: true, error: null } })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })

  it('says nothing when the request failed (the reason is not known)', () => {
    ctl.session = { id: 1, level: 5 }
    renderPage({ actionDisabled: true })
    view.update({ driversGroupsState: { groups: [], loading: false, error: ['Network down'] } })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })

  it('says nothing when the manager administers a group (the actions are on)', () => {
    ctl.session = { id: 1, level: 5 }
    renderPage({ actionDisabled: true })
    view.update({ actionDisabled: false, driversGroupsState: { groups: [{ id: 1 }], loading: false, error: null } })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })

  it('is only for level 5', () => {
    renderPage({ actionDisabled: true })
    view.update({ driversGroupsState: groupsAnswered() })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })

  it('is not drawn for a read-only delivery manager (the reason is another one)', () => {
    ctl.session = { id: 1, level: 5 }
    ctl.flags = { readOnlyDeliveryManager: true }
    renderPage()
    view.update({ driversGroupsState: groupsAnswered() })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })
})

describe('selection bar', () => {
  it('is not there with nothing selected', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Actions for selected drivers' })).toBeNull()
  })

  it('counts the selection and says how many are on other pages', () => {
    renderPage({ selectedUsers: [1, 2, 3, 70, 71] })
    const bar = screen.getByRole('region', { name: 'Actions for selected drivers' })
    expect(within(bar).getByRole('status')).toHaveTextContent('5 selected · 2 on other pages')
    expect(bar.querySelectorAll('.odc-figure').length).toBe(2)
  })

  it('says «on another page» for one and nothing extra when all are on this page', () => {
    renderPage({ selectedUsers: [1, 70] })
    expect(within(screen.getByRole('region', { name: 'Actions for selected drivers' })).getByRole('status')).toHaveTextContent('2 selected · 1 on another page')
    view.update({ selectedUsers: [1, 2] })
    expect(within(screen.getByRole('region', { name: 'Actions for selected drivers' })).getByRole('status')).toHaveTextContent(/^2 selected$/)
  })

  it('one id, and a whole page that adds, then removes', async () => {
    renderPage({ selectedUsers: [9] })
    await userEvent.click(screen.getByRole('button', { name: 'Select 1' }))
    expect(ctl.props.handleSelectedUsers).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([9, 1, 2, 3])
    view.update({ selectedUsers: [9, 1, 2, 3] })
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([9])
  })

  it('Clear selection empties it', async () => {
    renderPage({ selectedUsers: [1, 2] })
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([])
  })

  it('Delete asks ConfirmAdmin first (count in its title and button) and only then calls the controller with the code', async () => {
    renderPage({ selectedUsers: [1, 2, 70] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(seen.confirmAdmin.open).toBe(true)
    expect(seen.confirmAdmin.title).toBe('Delete 3 drivers?')
    expect(seen.confirmAdmin.confirmLabel).toBe('Delete 3 drivers')
    expect(seen.confirmAdmin.description).toBe("This can't be undone.")
    expect(ctl.props.handleDeleteSeveralUsers).not.toHaveBeenCalled() // nothing is sent before the confirmation
    await userEvent.click(screen.getByRole('button', { name: 'Delete 3 drivers' }))
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledWith('code-1')
    expect(seen.confirmAdmin.open).toBe(false)
  })

  it('names one driver in the singular', async () => {
    renderPage({ selectedUsers: [2] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(seen.confirmAdmin.confirmLabel).toBe('Delete 1 driver')
    expect(seen.confirmAdmin.title).toBe('Delete 1 driver?')
  })

  it('cancelling the confirmation deletes nothing', async () => {
    renderPage({ selectedUsers: [2] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel admin' }))
    expect(ctl.props.handleDeleteSeveralUsers).not.toHaveBeenCalled()
    expect(seen.confirmAdmin.open).toBe(false)
  })

  it('is busy and cannot be deleted again while the request is in flight', () => {
    renderPage({ selectedUsers: [1], deleteUsersActionState: { loading: true, error: null } })
    expect(screen.getByRole('region', { name: 'Actions for selected drivers' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('Delete is off with actionDisabled and for a read-only delivery manager, as main\'s', () => {
    renderPage({ selectedUsers: [1], actionDisabled: true })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    ctl.flags = { readOnlyDeliveryManager: true }
    view.update({ actionDisabled: false })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('tells what the API refused, as a dialog', async () => {
    renderPage({ selectedUsers: [1] })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    view.update({ deleteUsersActionState: { loading: false, error: ['You can not delete this user'] } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The drivers weren't deleted")
    expect(dialog).toHaveTextContent('You can not delete this user')
  })

  it('an error that is not text still says something', async () => {
    renderPage({ selectedUsers: [1] })
    view.update({ deleteUsersActionState: { loading: false, error: { weird: true } } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent.trim().length).toBeGreaterThan("The drivers weren't deleted".length)
  })
})

describe('the three switches (one useDriverToggles, shared)', () => {
  it('a switch of the table calls the controller\'s handler with the attribute', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Online off 1' }))
    expect(ctl.props.handleChangeAvailable).toHaveBeenCalledWith({ id: 1, available: false })
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
  })

  // redesign D-1 (owner, 2026-10-19, decision 25 C8): deactivating a driver asks first; Online/Busy/activating do not
  it('deactivating a driver asks first (ConfirmDialog, focus on Cancel); «Deactivate driver» is what calls the controller', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Active off 1' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent('Deactivate Name1 Lopez?')
    expect(dialog).toHaveTextContent('The account becomes inactive. You can activate it again at any time.')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate driver' }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 1, enabled: false })
  })

  it('Cancel on that dialog writes nothing', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Active off 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
  })

  it('activating a driver stays immediate', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Active on 3' }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 3, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the table and the panel get the same handler and pending list', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(seen.panel.onToggle).toBe(seen.table.onToggle)
  })

  it('a failure shows the hook\'s dialog once (even though the controller also left it in actionStatus) and nothing moves', async () => {
    const error = ['The driver has orders in progress']
    renderPage({}, `${ROUTE}?id=77`)
    ctl.props.handleChangeAvailable = vi.fn(async () => {
      act(() => view.update({ actionStatus: { loading: false, error } }))
      return { ok: false, error }
    })
    view.update({})
    await userEvent.click(screen.getByRole('button', { name: 'Panel online on' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The status didn't change")
    expect(dialog).toHaveTextContent('The driver has orders in progress')
    await new Promise(resolve => setTimeout(resolve, 30)) // the page's own dialog decides after a tick: it must not add a second one
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.getByTestId('panel-patch')).toHaveTextContent('no patch') // the page heard no ok
    expect(DRIVERS.every(row => row.available === true)).toBe(true)
  })

  it('the row of the table stays as the controller keeps it after a failure', async () => {
    renderPage()
    ctl.props.handleChangeAvailable = vi.fn(async () => ({ ok: false, error: null }))
    view.update({})
    await userEvent.click(screen.getByRole('button', { name: 'Online off 1' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Something went wrong. Try again.')
    expect(seen.table.users[0].available).toBe(true)
  })

  it('an error the controller left that no switch caused is shown by the page, never empty', async () => {
    renderPage()
    view.update({ actionStatus: { loading: false, error: ['The server said no'] } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The action didn't complete")
    expect(dialog).toHaveTextContent('The server said no')
  })

  it('an error that is not text still says something', async () => {
    renderPage()
    view.update({ actionStatus: { loading: false, error: { weird: true } } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Something went wrong. Try again.')
  })

  it('a switch of a driver the page does not hold hands the panel the new state as a patch', async () => {
    renderPage({}, `${ROUTE}?id=77`)
    expect(screen.getByTestId('panel-patch')).toHaveTextContent('no patch')
    await userEvent.click(screen.getByRole('button', { name: 'Panel online on' }))
    await waitFor(() => expect(screen.getByTestId('panel-patch')).toHaveTextContent('{"available":true}'))
    expect(ctl.props.handleChangeAvailable).toHaveBeenCalledWith({ id: 77, available: true })
  })

  it('the patch is the state the API returned, not the one asked for', async () => {
    renderPage({ handleChangeAvailable: vi.fn(async () => ({ ok: true, error: null, user: { id: 77, available: false } })) }, `${ROUTE}?id=77`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel online on' }))
    expect(ctl.props.handleChangeAvailable).toHaveBeenCalledWith({ id: 77, available: true })
    await waitFor(() => expect(screen.getByTestId('panel-patch')).toHaveTextContent('{"available":false}'))
  })

  it('a driver the list holds shows the list\'s row, not the patch (a live event may be newer)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Online off 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(screen.getByTestId('panel-patch')).toHaveTextContent('no patch')
  })
})

describe('what the panel reports back', () => {
  // the controller takes the deleted driver out of its list (the opener of the panel is gone with it)
  const dropOnDelete = () => {
    ctl.props.handleSuccessDeleteUser = vi.fn(deleted => {
      view.update({ usersList: { users: ctl.props.usersList.users.filter(row => row.id !== deleted.id), loading: false, error: null } })
    })
    view.update({})
  }

  it('a saved profile goes to the controller\'s handleSuccessUpdate (it takes the row out when the level is no longer a driver\'s)', async () => {
    renderPage({ selectedUsers: [1, 2] })
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save as admin' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 1, level: 1 })
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([2]) // a row the list drops must not stay selected
  })

  it('a saved name keeps the selection', async () => {
    renderPage({ selectedUsers: [1, 2] })
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 1, name: 'Renamed' })
    expect(ctl.props.setSelectedUsers).not.toHaveBeenCalled()
  })

  it('a deleted driver goes to the controller, leaves the selection, closes the panel and the focus goes to the next row', async () => {
    renderPage({ selectedUsers: [2] })
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    act(() => { document.body.focus() })
    dropOnDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    expect(ctl.props.handleSuccessDeleteUser).toHaveBeenCalledWith({ id: 2, level: 4 })
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([])
    expect(screen.queryByTestId('driver-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })

  it('deleting the last row of the list goes to the one before it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    act(() => { document.body.focus() })
    dropOnDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })
})

describe('unsaved changes in the panel', () => {
  const dirtyThenOpen = async (next) => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(next())
  }

  it('opening another driver asks before dropping a draft; «Keep editing» stays', async () => {
    await dirtyThenOpen(() => screen.getByRole('button', { name: 'Open 2' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(seen.panel.userId).toBe(1)
    expect(urlParams().id).toBe('1')
  })

  // redesign DL-B5 (review): an unsaved schedule (reported by the panel, not the profile form) guards too
  it('an unsaved schedule also asks before opening another driver', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Schedule dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
    expect(seen.panel.userId).toBe(1)
  })

  it('«Discard» opens the other driver', async () => {
    await dirtyThenOpen(() => screen.getByRole('button', { name: 'Open 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(seen.panel.userId).toBe(2))
    expect(urlParams().id).toBe('2')
  })

  it('the same for «Add driver»', async () => {
    await dirtyThenOpen(() => document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('a clean form asks nothing', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile clean' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.userId).toBe(2)
  })

  it('after closing the panel the old draft does not follow the next driver', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.userId).toBe(3)
  })
})

describe('foot', () => {
  it('has the pagination with 10 / 25 / 50 and the range', async () => {
    renderPage({ usersList: { users: FULL_PAGE.map(item => ({ ...item, id: item.id + 10 })), loading: false, error: null }, paginationProps: { currentPage: 2, pageSize: 10, totalItems: 42, totalPages: 5, from: 11, to: 20 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 11–20 of 42')
    await userEvent.click(screen.getByRole('button', { name: 'Items per page 10' }))
    const sizes = (await screen.findAllByRole('menuitemradio')).map(item => item.textContent)
    expect(sizes).toEqual(['10', '25', '50'])
  })

  // redesign DL-R1 (Q-4): after a delete the page holds fewer rows than its size until the next load; the range must not claim more
  it('the range never claims more rows than the page holds (9 rows left on page 1 of 16) (Q-4)', () => {
    const nine = Array.from({ length: 9 }, (_, index) => driver(index + 1))
    renderPage({
      usersList: { users: nine, loading: false, error: null },
      paginationProps: { currentPage: 1, pageSize: 10, totalItems: 17, totalPages: 2, from: 1, to: 10 },
      paginationDetail: { total: 16 }
    })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–9 of 16')
  })

  it('a full page keeps its whole range (Q-4)', () => {
    const ten = Array.from({ length: 10 }, (_, index) => driver(index + 1))
    renderPage({
      usersList: { users: ten, loading: false, error: null },
      paginationProps: { currentPage: 1, pageSize: 10, totalItems: 16, totalPages: 2, from: 1, to: 10 },
      paginationDetail: { total: 16 }
    })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 16')
  })

  it('the next page asks the controller for it', async () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 10 } })
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 10)
  })

  it('a new page size asks for the page that keeps the first driver in view', async () => {
    renderPage({ paginationProps: { currentPage: 3, pageSize: 10, totalItems: 120, totalPages: 12, from: 21, to: 30 }, paginationDetail: { total: 120 } })
    await userEvent.click(screen.getByRole('button', { name: 'Items per page 10' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 25)
  })

  it('follows the total the controller keeps when drivers are deleted', () => {
    renderPage({ paginationDetail: { total: 40 } })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('of 40')
    expect(screen.getByText('40 drivers')).toBeInTheDocument()
  })

  it('writes ?page and ?pageSize after each load, as main', () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4, from: 26, to: 50 } })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' })
  })

  it('does not touch the address without isUseQuery', () => {
    renderPage({}, ROUTE, { isUseQuery: false })
    expect(window.location.search).toBe('')
  })

  it('a page left empty by deleting asks again (the previous one when it was the last)', () => {
    renderPage({ usersList: { users: [], loading: false, error: null }, paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3 }, paginationDetail: { total: 20 } })
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 10)
  })
})

// redesign DM-B5 (decisions 1-3 | audit 3, 5): the page with role managers
describe('managers role', () => {
  it('has no «Status» control and the header says «Add driver manager» and «N managers»', () => {
    renderManagers()
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('heading', { name: /Drivers managers/ })).toBeInTheDocument()
    expect(screen.getByText('42 managers')).toBeInTheDocument()
    expect(document.querySelector('[data-tour="tour_add"]')).toHaveTextContent('Add driver manager')
  })

  it('gives the header\'s export, the table and the panel the role', async () => {
    renderManagers()
    expect(seen.exportProps.role).toBe('managers')
    expect(seen.table.role).toBe('managers')
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.panel.role).toBe('managers')
  })

  // redesign (n.º 26, D-86): the managers list asks before deactivating, like the drivers list; activating stays immediate
  it('deactivating a manager asks first («Deactivate driver manager»); the controller is called only once confirmed', async () => {
    renderManagers()
    await userEvent.click(screen.getByRole('button', { name: 'Active off 1' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent('Deactivate Name1 Lopez?')
    expect(within(dialog).queryByRole('button', { name: 'Deactivate driver' })).toBeNull()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate driver manager' }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 1, enabled: false })
  })

  it('Cancel on a manager\'s deactivation writes nothing', async () => {
    renderManagers()
    await userEvent.click(screen.getByRole('button', { name: 'Active off 1' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
  })

  it('activating a manager stays immediate and asks nothing', async () => {
    renderManagers()
    await userEvent.click(screen.getByRole('button', { name: 'Active on 3' }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 3, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('drivers pieces get role drivers', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.table.role).toBe('drivers')
    expect(seen.panel.role).toBe('drivers')
    expect(seen.exportProps.role).toBe('drivers')
  })

  it('ignores ?status= in the address: no filter, none reaches the controller, nothing is written', async () => {
    renderManagers({}, `${MANAGERS_ROUTE}?status=offline`)
    expect(seen.controller).not.toHaveProperty('statusFilter')
    expect(seen.table.hasFilters).toBe(false)
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(urlParams().status).toBe('offline') // not ours to touch
  })

  it('the search is the only filter: it sets hasFilters and «Clear filters» clears just it', async () => {
    renderManagers({ searchValue: 'ada' })
    expect(seen.table.hasFilters).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
  })

  it('«Add driver manager» opens the sheet with that title and a UserAddForm of managers', async () => {
    renderManagers()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const dialog = await screen.findByRole('dialog', { name: 'Add driver manager' })
    expect(within(dialog).getByTestId('add-form')).toBeInTheDocument()
    expect(seen.addForm).toMatchObject({ isDriversManagersPage: true, showTitle: false })
    expect(seen.addForm.isDriversPage).toBeFalsy()
  })

  it('the add form of drivers still gets isDriversPage and not isDriversManagersPage', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await screen.findByTestId('add-form')
    expect(seen.addForm.isDriversPage).toBe(true)
    expect(seen.addForm.isDriversManagersPage).toBeFalsy()
  })

  it('a new manager does not reload page 1 (no status to hold it out)', async () => {
    renderManagers({}, `${MANAGERS_ROUTE}?add=1`)
    await screen.findByTestId('add-form')
    await userEvent.click(screen.getByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith({ id: 99, level: 4 })
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  it('the selection bar and the bulk delete speak of driver managers', async () => {
    renderManagers({ selectedUsers: [1, 2] })
    const bar = screen.getByRole('region', { name: 'Actions for selected driver managers' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 driver managers?' })
    expect(seen.confirmAdmin).toMatchObject({ title: 'Delete 2 driver managers?', confirmLabel: 'Delete 2 driver managers' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete 2 driver managers' }))
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledWith('code-1')
  })

  it('one selected says «Delete 1 driver manager»', async () => {
    renderManagers({ selectedUsers: [1] })
    await userEvent.click(within(screen.getByRole('region', { name: 'Actions for selected driver managers' })).getByRole('button', { name: 'Delete' }))
    expect(seen.confirmAdmin).toMatchObject({ title: 'Delete 1 driver manager?', confirmLabel: 'Delete 1 driver manager' })
  })

  it('a failed bulk delete says it in managers\' words', async () => {
    renderManagers({ selectedUsers: [1, 2] })
    view.update({ deleteUsersActionState: { loading: false, error: { weird: true } } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The driver managers weren't deleted")
    expect(dialog).toHaveTextContent("We couldn't delete the selected driver managers. Try again.")
  })

  it('the panel is named «Driver manager» until its row arrives', () => {
    renderManagers({}, `${MANAGERS_ROUTE}?id=999`)
    expect(screen.getByRole('complementary', { name: 'Driver manager' })).toBeInTheDocument()
  })

  it('keeps the panel width apart from the drivers one (storageKey)', () => {
    window.localStorage.setItem('od.drivers-managers.panel', '480')
    renderManagers({}, `${MANAGERS_ROUTE}?id=2`)
    // jsdom has no layout, so the width is clamped to 0: what is read is that a stored width was found under the managers' key at all
    expect(document.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).not.toBe('')
  })

  it('does not take the drivers\' stored width', () => {
    window.localStorage.setItem('od.drivers.panel', '480')
    renderManagers({}, `${MANAGERS_ROUTE}?id=2`)
    expect(document.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).toBe('')
  })

  it('the drivers page reads its own key and not the managers\' width', () => {
    window.localStorage.setItem('od.drivers-managers.panel', '480')
    renderPage({}, `${ROUTE}?id=2`)
    expect(document.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).toBe('')
  })

  it('never says the level 5 «no groups» notice (it is the drivers page\'s)', () => {
    ctl.session = { id: 1, level: 5 }
    renderManagers({ actionDisabled: true })
    view.update({ driversGroupsState: { groups: [], loading: false, error: null } })
    expect(screen.queryByText(/don't administer/)).toBeNull()
  })
})
