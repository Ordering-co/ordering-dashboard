/* eslint-disable import/first */
// redesign BO-B6 (decisions 1-9; auditor #3, #7d): the staff page (business owners, ). The controller (K/UsersList), the
// table, the panel, the Stores section, the export, the filter bar, the add form and ConfirmAdmin are other pieces and are stubs
// here that record what they receive: what is tested is how the page composes them, what it passes to each, and what it owns
// (the URL, the open record, the selection bar, the draft guard and the focus). The Product wrappers the page is made of
// (PageHeader, Tabs, SelectionBar, SplitView, Pagination, Sheet, dialogs), `useActiveToggle`, `useStaffQuery` and `staffKinds`
// are the real ones.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({
  controller: null,
  table: null,
  filters: null,
  panel: null,
  exportCsv: null,
  addForm: null,
  stores: null,
  confirmAdmin: []
}))
// R3 (decision 35): the panel stub draws its sections as RecordPanel does: tabs, or a SectionNav (a list, or its trigger when narrow)
const panelShape = vi.hoisted(() => ({ nav: null }))
const ctl = vi.hoisted(() => ({ props: {}, loyalty: { loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] }, configs: {}, sessionId: 900 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  // redesign D-3: the signed-in id is 900, not on any fixture list (the fixtures are ids 1-3, and the page now keeps the signed-in
  // person out of the selection); the D-3 tests set `ctl.sessionId` to an id that IS on the list
  useSession: () => [{ user: { id: ctl.sessionId, level: 0 } }],
  useConfig: () => [{ configs: ctl.configs }],
  // the controller hands its props to the UI as the real one does; the test plays the controller
  UsersList: ({ UIComponent, ...props }) => {
    seen.controller = props
    return <UIComponent {...props} {...ctl.props} />
  },
  UsersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} loyaltyLevelState={ctl.loyalty} />
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../StaffTable', () => ({
  StaffTable: (props) => {
    seen.table = props
    const ids = props.users.map(user => user.id)
    return (
      <div className='odc-table-scroll' role='region' aria-label='Owners table'>
        {props.users.map(user => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={user.id} data-row-id={user.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpenUser(user)}>Open {user.id}</button>
            <button type='button' onClick={() => props.selection.onToggle(user.id)}>Select {user.id}</button>
            <button type='button' onClick={() => props.onToggleActive(user, false)}>Switch off {user.id}</button>
            <button type='button' onClick={() => props.onToggleActive(user, true)}>Switch on {user.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.selection.onToggleAll(ids)}>Select page</button>
        <button type='button' onClick={() => props.onClearFilters()}>Table clear filters</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onAdd()}>Table add</button>
      </div>
    )
  }
}))

vi.mock('../../UsersFilterBar/UsersFilterBar', () => ({
  UsersFilterBar: (props) => {
    seen.filters = props
    return <div data-testid='users-filters' />
  }
}))

vi.mock('../../UsersExport/UsersExport', () => ({
  UsersExport: (props) => {
    seen.exportCsv = props
    return <button type='button'>Export CSV</button>
  }
}))

vi.mock('../StaffStoresSection', () => ({
  StaffStoresSection: (props) => {
    seen.stores = props
    return (
      <div data-testid='stores-section' data-user-id={props.userId} data-stores-key={props.storesKey}>
        <button type='button' onClick={() => props.onDirtyChange(true)}>Stores dirty</button>
        <button type='button' onClick={() => props.onDirtyChange(false)}>Stores clean</button>
        {/* as StaffStoresSection: what it saved comes back under the key it was given */}
        <button type='button' onClick={() => props.onSaved({ id: props.userId, [props.storesKey]: [{ id: 5, name: 'Fast Bite' }] })}>Stores saved</button>
      </div>
    )
  }
}))

vi.mock('../StaffPanel', () => ({
  StaffPanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='staff-panel'>
        <span>Panel of owner {props.userId}</span>
        <span data-testid='panel-section'>{props.section}</span>
        <span data-testid='panel-switch'>{props.user ? String(props.user.enabled) : 'no row'}</span>
        {/* as RecordPanel's tabs: the record is `.odc-record` and its selected tab says so */}
        <div className='odc-record'>
          {panelShape.nav === 'list' && (
            <nav className='odc-sectionnav'>
              <button type='button' className='odc-sectionnav-row' aria-current={props.section === 'profile' ? 'page' : undefined}>Profile row</button>
              <button type='button' className='odc-sectionnav-row' aria-current={props.section === 'businesses' ? 'page' : undefined}>Stores row</button>
            </nav>
          )}
          {panelShape.nav === 'compact' && (
            <div className='odc-sectionnav'>
              <button type='button' className='odc-sectionnav-trigger'>Section: {props.section}</button>
            </div>
          )}
          {!panelShape.nav && (
            <div role='tablist'>
              <button type='button' role='tab' aria-selected={props.section === 'profile'}>Profile tab</button>
              <button type='button' role='tab' aria-selected={props.section === 'businesses'}>Stores tab</button>
            </div>
          )}
        </div>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onSectionChange('orders')}>To orders</button>
        <button type='button' onClick={() => props.onSectionChange('businesses')}>To stores</button>
        <button type='button' onClick={() => props.onCustomFieldsOpenChange(true)}>Custom fields</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onToggleActive(props.user ?? { id: props.userId, enabled: true }, false)}>Panel switch off</button>
        <button type='button' onClick={() => props.onToggleActive(props.user ?? { id: props.userId, enabled: false }, true)}>Panel switch on</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, level: 1 })}>Save as admin</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, name: 'Renamed' })}>Save name</button>
        <button
          type='button'
          onClick={() => {
            props.handleSuccessDeleteUser({ id: props.userId, level: 2 })
            props.onClose()
          }}
        >
          Delete from panel
        </button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(true)}>Profile dirty</button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(false)}>Profile clean</button>
        {/* as StaffPanel: `level` is the record's (the row over the detail) and `user` the detail it holds */}
        {props.section === 'businesses' && props.renderStores({ user: props.user ?? { id: props.userId }, level: props.user?.level, onDirtyChange: () => {} })}
      </div>
    )
  }
}))

vi.mock('../../UserAddForm', () => ({
  UserAddForm: (props) => {
    seen.addForm = props
    return (
      <div data-testid='add-form'>
        <button type='button' onClick={() => props.handleSuccessAdd({ id: 99, level: 2, name: 'New', businesses: [] })}>Add succeeded</button>
        <button type='button' onClick={props.onClose}>Close form</button>
      </div>
    )
  }
}))

// redesign (B1c): the professionals' add form is another piece too (its own file); the stub records what the sheet gives it
const proForm = vi.hoisted(() => ({ props: null }))
vi.mock('../../ProfessionalAddForm', () => ({
  ProfessionalAddForm: (props) => {
    proForm.props = props
    return (
      <div data-testid='professional-add-form'>
        <button type='button' onClick={() => props.handleSuccessAdd({ id: 77, level: 8, name: 'Nova', enabled: true })}>Professional created</button>
        <button type='button' onClick={props.onClose}>Close professional form</button>
      </div>
    )
  }
}))

vi.mock('../../../Shared/ConfirmAdmin', () => ({
  ConfirmAdmin: (props) => {
    seen.confirmAdmin.push(props)
    return props.open
      ? (
        <div role='dialog' aria-label={props.title ?? 'Confirm password'}>
          <p>{props.description}</p>
          <button type='button' onClick={() => props.onConfirm('code-1')}>{props.confirmLabel ?? 'Confirm'}</button>
          <button type='button' onClick={props.onClose}>Cancel admin</button>
        </div>
        )
      : null
  }
}))

import { StaffListing } from '../StaffListing'
import { ProfessionalAddForm as ProfessionalAddFormStub } from '../../ProfessionalAddForm'
import { STAFF_KINDS } from '../staffKinds'

const owner = (id, extra = {}) => ({ id, name: `Name${id}`, lastname: 'Lopez', email: `o${id}@example.com`, enabled: true, level: 2, orders_count: id, businesses: [{ id: 10 + id, name: `Store${id}` }], ...extra })
const USERS = [owner(1), owner(2), owner(3)]

const baseCtl = (overrides = {}) => ({
  usersList: { users: USERS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 24, totalPages: 3, from: 1, to: 3 },
  paginationDetail: { total: 24, current_page: 1, total_pages: 3 },
  getUsers: vi.fn(),
  searchValue: '',
  onSearch: vi.fn(),
  orderFilterValue: null,
  handleChangeOrderFilterValue: vi.fn(),
  multiFilterValues: { name: 'Ana' },
  handleChangeMultiFilterValues: vi.fn(),
  userTypesSelected: [2],
  selectedUserActiveState: true,
  handleChangeUserActiveState: vi.fn(),
  handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  selectedUsers: [],
  handleSelectedUsers: vi.fn(),
  setSelectedUsers: vi.fn(),
  deleteUsersActionState: { loading: false, error: null },
  handleDeleteSeveralUsers: vi.fn(),
  handleSuccessUpdate: vi.fn(),
  handleSuccessAddUser: vi.fn(),
  handleSuccessDeleteUser: vi.fn(),
  ...overrides
})

const PAGE_PROPS = { kind: 'business_owner', isUseQuery: true }

const ROUTE = '/users/business-owners'
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
  const element = () => <><Capture /><StaffListing {...PAGE_PROPS} {...pageProps} /></>
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

