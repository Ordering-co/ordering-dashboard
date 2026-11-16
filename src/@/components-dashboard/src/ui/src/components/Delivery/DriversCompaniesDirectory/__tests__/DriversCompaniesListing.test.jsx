/* eslint-disable import/first */
// redesign DC-B5 (decisions 1, 2, 5, 17 | M-DC5, M-DC6, M-DC8, M-DC11, M-DC19, M-DC21): the delivery companies page. The controller
// (K/DriversCompaniesList) is played by `Host` (it keeps the selection the way the real one does, and `handleAllSelectCompany` takes
// every company or none, as components/DriversCompaniesList/index.js:132-139); the table (B2), the panel (B3) and the add panel (B4)
// are stubs that record what they receive: what is tested is how they are composed, what the page passes to each, and what the page
// owns (the search, the page, the URL, the open company, the guard, the selection bar, the dialogs and the focus). The Product
// wrappers (PageHeader, SearchField, SelectionBar, SplitView, Pagination, dialogs) are the real ones.
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ table: null, panel: null, addPanel: null, controller: null }))
const ctl = vi.hoisted(() => ({
  props: {},
  selected: [],
  selectedNow: [],
  setSelected: null,
  allSelect: null,
  panelDirty: false,
  addDirty: false,
  pending: null
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  DriversCompaniesList: (props) => {
    seen.controller = props
    return <div data-testid='controller' />
  }
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../CompaniesTable', () => ({
  CompaniesTable: (props) => {
    seen.table = props
    return (
      <div className='odc-table-scroll' role='region' aria-label='Companies table'>
        {props.companies.map(company => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={company.id} data-row-id={company.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpen(company)}>Open {company.id}</button>
            <button type='button' onClick={() => props.onToggleSelect(company.id)}>Select {company.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onToggleAll(props.companies.map(company => company.id))}>Select page</button>
        <button type='button' onClick={() => props.onClearSearch()}>Table clear search</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onAdd()}>Table add</button>
      </div>
    )
  }
}))

vi.mock('../CompanyPanel', async () => {
  const React = await import('react')
  return {
    CompanyPanel: (props) => {
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
        <div data-testid='company-panel'>
          <span>Panel of company {props.driversCompanyId}</span>
          <span data-testid='panel-section'>{String(props.section)}</span>
          <span data-testid='panel-expanded'>{String(props.expanded)}</span>
          <button type='button' onClick={() => props.panelRef.current.requestClose()}>Close panel</button>
          <button type='button' onClick={() => props.onSectionChange('schedule')}>To schedule</button>
          <button type='button' onClick={() => props.onToggleExpanded()}>Open as page</button>
          <button type='button' onClick={() => props.onDeleted(props.driversCompanyId)}>Deleted from panel</button>
          <button type='button' onClick={() => props.onToggleEnabled(props.driversCompany ?? { id: props.driversCompanyId }, false)}>Panel switch off</button>
          {asking && (
            <button type='button' onClick={() => { setAsking(false); ctl.pending?.() }}>Discard in panel</button>
          )}
        </div>
      )
    }
  }
})

vi.mock('../CompanyAddPanel', async () => {
  const React = await import('react')
  return {
    CompanyAddPanel: (props) => {
      seen.addPanel = props
      const [asking, setAsking] = React.useState(false)
      React.useImperativeHandle(props.panelRef, () => ({
        requestClose: (proceed) => {
          const next = typeof proceed === 'function' ? proceed : props.onClose
          if (ctl.addDirty) {
            ctl.pending = next
            setAsking(true)
          } else {
            next?.()
          }
        }
      }), [props.onClose])
      return (
        <div data-testid='add-panel'>
          <button type='button' onClick={() => props.onClose()}>Cancel add</button>
          <button type='button' onClick={() => props.onAdded()}>Saved add</button>
          {asking && (
            <button type='button' onClick={() => { setAsking(false); ctl.pending?.() }}>Discard in add</button>
          )}
        </div>
      )
    }
  }
})

import { DriversCompaniesListingUI } from '../DriversCompaniesListing'
import { DriversCompaniesListing } from '../../DriversCompaniesListing'

