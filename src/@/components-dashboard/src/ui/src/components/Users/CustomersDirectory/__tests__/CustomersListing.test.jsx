/* eslint-disable import/first */
// redesign UC-B7 (decisions 1-8; auditor #1, #3, #7, #14; analysis.md §8): the customers page. The controller (K/UsersList),
// the table, the filters, the panel, the export, the wallet section, the add form and ConfirmAdmin are other pieces (B2-B6 and
// legacy ones) and are stubs here that record what they receive: what is tested is how they are composed, what the page passes
// to each, and what the page owns (the URL, the open customer, the selection bar, the focus). The Product wrappers the page is
// made of (PageHeader, Tabs, SelectionBar, SplitView, Pagination, Sheet, dialogs) and `useCustomerActiveToggle` are the real ones.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
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
  confirmAdmin: null,
  wallet: null,
  walletDirty: null
}))
const ctl = vi.hoisted(() => ({ props: {}, loyalty: { loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] }, configs: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: ctl.configs }],
  useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}` }],
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

vi.mock('../CustomersTable', () => ({
  CustomersTable: (props) => {
    seen.table = props
    const ids = props.users.map(user => user.id)
    return (
      <div className='odc-table-scroll' role='region' aria-label='Customers table'>
        {props.users.map(user => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={user.id} data-row-id={user.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpenUser(user)}>Open {user.id}</button>
            <button type='button' onClick={() => props.selection.onToggle(user.id)}>Select {user.id}</button>
            <button type='button' onClick={() => props.onToggleActive(user, false)}>Switch off {user.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.selection.onToggleAll(ids)}>Select page</button>
        <button type='button' onClick={() => props.onClearFilters()}>Table clear filters</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
      </div>
    )
  }
}))

vi.mock('../CustomersFilters', () => ({
  CustomersFilters: (props) => {
    seen.filters = props
    return <div data-testid='customers-filters' />
  }
}))

vi.mock('../CustomersExport', () => ({
  CustomersExport: (props) => {
    seen.exportCsv = props
    return <button type='button'>Export CSV</button>
  }
}))

vi.mock('../CustomerWalletSection', () => ({
  CustomerWalletSection: (props) => {
    seen.wallet = props
    return <div data-testid='wallet-section' data-wallet={props.wallet} />
  }
}))

vi.mock('../CustomerPanel', () => ({
  CustomerPanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='customer-panel'>
        <span>Panel of customer {props.userId}</span>
        <span data-testid='panel-section'>{props.section}</span>
        <span data-testid='panel-switch'>{props.user ? String(props.user.enabled) : 'no row'}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onSectionChange('orders')}>To orders</button>
        <button type='button' onClick={() => { props.onWalletChange('points'); props.onSectionChange('wallet') }}>To points</button>
        <button type='button' onClick={() => props.onCustomFieldsOpenChange(true)}>Custom fields</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onToggleActive(props.user ?? { id: props.userId, enabled: true }, false)}>Panel switch off</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, level: 1 })}>Save as admin</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: props.userId, name: 'Renamed' })}>Save name</button>
        <button
          type='button'
          onClick={() => {
            props.handleSuccessDeleteUser({ id: props.userId, level: 3 })
            props.onClose()
          }}
        >
          Delete from panel
        </button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(true)}>Profile dirty</button>
        <button type='button' onClick={() => props.profileProps.onDirtyChange(false)}>Profile clean</button>
        <button type='button' onClick={() => props.pendingIds.length}>pending {props.pendingIds.length}</button>
        {props.renderWallet({ user: props.user, wallet: props.wallet, onWalletChange: props.onWalletChange, onDirtyChange: (value) => { seen.walletDirty = value } })}
      </div>
    )
  }
}))

vi.mock('../../UserAddForm', () => ({
  UserAddForm: (props) => {
    seen.addForm = props
    return (
      <div data-testid='add-form'>
        <button type='button' onClick={() => props.handleSuccessAdd({ id: 99, level: 3 })}>Add succeeded</button>
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

import { CustomersListing } from '../../CustomersListing'

const user = (id, extra = {}) => ({ id, name: `Name${id}`, lastname: 'Lopez', email: `c${id}@example.com`, enabled: true, level: 3, orders_count: id, ...extra })
const USERS = [user(1), user(2), user(3)]

const baseCtl = (overrides = {}) => ({
  usersList: { users: USERS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 3 },
  paginationDetail: { total: 42, current_page: 1, total_pages: 5 },
  getUsers: vi.fn(),
  searchValue: '',
  onSearch: vi.fn(),
  orderFilterValue: null,
  handleChangeOrderFilterValue: vi.fn(),
  multiFilterValues: {},
  handleChangeMultiFilterValues: vi.fn(),
  userTypesSelected: [3],
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

const PAGE_PROPS = {
  isUseQuery: true,
  headerTitle: 'Customers',
  defaultUserTypesSelected: [3],
  disabledActiveStateCondition: false
}

const ROUTE = '/users/customers'
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
  const element = () => <><Capture /><CustomersListing {...PAGE_PROPS} {...pageProps} /></>
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
  ctl.loyalty = { loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] }
  Object.keys(seen).forEach(key => { seen[key] = null })
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('wrapper: what it passes the controller', () => {
  it('turns the four search flags on (decision 2A)', () => {
    renderPage()
    expect(seen.controller).toMatchObject({
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByFullName: true
    })
  })

  it('keeps what it did: the active tab, the page and the page size from the URL, and the fields it asks for', () => {
    renderPage({}, `${ROUTE}?enabled=inactive&page=3&pageSize=25`)
    expect(seen.controller.defaultUserActiveState).toBe(false)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
    expect(seen.controller.propsToFetch).toEqual(expect.arrayContaining(['orders_count', 'wallets', 'loyalty_level', 'enabled']))
  })

  it('active, page 1 and 10 per page by default', () => {
    renderPage()
    expect(seen.controller.defaultUserActiveState).toBe(true)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it.each(['7', '0', 'abc', '100', '-10'])('a ?pageSize=%s that is not 10, 25 or 50 falls back to 10', (size) => {
    renderPage({}, `${ROUTE}?page=2&pageSize=${size}`)
    expect(seen.controller.paginationSettings.pageSize).toBe(10)
  })

  it.each(['0', 'abc', '-2', '1.5'])('a ?page=%s that is not a page falls back to 1', (page) => {
    renderPage({}, `${ROUTE}?page=${page}&pageSize=25`)
    expect(seen.controller.paginationSettings.initialPage).toBe(1)
    expect(seen.controller.paginationSettings.pageSize).toBe(25)
  })

  it('without isUseQuery the URL is not read', () => {
    renderPage({}, `${ROUTE}?enabled=inactive&page=3&pageSize=25`, { isUseQuery: false })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })
})

const cleanupView = () => view.unmount()

describe('header', () => {
  it('draws the title with the count, Learn, Add customer (keeps data-tour) and Export CSV', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Customers' })).toHaveClass('odc-pagehead-title')
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('42 customers')
    expect(screen.getByRole('button', { name: /Learn/ })).toBeInTheDocument()
    const add = document.querySelector('[data-tour="tour_add"]')
    expect(add).toHaveTextContent('Add customer')
    expect(add).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('says «1 customer» for one', () => {
    renderPage({ paginationDetail: { total: 1 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('1 customer')
    expect(document.querySelector('.odc-pagehead-count')).not.toHaveTextContent('1 customers')
  })

  it('shows no count until the controller knows the total', () => {
    renderPage({ paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(document.querySelector('.odc-pagehead-count')).toBeNull()
  })

  it('the export gets what today\'s UsersExportCSV gets', () => {
    renderPage({ multiFilterValues: { name: 'Ana' }, selectedUserActiveState: false })
    expect(seen.exportCsv).toMatchObject({
      defaultUserTypesSelected: [3],
      disabledActiveStateCondition: false,
      userTypesSelected: [3],
      selectedUserActiveState: false,
      multiFilterValues: { name: 'Ana' }
    })
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanupView()
    infoShare.isCollapse = true
    renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    // the header root keeps its page class (the css and CustomersLiveFixes read it) on the page header itself
    expect(opener.closest('.odc-cpg-head')).toHaveClass('odc-pagehead')
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('the Add customer button opens the form in a sheet titled «Add customer»', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    const sheet = await screen.findByRole('dialog', { name: 'Add customer' })
    expect(within(sheet).getByTestId('add-form')).toBeInTheDocument()
    expect(seen.addForm.defaultUserTypesSelected).toEqual([3])
  })
})

describe('Active / Inactive tabs', () => {
  it('Active is the selected one by default and writes ?enabled=active once (as today)', () => {
    renderPage()
    expect(tabOf('Active')).toHaveAttribute('aria-selected', 'true')
    expect(tabOf('Inactive')).toHaveAttribute('aria-selected', 'false')
    expect(urlParams().enabled).toBe('active')
  })

  it('leaves a ?enabled= that is already there', () => {
    renderPage({ selectedUserActiveState: false }, `${ROUTE}?enabled=inactive`)
    expect(tabOf('Inactive')).toHaveAttribute('aria-selected', 'true')
    expect(urlParams().enabled).toBe('inactive')
  })

  it('choosing the other tab asks the controller once and writes ?enabled=', async () => {
    renderPage()
    await userEvent.click(tabOf('Inactive'))
    expect(ctl.props.handleChangeUserActiveState).toHaveBeenCalledTimes(1)
    expect(urlParams().enabled).toBe('inactive')
  })

  it('choosing the tab that is already selected does nothing (M-C15)', async () => {
    renderPage()
    await userEvent.click(tabOf('Active'))
    await userEvent.type(tabOf('Active'), '{Enter}')
    expect(ctl.props.handleChangeUserActiveState).not.toHaveBeenCalled()
    expect(urlParams().enabled).toBe('active')
  })

  it('the Inactive tab as the current one: its own tab does nothing, Active toggles', async () => {
    renderPage({ selectedUserActiveState: false }, `${ROUTE}?enabled=inactive`)
    await userEvent.click(tabOf('Inactive'))
    expect(ctl.props.handleChangeUserActiveState).not.toHaveBeenCalled()
    await userEvent.click(tabOf('Active'))
    expect(ctl.props.handleChangeUserActiveState).toHaveBeenCalledTimes(1)
    expect(urlParams().enabled).toBe('active')
  })
})

describe('filters', () => {
  it('gets the controller\'s values and its handlers', () => {
    renderPage({ searchValue: 'ana', orderFilterValue: 5, multiFilterValues: { name: 'x' } })
    expect(seen.filters).toMatchObject({ searchValue: 'ana', orderFilterValue: 5, multiFilterValues: { name: 'x' } })
    seen.filters.onSearch('olivia')
    expect(ctl.props.onSearch).toHaveBeenCalledWith('olivia')
    seen.filters.onOrderFilterChange(0)
    expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledWith(0)
    seen.filters.onMultiFilterChange({ name: 'y' })
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledWith({ name: 'y' })
  })

  it('gets the loyalty levels from K/UsersFilter', () => {
    renderPage()
    expect(seen.filters.loyaltyLevels).toEqual({ loading: false, error: null, levels: [{ id: 3, name: 'Gold' }] })
    ctl.loyalty = { loading: true, error: null, levels: [] }
    view.update({})
    expect(seen.filters.loyaltyLevels.loading).toBe(true)
  })

  it('«Clear filters» clears the search, the orders control and every filter at once, each with one call', () => {
    renderPage({ searchValue: 'ana', orderFilterValue: 5, multiFilterValues: { name: 'x' } })
    act(() => seen.filters.onClearAll())
    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledWith(null)
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledTimes(1)
    const cleared = ctl.props.handleChangeMultiFilterValues.mock.calls[0][0]
    // a COMPLETE object (B3): every key is there, none of them is a condition
    expect(cleared).toMatchObject({ name: null, email: null, loyaltyLevel: null, phoneVerified: null })
    expect(Object.keys(cleared).length).toBeGreaterThan(5)
  })

  it('the table\'s «Clear filters» is the same action', async () => {
    renderPage({ searchValue: 'ana' })
    await userEvent.click(screen.getByRole('button', { name: 'Table clear filters' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(ctl.props.handleChangeOrderFilterValue).toHaveBeenCalledWith(null)
    expect(ctl.props.handleChangeMultiFilterValues).toHaveBeenCalledTimes(1)
  })
})

describe('table', () => {
  it('gets the list, the state of the load and whether a filter narrows it', () => {
    renderPage({ searchValue: 'ana' })
    expect(seen.table.users).toEqual(USERS)
    expect(seen.table.loading).toBe(false)
    expect(seen.table.pageSize).toBe(10)
    expect(seen.table.hasFilters).toBe(true)
    expect(seen.table.activeUserId).toBeNull()
    view.update({ searchValue: '', usersList: { users: [], loading: true, error: null } })
    expect(seen.table.loading).toBe(true)
    expect(seen.table.hasFilters).toBe(false)
  })

  it('a failed load goes to the table (with Retry that asks the same page again)', async () => {
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

    // some of the page already selected (and one from another page): the header adds the missing ones and keeps the rest
    view.update({ selectedUsers: [2, 77] })
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([2, 77, 1, 3])

    // the whole page selected: the header removes this page's ids and keeps the other page's
    view.update({ selectedUsers: [1, 2, 3, 77] })
    await userEvent.click(screen.getByRole('button', { name: 'Select page' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenLastCalledWith([77])
    expect(seen.table.selection.selectedIds).toEqual([1, 2, 3, 77])
  })

  // owner decision 36 (batch AE): the header primary is the only «Add customer» on the page, with customers and with none
  it('has exactly one «Add customer» button, the header primary, with customers', () => {
    renderPage()
    const adds = screen.getAllByRole('button', { name: 'Add customer' })
    expect(adds).toHaveLength(1)
    expect(adds[0]).toBe(document.querySelector('[data-tour="tour_add"]'))
    expect(adds[0]).toHaveAttribute('data-variant', 'primary')
    expect(document.querySelector('.odc-cpg-foot').querySelector('button[data-variant="link"]')).toBeNull()
  })

  it('the one «Add customer» opens the add form', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add customer' }))
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('has exactly one «Add customer» button, the header primary, with no customers', () => {
    renderPage({ usersList: { users: [], loading: false, error: null } })
    expect(screen.getAllByRole('button', { name: 'Add customer' })).toHaveLength(1)
  })

  it('the table is not given a second way to add a customer', () => {
    renderPage()
    expect(seen.table.onAddCustomer).toBeUndefined()
  })
})

describe('selection bar', () => {
  it('is not there with nothing selected', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Actions for selected customers' })).toBeNull()
  })

  // redesign (n.º 14, D-55): the controller empties the selection on a page, filter or search change, so the bar has nothing «on other pages» to say
  it('asks the controller to empty the selection on a page, filter or search change (D-55)', () => {
    renderPage()
    expect(seen.controller.clearSelectionOnQueryChange).toBe(true)
  })

  it('counts the selection and says nothing about other pages', () => {
    renderPage({ selectedUsers: [1, 2, 3] })
    const bar = screen.getByRole('region', { name: 'Actions for selected customers' })
    expect(within(bar).getByRole('status')).toHaveTextContent(/^3 selected$/)
    expect(bar.querySelectorAll('.odc-figure').length).toBe(1)
    view.update({ selectedUsers: [1] })
    expect(within(screen.getByRole('region', { name: 'Actions for selected customers' })).getByRole('status')).toHaveTextContent(/^1 selected$/)
  })

  it('Clear selection empties it', async () => {
    renderPage({ selectedUsers: [1, 2] })
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(ctl.props.setSelectedUsers).toHaveBeenCalledWith([])
  })

  it('Delete goes through ConfirmAdmin with the count in its title and button, then calls the controller with the code', async () => {
    renderPage({ selectedUsers: [1, 2, 70] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(seen.confirmAdmin.open).toBe(true)
    expect(seen.confirmAdmin.confirmLabel).toBe('Delete 3 customers')
    expect(seen.confirmAdmin.title).toBe('Delete 3 customers?')
    expect(seen.confirmAdmin.description).toBe("This can't be undone.")
    expect(ctl.props.handleDeleteSeveralUsers).not.toHaveBeenCalled() // nothing is sent before the confirmation
    await userEvent.click(screen.getByRole('button', { name: 'Delete 3 customers' }))
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleDeleteSeveralUsers).toHaveBeenCalledWith('code-1')
    expect(seen.confirmAdmin.open).toBe(false)
  })

  it('names one customer in the singular', async () => {
    renderPage({ selectedUsers: [2] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(seen.confirmAdmin.confirmLabel).toBe('Delete 1 customer')
    expect(seen.confirmAdmin.title).toBe('Delete 1 customer?')
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
    expect(screen.getByRole('region', { name: 'Actions for selected customers' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('tells what the API refused, as a dialog', async () => {
    renderPage({ selectedUsers: [1] })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    view.update({ deleteUsersActionState: { loading: false, error: ['You can not delete this user'] } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("The customers weren't deleted")
    expect(dialog).toHaveTextContent('You can not delete this user')
  })

  it('an error that is not text still says something', async () => {
    renderPage({ selectedUsers: [1] })
    view.update({ deleteUsersActionState: { loading: false, error: { weird: true } } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent.trim().length).toBeGreaterThan('The customers weren\'t deleted'.length)
  })
})

describe('opening a customer', () => {
  it('a row opens the panel with that row, writes ?id= and marks the row active', async () => {
    renderPage()
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.getByText('Panel of customer 2')).toBeInTheDocument()
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
    expect(seen.panel.userId).toBe(2)
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeUserId).toBe(2)
    expect(seen.panel.section).toBe('overview')
    expect(seen.panel.wallet).toBe('cash')
    expect(seen.panel.customFieldsOpen).toBe(false)
  })

  it('the panel is told what it needs from the page', async () => {
    ctl.configs = { addon_cash_wallet_and_refunds: { value: '1' } }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(seen.panel.configs).toBe(ctl.configs)
    expect(typeof seen.panel.onToggleActive).toBe('function')
    expect(seen.panel.pendingIds).toEqual([])
    expect(seen.panel.expanded).toBe(false)
    expect(typeof seen.panel.renderWallet).toBe('function')
    expect(typeof seen.panel.profileProps.onDirtyChange).toBe('function')
  })

  it('the wallet section is drawn through renderWallet with the panel\'s wallet, and its dirty state is heard', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    expect(screen.getByTestId('wallet-section')).toHaveAttribute('data-wallet', 'cash')
    expect(seen.wallet.user).toMatchObject({ id: 1 })
    expect(seen.wallet.configs).toBe(ctl.configs)
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    expect(screen.getByTestId('wallet-section')).toHaveAttribute('data-wallet', 'points')
  })

  it('section and wallet go to the URL, and Custom fields is a dialog without an address', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To orders' }))
    expect(screen.getByTestId('panel-section')).toHaveTextContent('orders')
    expect(urlParams()).toMatchObject({ id: '1', section: 'orders' })
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    expect(urlParams()).toMatchObject({ id: '1', section: 'wallet', wallet: 'points' })
    await userEvent.click(screen.getByRole('button', { name: 'Custom fields' }))
    expect(seen.panel.customFieldsOpen).toBe(true)
    expect(urlParams()).toEqual(expect.not.objectContaining({ customFields: expect.anything() }))
  })

  it('opening another row starts it at the overview', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 3' }))
    expect(seen.panel.userId).toBe(3)
    expect(seen.panel.section).toBe('overview')
    expect(urlParams()).toEqual(expect.objectContaining({ id: '3' }))
    expect(urlParams().section).toBeUndefined()
    expect(urlParams().wallet).toBeUndefined()
  })

  it('closing removes id, section and wallet and keeps page, pageSize and enabled', async () => {
    renderPage({}, `${ROUTE}?enabled=active&page=1&pageSize=10`)
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    expect(urlParams()).toEqual({ enabled: 'active', page: '1', pageSize: '10' })
    expect(seen.table.activeUserId).toBeNull()
  })

  it('the panel can open as a page and is not expanded on the next customer', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(seen.panel.expanded).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(seen.panel.expanded).toBe(false)
  })

  it('the panel is named after the customer', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(document.querySelector('[aria-label="Name2 Lopez"]')).not.toBeNull()
  })

  it('closing the panel gives the focus back to the row', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    // the panel took the focus (as the split view does) and the opener is gone from the page's focus
    act(() => { document.body.focus() })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    // on the row (or on what the row holds: the split view gives it back to what had it when the panel opened)
    await waitFor(() => expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true))
  })

  it('closing a panel that was opened by ?id= (no opener) puts the focus on its row', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })
})

describe('?id= on load: decided once, when the first list arrives', () => {
  it('opens the row when the customer is on the page', () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(seen.panel.userId).toBe(2)
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
    expect(seen.table.activeUserId).toBe(2)
  })

  it('opens by id with no row when the customer is on another page (the panel loads it)', () => {
    renderPage({}, `${ROUTE}?id=500`)
    expect(seen.panel.userId).toBe(500)
    expect(seen.panel.user).toBeNull()
    expect(urlParams().id).toBe('500')
  })

  it('waits for the first list: nothing opens while it loads, then the row does', () => {
    renderPage({ usersList: { users: [], loading: true, error: null }, paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } }, `${ROUTE}?id=3`)
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    view.update({ usersList: { users: USERS, loading: false, error: null }, paginationDetail: { total: 3 } })
    expect(seen.panel.userId).toBe(3)
    expect(seen.panel.user).toMatchObject({ id: 3 })
  })

  it('waits through the empty state the controller starts with (not loading yet, nothing arrived)', () => {
    renderPage({ usersList: { users: [], loading: false, error: null }, paginationDetail: {}, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } }, `${ROUTE}?id=3`)
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    view.update({ usersList: { users: USERS, loading: false, error: null }, paginationDetail: { total: 3 } })
    expect(seen.panel.user).toMatchObject({ id: 3 })
  })

  it('still opens it when the list failed (the panel does not need the list)', () => {
    renderPage({ usersList: { users: [], loading: false, error: ['boom'] } }, `${ROUTE}?id=3`)
    expect(seen.panel.userId).toBe(3)
  })

  it('does not reopen it after it is closed, nor when the list reloads', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    view.update({ usersList: { users: USERS, loading: false, error: null } })
    expect(screen.queryByTestId('customer-panel')).toBeNull()
  })

  it('an id that is not a number opens nothing', () => {
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('customer-panel')).toBeNull()
  })

  it('the panel follows the list: the row it holds is the list\'s own one', () => {
    renderPage({}, `${ROUTE}?id=2`)
    view.update({ usersList: { users: [USERS[0], user(2, { enabled: false, name: 'Changed' }), USERS[2]], loading: false, error: null } })
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Changed', enabled: false })
  })

  it('a customer that left the list (it was switched off) keeps its panel', () => {
    renderPage({}, `${ROUTE}?id=2`)
    view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } })
    expect(screen.getByText('Panel of customer 2')).toBeInTheDocument()
    expect(seen.panel.user).toMatchObject({ id: 2, name: 'Name2' })
  })
})

describe('legacy links (analysis.md §8)', () => {
  it.each([
    ['?id=2&section=user_details&tab=saved_places', 'addresses', 'cash'],
    ['?id=2&section=user_details&tab=orders', 'orders', 'cash'],
    ['?id=2&section=user_details', 'profile', 'cash'],
    ['?id=2&section=cash_wallet&tab=history', 'wallet', 'cash'],
    ['?id=2&section=points_wallet', 'wallet', 'points']
  ])('%s opens the new section and rewrites the address', (search, section, wallet) => {
    renderPage({}, `${ROUTE}${search}`)
    expect(seen.panel.userId).toBe(2)
    expect(seen.panel.section).toBe(section)
    expect(seen.panel.wallet).toBe(wallet)
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams().section).toBe(section)
  })

  it('?section=metafields opens the Custom fields dialog and leaves ?id= only', () => {
    renderPage({}, `${ROUTE}?id=2&section=metafields`)
    expect(seen.panel.userId).toBe(2)
    expect(seen.panel.customFieldsOpen).toBe(true)
    expect(seen.panel.section).toBe('overview')
    expect(urlParams().id).toBe('2')
    expect(urlParams().section).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
  })

  it('the new links open as they are', () => {
    renderPage({}, `${ROUTE}?id=2&section=wallet&wallet=points`)
    expect(seen.panel.section).toBe('wallet')
    expect(seen.panel.wallet).toBe('points')
    expect(urlParams()).toMatchObject({ id: '2', section: 'wallet', wallet: 'points' })
    expect(urlParams().tab).toBeUndefined()
  })
})

describe('?add=1', () => {
  it('opens the add form once and takes itself out of the address', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
    expect(urlParams().add).toBeUndefined()
  })

  it('opening it closes the open customer, like today', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(screen.getByTestId('customer-panel')).toBeInTheDocument()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await screen.findByTestId('add-form')
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('opening a customer closes the form', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await screen.findByTestId('add-form')
    // the form is a modal sheet: a row is reached once it is closed, and the open from outside is what the table's callback does
    act(() => seen.table.onOpenUser(USERS[0]))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    expect(seen.panel.userId).toBe(1)
  })

  it('a new customer goes to the controller, and Close closes the sheet', async () => {
    renderPage()
    await userEvent.click(document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add succeeded' }))
    expect(ctl.props.handleSuccessAddUser).toHaveBeenCalledWith({ id: 99, level: 3 })
    await userEvent.click(screen.getByRole('button', { name: 'Close form' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
  })
})

describe('the status switch (one useCustomerActiveToggle, shared)', () => {
  it('deactivating from the table asks first, then calls the controller', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    expect(ctl.props.handleChangeActiveUser).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Deactivate Name2 Lopez?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false }))
  })

  it('renders the dialogs once and gives the table and the panel the same handler and pending list', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(seen.table.onToggleActive).toEqual(expect.any(Function))
    expect(seen.table.pendingIds).toBe(seen.panel.pendingIds)
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 1' }))
    expect(await screen.findAllByRole('alertdialog')).toHaveLength(1)
  })

  it('a failure tells the person (the hook\'s dialog) and the pending id goes away', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    expect(await screen.findByText('Nope')).toBeInTheDocument()
    expect(seen.table.pendingIds).toEqual([])
  })

  it('switching off a customer from the table puts the focus on the row that took its place', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        // the controller takes the row out of the Active list
        act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
        return { ok: true, error: null }
      })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })

  it('the open customer\'s switch reflects a successful toggle from the panel even when it is not in the list', async () => {
    renderPage({}, `${ROUTE}?id=500`)
    expect(screen.getByTestId('panel-switch')).toHaveTextContent('no row')
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 500, enabled: false }))
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 500, enabled: false }))
    // the controller appends what it was given to the list when the customer was not in it: the list is asked again
    await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 10))
  })

  // the panel and the reload follow the record the API returned (the controller's `user`), not what was asked
  it('the open customer\'s switch shows the enabled state the API returned, not the one that was asked', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { id: 500, enabled: true } })) }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 500, enabled: false }))
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 500, enabled: true }))
  })

  it('when the API keeps a listed customer in the tab\'s state, the focus stays on that row (it did not leave)', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)) // after the dialog has given the focus back
        document.activeElement?.blur() // the focus is nowhere in the list when the answer comes
        return { ok: true, error: null, user: { ...USERS[1], enabled: true } }
      })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 300)) // the focus settling runs on the next frames
    // the row (or the control in it the dialog gave the focus back to), never the one after it
    expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true)
  })

  it('when the API keeps a listed customer in the tab\'s state, the row did not leave: no reload', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(async () => ({ ok: true, error: null, user: { ...USERS[1], enabled: true } })) })
    await userEvent.click(screen.getByRole('button', { name: 'Switch off 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })

  // redesign UC-R2b (Q-06): this one pinned «no reload» for a panel toggle; the count in the header and the foot went stale the
  // same way as from the table, so a toggle that takes the row out of the list asks for the current page once, from either place
  it('a toggle from the panel of a customer that is in the list reloads the current page once (the row left)', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        // the controller takes the row out of the Active list
        act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
        return { ok: true, error: null }
      })
    }, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledTimes(1))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 10)
    await waitFor(() => expect(seen.panel.user).toMatchObject({ id: 2, enabled: false }))
  })

  // redesign UC-R2b (Q-06): the controller takes the row out of the list but does not discount the total, so the header count and
  // «Showing 1–10 of N» stay at N with 9 rows. After a toggle that took the row out, the current page is asked for once.
  describe('count after a toggle that takes the row out (Q-06)', () => {
    const removing = (ids = [1, 3]) => vi.fn(async () => {
      act(() => view.update({ usersList: { users: ids.map(id => USERS[id - 1]), loading: false, error: null } }))
      return { ok: true, error: null }
    })
    const confirmOff = async (id) => {
      await userEvent.click(screen.getByRole('button', { name: `Switch off ${id}` }))
      await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    }

    it('deactivating in Active asks for the current page once, with the page and the page size', async () => {
      renderPage({
        handleChangeActiveUser: removing(),
        paginationProps: { currentPage: 3, pageSize: 25, totalItems: 120, totalPages: 5, from: 51, to: 53 },
        paginationDetail: { total: 120, current_page: 3, total_pages: 5 }
      })
      await confirmOff(2)
      await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledTimes(1))
      expect(ctl.props.getUsers).toHaveBeenCalledWith(3, 25)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(ctl.props.getUsers).toHaveBeenCalledTimes(1)
    })

    it('activating in Inactive (the row leaves that list too) asks once', async () => {
      renderPage({
        selectedUserActiveState: false,
        usersList: { users: [user(1, { enabled: false }), user(2, { enabled: false }), user(3, { enabled: false })], loading: false, error: null },
        handleChangeActiveUser: vi.fn(async () => {
          act(() => view.update({ usersList: { users: [user(1, { enabled: false }), user(3, { enabled: false })], loading: false, error: null } }))
          return { ok: true, error: null }
        })
      })
      act(() => seen.table.onToggleActive(seen.table.users[1], true)) // activating is immediate
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: true }))
      await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledTimes(1))
      expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 10)
    })

    it('a failed toggle does not reload', async () => {
      renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] })) })
      await confirmOff(2)
      expect(await screen.findByText('Nope')).toBeInTheDocument()
      expect(ctl.props.getUsers).not.toHaveBeenCalled()
    })

    it('a toggle that leaves the row in its list (the state condition is off) does not reload', async () => {
      renderPage({ handleChangeActiveUser: removing() }, ROUTE, { disabledActiveStateCondition: true })
      await confirmOff(2)
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(ctl.props.getUsers).not.toHaveBeenCalled()
    })

    it('the last row of a page with more pages is the empty-page effect\'s: one request in all, not two', async () => {
      renderPage({
        usersList: { users: [USERS[1]], loading: false, error: null },
        handleChangeActiveUser: vi.fn(async () => {
          act(() => view.update({ usersList: { users: [], loading: false, error: null } }))
          return { ok: true, error: null }
        })
      })
      await confirmOff(2)
      await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
      await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalled())
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(ctl.props.getUsers).toHaveBeenCalledTimes(1)
    })

    it('the focus lands on the row that took its place once the page is back, not on the table while it loads', async () => {
      let finish
      renderPage({
        handleChangeActiveUser: removing(),
        // as the controller: the rows give way to the loading state, then the page comes back with the row that took the place
        getUsers: vi.fn(() => {
          act(() => view.update({ usersList: { users: [], loading: true, error: null } }))
          return new Promise(resolve => {
            finish = () => {
              act(() => view.update({ usersList: { users: [USERS[0], USERS[2], user(4)], loading: false, error: null } }))
              resolve()
            }
          })
        })
      })
      await confirmOff(2)
      await waitFor(() => expect(ctl.props.getUsers).toHaveBeenCalledTimes(1))
      await new Promise(resolve => setTimeout(resolve, 300)) // longer than the focus settling waits for a row
      expect(document.activeElement?.closest('.odc-table-scroll') === document.activeElement).toBe(false)
      await act(async () => { finish() })
      await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
    })
  })

  it('the switch of the panel keeps the focus after its confirmation (the list does not take it)', async () => {
    renderPage({
      handleChangeActiveUser: vi.fn(async () => {
        act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
        return { ok: true, error: null }
      })
    }, `${ROUTE}?id=2`)
    const panelSwitch = screen.getByRole('button', { name: 'Panel switch off' })
    await userEvent.click(panelSwitch)
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 150)) // the list's focus settling runs on the next frames
    expect(document.querySelector('[data-row-id]').closest('.odc-cpg-frame').contains(document.activeElement)).toBe(false)
    expect(screen.getByTestId('customer-panel').contains(document.activeElement)).toBe(true)
  })

  it('a failed toggle from the panel leaves the switch where it was', async () => {
    renderPage({ handleChangeActiveUser: vi.fn(() => Promise.resolve({ ok: false, error: null })) }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Panel switch off' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(ctl.props.handleChangeActiveUser).toHaveBeenCalled())
    expect(seen.panel.user).toBeNull()
    expect(ctl.props.getUsers).not.toHaveBeenCalled()
  })
})

describe('what the panel reports back', () => {
  it('a saved profile goes to the controller\'s handleSuccessUpdate (it takes the row out when the level is no longer a customer\'s)', async () => {
    renderPage({ selectedUsers: [2, 3] }, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Save as admin' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 2, level: 1 })
    // a customer that is no longer one leaves the selection too
    expect(ctl.props.setSelectedUsers).toHaveBeenCalled()
    const next = ctl.props.setSelectedUsers.mock.calls.at(-1)[0]
    expect(typeof next === 'function' ? next([2, 3]) : next).toEqual([3])
  })

  it('a saved name keeps the selection and updates the row the panel holds when the list has none', async () => {
    renderPage({ selectedUsers: [2] }, `${ROUTE}?id=500`)
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(ctl.props.handleSuccessUpdate).toHaveBeenCalledWith({ id: 500, name: 'Renamed' })
    expect(ctl.props.setSelectedUsers).not.toHaveBeenCalled()
  })

  it('a deleted customer goes to the controller, leaves the selection, closes the panel and the focus goes to the next row', async () => {
    renderPage({ selectedUsers: [2, 3] }, `${ROUTE}?id=2`)
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    expect(ctl.props.handleSuccessDeleteUser).toHaveBeenCalledWith({ id: 2, level: 3 })
    const next = ctl.props.setSelectedUsers.mock.calls.at(-1)[0]
    expect(typeof next === 'function' ? next([2, 3]) : next).toEqual([3])
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    // the controller takes the row out of the list; the row that took its place is the next one
    act(() => view.update({ usersList: { users: [USERS[0], USERS[2]], loading: false, error: null } }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
  })

  it('deleting the last row of the list goes to the one before it', async () => {
    renderPage({}, `${ROUTE}?id=3`)
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    act(() => view.update({ usersList: { users: [USERS[0], USERS[1]], loading: false, error: null } }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })

  it('deleting the only row puts the focus on the table\'s region', async () => {
    renderPage({ usersList: { users: [USERS[0]], loading: false, error: null } }, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'Delete from panel' }))
    act(() => view.update({ usersList: { users: [], loading: false, error: null } }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.odc-table-scroll')))
  })
})

describe('unsaved changes in the panel', () => {
  const dirtyThenOpen = async (next) => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    await userEvent.click(next())
  }

  it('opening another customer asks before dropping a draft; «Keep editing» stays', async () => {
    await dirtyThenOpen(() => screen.getByRole('button', { name: 'Open 2' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(seen.panel.userId).toBe(1)
    expect(urlParams().id).toBe('1')
  })

  it('«Discard» opens the other customer', async () => {
    await dirtyThenOpen(() => screen.getByRole('button', { name: 'Open 2' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(seen.panel.userId).toBe(2))
    expect(urlParams().id).toBe('2')
  })

  it('the same for «Add customer»', async () => {
    await dirtyThenOpen(() => document.querySelector('[data-tour="tour_add"]'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('a draft of the wallet counts too', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open 1' }))
    act(() => seen.wallet.onDirtyChange(true))
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
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

  it('after closing the panel the old draft does not follow the next customer', async () => {
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
  it('has the pagination with 10 / 25 / 50 and the range', () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 10, totalItems: 42, totalPages: 5, from: 11, to: 20 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 11–20 of 42')
    expect(within(nav).getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('the next page asks the controller for it', async () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 10 } })
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(2, 10)
  })

  it('a new page size asks for the page that keeps the first customer in view', async () => {
    renderPage({ paginationProps: { currentPage: 3, pageSize: 10, totalItems: 120, totalPages: 12, from: 21, to: 30 }, paginationDetail: { total: 120 } })
    await userEvent.click(screen.getByRole('button', { name: 'Items per page 10' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(ctl.props.getUsers).toHaveBeenCalledWith(1, 25)
  })

  it('follows the total the controller keeps when customers are deleted', () => {
    renderPage({ paginationDetail: { total: 11 }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 10 } })
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('11 customers')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('of 11')
  })

  it('has no pagination when the load failed or nothing is known yet', () => {
    renderPage({ usersList: { users: [], loading: false, error: ['x'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  // owner decision 36 (batch AE): the foot holds only the pagination; «Add customer» is the header primary
  it('holds only the pagination, with no «Add customer» of its own', () => {
    renderPage()
    const foot = document.querySelector('.odc-cpg-foot')
    expect(within(foot).queryByRole('button', { name: 'Add customer' })).toBeNull()
    expect(foot.children).toHaveLength(1)
    expect(within(foot).getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })

  it('writes ?page and ?pageSize after each load, as today', () => {
    renderPage({ paginationProps: { currentPage: 4, pageSize: 25, totalItems: 120, totalPages: 5, from: 76, to: 100 } })
    expect(urlParams()).toMatchObject({ page: '4', pageSize: '25' })
    view.update({ paginationProps: { currentPage: 5, pageSize: 25, totalItems: 120, totalPages: 5, from: 101, to: 120 } })
    expect(urlParams()).toMatchObject({ page: '5', pageSize: '25' })
  })

  it('does not touch the address without isUseQuery', () => {
    renderPage({}, ROUTE, { isUseQuery: false })
    expect(window.location.search).toBe('')
  })

  it('a page left empty by deleting asks again (the previous one when it was the last)', () => {
    renderPage({ usersList: { users: [], loading: false, error: null }, paginationProps: { currentPage: 5, pageSize: 10, totalItems: 42, totalPages: 5, from: 41, to: 42 }, paginationDetail: { total: 42 } })
    expect(ctl.props.getUsers).toHaveBeenCalledWith(4, 10)
  })
})

describe('the router moves while the page is open (⌘K)', () => {
  it('a navigation to another customer opens it', async () => {
    renderPage()
    expect(screen.queryByTestId('customer-panel')).toBeNull()
    act(() => historyRef.current.push(`${ROUTE}?id=3&section=cash_wallet`))
    await waitFor(() => expect(seen.panel?.userId).toBe(3))
    expect(seen.panel.section).toBe('wallet')
    expect(seen.panel.wallet).toBe('cash')
  })
})

// (1): ⌘K to another customer goes through the draft guard, as a click on another row does (R2-1 did
// the same on the owners' page)
describe('⌘K to another customer while the open one has unsaved changes', () => {
  // What the browser's router does: the address changes in the window and the router hears it
  const navigate = (search) => act(() => {
    window.history.replaceState(null, '', `${ROUTE}${search}`)
    historyRef.current.push(`${ROUTE}${search}`)
  })

  it('it asks first; «Keep editing» keeps the customer and gives the address back to its id, section and wallet', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    navigate('?id=3&section=orders')
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    // nothing was dropped yet: the open customer is still the one before
    expect(seen.panel.userId).toBe(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(seen.panel.userId).toBe(1)
    expect(seen.panel.section).toBe('wallet')
    expect(seen.panel.wallet).toBe('points')
    expect(urlParams()).toMatchObject({ id: '1', section: 'wallet', wallet: 'points' })
  })

  it('«Keep editing» from the overview leaves no section in the address', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    navigate('?id=3&section=cash_wallet')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(seen.panel.userId).toBe(1)
    expect(seen.panel.section).toBe('overview')
    expect(urlParams().id).toBe('1')
    expect(urlParams().section).toBeUndefined()
    expect(urlParams().wallet).toBeUndefined()
  })

  it('«Discard» opens the customer the link says, in the section it says', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'Profile dirty' }))
    navigate('?id=3&section=cash_wallet')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(seen.panel.userId).toBe(3))
    expect(seen.panel.section).toBe('wallet')
    expect(seen.panel.wallet).toBe('cash')
    expect(urlParams()).toMatchObject({ id: '3', section: 'wallet' })
    // the draft went with the old customer: the next switch asks nothing
    await userEvent.click(screen.getByRole('button', { name: 'Open 2' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.userId).toBe(2)
  })

  it('a draft of the wallet asks too', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    act(() => seen.wallet.onDirtyChange(true))
    navigate('?id=3')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
    expect(seen.panel.userId).toBe(1)
  })

  // review: the link's place must not reach the open customer before the guard. A new wallet remounts the wallet form (its key
  // is wallet + customer), and a form that leaves says it is clean, so the guard found no draft and the points draft was lost.
  it('behind the dialog the open customer keeps its section and wallet: the draft\'s form stays mounted', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    await userEvent.click(screen.getByRole('button', { name: 'To points' }))
    act(() => seen.wallet.onDirtyChange(true))
    navigate('?id=3&section=orders')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
    expect(seen.panel.userId).toBe(1)
    expect(seen.panel.section).toBe('wallet')
    expect(seen.panel.wallet).toBe('points')
    expect(screen.getByTestId('wallet-section')).toHaveAttribute('data-wallet', 'points')
  })

  it('without a draft it opens the customer at once, asking nothing', async () => {
    renderPage({}, `${ROUTE}?id=1`)
    navigate('?id=3&section=orders')
    await waitFor(() => expect(seen.panel.userId).toBe(3))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(seen.panel.section).toBe('orders')
  })
})