const tabOf = (name) => screen.getByRole('tab', { name })

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
  ctl.configs = {}
  ctl.sessionId = 900
  ctl.loyalty = { loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] }
  Object.keys(seen).forEach(key => { seen[key] = null })
  seen.confirmAdmin = []
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('wrapper: what it passes the controller', () => {
  it('mounts UsersList with the owner level, the four search flags and the stores in propsToFetch', () => {
    renderPage()
    expect(seen.controller).toMatchObject({
      defaultUserTypesSelected: [2],
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true
    })
    // main's list of fields, plus the stores and the loyalty level the row and the filter use
    expect(seen.controller.propsToFetch).toEqual(expect.arrayContaining([
      'name', 'lastname', 'email', 'phone', 'photo', 'level', 'enabled', 'orders_count', 'phone_verified', 'email_verified', 'drivergroups',
      'businesses', 'loyalty_level', 'loyalty_level_id'
    ]))
  })

  it('keeps the active tab, the page and the page size from the URL', () => {
    renderPage({}, `${ROUTE}?enabled=inactive&page=3&pageSize=25`)
    expect(seen.controller.defaultUserActiveState).toBe(false)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('active, page 1 and 10 per page by default; a page size that is not 10, 25 or 50 falls back to 10', () => {
    renderPage()
    expect(seen.controller.defaultUserActiveState).toBe(true)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    view.unmount()
    renderPage({}, `${ROUTE}?page=abc&pageSize=100`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('without isUseQuery the URL is not read', () => {
    renderPage({}, `${ROUTE}?enabled=inactive&page=3&pageSize=25`, { isUseQuery: false })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('an unknown kind is a mistake of the page, not an empty list', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderPage({}, ROUTE, { kind: 'nope' })).toThrow(/nope/)
    silence.mockRestore()
  })
})

describe('header', () => {
  it('says «24 business owners», has Learn, «Add business owner» (keeps data-tour) and Export CSV', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Business owners' })).toHaveClass('odc-pagehead-title')
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('24 business owners')
    expect(screen.getByRole('button', { name: /Learn/ })).toBeInTheDocument()
    const add = document.querySelector('[data-tour="tour_add"]')
    expect(add).toHaveTextContent('Add business owner')
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('says «1 business owner» for one and no count until the total is known', () => {
    renderPage({ paginationDetail: { total: 1 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 business owner')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 business owners')
    view.unmount()
    renderPage({ paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(document.querySelector('.odc-pagehead-count')).toBeNull()
  })

  it('the export gets the owners\' words and only what main gave it (no multiFilterValues)', () => {
    renderPage({ selectedUserActiveState: false })
    expect(seen.exportCsv.copy).toBe(STAFF_KINDS.business_owner.exportCopy)
    expect(seen.exportCsv).toMatchObject({
      defaultUserTypesSelected: [2],
      userTypesSelected: [2],
      selectedUserActiveState: false
    })
    expect(seen.exportCsv).not.toHaveProperty('multiFilterValues')
    expect(Object.keys(seen.exportCsv).sort()).toEqual(['copy', 'defaultUserTypesSelected', 'disabledActiveStateCondition', 'selectedUserActiveState', 'userTypesSelected'])
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    view.unmount()
    infoShare.isCollapse = true
    renderPage()
    const menu = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`: the first child of the lead block, before the title
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    await userEvent.click(menu)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('Active / Inactive tabs', () => {
  it('Active is the selected one by default and writes ?enabled=active once', () => {
    renderPage()
    expect(tabOf('Active')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tablist', { name: 'Business owner status' })).toBeInTheDocument()
    expect(urlParams().enabled).toBe('active')
  })

  it('choosing the other tab asks the controller once and writes ?enabled=; the selected one does nothing', async () => {
    renderPage()
    await userEvent.click(tabOf('Active'))
    expect(ctl.props.handleChangeUserActiveState).not.toHaveBeenCalled()
    await userEvent.click(tabOf('Inactive'))
    expect(ctl.props.handleChangeUserActiveState).toHaveBeenCalledTimes(1)
    expect(urlParams().enabled).toBe('inactive')
  })
})

describe('filters', () => {
  it('the bar has no Orders control, the owners\' sheet and words, and the loyalty levels', () => {
    renderPage({ searchValue: 'ana', multiFilterValues: { name: 'x' } })
    expect(seen.filters).toMatchObject({
      showOrders: false,
      sheetKeys: STAFF_KINDS.business_owner.sheetKeys,
      searchLabel: STAFF_KINDS.business_owner.text.search,
      barLabel: STAFF_KINDS.business_owner.text.filterBar,
      searchValue: 'ana',
      multiFilterValues: { name: 'x' },
      loyaltyLevels: { loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] }
    })
    seen.filters.onSearch('olivia')
    expect(ctl.props.onSearch).toHaveBeenCalledWith('olivia')
    seen.filters.onMultiFilterChange({ name: 'y' })
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledWith({ name: 'y' })
  })

  it('«Clear filters» clears the search, the orders control and every filter, each with one call (also from the table)', async () => {
    renderPage({ searchValue: 'ana', multiFilterValues: { name: 'x' } })
    act(() => seen.filters.onClearAll())
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledWith(null)
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledTimes(1)
    const cleared = ctl.props.handleChangeMultiFilterValues.mock.calls[0][0]
    expect(cleared).toMatchObject({ name: null, email: null, loyaltyLevel: null, phoneVerified: null })
    await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledTimes(2)
  })
})

describe('table', () => {
  it('gets its kind, the list, the state of the load and whether a filter narrows it', () => {
    renderPage({ searchValue: 'ana' })
    expect(seen.table.kind).toBe(STAFF_KINDS.business_owner)
    expect(seen.table.users).toEqual(USERS)
    expect(seen.table.loading).toBe(false)
    expect(seen.table.pageSize).toBe(10)
    expect(seen.table.hasFilters).toBe(true)
    expect(seen.table.activeUserId).toBeNull()
    view.update({ searchValue: '', multiFilterValues: {}, usersList: { users: [], loading: true, error: null } })
    expect(seen.table.loading).toBe(true)
    expect(seen.table.hasFilters).toBe(false)
  })

  it('a failed load goes to the table, with Retry that asks the same page again', async () => {
    renderPage({ usersList: { users: [], loading: false, error: ['boom'] }, paginationProps: { currentPage: 2, pageSize: 25, totalPages: 3 } })
    expect(seen.table.error).toEqual(['boom'])
    await userEvent.click(screen.getByRole('button', { name: 'Table retry' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 25)
  })

  it('the selection is the controller\'s: one id, and a whole page that adds, then removes', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Select 2' }))
    expect(ctl.props.handleSelectedUsers).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([1, 2, 3])
    view.update({ selectedUsers: [1, 2, 3, 77] })
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([77])
  })

  it('the empty state\'s «Add business owner» opens the form', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Table add' }))
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })
})

describe('selection bar', () => {
  // redesign (n.º 14, D-55): admins, business owners and call-center agents; the controller empties the selection on a page, filter or search change
  it('is not there with nothing selected; counts the selection and says nothing about other pages', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Actions for selected business owners' })).toBeNull()
    view.update({ selectedUsers: [1, 2, 3] })
    const bar = screen.getByRole('region', { name: 'Actions for selected business owners' })
    expect(within(bar).getByRole('status')).toHaveTextContent(/^3 selected$/)
  })

  it.each(['business_owner', 'callcenter_agent', 'admin'])('asks the controller to empty the selection on a page, filter or search change: %s (D-55)', (kind) => {
    renderPage({}, ROUTE, { kind })
    expect(seen.controller.clearSelectionOnQueryChange).toBe(true)
  })

  it('does not for the professionals (not in D-55): the selection survives and the bar still says how many are on other pages', () => {
    renderPage({ selectedUsers: [1, 2, 3, 70, 71] }, ROUTE, { kind: 'professional', AddForm: ProfessionalAddFormStub })
    expect(seen.controller.clearSelectionOnQueryChange).toBe(false)
    const bar = screen.getByRole('region', { name: /^Actions for selected/ })
    expect(within(bar).getByRole('status')).toHaveTextContent('5 selected · 2 on other pages')
  })

  it('Clear selection empties it', async () => {
    renderPage({ selectedUsers: [1, 2] })
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([])
  })

  it('Delete goes through ConfirmAdmin with the count in its title and button, then calls the controller with the code', async () => {
    renderPage({ selectedUsers: [1, 2, 70] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete 3 business owners?' })
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    expect(ctl.props.handleDeleteSeveralUsers).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete 3 business owners' }))
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledWith('code-1')
  })

  it('names one business owner in the singular', async () => {
    renderPage({ selectedUsers: [2] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete 1 business owner?' })).toBeInTheDocument()
  })

  it('tells what the API refused, as a dialog, with the owners\' title', async () => {
    renderPage({ selectedUsers: [1] })
    view.update({ deleteUsersActionState: { loading: false, error: ['You can not delete this user'] } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The business owners weren't deleted")
    expect(dialog).toHaveTextContent('You can not delete this user')
  })

  it('a delete that went through puts the focus on the first row', async () => {
    renderPage({ selectedUsers: [1] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete 1 business owner' }))
    view.update({ deleteUsersActionState: { loading: true, error: null } })
    view.update({ deleteUsersActionState: { loading: false, error: null }, usersList: { users: [USERS[1], USERS[2]], loading: false, error: null } })
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })
})

// redesign D-3 (owner, 2026-10-19): the signed-in person cannot be selected, so cannot be bulk deleted
describe('the signed-in person is not selectable (D-3)', () => {
  it('the table is told who is signed in', () => {
    ctl.sessionId = 2
    renderPage()
    expect(seen.table.currentUserId).toBe(2)
  })

  it('«Select all» adds the page without them, and a row toggle for their id reaches no one', async () => {
    ctl.sessionId = 2
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([1, 3])
    await userEvent.click(screen.getByRole('button', { name: 'Select 2' }))
    expect(ctl.props.handleSelectedUsers).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Select 3' }))
    expect(ctl.props.handleSelectedUsers).toHaveBeenCalledWith(3)
  })

  it('«Select all» takes them all off when the others are already in', async () => {
    ctl.sessionId = 2
    renderPage({ selectedUsers: [1, 3, 77] })
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([77])
  })

  it('a selection that already holds their id is cleaned, is not counted, and the bulk delete does not name them', async () => {
    ctl.sessionId = 2
    renderPage({ selectedUsers: [2, 3] })
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([3])
    const bar = screen.getByRole('region', { name: 'Actions for selected business owners' })
    expect(within(bar).getByRole('status')).toHaveTextContent('1 selected')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete 1 business owner?' })).toBeInTheDocument()
  })

  it('a selection of only them has no bar', () => {
    ctl.sessionId = 2
    renderPage({ selectedUsers: [2] })
    expect(screen.queryByRole('region', { name: 'Actions for selected business owners' })).toBeNull()
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([])
  })

  it('without them on the list nothing is cleaned', () => {
    renderPage({ selectedUsers: [1, 3] })
    expect(ctl.props.setSelectedUsers).not.toHaveBeenCalled()
  })
})

describe('a protected account is not selectable or switched off', () => {
  const withProtected = { usersList: { users: [owner(1), owner(2, { protected: true }), owner(3)], loading: false, error: null } }

  it('asks the list for the protected flag', () => {
    renderPage()
    expect(seen.controller.propsToFetch).toContain('protected')
  })

  it('«Select all» adds the page without it, and a row toggle for its id reaches no one', async () => {
    renderPage(withProtected)
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([1, 3])
    await userEvent.click(screen.getByRole('button', { name: 'Select 2' }))
    expect(ctl.props.handleSelectedUsers).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Select 3' }))
    expect(ctl.props.handleSelectedUsers).toHaveBeenCalledWith(3)
  })

  it('switching it off asks nothing and writes nothing', async () => {
    renderPage(withProtected)
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
  })
})

describe('opening a record', () => {
  it('a row opens the panel in Profile with that row, writes ?id= and marks the row', async () => {
    renderPage()
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByText('Panel of owner 2')).toBeInTheDocument()
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
    expect(seen.panel.kind).toBe(STAFF_KINDS.business_owner)
    expect(seen.panel.section).toBe('profile')
    expect(seen.panel.customFieldsOpen).toBe(false)
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeUserId).toBe(2)
  })

  it('the panel is told what it needs from the page', async () => {
    ctl.configs = { schools: { value: '1' } }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(seen.panel.configs).toBe(ctl.configs)
    expect(typeof seen.panel.onToggleActive).toBe('function')
    expect(seen.panel.pendingIds).toEqual([])
    expect(seen.panel.expanded).toBe(false)
    expect(typeof seen.panel.renderStores).toBe('function')
    expect(seen.table.pendingIds).toBe(seen.panel.pendingIds)
  })

  it('the panel is named after the owner', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(document.querySelector('[aria-label="Name2 Lopez"]')).not.toBeNull()
  })

  it('the section goes to ?tab= (Profile too, as main) and Custom fields is a dialog without an address', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To orders' }))
    expect(screen.getByTestId('panel-section')).toHaveTextContent('orders')
    expect(urlParams()).toMatchObject({ id: '1', tab: 'orders' })
    await userEvent.click(screen.getByRole('button', { name: 'Custom fields' }))
    expect(seen.panel.customFieldsOpen).toBe(true)
    expect(urlParams().tab).toBe('orders')
  })

  it('opening another row starts it in Profile', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To stores' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(seen.panel.userId).toBe(3)
    expect(seen.panel.section).toBe('profile')
    expect(urlParams().id).toBe('3')
    expect(urlParams().tab).toBeUndefined()
  })

  it('closing removes id and tab and keeps enabled, page and pageSize', async () => {
    renderPage({}, `${ROUTE}?enabled=active&page=1&pageSize=10`)
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To orders' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    expect(urlParams()).toEqual({ enabled: 'active', page: '1', pageSize: '10' })
    expect(seen.table.activeUserId).toBeNull()
  })

  it('the panel can open as a page and is not expanded on the next owner', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(seen.panel.expanded).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.panel.expanded).toBe(false)
  })

  it('closing the panel gives the focus back to the row, also when ?id= opened it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    act(() => { document.body.focus() })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true))
    view.unmount()
    renderPage({}, `${ROUTE}?id=3`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })
})

describe('?id= and ?tab= on load: decided once, when the first list arrives', () => {
  it('?id=39&tab=businesses opens the record in Stores (an id that is not on the page: the panel loads it)', () => {
    renderPage({}, `${ROUTE}?id=39&tab=businesses`)
    expect(seen.panel.userId).toBe(39)
    expect(seen.panel.user).toBeNull()
    expect(seen.panel.section).toBe('businesses')
    expect(urlParams()).toMatchObject({ id: '39', tab: 'businesses' })
  })

  it('opens the row when the owner is on the page, and Profile when there is no tab or it is unknown', () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
    expect(seen.panel.section).toBe('profile')
    view.unmount()
    renderPage({}, `${ROUTE}?id=2&tab=whatever`)
    expect(seen.panel.section).toBe('profile')
  })

  it('?tab=metafields opens the Custom fields dialog on Profile', () => {
    renderPage({}, `${ROUTE}?id=2&tab=metafields`)
    expect(seen.panel.section).toBe('profile')
    expect(seen.panel.customFieldsOpen).toBe(true)
  })

  it('waits for the first list: nothing opens while it loads, then the row does', () => {
    renderPage({ usersList: { users: [], loading: true, error: null }, paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } }, `${ROUTE}?id=3`)
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    view.update({ usersList: { users: USERS, loading: false, error: null }, paginationDetail: { total: 3 } })
    expect(seen.panel.userId).toBe(3)
    expect(seen.panel.user).toMatchObject({ id: 3 })
  })

  it('still opens it when the list failed; an id that is not a number opens nothing; it is not reopened after closing', async () => {
    renderPage({ usersList: { users: [], loading: false, error: ['boom'] } }, `${ROUTE}?id=3`)
    expect(seen.panel.userId).toBe(3)
    view.unmount()
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    view.unmount()
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    view.update({ usersList: { users: USERS, loading: false, error: null } })
    expect(screen.queryByTestId('staff-panel')).toBeNull()
  })

  it('the panel follows the list, and a record that left it (switched off) keeps its panel', () => {
    renderPage({}, `${ROUTE}?id=2`)
    view.update({ usersList: { users: [USERS[0], owner(2, { enabled: false, name: 'Changed' }), USERS[2]], loading: false, error: null } })
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Changed', enabled: false })
    view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } })
    expect(screen.getByText('Panel of owner 2')).toBeInTheDocument()
    // the row it held when the list lost it
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
  })

  it('a navigation to another owner while the page is open (⌘K) opens it in the section the link says', async () => {
    renderPage()
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    act(() => historyRef.current.push(`${ROUTE}?id=3&tab=businesses`))
    await waitFor(() => expect(seen.panel?.userId).toBe(3))
    expect(seen.panel.section).toBe('businesses')
  })
})

// redesign BO-R2 (review r1, «bad»): ⌘K to another owner goes through the draft guard, as a click on another row does
describe('⌘K to another owner while the open record has unsaved changes', () => {
  // What the browser's router does: the address changes in the window and the router hears it
  const navigate = (search) => act(() => {
    window.history.replaceState(null, '', `${ROUTE}${search}`)
    historyRef.current.push(`${ROUTE}${search}`)
  })

  it('with a draft in Stores it asks first; «Keep editing» keeps the record and gives the address back to its id and section', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=businesses`)
    await userEvent.click(screen.getByRole('button', { name: 'Stores dirty' }))
    navigate('?id=3&tab=orders')
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    // nothing was dropped yet: the open record is still the one before
    expect(seen.panel.userId).toBe(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(seen.panel.userId).toBe(1)
    expect(seen.panel.section).toBe('businesses')
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-user-id', '1')
    expect(urlParams()).toMatchObject({ id: '1', tab: 'businesses' })
  })

  it('«Discard» opens the owner the link says, in the section it says', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=businesses`)
    await userEvent.click(screen.getByRole('button', { name: 'Stores dirty' }))
    navigate('?id=3&tab=orders')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(seen.panel.userId).toBe(3))
    expect(seen.panel.section).toBe('orders')
    expect(urlParams()).toMatchObject({ id: '3', tab: 'orders' })
    // the draft went with the old record: the next switch asks nothing
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.userId).toBe(2)
  })

  it('a profile draft asks too, and «Keep editing» returns to Profile', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    navigate('?id=3&tab=orders')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(seen.panel.userId).toBe(1)
    expect(seen.panel.section).toBe('profile')
    expect(urlParams()).toMatchObject({ id: '1', tab: 'profile' })
  })

  it('without a draft it opens the owner at once, asking nothing', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=businesses`)
    navigate('?id=3&tab=orders')
    await waitFor(() => expect(seen.panel.userId).toBe(3))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.section).toBe('orders')
  })
})

describe('Stores section', () => {
  it('is drawn through renderStores with the owner, the kind\'s stores key, and the page\'s handlers', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.queryByTestId('stores-section')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'To stores' }))
    const section = screen.getByTestId('stores-section')
    expect(section).toHaveAttribute('data-user-id', '2')
    expect(section).toHaveAttribute('data-stores-key', 'businesses')
  })

  it('saving the stores goes to the controller\'s handleSuccessUpdate with { id, businesses } (the row paints them)', async () => {
    renderPage({}, `${ROUTE}?id=2&tab=businesses`)
    await userEvent.click(screen.getByRole('button', { name: 'Stores saved' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 2, businesses: [{ id: 5, name: 'Fast Bite' }] })
    expect(ctl.props.setSelectedUsers).not.toHaveBeenCalled()
  })

  it('a draft of the stores guards switching record and the add form', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=businesses`)
    await userEvent.click(screen.getByRole('button', { name: 'Stores dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(seen.panel.userId).toBe(1)
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })
})

describe('add', () => {
  it('«Add business owner» opens the form in a sheet with the owner level and without its own title', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const sheet = await screen.findByRole('dialog', { name: 'Add business owner' })
    expect(within(sheet).getByTestId('add-form')).toBeInTheDocument()
    expect(seen.addForm.defaultUserTypesSelected).toEqual([2])
    expect(seen.addForm.showTitle).toBe(false)
  })

  it('after creating, the controller hears it, the sheet closes and the new owner\'s record opens in Stores', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith({ id: 99, level: 2, name: 'New', businesses: [] })
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    expect(seen.panel.userId).toBe(99)
    expect(seen.panel.section).toBe('businesses')
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-user-id', '99')
    expect(urlParams()).toMatchObject({ id: '99', tab: 'businesses' })
    // closing the record leaves the list as it is
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  describe('the focus after creating (the sheet gives it back to its opener when it finishes closing)', () => {
    let frames
    // Runs the frames queued so far, one generation per call (what a callback queues waits for the next one)
    const tick = (count = 1) => {
      for (let i = 0; i < count; i++) {
        const batch = frames
        frames = []
        batch.forEach(callback => callback())
      }
    }
    // Frames until none is left (something else of the page may queue a late one, so «none left» is read after this, not after one tick)
    const drain = () => { for (let i = 0; i < 100 && frames.length > 0; i++) tick() }
    const storesTab = () => document.querySelector('.odc-record [role="tab"][aria-selected="true"]')

    let rafSpy
    beforeEach(() => { frames = [] })
    afterEach(() => { rafSpy?.mockRestore() })

    const createOwner = async () => {
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      const create = await screen.findByRole('button', { name: 'Add succeeded' })
      rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback))
      await userEvent.click(create)
      await waitFor(() => expect(seen.panel?.userId).toBe(99))
    }

    // R3 (decision 35): a record with more than four sections has a SectionNav, not tabs: the focus ends in its current row (wide) or its
    // trigger (narrow panel)
    describe('with a section list instead of tabs', () => {
      afterEach(() => { panelShape.nav = null })

      it('ends in the current row of the list', async () => {
        panelShape.nav = 'list'
        renderPage()
        await createOwner()
        drain()
        expect(document.activeElement).toHaveTextContent('Stores row')
        expect(document.activeElement).toHaveAttribute('aria-current', 'page')
      })

      it('ends in the trigger of the compact list', async () => {
        panelShape.nav = 'compact'
        renderPage()
        await createOwner()
        drain()
        expect(document.activeElement).toHaveClass('odc-sectionnav-trigger')
      })
    })

    it('ends in the selected tab of the new record, also after the sheet hands the focus back to its opener', async () => {
      renderPage()
      await createOwner()
      expect(storesTab()).toHaveTextContent('Stores tab')
      tick()
      expect(document.activeElement).toBe(storesTab())
      // the sheet finishes closing and returns the focus to the button that opened it (from ⌘K: «Skip to content»)
      document.querySelector('[data-tour="tour_add"]').focus()
      tick()
      expect(document.activeElement).toBe(storesTab())
      drain()
      expect(document.activeElement).toBe(storesTab())
    })

    // R2-3 (review r1, finding 3): the sheet hands the focus back to its button when it FINISHES closing, which is later than 3 frames
    const stuckSheet = () => {
      const sheet = document.createElement('div')
      sheet.className = 'odc-sheet'
      document.body.append(sheet)
      return sheet
    }

    it('waits while a sheet is still in the document, and ends in the selected tab once it is gone and the focus went back to «Add …»', async () => {
      renderPage()
      await createOwner()
      const sheet = stuckSheet()
      tick(10) // far more than 3 stable frames
      expect(frames.length).toBeGreaterThan(0) // still asking
      sheet.remove()
      const add = document.querySelector('[data-tour="tour_add"]')
      add.focus() // what the sheet does when it finishes closing
      expect(document.activeElement).toBe(add)
      drain()
      expect(document.activeElement).toBe(storesTab())
    })

    it('does not put the focus in the record while the sheet is still there', async () => {
      renderPage()
      await createOwner()
      const sheet = stuckSheet()
      const add = document.querySelector('[data-tour="tour_add"]')
      add.focus()
      tick(10)
      expect(document.activeElement).toBe(add)
      sheet.remove()
      drain()
    })

    it('gives up after 300 frames if the sheet never goes', async () => {
      renderPage()
      await createOwner()
      const sheet = stuckSheet()
      tick(299)
      expect(frames.length).toBeGreaterThan(0)
      tick(5)
      expect(frames).toHaveLength(0)
      sheet.remove()
    })

    it('leaves alone a focus the person already put inside the record', async () => {
      renderPage()
      await createOwner()
      const profileTab = Array.from(document.querySelectorAll('.odc-record [role="tab"]')).find(tab => tab.getAttribute('aria-selected') === 'false')
      profileTab.focus()
      drain()
      expect(document.activeElement).toBe(profileTab)
    })

    it('stops asking when the record is closed before it has a selected tab (at most 40 frames)', async () => {
      renderPage()
      await createOwner()
      await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
      expect(storesTab()).toBeNull()
      drain() // every loop ends within its cap (30 frames for the list's focus, 40 for the record's)
      expect(frames).toHaveLength(0)
    })
  })

  it('Close closes the sheet; ?add=1 opens it once and takes itself out of the address; the foot has the link', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
    expect(urlParams().add).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Close form' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    const add = within(document.querySelector('.sdl-foot')).getByRole('button', { name: 'Add business owner' })
    expect(add).toHaveAttribute('data-variant', 'link')
    await userEvent.click(add)
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('opening it closes the open record, and opening a record closes it', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await screen.findByTestId('add-form')
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    act(() => seen.table.onOpenUser(USERS[0]))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    expect(seen.panel.userId).toBe(1)
  })
})

// redesign D-1 (owner, 2026-10-19, decision 25 C8): deactivating a business owner, a call center agent or a professional asks
// first, in a ConfirmDialog with the initial focus on Cancel; activating is immediate; the admin kind keeps ConfirmAdmin and no second dialog
const deactivateDialog = () => screen.findByRole('alertdialog')
// the title of the admin confirmation of the status switch (ConfirmAdmin, a plain dialog; the ConfirmDialog above is an alertdialog)
const ADMIN_TOGGLE_TITLE = /^(Activate|Deactivate) .+\?$/
const confirmDeactivation = async (name) => {
  await userEvent.click(within(await deactivateDialog()).getByRole('button', { name }))
}

describe('the status switch (one useActiveToggle, shared; decision 5; D-1)', () => {
  it('deactivating from a row asks first: the owner\'s title and confirm, the focus on Cancel, nothing written yet', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    const dialog = await deactivateDialog()
    expect(dialog).toHaveTextContent('Deactivate Name2 Lopez?')
    expect(dialog).toHaveTextContent("They can't sign in to the dashboard until you activate them again.")
    expect(within(dialog).getByRole('button', { name: 'Deactivate business owner' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
  })

  it('Cancel writes nothing and leaves the row where it was', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await userEvent.click(within(await deactivateDialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  it('confirming calls the controller once with the row', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
  })

  it('the open record\'s switch asks the same question, with the same dialog (one hook for the row, the card and the record)', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    const dialog = await deactivateDialog()
    expect(dialog).toHaveTextContent('Deactivate Name2 Lopez?')
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
  })

  it('activating stays immediate: no dialog', async () => {
    renderPage({ selectedUserActiveState: false }, `${ROUTE}?enabled=inactive`)
    await userEvent.click(screen.getByRole('button', { name: 'Switch on 2' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a failure tells the person, and the pending id goes away', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The status didn't change")
    expect(dialog).toHaveTextContent('Nope')
    expect(seen.table.pendingIds).toEqual([])
  })

  it('a failure with no message says the default line', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: null })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Something went wrong. Try again.')
  })

  it('the open record\'s switch reflects a successful toggle from the panel even when it is not in the list; the list is asked again', async () => {
    renderPage({}, `${ROUTE}?id=500`)
    expect(screen.getByTestId('panel-switch')).toHaveTextContent('no row')
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 500, enabled: false }))
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 500, enabled: false }))
    await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 10))
  })

  it('a toggle that takes the row out of its tab asks for the current page once (the count and the range follow)', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
        return { ok: true, error: null }
      }),
      paginationProps: { currentPage: 3, pageSize: 25, totalItems: 120, totalPages: 5, from: 51, to: 53 },
      paginationDetail: { total: 120 }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledTimes(1))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(3, 25)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ctl.props.getUsers).toHaveBeenCalledTimes(1)
  })

  // the panel, the reload and the focus follow the record the API returned (the controller's `user`), not what was asked
  it('the open record\'s switch shows the enabled state the API returned, not the one that was asked', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { id: 500, enabled: true } })) }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 500, enabled: false }))
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 500, enabled: true }))
  })

  it('when the API keeps a listed record in the tab\'s state, the row did not leave: no reload', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { ...USERS[1], enabled: true } })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  it('when the API keeps a listed record in the tab\'s state, the focus stays on that row (it did not leave)', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        document.activeElement?.blur() // the focus is nowhere in the list when the answer comes
        return { ok: true, error: null, user: { ...USERS[1], enabled: true } }
      })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 300)) // the focus settling runs on the next frames
    // the row (or the control in it), never the one after it
    expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true)
  })

  it('in Inactive, when the API keeps a record off that was asked to turn on, the row did not leave: no reload', async () => {
    renderPage({
      selectedUserActiveState: false,
      handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { ...USERS[1], enabled: false } }))
    }, `${ROUTE}?enabled=inactive`)
    await userEvent.click(screen.getByRole('button', { name: 'Switch on 2' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true }))
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  it('a returned record without `enabled` falls back to what was asked (the open record\'s switch)', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { id: 500 } })) }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 500, enabled: false }))
    await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 10))
  })

  it('a failed toggle does not reload', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    expect(await screen.findByText('Nope')).toBeInTheDocument()
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  it('switching off a row puts the focus on the row that took its place', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
        return { ok: true, error: null }
      })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate business owner')
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })

  describe('confirmAdminOnToggle on a kind that does not set it (off for owners; the admin kind sets it, see «admins (kind admin)»)', () => {
    afterEach(() => { STAFF_KINDS.business_owner.confirmAdminOnToggle = false })

    it('is off for business owners: a level 0 row skips ConfirmAdmin and meets only the deactivation question', async () => {
      renderPage({ usersList: { users: [owner(7, { level: 0 })], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 7' }))
      await confirmDeactivation('Deactivate business owner')
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 7, enabled: false }))
    })

    it('on, a level 0 row asks ConfirmAdmin before the controller hears it; cancelling changes nothing', async () => {
      STAFF_KINDS.business_owner.confirmAdminOnToggle = true
      renderPage({ usersList: { users: [owner(7, { level: 0 }), owner(8)], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 7' }))
      const dialog = await screen.findByRole('dialog', { name: 'Deactivate Name7 Lopez?' })
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 7' }))
      await userEvent.click(within(await screen.findByRole('dialog', { name: 'Deactivate Name7 Lopez?' })).getByRole('button', { name: 'Deactivate admin' }))
      // (the owners' kind never sets both; if one did, the person would meet both questions, ConfirmAdmin first)
      await confirmDeactivation('Deactivate business owner')
      // the ConfirmAdmin stub resolves with 'code-1'; it rides through to the controller as confirmationToken
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 7, enabled: false, confirmationToken: 'code-1' }))
    })

    it('on, a row of another level skips ConfirmAdmin and meets only the deactivation question', async () => {
      STAFF_KINDS.business_owner.confirmAdminOnToggle = true
      renderPage({ usersList: { users: [owner(7, { level: 0 }), owner(8)], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 8' }))
      await confirmDeactivation('Deactivate business owner')
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 8, enabled: false }))
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
    })
  })
})

describe('what the panel reports back', () => {
  it('a saved profile goes to the controller; a record that is no longer an owner leaves the selection', async () => {
    renderPage({ selectedUsers: [2, 3] }, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Save as admin' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 2, level: 1 })
    const next = ctl.props.setSelectedUsers.mock.calls.at(-1)[0]
    expect(typeof next === 'function' ? next([2, 3]) : next).toEqual([3])
  })

  it('a saved name keeps the selection and updates the row the panel holds when the list has none', async () => {
    renderPage({ selectedUsers: [2] }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 500, name: 'Renamed' })
    expect(ctl.props.setSelectedUsers).not.toHaveBeenCalled()
  })

  it('a deleted owner goes to the controller, leaves the selection, closes the panel and the focus goes to the next row', async () => {
    renderPage({ selectedUsers: [2, 3] }, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    expect(ctl.props.handleSuccessDeleteUser).toHaveBeenCalledWith({ id: 2, level: 2 })
    const next = ctl.props.setSelectedUsers.mock.calls.at(-1)[0]
    expect(typeof next === 'function' ? next([2, 3]) : next).toEqual([3])
    expect(screen.queryByTestId('staff-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })
})

describe('unsaved changes in the profile', () => {
  it('opening another record asks before dropping a draft; «Discard» opens it, a clean form asks nothing', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(seen.panel.userId).toBe(2))
    expect(urlParams().id).toBe('2')
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile clean' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.userId).toBe(3)
  })

  it('after closing the panel the old draft does not follow the next record', async () => {
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
  it('has the pagination with 10 / 25 / 50 and the range; the next page and a new size ask the controller', async () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 24, totalPages: 3, from: 1, to: 10 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 24')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 10)
    await userEvent.click(screen.getByRole('button', { name: 'Items per page 10' }))
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(3)
    await userEvent.click(screen.getByRole('menuitemradio', { name: '25' }))
    expect(ctl.props.getUsers).toHaveBeenLastCalledWith(1, 25)
  })

  it('follows the total the controller keeps; has no pagination when the load failed', () => {
    renderPage({ paginationDetail: { total: 11 }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 24, totalPages: 3, from: 1, to: 10 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('11 business owners')
    view.unmount()
    renderPage({ usersList: { users: [], loading: false, error: ['x'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('writes ?page and ?pageSize after each load; does not touch the address without isUseQuery', () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 120, totalPages: 5, from: 26, to: 50 } })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' })
    view.unmount()
    renderPage({}, ROUTE, { isUseQuery: false })
    expect(window.location.search).toBe('')
  })

  it('a page left empty by deleting asks again (the previous one when it was the last)', () => {
    renderPage({ usersList: { users: [], loading: false, error: null }, paginationProps: { currentPage: 3, pageSize: 10, totalItems: 24, totalPages: 3, from: 21, to: 24 }, paginationDetail: { total: 24 } })
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 10)
  })
})

// redesign CA-B1 (CA-4): a list that loaded with no rows, no error and no filter already has its «Add» in the table's
// empty state; the link of the foot would be the second one. With rows, or with filters that empty the list, it stays.
describe.each([
  ['business_owner', 'Add business owner', ROUTE],
  ['callcenter_agent', 'Add call center agent', '/users/callcenter-agents']
])('the foot\'s «Add» link · %s', (kindId, addText, route) => {
  const none = {
    usersList: { users: [], loading: false, error: null },
    paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    paginationDetail: { total: 0 },
    searchValue: '',
    multiFilterValues: {}
  }
  const footAdd = () => within(document.querySelector('.sdl-foot')).queryByRole('button', { name: addText })

  it('is not drawn when the list loaded empty, with no error and no filter (the table\'s empty state has the Add)', () => {
    renderPage(none, route, { kind: kindId })
    expect(footAdd()).toBeNull()
    expect(screen.getByRole('button', { name: 'Table add' })).toBeInTheDocument()
  })

  it('stays when filters leave the list empty', () => {
    renderPage({ ...none, searchValue: 'zzz' }, route, { kind: kindId })
    expect(footAdd()).toBeInTheDocument()
    view.unmount()
    renderPage({ ...none, multiFilterValues: { name: 'Ana' } }, route, { kind: kindId })
    expect(footAdd()).toBeInTheDocument()
  })

  it('stays when there are rows', () => {
    renderPage({ ...none, usersList: { users: USERS, loading: false, error: null } }, route, { kind: kindId })
    expect(footAdd()).toBeInTheDocument()
  })

  it('stays when the load failed', () => {
    renderPage({ ...none, usersList: { users: [], loading: false, error: ['boom'] } }, route, { kind: kindId })
    expect(footAdd()).toBeInTheDocument()
  })
})

// redesign CA-B1: the same page driven by the call center agent kind
describe('call center agents (kind callcenter_agent)', () => {
  const AGENTS_ROUTE = '/users/callcenter-agents'
  const AGENTS_PAGE = { kind: 'callcenter_agent' }
  const agent = (id, extra = {}) => owner(id, { level: 9, businesses: undefined, businesses_agent: [{ id: 20 + id, name: `Desk${id}` }], ...extra })
  const AGENTS = [agent(1), agent(2), agent(3)]
  const agents = (overrides = {}) => ({ usersList: { users: AGENTS, loading: false, error: null }, userTypesSelected: [9], ...overrides })
  const renderAgents = (overrides = {}, route = AGENTS_ROUTE) => renderPage(agents(overrides), route, AGENTS_PAGE)

  it('mounts UsersList with level 9, the search flags and businesses_agent (once) in propsToFetch', () => {
    renderAgents()
    expect(seen.controller).toMatchObject({
      defaultUserTypesSelected: [9],
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true
    })
    expect(seen.controller.propsToFetch).toEqual(expect.arrayContaining(['name', 'email', 'level', 'orders_count', 'loyalty_level', 'businesses_agent']))
    expect(seen.controller.propsToFetch.filter(key => key === 'businesses_agent')).toHaveLength(1)
    expect(seen.controller.propsToFetch).not.toContain('businesses')
  })

  it('the header says «Call center agents», «24 call center agents», has no Learn, «Add call center agent» (keeps data-tour) and Export CSV', () => {
    renderAgents()
    expect(screen.getByRole('heading', { level: 1, name: 'Call center agents' })).toHaveClass('odc-pagehead-title')
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('24 call center agents')
    expect(screen.queryByRole('button', { name: /Learn/ })).toBeNull()
    const add = document.querySelector('[data-tour="tour_add"]')
    expect(add).toHaveTextContent('Add call center agent')
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('says «1 call center agent» for one', () => {
    renderAgents({ paginationDetail: { total: 1 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 call center agent')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 call center agents')
  })

  it('the export gets the agents\' words and level', () => {
    renderAgents()
    expect(seen.exportCsv.copy).toBe(STAFF_KINDS.callcenter_agent.exportCopy)
    expect(seen.exportCsv).toMatchObject({ defaultUserTypesSelected: [9], userTypesSelected: [9] })
  })

  it('the table, the tabs, the filter bar and the panel get the agents\' kind and words', async () => {
    renderAgents()
    expect(seen.table.kind).toBe(STAFF_KINDS.callcenter_agent)
    expect(screen.getByRole('tablist', { name: 'Call center agent status' })).toBeInTheDocument()
    expect(seen.filters).toMatchObject({
      sheetKeys: STAFF_KINDS.callcenter_agent.sheetKeys,
      searchLabel: STAFF_KINDS.callcenter_agent.text.search,
      barLabel: STAFF_KINDS.callcenter_agent.text.filterBar
    })
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.panel.kind).toBe(STAFF_KINDS.callcenter_agent)
  })

  it('the empty state\'s table gets the agents\' kind (it paints its words)', () => {
    renderAgents({ usersList: { users: [], loading: false, error: null }, paginationDetail: { total: 0 }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 }, multiFilterValues: {} })
    expect(seen.table.kind).toBe(STAFF_KINDS.callcenter_agent)
    expect(seen.table.users).toEqual([])
  })

  it('«Add call center agent» opens the form in a sheet with level 9 and without its own title', async () => {
    renderAgents()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const sheet = await screen.findByRole('dialog', { name: 'Add call center agent' })
    expect(within(sheet).getByTestId('add-form')).toBeInTheDocument()
    expect(seen.addForm.defaultUserTypesSelected).toEqual([9])
    expect(seen.addForm.showTitle).toBe(false)
  })

  it('the selection bar and its delete speak of call center agents', async () => {
    renderAgents({ selectedUsers: [1, 2] })
    expect(screen.getByRole('region', { name: 'Actions for selected call center agents' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete 2 call center agents?' })).toBeInTheDocument()
  })

  // redesign D-1 (owner, 2026-10-19)
  it('deactivating asks first with the agents\' words, the focus on Cancel; Cancel writes nothing, the confirm calls the controller', async () => {
    renderAgents()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    const dialog = await deactivateDialog()
    expect(dialog).toHaveTextContent('Deactivate Name2 Lopez?')
    expect(dialog).toHaveTextContent("They can't sign in to the call center app or take orders until you activate them again.")
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await confirmDeactivation('Deactivate call center agent')
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
    expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
  })

  it('activating an agent stays immediate', async () => {
    renderAgents({ selectedUserActiveState: false }, `${AGENTS_ROUTE}?enabled=inactive`)
    await userEvent.click(screen.getByRole('button', { name: 'Switch on 2' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a level 9 record gets its stores in businesses_agent, and saving them comes back under that key', async () => {
    renderAgents({}, `${AGENTS_ROUTE}?id=2&tab=businesses`)
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses_agent')
    await userEvent.click(screen.getByRole('button', { name: 'Stores saved' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 2, businesses_agent: [{ id: 5, name: 'Fast Bite' }] })
  })

  it('a level 2 record opened on this page keeps its stores in businesses (CA-3: the record decides, not the page)', async () => {
    renderAgents({ usersList: { users: [...AGENTS, owner(4)], loading: false, error: null } }, `${AGENTS_ROUTE}?id=4&tab=businesses`)
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-user-id', '4')
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses')
  })

  it('a record that is not on the page (no row, no level yet) takes the kind\'s: businesses_agent', () => {
    renderAgents({}, `${AGENTS_ROUTE}?id=500&tab=businesses`)
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses_agent')
  })

  it('opens and closes its record with its own address', async () => {
    renderAgents({}, `${AGENTS_ROUTE}?enabled=active`)
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(urlParams()).toMatchObject({ id: '3', enabled: 'active' })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(urlParams().id).toBeUndefined()
  })

  describe('renderStores · the level the panel passes decides the stores key', () => {
    const storesKeyFor = async (args) => {
      renderAgents()
      await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
      const { container, unmount } = render(seen.panel.renderStores({ onDirtyChange: () => {}, ...args }))
      const key = within(container).getByTestId('stores-section').getAttribute('data-stores-key')
      unmount()
      return key
    }

    it('level 2 → businesses, even on the agents\' page', async () => {
      expect(await storesKeyFor({ user: { id: 5, level: 9 }, level: 2 })).toBe('businesses')
    })

    it('level 9 → businesses_agent, even when the detail it holds says another level', async () => {
      expect(await storesKeyFor({ user: { id: 5, level: 2 }, level: 9 })).toBe('businesses_agent')
    })

    it('without level, the one of the user (2 → businesses)', async () => {
      expect(await storesKeyFor({ user: { id: 5, level: 2 } })).toBe('businesses')
    })

    it('without level, the one of the user (9 → businesses_agent)', async () => {
      expect(await storesKeyFor({ user: { id: 5, level: 9 } })).toBe('businesses_agent')
    })

    it('without level nor user level, the kind\'s (9 here)', async () => {
      expect(await storesKeyFor({ user: { id: 5 } })).toBe('businesses_agent')
    })
  })
})

// redesign AD-B1: the same page driven by the admin kind (level 0): no stores anywhere, and ConfirmAdmin before a switch
describe('admins (kind admin)', () => {
  const ADMINS_ROUTE = '/users/admins'
  const ADMINS_PAGE = { kind: 'admin' }
  const admin = (id, extra = {}) => owner(id, { level: 0, businesses: undefined, ...extra })
  const ADMIN_ROWS = [admin(1), admin(2), admin(3)]
  const admins = (overrides = {}) => ({ usersList: { users: ADMIN_ROWS, loading: false, error: null }, userTypesSelected: [0], ...overrides })
  const renderAdmins = (overrides = {}, route = ADMINS_ROUTE) => renderPage(admins(overrides), route, ADMINS_PAGE)
  const confirmDialog = (name = 'Deactivate Name2 Lopez?') => screen.findByRole('dialog', { name })

  it('mounts UsersList with level 0, the search flags and a propsToFetch with no stores key (and no null or undefined)', () => {
    renderAdmins()
    expect(seen.controller).toMatchObject({
      defaultUserTypesSelected: [0],
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true
    })
    expect(seen.controller.propsToFetch).toEqual(expect.arrayContaining(['name', 'email', 'level', 'orders_count', 'loyalty_level']))
    expect(seen.controller.propsToFetch).not.toContain(null)
    expect(seen.controller.propsToFetch).not.toContain(undefined)
    expect(seen.controller.propsToFetch).not.toContain('businesses')
    expect(seen.controller.propsToFetch).not.toContain('businesses_agent')
    seen.controller.propsToFetch.forEach(key => expect(typeof key).toBe('string'))
  })

  it('the header says «Admins», «24 admins», has Learn with main\'s two articles, «Add admin» (keeps data-tour) and Export CSV', async () => {
    renderAdmins()
    expect(screen.getByRole('heading', { level: 1, name: 'Admins' })).toHaveClass('odc-pagehead-title')
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('24 admins')
    await userEvent.click(screen.getByRole('button', { name: /Learn/ }))
    expect(await screen.findAllByRole('menuitem')).toHaveLength(2)
    expect(screen.getByRole('menuitem', { name: /Managers \| General overview/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Manager details/ })).toBeInTheDocument()
    const add = document.querySelector('[data-tour="tour_add"]')
    expect(add).toHaveTextContent('Add admin')
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('says «1 admin» for one', () => {
    renderAdmins({ paginationDetail: { total: 1 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 admin')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 admins')
  })

  it('the export gets the admins\' words and level', () => {
    renderAdmins()
    expect(seen.exportCsv.copy).toBe(STAFF_KINDS.admin.exportCopy)
    expect(seen.exportCsv).toMatchObject({ defaultUserTypesSelected: [0], userTypesSelected: [0] })
  })

  it('the table, the tabs, the filter bar and the panel get the admins\' kind and words', async () => {
    renderAdmins()
    expect(seen.table.kind).toBe(STAFF_KINDS.admin)
    expect(screen.getByRole('tablist', { name: 'Admin status' })).toBeInTheDocument()
    expect(seen.filters).toMatchObject({
      sheetKeys: STAFF_KINDS.admin.sheetKeys,
      searchLabel: STAFF_KINDS.admin.text.search,
      barLabel: STAFF_KINDS.admin.text.filterBar
    })
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.panel.kind).toBe(STAFF_KINDS.admin)
  })

  it('the empty state\'s table gets the admins\' kind (it paints its words)', () => {
    renderAdmins({ usersList: { users: [], loading: false, error: null }, paginationDetail: { total: 0 }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 }, multiFilterValues: {} })
    expect(seen.table.kind).toBe(STAFF_KINDS.admin)
    expect(seen.table.users).toEqual([])
  })

  it('the selection bar and its delete speak of admins', async () => {
    renderAdmins({ selectedUsers: [1, 2] })
    expect(screen.getByRole('region', { name: 'Actions for selected admins' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete 2 admins?' })).toBeInTheDocument()
  })

  it('«Add admin» opens the form in a sheet with level 0 and without its own title', async () => {
    renderAdmins()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const sheet = await screen.findByRole('dialog', { name: 'Add admin' })
    expect(within(sheet).getByTestId('add-form')).toBeInTheDocument()
    expect(seen.addForm.defaultUserTypesSelected).toEqual([0])
    expect(seen.addForm.showTitle).toBe(false)
  })

  it('after creating, the controller hears it and the new admin\'s record opens in Profile (it has no stores to set up)', async () => {
    renderAdmins()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    expect(seen.panel.userId).toBe(99)
    expect(seen.panel.section).toBe('profile')
    expect(screen.queryByTestId('stores-section')).toBeNull()
    expect(urlParams()).toMatchObject({ id: '99', tab: 'profile' })
    expect(urlParams().tab).not.toBe('businesses')
  })

  it('on the call center agents\' page (a kind with stores) the new record still opens in Stores', async () => {
    renderPage({ userTypesSelected: [9] }, '/users/callcenter-agents', { kind: 'callcenter_agent' })
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    await waitFor(() => expect(seen.panel?.userId).toBe(99))
    expect(seen.panel.section).toBe('businesses')
    expect(urlParams()).toMatchObject({ id: '99', tab: 'businesses' })
  })

  describe('the status switch asks ConfirmAdmin for a level 0 row (the table and the record, both ways)', () => {
    it('from the table: nothing reaches the controller until it is confirmed, then it gets (user, enabled)', async () => {
      renderAdmins()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      const dialog = await confirmDialog()
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate admin' }))
      // the ConfirmAdmin stub resolves with 'code-1'; it rides through to the controller as confirmationToken
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false, confirmationToken: 'code-1' }))
      expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull())
    })

    // redesign D-2 (owner, 2026-10-19): the confirmation says WHO and what it means; the code tab reads the same sentence
    it('names the admin: title, one sentence of consequence (also for the code tab) and «Deactivate admin»', async () => {
      renderAdmins()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      const dialog = await confirmDialog()
      expect(within(dialog).getByText("They can't sign in to the dashboard until you activate them again.")).toBeInTheDocument()
      const asked = seen.confirmAdmin.filter(props => props.open).at(-1)
      expect(asked).toMatchObject({
        title: 'Deactivate Name2 Lopez?',
        description: "They can't sign in to the dashboard until you activate them again.",
        otpDescription: "They can't sign in to the dashboard until you activate them again.",
        confirmLabel: 'Deactivate admin'
      })
    })

    it('from the table, activating asks too, with its own words (as main: both directions)', async () => {
      renderAdmins({ usersList: { users: [admin(2, { enabled: false })], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch on 2' }))
      const dialog = await confirmDialog('Activate Name2 Lopez?')
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      expect(within(dialog).getByText('They can sign in to the dashboard again.')).toBeInTheDocument()
      expect(seen.confirmAdmin.filter(props => props.open).at(-1)).toMatchObject({
        description: 'They can sign in to the dashboard again.',
        otpDescription: 'They can sign in to the dashboard again.',
        confirmLabel: 'Activate admin'
      })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Activate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true, confirmationToken: 'code-1' }))
    })

    it('without a name it says «No name»', async () => {
      renderAdmins({ usersList: { users: [admin(5, { name: '', lastname: '' })], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 5' }))
      expect(await confirmDialog('Deactivate No name?')).toBeInTheDocument()
    })

    // redesign D-1 (owner, 2026-10-19): the admin keeps ConfirmAdmin alone; a level 0 row never gets the second dialog
    it('a level 0 row gets ConfirmAdmin only: no deactivation dialog before or after it', async () => {
      renderAdmins()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      const dialog = await confirmDialog()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false, confirmationToken: 'code-1' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('from the table: closing the confirmation changes nothing, and asking again works', async () => {
      renderAdmins()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      await userEvent.click(within(await confirmDialog()).getByRole('button', { name: 'Cancel admin' }))
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 3' }))
      await userEvent.click(within(await confirmDialog('Deactivate Name3 Lopez?')).getByRole('button', { name: 'Deactivate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 3, enabled: false, confirmationToken: 'code-1' }))
    })

    // redesign D-2 (owner, 2026-10-19): from the record, deactivating asks (it cuts service); activating stays immediate
    it('from the record, deactivating asks with the name; nothing reaches the controller until it is confirmed', async () => {
      renderAdmins({}, `${ADMINS_ROUTE}?id=2`)
      await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
      const dialog = await confirmDialog()
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false, confirmationToken: 'code-1' }))
      expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    })

    it('from the record, closing the confirmation changes nothing', async () => {
      renderAdmins({}, `${ADMINS_ROUTE}?id=2`)
      await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
      await userEvent.click(within(await confirmDialog()).getByRole('button', { name: 'Cancel admin' }))
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    })

    // the API asks the proof (user_enabled) to activate an admin too
    it('from the record, activating asks too; nothing reaches the controller until it is confirmed', async () => {
      renderAdmins({ usersList: { users: [admin(1), admin(2, { enabled: false }), admin(3)], loading: false, error: null } }, `${ADMINS_ROUTE}?id=2`)
      await userEvent.click(screen.getByRole('button', { name: 'Panel switch on' }))
      const dialog = await confirmDialog('Activate Name2 Lopez?')
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Activate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true, confirmationToken: 'code-1' }))
    })

    it('the table and the record both ask, in the same page, one after the other', async () => {
      renderAdmins({}, `${ADMINS_ROUTE}?id=2`)
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 3' }))
      await userEvent.click(within(await confirmDialog('Deactivate Name3 Lopez?')).getByRole('button', { name: 'Deactivate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 3, enabled: false, confirmationToken: 'code-1' }))
      await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
      await userEvent.click(within(await confirmDialog()).getByRole('button', { name: 'Deactivate admin' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false, confirmationToken: 'code-1' }))
      expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
    })

    it('a row of another level opened on this page is switched at once (main: only level 0 rows)', async () => {
      renderAdmins({ usersList: { users: [admin(1), owner(8)], loading: false, error: null } })
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 8' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 8, enabled: false }))
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
    })

    it('on the business owners\' page a level 2 row never opens it', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      await confirmDeactivation('Deactivate business owner')
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
      expect(screen.queryByRole('dialog', { name: ADMIN_TOGGLE_TITLE })).toBeNull()
    })
  })

  it('a record of the admins\' page that is a level 2 one keeps its stores in its own section (the record decides, not the page)', async () => {
    renderAdmins({ usersList: { users: [...ADMIN_ROWS, owner(4)], loading: false, error: null } }, `${ADMINS_ROUTE}?id=4&tab=businesses`)
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-user-id', '4')
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses')
  })

  it('opens and closes its record with its own address', async () => {
    renderAdmins({}, `${ADMINS_ROUTE}?enabled=active`)
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(urlParams()).toMatchObject({ id: '3', enabled: 'active' })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(urlParams().id).toBeUndefined()
  })

  // review r1 #1: main's staff lists put `?q=` (⌘K «Search “…” in Admins») in the search box, which here searches name,
  // last name, full name, email and phone. A filter on the first name found nothing for «support» (0 admins; the box finds 11).
  it.each([
    ['one word', 'support'],
    ['a full name', 'Ordering Support'],
    ['an email', 'ana@example.com'],
    ['a phone', '5550101234']
  ])('?q= with %s fills the search box, not a filter', (_, value) => {
    renderAdmins({}, `${ADMINS_ROUTE}?q=${encodeURIComponent(value)}`)
    expect(seen.controller.searchSeed).toMatchObject({ value })
    expect(seen.controller.filterSeed).toBeFalsy()
  })
})

// redesign (B1c, decisions 2, 4, 10, 13, 13b; auditor 1-2, 10, 12): the professionals' page. Every option it uses is opt-in in
// the kind, so the kinds above (their tests untouched) behave as before: the last cases of this block say so.
describe('professionals (kind professional)', () => {
  const PRO_ROUTE = '/users/professionals'
  // the page injects main's professional form (residue ratchet: StaffListing must not import it, or every staff route reaches its date range)
  const PRO_PAGE = { kind: 'professional', AddForm: ProfessionalAddFormStub }
  const pro = (id, extra = {}) => owner(id, { level: 8, businesses: undefined, ...extra })
  const PRO_ROWS = [pro(1), pro(2), pro(3)]
  const OCCUPATIONS = [{ id: 1, name: 'Stylist' }, { id: 2, name: 'Barber' }]
  const pros = (overrides = {}) => ({
    usersList: { users: PRO_ROWS, loading: false, error: null },
    userTypesSelected: [8],
    occupationsState: { occupations: OCCUPATIONS, loading: false, error: null },
    selectedOccupation: null,
    handleSelectOccupation: vi.fn(),
    ...overrides
  })
  const renderPros = (overrides = {}, route = PRO_ROUTE) => renderPage(pros(overrides), route, PRO_PAGE)

  beforeEach(() => {
    proForm.props = null
  })

  // redesign D-1 (owner, 2026-10-19)
  describe('the status switch asks before deactivating', () => {
    it('with the professionals\' words, the focus on Cancel; Cancel writes nothing, the confirm calls the controller', async () => {
      renderPros()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      const dialog = await deactivateDialog()
      expect(dialog).toHaveTextContent('Deactivate Name2 Lopez?')
      expect(dialog).toHaveTextContent("They can't sign in until you activate them again.")
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
      await confirmDeactivation('Deactivate professional')
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
      expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    })

    it('activating a professional stays immediate', async () => {
      renderPros({ selectedUserActiveState: false }, `${PRO_ROUTE}?enabled=inactive`)
      await userEvent.click(screen.getByRole('button', { name: 'Switch on 2' }))
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
  })

  describe('no appointments add-on gate ()', () => {
    it.each([{}, { appointments: { value: false } }, { appointments: { value: true } }])('lists the professionals with configs %j', (configs) => {
      ctl.configs = configs
      renderPros()
      expect(screen.getByRole('heading', { level: 1, name: 'Professionals' })).toBeInTheDocument()
      expect(seen.controller).not.toBeNull()
      expect(screen.getAllByRole('button', { name: 'Add professional' }).length).toBeGreaterThan(0)
      expect(screen.queryByText('The appointments feature is not enabled.')).toBeNull()
    })
  })

  describe('what it passes the controller (auditor 1-2)', () => {
    it('isProfessional, level 8 and the search flags', () => {
      renderPros()
      expect(seen.controller).toMatchObject({
        isProfessional: true,
        defaultUserTypesSelected: [8],
        isSearchByUserName: true,
        isSearchByUserEmail: true,
        isSearchByUserPhone: true,
        isSearchByFullName: true
      })
    })

    // without these the record would open with no schedule (drawn 24/7) and a Save would overwrite the real one
    it('propsToFetch has the schedule, max_days_in_future, occupation_id, occupation and timezone, and the list\'s own fields; no stores key', () => {
      renderPros()
      expect(seen.controller.propsToFetch).toEqual(expect.arrayContaining([
        'schedule', 'max_days_in_future', 'occupation_id', 'occupation', 'timezone',
        'name', 'lastname', 'email', 'phone', 'photo', 'level', 'enabled', 'city'
      ]))
      expect(seen.controller.propsToFetch).not.toContain('businesses')
      expect(seen.controller.propsToFetch).not.toContain('businesses_agent')
      expect(seen.controller.propsToFetch).not.toContain(null)
      expect(seen.controller.propsToFetch).not.toContain(undefined)
      expect(new Set(seen.controller.propsToFetch).size).toBe(seen.controller.propsToFetch.length)
    })

    it('the other kinds do not get them: isProfessional is off and no schedule is fetched', () => {
      renderPage()
      expect(seen.controller.isProfessional).toBeFalsy()
      expect(seen.controller.propsToFetch).not.toContain('schedule')
      expect(seen.controller.propsToFetch).not.toContain('timezone')
      expect(seen.controller.propsToFetch).not.toContain('occupation_id')
      view.unmount()
      renderPage({ userTypesSelected: [0] }, '/users/admins', { kind: 'admin' })
      expect(seen.controller.isProfessional).toBeFalsy()
      expect(seen.controller.propsToFetch).not.toContain('max_days_in_future')
    })
  })

  describe('the ⓘ next to the title (decision 13)', () => {
    const INFO = /Create, assign and manage your professionals\./

    it('is a button named «More information», closed at first, with main\'s text once open', async () => {
      renderPros()
      const button = screen.getByRole('button', { name: 'More information' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText(INFO)).toBeNull()
      await userEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText(INFO)).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-controls', screen.getByText(INFO).id)
      await userEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText(INFO)).toBeNull()
    })

    it('works from the keyboard: it takes the focus with Tab and Enter and Space open and close it', async () => {
      renderPros()
      const button = screen.getByRole('button', { name: 'More information' })
      expect(button.tagName).toBe('BUTTON') // native: it is in the Tab order
      button.focus()
      await userEvent.keyboard('{Enter}')
      expect(screen.getByText(INFO)).toBeInTheDocument()
      expect(button).toHaveFocus()
      await userEvent.keyboard(' ')
      expect(screen.queryByText(INFO)).toBeNull()
    })

    it('sits in the title\'s block, before the actions', () => {
      renderPros()
      const button = screen.getByRole('button', { name: 'More information' })
      expect(button.closest('.odc-pagehead-lead')).not.toBeNull()
      expect(button.closest('.odc-pagehead-lead')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Professionals' }))
    })

    it('the kinds with no info draw none', () => {
      renderPage()
      expect(screen.queryByRole('button', { name: 'More information' })).toBeNull()
    })
  })

  describe('the occupation row (decision 4)', () => {
    it('is a group named «Occupation» with «All» and one button per occupation, before the filter bar', () => {
      renderPros()
      const group = screen.getByRole('group', { name: 'Occupation' })
      expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['All', 'Stylist', 'Barber'])
      expect(group.compareDocumentPosition(screen.getByTestId('users-filters')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // after the Active / Inactive tabs
      expect(screen.getByRole('tablist').compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('«All» is pressed with no occupation; the controller\'s selection is the pressed one', () => {
      renderPros()
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
      view.update({ selectedOccupation: 2 })
      expect(screen.getByRole('button', { name: 'Barber' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('one click on an occupation tells the controller its id; «All» tells it null', async () => {
      renderPros({ selectedOccupation: 1 })
      await userEvent.click(screen.getByRole('button', { name: 'Barber' }))
      expect(ctl.props.handleSelectOccupation).toHaveBeenLastCalledWith(2)
      await userEvent.click(screen.getByRole('button', { name: 'All' }))
      expect(ctl.props.handleSelectOccupation).toHaveBeenLastCalledWith(null)
      expect(ctl.props.handleSelectOccupation).toHaveBeenCalledTimes(2)
    })

    it('with no occupations (and none loading) nothing is drawn', () => {
      renderPros({ occupationsState: { occupations: [], loading: false, error: null } })
      expect(screen.queryByRole('group', { name: 'Occupation' })).toBeNull()
    })

    it('while they load, a busy placeholder', () => {
      renderPros({ occupationsState: { occupations: [], loading: true, error: null } })
      expect(screen.getByRole('status', { name: 'Occupation' })).toHaveAttribute('aria-busy', 'true')
    })

    it('the other kinds draw no row', () => {
      renderPage({ occupationsState: { occupations: OCCUPATIONS, loading: false, error: null } })
      expect(screen.queryByRole('group', { name: 'Occupation' })).toBeNull()
    })
  })

  describe('an occupation is a filter (auditor 10)', () => {
    const EMPTY = { usersList: { users: [], loading: false, error: null }, paginationDetail: { total: 0 }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }

    it('an empty list with an occupation selected is «no match», not «empty»', () => {
      renderPros({ ...EMPTY, multiFilterValues: {}, selectedOccupation: 2 })
      expect(seen.table.hasFilters).toBe(true)
    })

    it('an empty list with no occupation and no filter is still «empty»', () => {
      renderPros({ ...EMPTY, multiFilterValues: {}, selectedOccupation: null })
      expect(seen.table.hasFilters).toBe(false)
    })

    it('the foot\'s «Add professional» link stays when only the occupation emptied the list', () => {
      renderPros({ ...EMPTY, multiFilterValues: {}, selectedOccupation: 2 })
      expect(screen.getAllByRole('button', { name: 'Add professional' }).length).toBeGreaterThan(1)
    })

    it('«Clear all» of the empty state also resets the occupation', async () => {
      renderPros({ ...EMPTY, multiFilterValues: {}, selectedOccupation: 2, searchValue: 'ana' })
      await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
      expect(ctl.props.handleSelectOccupation).toHaveBeenCalledTimes(1)
      expect(ctl.props.handleSelectOccupation).toHaveBeenCalledWith(null)
      expect(ctl.props.onSearch).toHaveBeenCalledWith('')
      expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledWith(null)
      expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledTimes(1)
    })

    it('«Clear all» of the filter bar does the same', () => {
      renderPros({ selectedOccupation: 2 })
      act(() => seen.filters.onClearAll())
      expect(ctl.props.handleSelectOccupation).toHaveBeenCalledWith(null)
      expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    })

    it('a kind with no occupations clears as before (no handler to call)', async () => {
      renderPage({ multiFilterValues: { name: 'Ana' } })
      await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
      expect(ctl.props.onSearch).toHaveBeenCalledWith('')
      expect(ctl.props.handleSelectOccupation).toBeUndefined()
    })
  })

  describe('the filter bar', () => {
    it('has no Loyalty level on this page, and keeps it on the others', () => {
      renderPros()
      expect(seen.filters.showLoyalty).toBe(false)
      expect(seen.filters.sheetKeys).toEqual(['name', 'lastname', 'email', 'countryPhoneCode', 'cellphone'])
      view.unmount()
      renderPage()
      expect(seen.filters.showLoyalty).toBe(true)
      view.unmount()
      renderPage({ userTypesSelected: [0] }, '/users/admins', { kind: 'admin' })
      expect(seen.filters.showLoyalty).toBe(true)
    })
  })

  describe('add (decision 10, auditor 8, 12)', () => {
    it('StaffListing does not import ProfessionalAddForm: the page injects it as AddForm (residue ratchet of the other staff routes)', async () => {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const source = readFileSync(resolve(__dirname, '../StaffListing.jsx'), 'utf8')
      expect(source).not.toMatch(/from '\.\.\/ProfessionalAddForm'/)
    })

    it('«Add professional» opens ProfessionalAddForm in the sheet, not UserAddForm, without its own title and with the occupations', async () => {
      renderPros()
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      const sheet = await screen.findByRole('dialog', { name: 'Add professional' })
      expect(within(sheet).getByTestId('professional-add-form')).toBeInTheDocument()
      expect(screen.queryByTestId('add-form')).toBeNull()
      expect(proForm.props.showTitle).toBe(false)
      expect(proForm.props.occupations).toBe(OCCUPATIONS)
    })

    it('the occupations follow the controller (a new one created from the selector)', async () => {
      renderPros()
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      await screen.findByTestId('professional-add-form')
      const more = [...OCCUPATIONS, { id: 3, name: 'Coach' }]
      view.update({ occupationsState: { occupations: more, loading: false, error: null } })
      expect(proForm.props.occupations).toBe(more)
    })

    it('Close closes the sheet', async () => {
      renderPros()
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      await userEvent.click(await screen.findByRole('button', { name: 'Close professional form' }))
      await waitFor(() => expect(screen.queryByTestId('professional-add-form')).toBeNull())
    })

    it('after creating: the controller hears it and the new record opens in Business & Services (its services come next)', async () => {
      renderPros()
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      await userEvent.click(await screen.findByRole('button', { name: 'Professional created' }))
      expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledTimes(1)
      expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }))
      await waitFor(() => expect(screen.queryByTestId('professional-add-form')).toBeNull())
      expect(seen.panel.userId).toBe(77)
      expect(seen.panel.section).toBe('business_services')
      expect(urlParams()).toMatchObject({ id: '77', tab: 'business_services' })
    })

    it('?add=1 (⌘K create:professional) opens the same sheet once', async () => {
      renderPros({}, `${PRO_ROUTE}?add=1`)
      expect(await screen.findByTestId('professional-add-form')).toBeInTheDocument()
      expect(screen.queryByTestId('add-form')).toBeNull()
      await waitFor(() => expect(urlParams().add).toBeUndefined())
    })

    it('the other kinds keep UserAddForm and their own section after creating', async () => {
      renderPage()
      await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
      expect(await screen.findByTestId('add-form')).toBeInTheDocument()
      expect(screen.queryByTestId('professional-add-form')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Add succeeded' }))
      await waitFor(() => expect(seen.panel?.userId).toBe(99))
      expect(seen.panel.section).toBe('businesses')
    })
  })

  describe('the record', () => {
    it('gets isProfessional and the occupations in profileProps, next to the draft guard', () => {
      renderPros({}, `${PRO_ROUTE}?id=2`)
      expect(seen.panel.profileProps.isProfessional).toBe(true)
      expect(seen.panel.profileProps.occupations).toBe(OCCUPATIONS)
      expect(typeof seen.panel.profileProps.onDirtyChange).toBe('function')
    })

    it('profileProps keeps working as the draft guard (a draft asks before switching record)', async () => {
      renderPros({}, `${PRO_ROUTE}?id=2`)
      await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
      await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
      expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
    })

    it('the other kinds get neither', () => {
      renderPage({}, `${ROUTE}?id=2`)
      expect(seen.panel.profileProps).not.toHaveProperty('isProfessional')
      expect(seen.panel.profileProps).not.toHaveProperty('occupations')
    })
  })

  it('the header, tabs, count and the export carry the professionals\' words', () => {
    renderPros()
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('24 professionals')
    expect(screen.getByRole('tablist', { name: 'Professional status' })).toBeInTheDocument()
    expect(seen.table.kind).toBe(STAFF_KINDS.professional)
    expect(seen.exportCsv.copy).toBe(STAFF_KINDS.professional.exportCopy)
  })
})

describe('business owners page · stores of a record of another level (CA-3)', () => {
  it('a level 9 record opened on the owners\' page gets businesses_agent; an owner keeps businesses', async () => {
    const agentRow = owner(4, { level: 9, businesses: undefined, businesses_agent: [] })
    renderPage({ usersList: { users: [...USERS, agentRow], loading: false, error: null } }, `${ROUTE}?id=4&tab=businesses`)
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses_agent')
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'To stores' }))
    expect(screen.getByTestId('stores-section')).toHaveAttribute('data-stores-key', 'businesses')
  })
})