const NAMES = [
  'Fast Couriers', 'Swift Riders', 'Metro Dispatch', 'Harbor Express', 'Green Wheels', 'Night Owl Delivery',
  'Blue Line Cargo', 'Sunrise Runners', 'Alpha Movers', 'Delta Drivers', 'Echo Express', 'Zeta Couriers'
]
const company = (id, extra = {}) => ({ id, name: NAMES[id - 1], enabled: true, priority: 0, timezone: 'America/New_York', limit: 5, ...extra })
// 12 companies: 10 per page leaves two on page 2. Company 4 is an integration of the system (a delivery service in Connect)
const COMPANIES = Array.from({ length: 12 }, (_, index) => company(index + 1, index === 3 ? { owner_type: 'system' } : {}))

const baseCtl = (overrides = {}) => ({
  isUseQuery: true,
  driversCompaniesState: { companies: COMPANIES, loading: false, error: null },
  setDriversCompaniesState: vi.fn(),
  actionState: { loading: false, error: null },
  handleUpdateDriversCompany: vi.fn(() => Promise.resolve({ ok: true })),
  handleDeleteSelectedCompanies: vi.fn(),
  reloadDriversCompanies: vi.fn(),
  actionDisabled: false,
  ...overrides
})

// The controller keeps the selection like K/DriversCompaniesList: `handleSelectCompany` builds the next list from the list of ITS render
const Host = () => {
  const [selected, setSelected] = useState(ctl.selected)
  ctl.selectedNow = selected
  ctl.setSelected = setSelected
  const handleSelectCompany = (id) => {
    setSelected(selected.includes(id) ? selected.filter(other => other !== id) : [...selected, id])
  }
  // as components/DriversCompaniesList/index.js:132-139: every company of the state, or none when all are already in
  const handleAllSelectCompany = () => {
    ctl.allSelect()
    const allIds = ctl.props.driversCompaniesState.companies.map(item => item.id)
    setSelected(selected.length === allIds.length ? [] : allIds)
  }
  return (
    <DriversCompaniesListingUI
      {...ctl.props}
      selectedCompanyList={selected}
      setSelectedCompanyList={setSelected}
      handleSelectCompany={handleSelectCompany}
      handleAllSelectCompany={handleAllSelectCompany}
    />
  )
}

const ROUTE = '/delivery/drivers-companies'
let view
const renderPage = (ctlOverrides = {}, route = ROUTE) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const utils = renderWithProviders(<Host />, { initialEntries: [route] })
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
const addButton = () => document.querySelector('[data-add-company]')
const selectionBar = () => screen.getByRole('region', { name: 'Actions for selected companies' })
const tableIds = () => seen.table.companies.map(item => item.id)

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
  ctl.selected = []
  ctl.selectedNow = []
  ctl.setSelected = null
  ctl.allSelect = vi.fn()
  ctl.panelDirty = false
  ctl.addDirty = false
  ctl.pending = null
  Object.keys(seen).forEach(key => { seen[key] = null })
})

