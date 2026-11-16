/* eslint-disable import/first */
// redesign DG-B5 (decisions 1, 5, 6, 17 | M-DG1, M-DG6, M-DG8, M-DG14, M-DG15): the delivery groups page. The controller (K/DriversGroupsList)
// is played by `Host` (it keeps the selection the way the real one does: from the list of the render, not from the latest one), the table
// (B3), the panel (B4), the legacy add form are stubs that record what they receive: what is tested is how they are composed,
// what the page passes to each, and what the page owns (the URL, the open group, the guard, the selection bar, the dialogs and the focus).
// The Product wrappers (PageHeader, SearchField, SelectionBar, SplitView, RecordPanel, Pagination, InlineNotice, dialogs) are the real ones.
import React, { useState } from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ table: null, panel: null, addForm: null, learn: null }))
const ctl = vi.hoisted(() => ({ props: {}, session: { id: 1, level: 0 }, selected: [], selectedNow: [], panelDirty: false, pending: null }))
const DEFAULTS = vi.hoisted(() => ({ type: 0, enabled: true, autoassign_max_orders: 5, orders_group_use_maps_api: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: ctl.session }],
  useConfig: () => [{ configs: {} }]
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: (props) => {
    seen.learn = props
    return <div data-testid='learn' />
  }
}))

vi.mock('../GroupsTable', () => ({
  GroupsTable: (props) => {
    seen.table = props
    return (
      <div className='odc-table-scroll' role='region' aria-label='Groups table'>
        {props.groups.map(group => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={group.id} data-row-id={group.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpen(group)}>Open {group.id}</button>
            <button type='button' onClick={() => props.onToggleSelect(group.id)}>Select {group.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onToggleAll(props.groups.map(group => group.id))}>Select page</button>
        <button type='button' onClick={() => props.onClearSearch()}>Table clear search</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onAdd()}>Table add</button>
      </div>
    )
  }
}))

vi.mock('../GroupPanel', async () => {
  const React = await import('react')
  return {
    GroupPanel: (props) => {
      seen.panel = props
      const [asking, setAsking] = React.useState(false)
      // what RecordPanel does with `requestClose(proceed)`: ask when dirty, else go on
      React.useImperativeHandle(props.panelRef, () => ({
        requestClose: (proceed) => {
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
        <div data-testid='group-panel'>
          <span>Panel of group {props.driversGroupId}</span>
          <span data-testid='panel-section'>{String(props.section)}</span>
          <span data-testid='panel-expanded'>{String(props.expanded)}</span>
          <button type='button' onClick={() => props.panelRef.current.requestClose()}>Close panel</button>
          <button type='button' onClick={() => props.onSectionChange('schedule')}>To schedule</button>
          <button type='button' onClick={() => props.onToggleExpanded()}>Open as page</button>
          <button type='button' onClick={() => props.onClose()}>Closed by delete</button>
          {asking && (
            <button type='button' onClick={() => { setAsking(false); ctl.pending?.() }}>Discard in panel</button>
          )}
        </div>
      )
    }
  }
})

vi.mock('../../DriversGroupAddForm', async () => {
  const React = await import('react')
  return {
    DriversGroupAddForm: (props) => {
      seen.addForm = props
      // the controller starts with `{}` and fills the ~25 defaults in its mount effect
      React.useEffect(() => {
        props.onChangesStateChange?.({})
        props.onChangesStateChange?.({ ...DEFAULTS })
      }, [])
      return (
        <div data-testid='add-form'>
          <button type='button' onClick={() => props.onChangesStateChange?.({ ...DEFAULTS, name: 'Night shift' })}>Type a name</button>
          <button type='button' onClick={() => props.onChangesStateChange?.({ name: undefined, ...DEFAULTS })}>Back to the defaults</button>
          <button type='button' onClick={() => props.onClose()}>Cancel add</button>
          <button
            type='button'
            onClick={() => {
              props.onChangesStateChange?.({ ...DEFAULTS, name: 'Night shift' })
              props.setDriversGroupsState({ ...props.driversGroupsState, groups: [...props.driversGroupsState.groups, { id: 77 }] })
              // as the controller: a created group goes to `onCreated` when it is given, and `onClose` is the fallback, never both
              if (props.onCreated) props.onCreated({ id: 77, name: 'New' })
              else props.onClose()
            }}
          >
            Save add
          </button>
        </div>
      )
    }
  }
})

import { DriversGroupsListingUI } from '../DriversGroupsListing'

const group = (id, extra = {}) => ({ id, name: `Group ${id}`, enabled: true, type: 0, administrator_id: 100 + id, ...extra })
const GROUPS = [group(1), group(2), group(3)]

const baseCtl = (overrides = {}) => ({
  isUseQuery: true,
  driversGroupsState: { groups: GROUPS, loading: false, error: null },
  setDriversGroupsState: vi.fn(),
  driversManagersList: { managers: [{ id: 7 }], loading: false, error: null },
  businessesList: { businesses: [{ id: 3 }], loading: false, error: null },
  paymethodsList: { paymethods: [{ id: 4 }], loading: false, error: null },
  driversList: { drivers: [{ id: 5 }], loading: false, error: null },
  driversCompanyList: { companies: [{ id: 6 }], loading: false, error: null },
  actionState: { loading: false, error: null },
  handleUpdateDriversGroup: vi.fn(() => Promise.resolve({ ok: true })),
  handleDeleteDriversGroup: vi.fn(),
  reloadDriversGroups: vi.fn(),
  handleDeleteSelectedGroups: vi.fn(),
  handleAllSelectGroup: vi.fn(),
  actionDisabled: false,
  pagination: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5 },
  setPagination: vi.fn(),
  searchValue: '',
  onSearch: vi.fn(),
  searchBusinesses: vi.fn(),
  handleChangeBusinessPage: vi.fn(),
  handleChangeBusinessPageSize: vi.fn(),
  businessesPaginationProps: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
  ...overrides
})

// The controller keeps the selection like K/DriversGroupsList: `handleSelectGroup` builds the next list from the list of ITS render
const Host = () => {
  const [selected, setSelected] = useState(ctl.selected)
  ctl.selectedNow = selected
  const handleSelectGroup = (id) => {
    setSelected(selected.includes(id) ? selected.filter(other => other !== id) : [...selected, id])
  }
  return <DriversGroupsListingUI {...ctl.props} selectedGroupList={selected} handleSelectGroup={handleSelectGroup} />
}

const ROUTE = '/delivery/drivers-groups'
let view
const renderPage = (ctlOverrides = {}, route = ROUTE, state) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const entry = state ? { pathname: route.split('?')[0], search: route.includes('?') ? `?${route.split('?')[1]}` : '', state } : route
  const utils = renderWithProviders(<Host />, { initialEntries: [entry] })
  view = {
    ...utils,
    // the controller answers with new props (a new list, a new state)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(<Host />)
    }
  }
  return view
}

const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))
const click = (name) => userEvent.click(screen.getByRole('button', { name }))

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
  window.localStorage.clear()
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  ctl.session = { id: 1, level: 0 }
  ctl.selected = []
  ctl.selectedNow = []
  ctl.panelDirty = false
  ctl.pending = null
  Object.keys(seen).forEach(key => { seen[key] = null })
})

afterEach(() => {
  cleanup()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('composition', () => {
  it('draws the header with the count, Learn, the search, the table and the pagination; no panel yet', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Delivery groups/ })).toBeInTheDocument()
    expect(screen.getByText('42 groups')).toBeInTheDocument()
    expect(screen.getByTestId('learn')).toBeInTheDocument()
    expect(seen.learn.learnOptions).toBeDefined()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Groups table' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–3 of 42')
    expect(screen.queryByTestId('group-panel')).toBeNull()
  })

  it('keeps main\'s tour anchor on «Add driver group» and has no tutorial button (showTour stays false)', () => {
    renderPage()
    expect(document.querySelector('[data-tour="tour_add_group"]')).toHaveTextContent('Add driver group')
    expect(screen.queryByRole('button', { name: 'Start tutorial' })).toBeNull()
  })

  it('«Add driver group» is really disabled with actionDisabled', () => {
    renderPage({ actionDisabled: true })
    expect(document.querySelector('[data-tour="tour_add_group"]')).toBeDisabled()
  })

  it('gives the table the list, the state of the load, the selection and what the host decides', () => {
    ctl.selected = [2]
    renderPage()
    expect(seen.table.groups).toBe(GROUPS)
    expect(seen.table).toMatchObject({ loading: false, error: null, searchValue: '', pageSize: 10, activeId: null, actionDisabled: false })
    expect(seen.table.selectedIds).toEqual([2])
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    infoShare.isCollapse = true
    view.update({})
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    // the page keeps its class on the page header itself (drivers-groups-page.css scopes the Learn rules by it)
    expect(opener.closest('.odc-dgp-head')).toHaveClass('odc-pagehead')
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('has no pagination when the load failed or nothing is known yet', () => {
    renderPage({ driversGroupsState: { groups: [], loading: false, error: ['boom'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(seen.table.error).toEqual(['boom'])
    view.update({ driversGroupsState: { groups: [], loading: false, error: null }, pagination: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('the table\'s states call the controller: Retry reloads the page, Clear search empties the search, the add link adds', async () => {
    const { reloadDriversGroups, onSearch } = baseCtl()
    renderPage({ reloadDriversGroups, onSearch, searchValue: 'night' })
    await click('Table retry')
    expect(reloadDriversGroups).toHaveBeenCalledTimes(1)
    await click('Table clear search')
    expect(onSearch).toHaveBeenCalledWith('')
    await click('Table add')
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('the switch of a row saves { enabled } through the controller and returns its answer to the switch', async () => {
    const answer = { ok: false, error: ['no'] }
    const handleUpdateDriversGroup = vi.fn(() => Promise.resolve(answer))
    renderPage({ handleUpdateDriversGroup })
    await expect(seen.table.onToggleEnabled(GROUPS[1], false)).resolves.toBe(answer)
    expect(handleUpdateDriversGroup).toHaveBeenCalledWith(2, { enabled: false })
  })

  // redesign D-5 (owner, 2026-10-19): the page renders the ONE dialog that asks before a row switch turns a group off
  it('hands the table a confirmation for disabling: «Disable _name_?», the consequence, «Disable group», the focus on Cancel', async () => {
    const handleUpdateDriversGroup = vi.fn(() => Promise.resolve({ ok: true }))
    renderPage({ handleUpdateDriversGroup })
    let answer
    act(() => { answer = seen.table.onConfirmDisable(GROUPS[1]) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable Group 2?' })
    expect(dialog).toHaveTextContent('New orders are no longer assigned through this group until you enable it again.')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disable group' }))
    await expect(answer).resolves.toBe(true)
    expect(handleUpdateDriversGroup).not.toHaveBeenCalled() // the table saves after the yes, through onToggleEnabled
  })

  it('Cancel answers no and writes nothing', async () => {
    const handleUpdateDriversGroup = vi.fn(() => Promise.resolve({ ok: true }))
    renderPage({ handleUpdateDriversGroup })
    let answer
    act(() => { answer = seen.table.onConfirmDisable(GROUPS[0]) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable Group 1?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await expect(answer).resolves.toBe(false)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleUpdateDriversGroup).not.toHaveBeenCalled()
  })
})

describe('count', () => {
  it('follows the groups that leave or join the page after a load (a delete, an add), not only the last answer of the API', () => {
    renderPage()
    expect(screen.getByText('42 groups')).toBeInTheDocument()
    view.update({ driversGroupsState: { groups: GROUPS.slice(1), loading: false, error: null } })
    expect(screen.getByText('41 groups')).toBeInTheDocument()
    view.update({ driversGroupsState: { groups: [...GROUPS, group(4)], loading: false, error: null } })
    expect(screen.getByText('43 groups')).toBeInTheDocument()
  })

  it('says «1 group» for one', () => {
    renderPage({ pagination: { currentPage: 1, pageSize: 10, totalItems: 1, totalPages: 1 }, driversGroupsState: { groups: [GROUPS[0]], loading: false, error: null } })
    expect(screen.getByText('1 group')).toBeInTheDocument()
  })
})

describe('search', () => {
  it('sends the text after a wait, and at once on Enter or on clear', async () => {
    const onSearch = vi.fn()
    renderPage({ onSearch })
    const box = screen.getByRole('searchbox', { name: 'Search' })
    await userEvent.type(box, 'ni{Enter}')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenLastCalledWith('ni')
    await userEvent.type(box, 'ght')
    expect(onSearch).toHaveBeenCalledTimes(1) // waiting
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith('night'), { timeout: 2000 })
  })

  it('clearing the box sends the empty search at once', async () => {
    const onSearch = vi.fn()
    renderPage({ onSearch, searchValue: 'night' }) // what the controller holds
    await click('Clear search')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenLastCalledWith('')
  })

  it('shows a search the page did not type (the controller\'s value)', () => {
    renderPage({ searchValue: 'night' })
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('night')
  })
})

describe('pagination and the address', () => {
  it('writes ?page and ?pageSize once the controller knows the pages (isUseQuery), as the list did', () => {
    renderPage({ pagination: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' })
  })

  it('does not write them without isUseQuery or before the pages are known', () => {
    renderPage({ isUseQuery: false })
    expect(urlParams().page).toBeUndefined()
    view.update({ isUseQuery: true, pagination: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(urlParams().page).toBeUndefined()
  })

  it('Next asks the controller for the next page through setPagination', async () => {
    const setPagination = vi.fn()
    renderPage({ setPagination })
    await click('Next page')
    expect(setPagination).toHaveBeenCalledWith({ currentPage: 2, pageSize: 10, totalItems: 42, totalPages: 5 })
  })

  it('a new page size asks for it together with the page the foot keeps in view', async () => {
    const setPagination = vi.fn()
    renderPage({ setPagination })
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(setPagination).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 25, currentPage: 1 }))
  })
})

describe('the open group: the address and the panel', () => {
  it('?id= opens the panel on that group (the panel loads it), at the section of ?tab=', () => {
    renderPage({}, `${ROUTE}?id=2&tab=schedule`)
    expect(screen.getByText('Panel of group 2')).toBeInTheDocument()
    expect(seen.panel.curDriversGroup).toBeNull()
    expect(seen.panel.section).toBe('schedule')
    expect(seen.table.activeId).toBe(2)
  })

  it('an id that is not a number opens nothing', () => {
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('group-panel')).toBeNull()
  })

  // redesign DG-R1 (R1-01): the row is what the panel shows at once; the panel's controller asks for the detail once (`refreshOnOpen`,
  // tested in GroupPanel and in K/DriversGroupDetails), so the page itself makes no request for the group
  it('a row opens the panel with its group (shown at once; the panel asks for the detail once, not the page) and writes ?id=', async () => {
    renderPage()
    await click('Open 2')
    expect(screen.getByText('Panel of group 2')).toBeInTheDocument()
    expect(seen.panel.curDriversGroup).toBe(GROUPS[1])
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeId).toBe(2)
  })

  it('gives the panel what main gave D/DriversGroupDetails, with the panel\'s own props', async () => {
    renderPage()
    await click('Open 1')
    expect(seen.panel).toMatchObject({
      driversGroupsState: ctl.props.driversGroupsState,
      setDriversGroupsState: ctl.props.setDriversGroupsState,
      driversGroupId: 1,
      driversManagers: [{ id: 7 }],
      businesses: [{ id: 3 }],
      businessesLoading: false,
      paymethods: [{ id: 4 }],
      drivers: [{ id: 5 }],
      companies: [{ id: 6 }],
      handleUpdateDriversGroup: ctl.props.handleUpdateDriversGroup,
      searchBusinesses: ctl.props.searchBusinesses,
      handleChangeBusinessPage: ctl.props.handleChangeBusinessPage,
      handleChangeBusinessPageSize: ctl.props.handleChangeBusinessPageSize,
      businessesPaginationProps: ctl.props.businessesPaginationProps,
      actionDisabled: false
    })
    expect(seen.panel.panelRef).toBeDefined()
    expect(typeof seen.panel.onClose).toBe('function')
    expect(typeof seen.panel.onSectionChange).toBe('function')
    expect(seen.panel.reloadDriversGroups).toBe(ctl.props.reloadDriversGroups) // the panel's delete re-fetches the list
  })

  it('a section change writes ?tab= and a group that is opened next starts at General again', async () => {
    renderPage()
    await click('Open 1')
    await click('To schedule')
    expect(urlParams().tab).toBe('schedule')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    await click('Open 3')
    expect(urlParams()).toMatchObject({ id: '3' })
    expect(urlParams().tab).toBeUndefined()
    expect(screen.getByTestId('panel-section')).toHaveTextContent('undefined')
  })

  it('opening another group also drops ?config= (a sub-panel of the logistics section of the other group)', async () => {
    renderPage({}, `${ROUTE}?id=1&tab=advanced_logistics&config=autoassign`)
    await click('Open 2')
    expect(urlParams()).toMatchObject({ id: '2' })
    expect(urlParams().config).toBeUndefined()
  })

  it('closing removes id, tab and config from the address (M-DG14) and the panel goes away', async () => {
    renderPage({ pagination: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } }, `${ROUTE}?id=2&tab=advanced_logistics&config=autoassign&page=2&pageSize=25`)
    await click('Close panel')
    expect(screen.queryByTestId('group-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams().config).toBeUndefined()
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' }) // what is not the panel's stays
    expect(seen.table.activeId).toBeNull()
  })

  it('«Open as page» is the panel\'s to ask and the page keeps the state; closing resets it', async () => {
    renderPage()
    await click('Open 1')
    await click('Open as page')
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('true')
    await click('Close panel')
    await click('Open 1')
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false')
  })

  it('a panel closed after a delete (its row is gone) leaves the focus on the table, not on the page', async () => {
    renderPage()
    await click('Open 2')
    view.update({ driversGroupsState: { groups: GROUPS.filter(item => item.id !== 2), loading: false, error: null } })
    await click('Closed by delete')
    await waitFor(() => expect(screen.getByRole('region', { name: 'Groups table' })).toHaveFocus())
  })

  it('closing gives the focus back to the row that was open', async () => {
    renderPage({}, `${ROUTE}?id=3`) // opened by the address: nothing opened it, so nothing gives the focus back by itself
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="3"]')).toHaveFocus())
  })

  // F1: SplitView gave the focus back to the row that opened the panel first (1), not to the open group (3)
  it('open one group, move to another, close: the focus goes to the row of the second, not of the first', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 3')
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="3"]')).toHaveFocus())
    expect(document.querySelector('[data-row-id="1"]')).not.toHaveFocus()
  })
})

describe('the guard: another group with the panel dirty (decision 17)', () => {
  it('a clean panel lets another group open at once', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 2')
    expect(screen.getByText('Panel of group 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })

  it('a dirty panel asks first: the group does not change nor does the address until the question is answered', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await click('Open 2')
    expect(screen.getByText('Panel of group 1')).toBeInTheDocument()
    expect(urlParams().id).toBe('1')
    await click('Discard in panel')
    expect(screen.getByText('Panel of group 2')).toBeInTheDocument()
    expect(urlParams().id).toBe('2')
  })

  it('the same row again does not ask', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await click('Open 1')
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })

  it('«Add driver group» asks too when a group is open and dirty', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await userEvent.click(document.querySelector('[data-tour="tour_add_group"]'))
    expect(screen.queryByTestId('add-form')).toBeNull()
    await click('Discard in panel')
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
    expect(screen.queryByTestId('group-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })
})

describe('the add panel (decision 1; M-DG15)', () => {
  const openAdd = async () => {
    await userEvent.click(document.querySelector('[data-tour="tour_add_group"]'))
    return screen.findByTestId('add-form')
  }

  it('«Add driver group» opens a panel «Add new driver group» with the add form, the list stays', async () => {
    renderPage()
    await openAdd()
    expect(screen.getByRole('heading', { name: 'Add new driver group' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Groups table' })).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
  })

  it('gives the form the props main gave it (D/DriversGroupsListing:237-256)', async () => {
    renderPage()
    await openAdd()
    expect(seen.addForm).toMatchObject({
      driversGroupsState: ctl.props.driversGroupsState,
      curDriversGroup: null,
      driversManagers: [{ id: 7 }],
      businesses: [{ id: 3 }],
      businessesLoading: false,
      paymethods: [{ id: 4 }],
      drivers: [{ id: 5 }],
      companies: [{ id: 6 }],
      actionDisabled: false,
      searchBusinesses: ctl.props.searchBusinesses,
      handleChangeBusinessPage: ctl.props.handleChangeBusinessPage,
      handleChangeBusinessPageSize: ctl.props.handleChangeBusinessPageSize,
      businessesPaginationProps: ctl.props.businessesPaginationProps
    })
    expect(seen.addForm.driversGroupId).toBeUndefined()
    expect(typeof seen.addForm.onClose).toBe('function')
    expect(typeof seen.addForm.setDriversGroupsState).toBe('function')
    expect(seen.addForm.reloadDriversGroups).toBe(ctl.props.reloadDriversGroups) // a saved add re-fetches the list
  })

  it('an untouched form is not dirty: Cancel closes without asking, even though the controller started with its defaults', async () => {
    renderPage()
    await openAdd()
    await click('Cancel add')
    expect(screen.queryByTestId('add-form')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Discard your changes?' })).toBeNull()
  })

  it('a changed form asks on Cancel, «Keep editing» stays and «Discard» closes', async () => {
    renderPage()
    await openAdd()
    await click('Type a name')
    await click('Cancel add')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('add-form')).toBeInTheDocument()
    await click('Cancel add')
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
  })

  it('the close button of the panel asks too when the form changed, and not when it did not', async () => {
    renderPage()
    await openAdd()
    await click('Close')
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    await openAdd()
    await click('Type a name')
    await click('Close')
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(screen.getByTestId('add-form')).toBeInTheDocument()
  })

  it('a change put back to the defaults is not a change: dirty means «differs from the initial values»', async () => {
    renderPage()
    await openAdd()
    await click('Type a name')
    await click('Back to the defaults')
    await click('Cancel add')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('add-form')).toBeNull()
  })

  it('saving closes the panel without asking, whatever was typed', async () => {
    renderPage()
    await openAdd()
    await click('Save add')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('add-form')).toBeNull()
    // the controller was told about the new group, as main\'s form did through the same setter
    expect(ctl.props.setDriversGroupsState).toHaveBeenCalledWith(expect.objectContaining({ groups: expect.arrayContaining([{ id: 77 }]) }))
  })

  // (row 27, drivers-groups P-10, D-39 (a)): a created group opens its record
  it('after saving, the new group opens at General with its ?id=, and the add panel closes without the leave question', async () => {
    renderPage()
    await openAdd()
    await click('Type a name')
    await click('Save add')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('add-form')).toBeNull()
    expect(await screen.findByText('Panel of group 77')).toBeInTheDocument()
    expect(urlParams().id).toBe('77')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('undefined')
    // review H1: the record loads the group by id (as with ?id= on arrival), never from the POST answer, which may lack the
    // relations the record reads (business, drivers) and broke the page
    expect(seen.panel.curDriversGroup).toBeNull()
    expect(typeof seen.addForm.onCreated).toBe('function')
  })

  it('a group that is opened with the add form dirty asks first, and the add form goes when it is discarded', async () => {
    renderPage()
    await openAdd()
    await click('Type a name')
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(screen.queryByText('Panel of group 2')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByText('Panel of group 2')).toBeInTheDocument()
    expect(screen.queryByTestId('add-form')).toBeNull()
  })

  it('the form is the add form again each time (a new one has its defaults and no leftovers)', async () => {
    renderPage()
    await openAdd()
    await click('Type a name')
    await click('Cancel add')
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByTestId('add-form')).toBeNull())
    await openAdd()
    await click('Cancel add')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('?add=1 (⌘K) opens it once, like the button, and takes the param off the address', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
    expect(urlParams().add).toBeUndefined()
  })

  it('?add=1 waits while the user may not act, then opens (M-DG8: the same condition as the button)', async () => {
    renderPage({ actionDisabled: true }, `${ROUTE}?add=1`)
    expect(screen.queryByTestId('add-form')).toBeNull()
    view.update({ actionDisabled: false })
    expect(await screen.findByTestId('add-form')).toBeInTheDocument()
  })

  it('closing the add panel gives the focus back to «Add driver group» when nothing else has it', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await screen.findByTestId('add-form')
    await click('Cancel add')
    await waitFor(() => expect(document.querySelector('[data-tour="tour_add_group"]')).toHaveFocus())
  })
})

describe('the selection and the bulk delete (decision 6)', () => {
  it('has no bar without a selection', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Actions for selected groups' })).toBeNull()
  })

  it('says how many are selected and how many of them are on other pages', () => {
    ctl.selected = [1, 99]
    renderPage()
    const bar = screen.getByRole('region', { name: 'Actions for selected groups' })
    expect(bar).toHaveTextContent('2 selected · 1 on another page')
    expect(bar.querySelectorAll('.odc-figure')).toHaveLength(2)
    cleanup()
    ctl.selected = [1, 2, 98, 99]
    renderPage()
    expect(screen.getByRole('region', { name: 'Actions for selected groups' })).toHaveTextContent('4 selected · 2 on other pages')
  })

  it('says nothing about other pages when the whole selection is on this one', () => {
    ctl.selected = [1, 2]
    renderPage()
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('2 selected')
  })

  it('a row\'s box toggles that group', async () => {
    renderPage()
    await click('Select 2')
    expect(ctl.selectedNow).toEqual([2])
    await click('Select 2')
    expect(ctl.selectedNow).toEqual([])
  })

  it('the header box adds the groups of the page, keeps the ones from other pages and, when all are in, takes only the page off', async () => {
    ctl.selected = [99, 2]
    renderPage()
    await click('Select page')
    await waitFor(() => expect(ctl.selectedNow.slice().sort()).toEqual([1, 2, 3, 99]))
    await click('Select page')
    await waitFor(() => expect(ctl.selectedNow).toEqual([99]))
  })

  it('«Clear selection» empties it, the ones of other pages included', async () => {
    ctl.selected = [1, 99]
    renderPage()
    await click('Clear selection')
    await waitFor(() => expect(ctl.selectedNow).toEqual([]))
    expect(screen.queryByRole('region', { name: 'Actions for selected groups' })).toBeNull()
  })

  it('Delete asks «Delete 2 delivery groups?» with the consequence, the focus on Cancel; nothing is deleted until it is confirmed', async () => {
    ctl.selected = [1, 2]
    const handleDeleteSelectedGroups = vi.fn()
    renderPage({ handleDeleteSelectedGroups })
    await userEvent.click(within(screen.getByRole('region', { name: 'Actions for selected groups' })).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 delivery groups?' })
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(handleDeleteSelectedGroups).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete groups' }))
    expect(handleDeleteSelectedGroups).toHaveBeenCalledTimes(1)
  })

  it('Cancel deletes nothing and keeps the selection', async () => {
    ctl.selected = [1]
    const handleDeleteSelectedGroups = vi.fn()
    renderPage({ handleDeleteSelectedGroups })
    await userEvent.click(within(screen.getByRole('region', { name: 'Actions for selected groups' })).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 1 delivery group?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleDeleteSelectedGroups).not.toHaveBeenCalled()
    expect(ctl.selectedNow).toEqual([1])
  })

  it('Delete is really disabled with actionDisabled (M-DG8)', () => {
    ctl.selected = [1]
    renderPage({ actionDisabled: true })
    expect(within(screen.getByRole('region', { name: 'Actions for selected groups' })).getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})

describe('errors of the list controller (as main\'s Alert «Ordering»)', () => {
  it('an error of the controller opens an alert with its messages', async () => {
    renderPage()
    view.update({ actionState: { loading: false, error: ['The group has orders.'] } })
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('The group has orders.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('what a switch already said (it failed under its own control) is not said twice', async () => {
    const error = ['Nope.']
    const handleUpdateDriversGroup = vi.fn(() => Promise.resolve({ ok: false, error }))
    renderPage({ handleUpdateDriversGroup })
    await act(async () => { await seen.table.onToggleEnabled(GROUPS[0], false) })
    view.update({ actionState: { loading: false, error } })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // another error is not that one
    view.update({ actionState: { loading: false, error: ['Other.'] } })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Other.')
  })
})

describe('level 5 without a group to administer (M-DG8)', () => {
  const NOTICE = 'You can edit the groups you manage. Ask an admin to make you the manager of a group.'
  const level5 = (overrides = {}) => {
    ctl.session = { id: 9, level: 5 }
    return renderPage({ actionDisabled: true, ...overrides })
  }

  it('says why adding, deleting and the switches are off, once the list is in', () => {
    level5()
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
    expect(document.querySelector('[data-tour="tour_add_group"]')).toBeDisabled()
    expect(seen.table.actionDisabled).toBe(true)
  })

  it('says nothing while the list loads, when it failed, or before the controller knows the total', () => {
    level5({ driversGroupsState: { groups: [], loading: true, error: null } })
    expect(screen.queryByText(NOTICE)).toBeNull()
    cleanup()
    level5({ driversGroupsState: { groups: [], loading: false, error: ['boom'] } })
    expect(screen.queryByText(NOTICE)).toBeNull()
    cleanup()
    level5({ pagination: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it('says nothing when the session administers one of the groups (the answer of the controller is on its way)', () => {
    level5({ driversGroupsState: { groups: [group(1, { administrator_id: 9 })], loading: false, error: null } })
    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it('says nothing to other levels, or when the actions are on', () => {
    ctl.session = { id: 1, level: 0 }
    renderPage({ actionDisabled: true })
    expect(screen.queryByText(NOTICE)).toBeNull()
    cleanup()
    ctl.session = { id: 9, level: 5 }
    renderPage({ actionDisabled: false })
    expect(screen.queryByText(NOTICE)).toBeNull()
  })
})