afterEach(() => {
  cleanup()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('the header', () => {
  it('draws the title, the count, the search, the table and the pagination; no panel yet', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Delivery companies/ })).toBeInTheDocument()
    expect(screen.getByText('12 companies')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Companies table' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 12')
    expect(screen.queryByTestId('company-panel')).toBeNull()
    expect(screen.queryByTestId('add-panel')).toBeNull()
  })

  it('says «1 company» for one', () => {
    renderPage({ driversCompaniesState: { companies: [COMPANIES[0]], loading: false, error: null } })
    expect(screen.getByText('1 company')).toBeInTheDocument()
  })

  it('follows the list the controller holds (a delete, an add) and says no count while it loads or after it failed', () => {
    renderPage()
    view.update({ driversCompaniesState: { companies: COMPANIES.slice(1), loading: false, error: null } })
    expect(screen.getByText('11 companies')).toBeInTheDocument()
    view.update({ driversCompaniesState: { companies: [], loading: true, error: null } })
    expect(screen.queryByText(/^\d+ compan(y|ies)$/)).toBeNull()
    view.update({ driversCompaniesState: { companies: [], loading: false, error: ['boom'] } })
    expect(screen.queryByText(/^\d+ compan(y|ies)$/)).toBeNull()
  })

  it('«Add driver company» opens the add panel, the list stays', async () => {
    renderPage()
    expect(addButton()).toHaveTextContent('Add driver company')
    await userEvent.click(addButton())
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Companies table' })).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
  })

  it('«Add driver company» is really disabled with actionDisabled', () => {
    renderPage({ actionDisabled: true })
    expect(addButton()).toBeDisabled()
    expect(seen.table.actionDisabled).toBe(true)
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    infoShare.isCollapse = true
    view.update({})
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('gives the table the page of the list, the state of the load, the selection and what the host decides', () => {
    ctl.selected = [2]
    renderPage()
    expect(tableIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(seen.table).toMatchObject({ loading: false, error: null, searchValue: '', pageSize: 10, activeId: null, actionDisabled: false })
    expect(seen.table.selectedIds).toEqual([2])
  })

  it('the table\'s states call the controller: Retry reloads, Clear search empties the search, the add link adds', async () => {
    const reloadDriversCompanies = vi.fn()
    renderPage({ reloadDriversCompanies })
    await click('Table retry')
    expect(reloadDriversCompanies).toHaveBeenCalledTimes(1)
    await click('Table add')
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
  })

  it('the switch of a row saves { enabled } through the controller and returns its answer to the switch', async () => {
    const answer = { ok: false, error: ['no'] }
    const handleUpdateDriversCompany = vi.fn(() => Promise.resolve(answer))
    renderPage({ handleUpdateDriversCompany })
    await expect(seen.table.onToggleEnabled(COMPANIES[1], false)).resolves.toBe(answer)
    expect(handleUpdateDriversCompany).toHaveBeenCalledWith(2, { enabled: false })
  })

  // redesign D-5 (owner, 2026-10-19, C8): turning a company OFF asks first; the switches (row and panel) call this
  // through AsyncSwitch's `confirmChange`, and ON stays immediate (it never asks)
  it('confirmDisable asks «Disable _name_?» with the consequence, the focus on Cancel, and answers true only on «Disable company»', async () => {
    const handleUpdateDriversCompany = vi.fn(() => Promise.resolve({ ok: true }))
    renderPage({ handleUpdateDriversCompany })
    let answer
    act(() => { answer = seen.table.confirmDisable(COMPANIES[1]) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable Swift Riders?' })
    expect(within(dialog).getByText('New orders are no longer sent to this company until you enable it again.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(handleUpdateDriversCompany).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disable company' }))
    await expect(answer).resolves.toBe(true)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel answers false and writes nothing', async () => {
    const handleUpdateDriversCompany = vi.fn(() => Promise.resolve({ ok: true }))
    renderPage({ handleUpdateDriversCompany })
    let answer
    act(() => { answer = seen.table.confirmDisable(COMPANIES[1]) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable Swift Riders?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await expect(answer).resolves.toBe(false)
    expect(handleUpdateDriversCompany).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('the table and the panel share the same question (one dialog, rendered once by the page)', async () => {
    renderPage()
    await click('Open 6')
    expect(typeof seen.table.confirmDisable).toBe('function')
    expect(seen.panel.confirmDisable).toBe(seen.table.confirmDisable)
  })
})

describe('the search (in the browser, as main)', () => {
  it('filters by name, without regard to case, what the table receives', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'EXPRESS')
    expect(tableIds()).toEqual([4, 11])
    expect(seen.table.searchValue).toBe('EXPRESS')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('EXPRESS')
    // the count is the whole list, not the search
    expect(screen.getByText('12 companies')).toBeInTheDocument()
  })

  it('from page 2, a search goes back to page 1 (M-DC5)', async () => {
    renderPage()
    await click('Next page')
    expect(tableIds()).toEqual([11, 12])
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 11–12 of 12')
    // «e» is in every name: the result still has two pages, so only M-DC5 explains being on the first
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'e')
    expect(tableIds()).toHaveLength(10)
    expect(tableIds()[0]).toBe(1)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 12')
  })

  it('«Clear search» of the search box and of the table empty it', async () => {
    renderPage()
    const box = screen.getByRole('searchbox', { name: 'Search' })
    await userEvent.type(box, 'express')
    await click('Clear search')
    expect(box).toHaveValue('')
    expect(tableIds()).toHaveLength(10)
    await userEvent.type(box, 'express')
    expect(tableIds()).toEqual([4, 11])
    await click('Table clear search')
    expect(box).toHaveValue('')
    expect(tableIds()).toHaveLength(10)
  })

  it('a search with no results leaves the table to say so and paints no pagination', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nothing like this')
    expect(tableIds()).toEqual([])
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('pagination and the address', () => {
  it('the table gets 10 and page 2 the rest', async () => {
    renderPage()
    expect(tableIds()).toHaveLength(10)
    await click('Next page')
    expect(tableIds()).toEqual([11, 12])
    await click('Previous page')
    expect(tableIds()).toHaveLength(10)
  })

  it('a new page size shows that many', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(tableIds()).toHaveLength(12)
    expect(seen.table.pageSize).toBe(25)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–12 of 12')
    expect(urlParams().pageSize).toBe('25')
  })

  it('reads ?page= and ?pageSize= when it mounts', () => {
    renderPage({}, `${ROUTE}?page=2&pageSize=10`)
    expect(tableIds()).toEqual([11, 12])
    cleanup()
    renderPage({}, `${ROUTE}?page=1&pageSize=25`)
    expect(tableIds()).toHaveLength(12)
    expect(seen.table.pageSize).toBe(25)
  })

  it('takes 1 and 10 for an address that is not a number, and the last page for one past the end', () => {
    renderPage({}, `${ROUTE}?page=abc&pageSize=-5`)
    expect(tableIds()).toHaveLength(10)
    expect(seen.table.pageSize).toBe(10)
    cleanup()
    renderPage({}, `${ROUTE}?page=9`)
    expect(tableIds()).toEqual([11, 12])
    expect(urlParams().page).toBe('2')
  })

  it('writes ?page and ?pageSize (isUseQuery) and follows the page', async () => {
    renderPage()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
    await click('Next page')
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '10' })
  })

  it('does not write them without isUseQuery, while it loads, or with nothing to page', () => {
    renderPage({ isUseQuery: false })
    expect(urlParams().page).toBeUndefined()
    cleanup()
    renderPage({ driversCompaniesState: { companies: [], loading: true, error: null } })
    expect(urlParams().page).toBeUndefined()
    cleanup()
    renderPage({ driversCompaniesState: { companies: [], loading: false, error: null } })
    expect(urlParams().page).toBeUndefined()
  })

  it('has no pagination with no companies, while it loads or after the load failed', () => {
    renderPage({ driversCompaniesState: { companies: [], loading: false, error: null } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    view.update({ driversCompaniesState: { companies: [], loading: true, error: null } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    view.update({ driversCompaniesState: { companies: [], loading: false, error: ['boom'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(seen.table.error).toEqual(['boom'])
  })
})

describe('the open company: the address and the panel', () => {
  it('a row opens the panel with its company, its id, and writes ?id=', async () => {
    renderPage()
    await click('Open 5')
    expect(screen.getByText('Panel of company 5')).toBeInTheDocument()
    expect(seen.panel.driversCompany).toBe(COMPANIES[4])
    expect(seen.panel.driversCompanyId).toBe(5)
    expect(urlParams().id).toBe('5')
    expect(seen.table.activeId).toBe(5)
  })

  it('gives the panel the controller\'s state and setter and what the page decides', async () => {
    renderPage()
    await click('Open 1')
    expect(seen.panel).toMatchObject({
      driversCompaniesState: ctl.props.driversCompaniesState,
      setDriversCompaniesState: ctl.props.setDriversCompaniesState,
      expanded: false,
      actionDisabled: false
    })
    expect(seen.panel.panelRef).toBeDefined()
    expect(typeof seen.panel.onClose).toBe('function')
    expect(typeof seen.panel.onSectionChange).toBe('function')
    expect(typeof seen.panel.onDeleted).toBe('function')
    expect(typeof seen.panel.onToggleEnabled).toBe('function')
  })

  it('?id=5 opens that company when it mounts; with no row yet the panel gets the id, and the row when the list arrives', () => {
    renderPage({ driversCompaniesState: { companies: [], loading: true, error: null } }, `${ROUTE}?id=5`)
    expect(screen.getByText('Panel of company 5')).toBeInTheDocument()
    expect(seen.panel.driversCompany).toBeUndefined()
    expect(seen.panel.driversCompanyId).toBe(5)
    expect(seen.table.activeId).toBe(5)
    view.update({ driversCompaniesState: { companies: COMPANIES, loading: false, error: null } })
    expect(seen.panel.driversCompany).toBe(COMPANIES[4])
  })

  it('an id that is not a number opens nothing', () => {
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('company-panel')).toBeNull()
    cleanup()
    renderPage({}, `${ROUTE}?id=0`)
    expect(screen.queryByTestId('company-panel')).toBeNull()
  })

  it('?tab= reaches the panel as `section`', () => {
    renderPage({}, `${ROUTE}?id=2&tab=schedule`)
    expect(seen.panel.section).toBe('schedule')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
  })

  it('a section change writes ?tab= and the same company keeps it', async () => {
    renderPage()
    await click('Open 1')
    await click('To schedule')
    expect(urlParams().tab).toBe('schedule')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
    await click('Open 1')
    expect(screen.getByTestId('panel-section')).toHaveTextContent('schedule')
  })

  it('another company starts without a section and without ?tab=', async () => {
    renderPage()
    await click('Open 1')
    await click('To schedule')
    await click('Open 3')
    expect(urlParams()).toMatchObject({ id: '3' })
    expect(urlParams().tab).toBeUndefined()
    expect(screen.getByTestId('panel-section')).toHaveTextContent('undefined')
  })

  it('closing removes id and tab from the address, keeps the rest, and the panel goes away', async () => {
    renderPage({}, `${ROUTE}?id=2&tab=schedule&page=1&pageSize=10`)
    await click('Close panel')
    expect(screen.queryByTestId('company-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(urlParams().tab).toBeUndefined()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
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

  it('closing gives the focus back to the row that was open', async () => {
    renderPage({}, `${ROUTE}?id=3`) // opened by the address: nothing opened it, so nothing gives the focus back by itself
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="3"]')).toHaveFocus())
  })

  it('the switch of the panel goes through the same answer as the row\'s', async () => {
    const handleUpdateDriversCompany = vi.fn(() => Promise.resolve({ ok: true }))
    renderPage({ handleUpdateDriversCompany })
    await click('Open 6')
    await click('Panel switch off')
    expect(handleUpdateDriversCompany).toHaveBeenCalledWith(6, { enabled: false })
    expect(seen.panel.onToggleEnabled).toBe(seen.table.onToggleEnabled)
  })
})

describe('the guard: another company with the panel dirty (decision 17)', () => {
  it('a clean panel lets another company open at once', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 2')
    expect(screen.getByText('Panel of company 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })

  it('a dirty panel asks first: the company and the address do not change until the question is answered', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await click('Open 2')
    expect(screen.getByText('Panel of company 1')).toBeInTheDocument()
    expect(urlParams().id).toBe('1')
    await click('Discard in panel')
    expect(screen.getByText('Panel of company 2')).toBeInTheDocument()
    expect(urlParams().id).toBe('2')
  })

  it('the same row again does not ask', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await click('Open 1')
    expect(screen.queryByRole('button', { name: 'Discard in panel' })).toBeNull()
  })
})

describe('the add panel (decision 5)', () => {
  it('gives it the controller\'s state and setter, a ref for the guard and its two exits', async () => {
    renderPage()
    await userEvent.click(addButton())
    await screen.findByTestId('add-panel')
    expect(seen.addPanel).toMatchObject({
      driversCompaniesState: ctl.props.driversCompaniesState,
      setDriversCompaniesState: ctl.props.setDriversCompaniesState
    })
    expect(seen.addPanel.panelRef).toBeDefined()
    expect(typeof seen.addPanel.onClose).toBe('function')
    expect(typeof seen.addPanel.onAdded).toBe('function')
  })

  it('?add=1 (⌘K) opens it once, like the button, and takes the param off the address', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
    expect(urlParams().add).toBeUndefined()
  })

  it('?add=1 waits while the user may not act (the same condition as the button), then opens', async () => {
    renderPage({ actionDisabled: true }, `${ROUTE}?add=1`)
    expect(screen.queryByTestId('add-panel')).toBeNull()
    view.update({ actionDisabled: false })
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
  })

  it('Cancel and Saved close it, and the focus goes back to «Add driver company»', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await screen.findByTestId('add-panel')
    await click('Cancel add')
    expect(screen.queryByTestId('add-panel')).toBeNull()
    await waitFor(() => expect(addButton()).toHaveFocus())
    await userEvent.click(addButton())
    await screen.findByTestId('add-panel')
    await click('Saved add')
    expect(screen.queryByTestId('add-panel')).toBeNull()
  })

  it('with a company open and dirty it asks first; the company stays until it is discarded', async () => {
    renderPage()
    await click('Open 1')
    ctl.panelDirty = true
    await userEvent.click(addButton())
    expect(screen.queryByTestId('add-panel')).toBeNull()
    expect(screen.getByText('Panel of company 1')).toBeInTheDocument()
    await click('Discard in panel')
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('company-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('with a company open and clean it replaces the panel at once', async () => {
    renderPage()
    await click('Open 1')
    await userEvent.click(addButton())
    expect(await screen.findByTestId('add-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('company-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('a company opened over a dirty add panel asks first, and the add panel goes when it is discarded', async () => {
    renderPage()
    await userEvent.click(addButton())
    await screen.findByTestId('add-panel')
    ctl.addDirty = true
    await click('Open 2')
    expect(screen.queryByText('Panel of company 2')).toBeNull()
    expect(screen.getByTestId('add-panel')).toBeInTheDocument()
    await click('Discard in add')
    expect(await screen.findByText('Panel of company 2')).toBeInTheDocument()
    expect(screen.queryByTestId('add-panel')).toBeNull()
    expect(urlParams().id).toBe('2')
  })
})

describe('the selection and the bulk delete', () => {
  it('has no bar without a selection', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Actions for selected companies' })).toBeNull()
  })

  it('a row\'s box toggles that company and the bar says how many are selected', async () => {
    renderPage()
    await click('Select 2')
    expect(ctl.selectedNow).toEqual([2])
    expect(selectionBar()).toHaveTextContent('1 selected')
    await click('Select 3')
    expect(selectionBar()).toHaveTextContent('2 selected')
    expect(selectionBar().querySelectorAll('.odc-figure')).toHaveLength(1)
    await click('Select 2')
    await click('Select 3')
    expect(ctl.selectedNow).toEqual([])
    expect(screen.queryByRole('region', { name: 'Actions for selected companies' })).toBeNull()
  })

  // redesign (n.º 10, P-1): the integration (company 4) is read only, so «Select all» skips it
  it('«Select page» selects every company that can be selected, also the ones of page 2, and skips the integration (M-DC19)', async () => {
    renderPage()
    await click('Select page')
    expect(ctl.allSelect).not.toHaveBeenCalled()
    expect(ctl.selectedNow).toHaveLength(11)
    expect(ctl.selectedNow).not.toContain(4)
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('11 selected · 2 not shown')
    // redesign DC-R1 (review r1 F2): the header box now shows checked, so its press clears (the same result as main's second press)
    await click('Select page')
    expect(ctl.allSelect).not.toHaveBeenCalled()
    expect(ctl.selectedNow).toEqual([])
  })

  it('with no integration among the companies, «Select all» is still the controller\'s, as main', async () => {
    const own = COMPANIES.map(item => ({ ...item, owner_type: 'user' }))
    renderPage({ driversCompaniesState: { companies: own, loading: false, error: null } })
    await click('Select page')
    expect(ctl.allSelect).toHaveBeenCalledTimes(1)
    expect(ctl.selectedNow).toHaveLength(12)
    await click('Select page')
    expect(ctl.allSelect).toHaveBeenCalledTimes(1)
    expect(ctl.selectedNow).toEqual([])
  })

  it('says nothing about the ones not shown when the whole selection is on screen', () => {
    ctl.selected = [1, 2]
    renderPage()
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('2 selected')
  })

  it('a search that hides part of the selected says how many are not shown (M-DC19)', async () => {
    ctl.selected = [1, 4]
    renderPage()
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('2 selected')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'express')
    expect(tableIds()).toEqual([4, 11])
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('2 selected · 1 not shown')
    expect(selectionBar().querySelectorAll('.odc-figure')).toHaveLength(2)
    // the other pages count too
    cleanup()
    ctl.selected = [1, 11, 12]
    renderPage()
    expect(document.querySelector('.odc-selbar-count').textContent).toBe('3 selected · 2 not shown')
  })

  it('«Clear selection» empties it, the ones that are not shown included', async () => {
    ctl.selected = [1, 12]
    renderPage()
    await click('Clear selection')
    expect(ctl.selectedNow).toEqual([])
    expect(screen.queryByRole('region', { name: 'Actions for selected companies' })).toBeNull()
  })

  it('Delete asks «Delete 2 driver companies?» with the consequence, the focus on Cancel; nothing is deleted until it is confirmed', async () => {
    ctl.selected = [1, 2]
    const handleDeleteSelectedCompanies = vi.fn()
    renderPage({ handleDeleteSelectedCompanies })
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 driver companies?' })
    expect(within(dialog).getByText(/This can't be undone\./)).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('not on screen')
    expect(dialog).not.toHaveTextContent('delivery services in Connect')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(handleDeleteSelectedCompanies).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete companies' }))
    expect(handleDeleteSelectedCompanies).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('says «Delete 1 driver company?» for one, and Cancel deletes nothing and keeps the selection', async () => {
    ctl.selected = [1]
    const handleDeleteSelectedCompanies = vi.fn()
    renderPage({ handleDeleteSelectedCompanies })
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 1 driver company?' })
    expect(within(dialog).getByRole('button', { name: 'Delete company' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleDeleteSelectedCompanies).not.toHaveBeenCalled()
    expect(ctl.selectedNow).toEqual([1])
  })

  it('warns about the ones that are not on screen (M-DC19)', async () => {
    ctl.selected = [1, 11, 12]
    renderPage()
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 3 driver companies?' })
    expect(dialog).toHaveTextContent('2 of them are not on screen.')
    cleanup()
    ctl.selected = [1, 11]
    renderPage()
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alertdialog', { name: 'Delete 2 driver companies?' })).toHaveTextContent('1 of them is not on screen.')
  })

  it('Delete is really disabled with actionDisabled', () => {
    ctl.selected = [1]
    renderPage({ actionDisabled: true })
    expect(within(selectionBar()).getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  const confirmBulkDelete = async () => {
    ctl.selected = [1, 2]
    renderPage()
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete companies' }))
  }

  it('while the controller deletes the bar stays busy, and goes when the selection is empty', async () => {
    await confirmBulkDelete()
    expect(within(selectionBar()).getByRole('button', { name: 'Delete' })).toBeDisabled()
    // the controller deletes them one after the other and shifts the selection
    act(() => ctl.setSelected([2]))
    expect(within(selectionBar()).getByRole('button', { name: 'Delete' })).toBeDisabled()
    act(() => ctl.setSelected([]))
    expect(screen.queryByRole('region', { name: 'Actions for selected companies' })).toBeNull()
  })

  // redesign DC-B5 (agent finding): the fallbacks are tried in order, so the table wins over «Add driver company»
  it('when the selection is empty the focus goes to the table, not to «Add driver company»', async () => {
    await confirmBulkDelete()
    act(() => ctl.setSelected([]))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Companies table' })).toHaveFocus())
  })

  it('a failed delete disarms the bar so the next one can be tried (M-DC18)', async () => {
    ctl.selected = [1, 2]
    renderPage()
    await userEvent.click(within(selectionBar()).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete companies' }))
    expect(within(selectionBar()).getByRole('button', { name: 'Delete' })).toBeDisabled()
    view.update({ actionState: { loading: false, error: ['The company has orders.'] } })
    await waitFor(() => expect(within(selectionBar()).getByRole('button', { name: 'Delete' })).toBeEnabled())
  })
})

describe('deleting from the panel (M-DC21)', () => {
  it('closes the panel, takes the id off the address and out of the selection, and keeps the other ones', async () => {
    ctl.selected = [2, 3]
    renderPage()
    await click('Open 2')
    await click('Deleted from panel')
    expect(screen.queryByTestId('company-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
    expect(ctl.selectedNow).toEqual([3])
    expect(selectionBar()).toHaveTextContent('1 selected')
  })

  it('leaves the selection as it was when the company was not selected, and the focus goes to the table', async () => {
    ctl.selected = [3]
    renderPage()
    await click('Open 2')
    view.update({ driversCompaniesState: { companies: COMPANIES.filter(item => item.id !== 2), loading: false, error: null } })
    await click('Deleted from panel')
    expect(ctl.selectedNow).toEqual([3])
    await waitFor(() => expect(screen.getByRole('region', { name: 'Companies table' })).toHaveFocus())
  })

  it('the last selected company deleted from its panel removes the bar', async () => {
    ctl.selected = [2]
    renderPage()
    await click('Open 2')
    await click('Deleted from panel')
    expect(ctl.selectedNow).toEqual([])
    expect(screen.queryByRole('region', { name: 'Actions for selected companies' })).toBeNull()
  })
})

describe('errors of the controller (as main\'s Alert «Ordering»)', () => {
  it('a new error of the controller opens an alert with its messages', async () => {
    renderPage()
    view.update({ actionState: { loading: false, error: ['The company has orders.'] } })
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('The company has orders.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('no alert without an error', async () => {
    renderPage()
    view.update({ actionState: { loading: true, error: null } })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('what the switch of a row already said (it failed under its own control) is not said twice', async () => {
    const error = ['Nope.']
    const handleUpdateDriversCompany = vi.fn(() => Promise.resolve({ ok: false, error }))
    renderPage({ handleUpdateDriversCompany })
    await act(async () => { await seen.table.onToggleEnabled(COMPANIES[0], false) })
    view.update({ actionState: { loading: false, error } })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // another error is not that one
    view.update({ actionState: { loading: false, error: ['Other.'] } })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Other.')
  })

  it('the same holds for the switch of the panel, and when the state arrives before the answer', async () => {
    const error = ['Nope.']
    let answer
    const handleUpdateDriversCompany = vi.fn(() => new Promise(resolve => { answer = resolve }))
    renderPage({ handleUpdateDriversCompany })
    await click('Open 1')
    await click('Panel switch off')
    // the controller writes actionState first, the answer comes right after
    view.update({ actionState: { loading: false, error } })
    await act(async () => { answer({ ok: false, error }) })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Delivery/DriversCompaniesListing (the export the page imports)', () => {
  it('mounts the controller with the new UI and passes the page props on', () => {
    render(
      <MemoryRouter initialEntries={[ROUTE]}>
        <DriversCompaniesListing isUseQuery extra='x' />
      </MemoryRouter>
    )
    expect(screen.getByTestId('controller')).toBeInTheDocument()
    expect(seen.controller.UIComponent).toBe(DriversCompaniesListingUI)
    expect(seen.controller).toMatchObject({ isUseQuery: true, extra: 'x' })
  })
})

// redesign DC-R1 (review r1 F1, F2, F3): the focus after moving between companies, the header box doing what it shows, «Clear search»
describe('review r1', () => {
  it('F1: open A, move to B, close: the focus goes to B\'s row, not to the row that opened the panel first', async () => {
    renderPage()
    await click('Open 3')
    await click('Open 5')
    expect(screen.getByText('Panel of company 5')).toBeInTheDocument()
    await click('Close panel')
    const row5 = document.querySelector('[data-row-id="5"]')
    await waitFor(() => expect(row5.contains(document.activeElement)).toBe(true))
  })

  it('F2: with every row on screen selected (the header box shows checked), its press clears the selection, also the hidden ones', async () => {
    ctl.selected = [3, 5]
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'Metro')
    expect(tableIds()).toEqual([3])
    await click('Select page')
    expect(ctl.selectedNow).toEqual([])
    expect(ctl.allSelect).not.toHaveBeenCalled()
  })

  it('F2: with a row on screen not selected, its press selects every company that can be selected, as main', async () => {
    ctl.selected = [1]
    renderPage()
    await click('Select page')
    expect(ctl.allSelect).not.toHaveBeenCalled() // company 4 is an integration: the page selects the rest itself (n.º 10, P-1)
    expect(ctl.selectedNow).toHaveLength(11)
  })

  it('F3: «Clear search» of the empty state gives the focus to the search box', async () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Search' })
    await userEvent.type(search, 'zzz')
    await click('Table clear search')
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
  })
})
