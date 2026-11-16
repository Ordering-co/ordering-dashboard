/* eslint-disable import/first */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  // redesign W1-8 (T1-8-4): the controller hands its props to the UI as the real one does
  DriverStoreStatus: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

// redesign driver-store-status (DSS-B3): the phone breakpoint is a flag of the test (the table gives way to cards under 768)
const phone = vi.hoisted(() => ({ value: false }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => phone.value }))

// (row 32, driver-store-status P-7): the realtime connection status is the shared Product piece; here it is a probe (its own states are covered in Shared/Product/__tests__/WebsocketStatus.test.jsx)
vi.mock('../../../Shared/Product/WebsocketStatus', () => ({ WebsocketStatus: () => <span data-testid='websocket-status-probe'>Live</span> }))

import { buildGlobalKpis, buildStoreRows } from '../aggregate'
import { StoresTable } from '../StoresTable'
import { DriverStoreStatus } from '../index'

const groups = [{ id: 5, business: [{ id: 8, name: 'North Store', enabled: true }] }]
const drivers = [
  { id: 1, enabled: true, available: true, busy: true, drivergroups: [{ id: 5 }] },
  { id: 2, enabled: true, available: false, busy: false, drivergroups: [5] },
  { id: 3, enabled: false, available: true, busy: false, drivergroups: [5] }
]

describe('DriverStoreStatus aggregation and table', () => {
  it('preserves enabled, online, busy and finished status aggregation', () => {
    const activeByBusiness = new Map([[8, 3]])
    const finishedTodayByBusiness = new Map([[8, 7]])
    expect(buildGlobalKpis({ groups, drivers })).toEqual({
      totalStores: 1,
      totalDrivers: 2,
      connectedDrivers: 1,
      busyDrivers: 1,
      offlineDrivers: 1
    })
    expect(buildStoreRows({ groups, drivers, activeByBusiness, finishedTodayByBusiness })).toEqual([{
      businessId: 8,
      name: 'North Store',
      totalDrivers: 2,
      connectedDrivers: 1,
      busyDrivers: 1, // (row 31, driver-store-status P-9)
      allBusy: true,
      activeOrders: 3,
      finishedToday: 7,
      groupIds: [5], // (row 28, driver-store-status P-1, D-22)
      driverGroupIds: [5], // (review L1): the group has enabled drivers
      unassignedTab: 'inProgress' // (review M4): no in-progress counts given, today's tab
    }])
  })

  it('names the table and scopes the column headings', () => {
    const rows = buildStoreRows({ groups, drivers })
    renderWithProviders(<StoresTable rows={rows} loading={false} ordersLoading={false} />)
    const table = screen.getByRole('table', { name: 'Driver store status' })
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(6) // (row 28): the five figures' columns plus «Actions"
    expect(table).toHaveClass('odc-table')
  })

  it('tints a store without online drivers with a data attribute and keeps its figures in .odc-figure', () => {
    const offline = [{ ...buildStoreRows({ groups, drivers })[0], connectedDrivers: 0 }]
    renderWithProviders(<StoresTable rows={offline} loading={false} ordersLoading={false} />)
    const row = screen.getByText('North Store').closest('tr')
    expect(row).toHaveAttribute('data-no-online', '')
    expect(row.querySelectorAll('.odc-figure')).toHaveLength(4)
  })

  it('shows the Product empty state, and a loading table that is aria-busy', () => {
    const { rerender } = renderWithProviders(<StoresTable rows={[]} loading={false} ordersLoading={false} />)
    expect(screen.getByText('No stores to show')).toBeInTheDocument()
    rerender(<StoresTable rows={[]} loading ordersLoading={false} />)
    expect(screen.getByRole('table', { name: 'Driver store status' })).toHaveAttribute('aria-busy', 'true')
  })
})

// redesign W1-8 (T1-8-4): the screen is made of the Product header, table and pagination; no legacy module is imported.
const manyGroups = [{
  id: 5,
  business: Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Store ${String(i).padStart(2, '0')}`, enabled: true }))
}]
const uiProps = { drivers, groups: manyGroups, orderCounts: { total: 9, assigned: 4, finished: 5 }, onReload: vi.fn() }

describe('DriverStoreStatus screen (Product header, table, pagination)', () => {
  it('draws the page header with the Reload action and the Product table', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Driver store status' })).toHaveClass('odc-pagehead-title')
    const reload = screen.getByRole('button', { name: 'Reload' })
    fireEvent.click(reload)
    expect(uiProps.onReload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('table', { name: 'Driver store status' })).toHaveClass('odc-table')
    expect(screen.getByRole('searchbox', { name: 'Search store' })).toBeInTheDocument()
  })

  it('· P-7 · the header shows the realtime connection status in its status slot', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const status = screen.getByTestId('websocket-status-probe')
    expect(status.closest('.odc-pagehead-status')).not.toBeNull()
    expect(status.closest('.odc-pagehead-status')).not.toHaveAttribute('data-empty')
    expect(status.closest('.odc-pagehead')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Driver store status' }))
  })

  it('pages the 12 stores 10 at a time in the Product pagination and hides the foot with one page', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 12')
    expect(screen.getAllByRole('row')).toHaveLength(11) // header + 10
    fireEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 11–12 of 12')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: 'Store 03' } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  // redesign owner-decisions Q-04: the size selector lives in the foot, so at 25 per page with one page the foot stays and the user can go back to 10
  it('Q-04 · choosing 25 per page keeps the foot with its size selector, and choosing 10 pages again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    await user.click(screen.getByRole('button', { name: 'Items per page 10' }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(screen.getAllByRole('row')).toHaveLength(13) // header + 12
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–12 of 12')
    await user.click(within(nav).getByRole('button', { name: 'Items per page 25' }))
    await user.click(await screen.findByRole('menuitemradio', { name: '10' }))
    expect(screen.getAllByRole('row')).toHaveLength(11) // header + 10
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 12')
  })

  it('Q-04 · with 10 per page and one page the foot stays hidden', () => {
    const fewGroups = [{ id: 5, business: manyGroups[0].business.slice(0, 5) }]
    renderWithProviders(<DriverStoreStatus {...uiProps} groups={fewGroups} />)
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('keeps the open-menu button when the sidebar is collapsed', () => {
    infoShare.isCollapse = true
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const menu = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    fireEvent.click(menu)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
    infoShare.isCollapse = false
  })

  it('imports no legacy module (button, pagination, search bar, bootstrap icons, react-loading-skeleton)', () => {
    const dir = path.resolve(__dirname, '..')
    const files = fs.readdirSync(dir).filter(name => name.endsWith('.js'))
    const forbidden = /react-bootstrap-icons|react-loading-skeleton|\.\.\/\.\.\/Shared'|Shared\/SearchBar|\.\.\/\.\.\/styles'|\.\.\/styles\/Buttons|<table|<h1/
    files.forEach(name => {
      expect({ name, hit: forbidden.exec(fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n').replace(/\/\/ .*$/gm, ''))?.[0] }).toEqual({ name, hit: undefined })
    })
  })
})

// redesign W1 tramo C r1 (C1c): fixes of the first QA round for the store status screen
describe('DriverStoreStatus tramo C r1 fixes (C1c)', () => {
  it('W1-QC1-06 · Reload is busy, not disabled, while the screen loads: it keeps the focus and ignores repeats', () => {
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(<DriverStoreStatus {...uiProps} onReload={onReload} />)
    const reload = screen.getByRole('button', { name: 'Reload' })
    reload.focus()
    expect(reload).toHaveFocus()
    rerender(<DriverStoreStatus {...uiProps} onReload={onReload} ordersLoading />)
    const busy = screen.getByRole('button', { name: 'Reload' })
    expect(busy).not.toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveFocus()
    fireEvent.click(busy)
    expect(onReload).not.toHaveBeenCalled()
    rerender(<DriverStoreStatus {...uiProps} onReload={onReload} />)
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Reload' })).not.toHaveAttribute('aria-busy')
  })

  it('W1-PC1-02 · the foot has the page field (main painted page numbers) and jumps to the page typed', async () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    const field = within(nav).getByRole('textbox', { name: 'Page' })
    expect(field).toHaveValue('1')
    expect(nav).toHaveTextContent('of 2')
    await userEvent.clear(field)
    await userEvent.type(field, '2{Enter}')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 11–12 of 12')
    expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('textbox', { name: 'Page' })).toHaveValue('2')
  })

  it('W1-QC1-15 · the store name is the row header of its row', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const headers = screen.getAllByRole('rowheader')
    expect(headers).toHaveLength(10)
    expect(headers[0]).toHaveTextContent('Store 00')
    expect(headers[0]).toHaveAttribute('scope', 'row')
    expect(headers[0].closest('tr').children).toHaveLength(6) // (row 28): the store, the four figures and the actions
  })

  // (row 28, driver-store-status P-1, D-22): the row itself still opens nothing (no tab stop, no interactive mark); its two
  // exits live in the «Actions» cell, behind one menu button (live check)
  it('W1-PC1-03 · the row itself has no tab stop and no interactive mark; its only control is the Actions menu button of the last cell (row 28)', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const table = screen.getByRole('table', { name: 'Driver store status' })
    const rows = table.querySelectorAll('tbody tr[data-row-id]')
    expect(rows).toHaveLength(10)
    rows.forEach(row => {
      expect(row).not.toHaveAttribute('tabindex')
      expect(row).not.toHaveAttribute('data-interactive')
      expect(Array.from(row.querySelectorAll('a, button')).map(control => control.closest('td'))).toEqual([row.querySelector('td:last-child')])
      expect(row.querySelector('a')).toBeNull()
    })
  })

  it('W1-QC1-11 · the table sits in a named scroll region with the edge fade', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const region = screen.getByRole('region', { name: 'Stores table, scrolls sideways' })
    expect(region).toHaveClass('odc-table-scroll', 'odc-fade-x')
    expect(within(region).getByRole('table', { name: 'Driver store status' })).toBeInTheDocument()
  })

  it('W1-QC1-14 · a search with no result says so, offers «Clear search» and hands the focus back to the field', async () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const search = screen.getByRole('searchbox', { name: 'Search store' })
    fireEvent.change(search, { target: { value: 'zzzz' } })
    const table = screen.getByRole('table', { name: 'Driver store status' })
    expect(within(table).getByText(/No stores match/)).toHaveTextContent('No stores match “zzzz”')
    expect(within(table).queryByText('No stores to show')).toBeNull()
    fireEvent.click(within(table).getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveValue('')
    await waitFor(() => expect(search).toHaveFocus())
    expect(screen.getAllByRole('rowheader')).toHaveLength(10)
  })

  it('W1-QC1-14 · with no search and no stores the empty state stays «No stores to show», with no action', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} groups={[]} />)
    const table = screen.getByRole('table', { name: 'Driver store status' })
    expect(within(table).getByText('No stores to show')).toBeInTheDocument()
    expect(within(table).queryByRole('button')).toBeNull()
  })

  // RED until the coordinator applies the styles.js fragment of the C1c report (styles.js is outside the files of this task):
  // the row header is a th now, and the tint of a store without online drivers sits on `td` only.
  it('W1-QC1-15 · the tint of a store without online drivers also covers its row header (styles.js)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../styles.js'), 'utf8')
    expect(source).toMatch(/tr\[data-no-online\] td,\s*tr\[data-no-online\] th\[scope='row'\]/)
  })
})

// redesign driver-store-status (DSS-B3): decisions 1 and 3 and the screen of M-DSS1
const metric = (label) => screen.getByText(label, { selector: '.odc-metric-label' }).closest('li')
const valueOf = (item) => item.querySelector('.odc-metric-value')
const refsOf = (item) => Array.from(item.querySelectorAll('.odc-metric-ref')).map(ref => ref.textContent.replace(/\s+/g, ' ').trim())
const activeByBusiness = new Map([[100, 3], [101, 2]])
const finishedTodayByBusiness = new Map([[100, 4], [105, 1]])
const figuresProps = { ...uiProps, activeByBusiness, finishedTodayByBusiness, onReload: vi.fn() }

describe('DriverStoreStatus figures (decision 1)', () => {
  it('DSS-B3 · four figures with their names and values, in a MetricGrid of four', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const grid = metric('Total active stores').closest('ul')
    expect(grid).toHaveClass('odc-metric-grid')
    expect(grid).toHaveAttribute('data-columns', '4')
    expect(grid.querySelectorAll(':scope > li')).toHaveLength(4)
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
    expect(refsOf(metric('Total active stores'))).toEqual(['0 without online drivers'])
    expect(valueOf(metric('Total drivers'))).toHaveTextContent('2')
    expect(refsOf(metric('Total drivers'))).toEqual(['1 Online drivers (1 Busy)', '1 Offline'])
    expect(valueOf(metric('Active unassigned'))).toHaveTextContent('5')
    expect(refsOf(metric('Active unassigned'))).toEqual(['Finished today 5'])
    expect(valueOf(metric('Orders, all time'))).toHaveTextContent('9')
    expect(refsOf(metric('Orders, all time'))).toEqual(['4 assigned · 5 finished'])
    grid.querySelectorAll('.odc-metric-value').forEach(value => expect(value.querySelector('bdi.odc-figure')).not.toBeNull())
  })

  it('DSS-B3 · the sum of Active unassigned and Finished today is of every store, not of the search', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: 'Store 11' } })
    expect(screen.getAllByRole('rowheader')).toHaveLength(1)
    expect(valueOf(metric('Active unassigned'))).toHaveTextContent('5')
    expect(refsOf(metric('Active unassigned'))).toEqual(['Finished today 5'])
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
  })

  it('DSS-B3 · stores without online drivers go in a local span with data-alert; with none, no alert', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    expect(metric('Total active stores').querySelector('[data-alert]')).toBeNull()
    rerender(<DriverStoreStatus {...figuresProps} drivers={[]} />)
    const alert = metric('Total active stores').querySelector('[data-alert]')
    expect(alert).toHaveTextContent('12 without online drivers')
    expect(alert.tagName).toBe('SPAN')
    expect(alert.querySelector('bdi.odc-figure')).toHaveTextContent('12')
  })

  it('DSS-B3 · the structure figures load with the structure and the order figures with the orders', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} ordersLoading />)
    expect(metric('Total active stores').querySelector('.odc-skeleton')).toBeNull()
    expect(metric('Total drivers').querySelector('.odc-skeleton')).toBeNull()
    expect(metric('Active unassigned').querySelector('.odc-skeleton')).not.toBeNull()
    expect(metric('Orders, all time').querySelector('.odc-skeleton')).not.toBeNull()
  })

  it('DSS-B3 · with an orders error the order figures and cells paint «—», never 0', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} ordersError />)
    const unassigned = metric('Active unassigned')
    expect(valueOf(unassigned)).toHaveTextContent('—')
    expect(refsOf(unassigned)[0]).toMatch(/^Finished today —/)
    expect(valueOf(metric('Orders, all time'))).toHaveTextContent('—')
    expect(refsOf(metric('Orders, all time'))[0]).toMatch(/^— assigned · — finished/)
    expect(unassigned).not.toHaveTextContent(/\b0\b/)
    const first = screen.getAllByRole('rowheader')[0].closest('tr')
    const cells = first.querySelectorAll('td')
    expect(cells[2]).toHaveTextContent('—')
    expect(cells[3]).toHaveTextContent('—')
    expect(cells[0]).not.toHaveTextContent('—')
    expect(cells[1]).not.toHaveTextContent('—')
    // the structure figures stay
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
  })
})

describe('DriverStoreStatus errors (M-DSS1)', () => {
  it('DSS-B3 · a structure error with no stores replaces the table and the foot with the error and «Try again»', () => {
    const onReload = vi.fn()
    renderWithProviders(<DriverStoreStatus {...uiProps} groups={[]} groupsError structureError onReload={onReload} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the stores.")
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('—')
    // review r1 (Q-02): the drivers were read, so their figure stays (it is not «—»)
    expect(valueOf(metric('Total drivers'))).toHaveTextContent('2')
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('DSS-B3 · «Try again» is busy, not disabled, while the retry loads', () => {
    const onReload = vi.fn()
    renderWithProviders(<DriverStoreStatus {...uiProps} groups={[]} groupsError structureError groupsLoading onReload={onReload} />)
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry).not.toBeDisabled()
    expect(retry).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(retry)
    expect(onReload).not.toHaveBeenCalled()
  })

  it('DSS-B3 · with stores painted, an error shows a warning above the table with «Try again» and the table stays', () => {
    const onReload = vi.fn()
    renderWithProviders(<DriverStoreStatus {...figuresProps} structureError onReload={onReload} />)
    const notice = screen.getByText("Some figures couldn't be updated.").closest('.odc-notice') // the Pagination has its own status region
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(notice).toHaveTextContent("Some figures couldn't be updated.")
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table', { name: 'Driver store status' })).toBeInTheDocument()
    expect(screen.getAllByRole('rowheader')).toHaveLength(10)
    // under the search, above the table
    const search = screen.getByRole('searchbox', { name: 'Search store' })
    expect(search.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('DSS-B3 · an orders error alone also shows the warning; with no error there is none', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    expect(screen.queryByText("Some figures couldn't be updated.")).toBeNull()
    rerender(<DriverStoreStatus {...figuresProps} ordersError />)
    expect(screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')).toHaveAttribute('role', 'status')
  })
})

describe('DriverStoreStatus attention and phone cards (decisions 2 and 3)', () => {
  it('DSS-B3 · an Active unassigned figure above 0 carries data-attention in a span; 0 does not', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const rows = screen.getAllByRole('rowheader').map(header => header.closest('tr'))
    const named = name => rows.find(row => row.textContent.includes(name)).querySelectorAll('td')[2]
    const hit = named('Store 00').querySelector('[data-attention]')
    expect(hit).toHaveTextContent('3')
    expect(hit.tagName).toBe('SPAN')
    expect(named('Store 05').querySelector('[data-attention]')).toBeNull()
  })

  it('DSS-B3 · at 390 the table gives way to a list of cards: name as h2, a dl of four, data-no-online, the exits, no table, no scroll region', () => {
    phone.value = true
    try {
      renderWithProviders(<DriverStoreStatus {...figuresProps} drivers={[]} />)
      expect(screen.queryByRole('table')).toBeNull()
      expect(screen.queryByRole('region', { name: 'Stores table, scrolls sideways' })).toBeNull()
      const list = screen.getByRole('list', { name: 'Driver store status' })
      const cards = within(list).getAllByRole('listitem')
      expect(cards).toHaveLength(10)
      expect(within(cards[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Store 00')
      expect(within(cards[0]).getByRole('heading', { level: 2 })).toHaveAttribute('dir', 'auto')
      const terms = Array.from(cards[0].querySelectorAll('dt')).map(dt => dt.textContent)
      expect(terms).toEqual(['Online drivers', 'Total drivers', 'Active unassigned', 'Finished today'])
      const values = Array.from(cards[0].querySelectorAll('dd'))
      expect(values.map(dd => dd.textContent)).toEqual(['0No drivers online', '0', '3', '4']) // (T10): the 0 of a tinted card is followed by its text status
      values.forEach(dd => expect(dd.querySelector('bdi.odc-figure')).not.toBeNull())
      expect(cards[0].querySelector('[data-attention]')).toHaveTextContent('3')
      cards.forEach(card => {
        expect(card).toHaveAttribute('data-no-online', '')
        expect(card).not.toHaveAttribute('tabindex')
        expect(card.querySelectorAll('a')).toHaveLength(1) // (row 28): the exits are the only controls of the card; (review L1) with no drivers, only «View unassigned orders»
        expect(card.querySelector('button')).toBeNull()
      })
    } finally {
      phone.value = false
    }
  })

  it('DSS-B3 · the cards keep a store with online drivers untinted, load as skeletons, and paint «—» for orders with an error', () => {
    phone.value = true
    try {
      const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
      expect(within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')[0]).not.toHaveAttribute('data-no-online')
      rerender(<DriverStoreStatus {...figuresProps} ordersError />)
      const first = within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')[0]
      const values = Array.from(first.querySelectorAll('dd')).map(dd => dd.textContent)
      expect(first.querySelector('dd bdi.odc-figure')).toHaveTextContent(/^1$/) // (row 31, P-9): the figure is still 1; the fixture's lone driver is busy, so «All busy» follows it
      expect(values[2]).toContain('—')
      expect(values[3]).toContain('—')
      rerender(<DriverStoreStatus {...figuresProps} groupsLoading />)
      const loading = screen.getByRole('list', { name: 'Driver store status' })
      expect(loading).toHaveAttribute('aria-busy', 'true')
      expect(loading.querySelectorAll('li')).toHaveLength(5)
      loading.querySelectorAll('li').forEach(card => expect(card).toHaveAttribute('aria-hidden', 'true'))
      expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
      rerender(<DriverStoreStatus {...figuresProps} groups={[]} />)
      expect(screen.getByText('No stores to show')).toBeInTheDocument()
    } finally {
      phone.value = false
    }
  })

  it('DSS-B3 · the styles keep only var(--od-*) values: no literal px, colour, weight or z-index', () => {
    const dir = path.resolve(__dirname, '..')
    ;['styles.js', 'StoreCards.js', 'KpiCards.js', 'StoresTable.js'].forEach(name => {
      const code = fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n').replace(/\/\* .*? \*\//g, '')
      expect({ name, z: /z-index/.test(code) }).toEqual({ name, z: false })
      expect({ name, color: /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.exec(code)?.[0] }).toEqual({ name, color: undefined })
      expect({ name, weight: /font-weight:\s*(\d|bold|normal)/.exec(code)?.[0] }).toEqual({ name, weight: undefined })
    })
    expect(fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')).not.toMatch(/Kpi(Row|Card|Label|Value|Sub)/)
  })
})

// redesign driver-store-status (review r1): each figure follows the source it comes from
describe('DriverStoreStatus review r1 fixes', () => {
  it('Q-01 · drivers failed on the first load: the driver figures and cells paint «—», never 0, and nothing is tinted', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} drivers={[]} driversError structureError />)
    expect(valueOf(metric('Total drivers'))).toHaveTextContent('—')
    expect(refsOf(metric('Total drivers')).join(' ')).not.toMatch(/\b0\b/)
    expect(refsOf(metric('Total active stores'))[0]).toMatch(/^— without online drivers/)
    expect(metric('Total active stores').querySelector('[data-alert]')).toBeNull()
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
    const first = screen.getAllByRole('rowheader')[0].closest('tr')
    expect(first).not.toHaveAttribute('data-no-online')
    const cells = first.querySelectorAll('td')
    expect(cells[0]).toHaveTextContent('—')
    expect(cells[1]).toHaveTextContent('—')
    expect(cells[2]).toHaveTextContent('3')
    expect(screen.getByText("Some figures couldn't be updated.")).toBeInTheDocument()
  })

  it('Q-01 · drivers failed at 390: the cards paint «—» for the drivers and are not tinted', () => {
    phone.value = true
    try {
      renderWithProviders(<DriverStoreStatus {...figuresProps} drivers={[]} driversError structureError />)
      const card = within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')[0]
      expect(card).not.toHaveAttribute('data-no-online')
      const figures = card.querySelectorAll('dd')
      expect(figures[0]).toHaveTextContent('—')
      expect(figures[1]).toHaveTextContent('—')
      expect(figures[2]).toHaveTextContent('3')
    } finally {
      phone.value = false
    }
  })

  it('Q-02 · groups failed: the store figures and the order sum paint «—»; the drivers, loaded, keep their figures', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} groups={[]} groupsError structureError />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the stores.")
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('—')
    expect(valueOf(metric('Active unassigned'))).toHaveTextContent('—')
    expect(refsOf(metric('Active unassigned'))[0]).toMatch(/^Finished today —/)
    expect(valueOf(metric('Total drivers'))).toHaveTextContent('2')
    expect(valueOf(metric('Orders, all time'))).toHaveTextContent('9')
  })

  it('Q-02 · the order sum loads while the stores load, even when the orders are in', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} groups={[]} groupsLoading />)
    expect(metric('Active unassigned').querySelector('.odc-skeleton')).not.toBeNull()
    expect(metric('Orders, all time').querySelector('.odc-skeleton')).toBeNull()
  })

  it('Q-03 · a retry that works hands the focus to «Reload», from the error and from the notice', () => {
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} groups={[]} groupsError structureError onReload={onReload} />)
    const retry = within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' })
    retry.focus()
    fireEvent.click(retry)
    expect(onReload).toHaveBeenCalledTimes(1)
    rerender(<DriverStoreStatus {...figuresProps} groups={[]} groupsLoading onReload={onReload} />)
    rerender(<DriverStoreStatus {...figuresProps} onReload={onReload} />)
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus()

    rerender(<DriverStoreStatus {...figuresProps} ordersError onReload={onReload} />)
    const noticeRetry = within(screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')).getByRole('button', { name: 'Try again' })
    noticeRetry.focus()
    fireEvent.click(noticeRetry)
    rerender(<DriverStoreStatus {...figuresProps} ordersLoading onReload={onReload} />)
    rerender(<DriverStoreStatus {...figuresProps} onReload={onReload} />)
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus()
  })

  it('Q-03 · a retry that fails again keeps the focus on «Try again»', () => {
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} ordersError onReload={onReload} />)
    const retry = within(screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')).getByRole('button', { name: 'Try again' })
    retry.focus()
    fireEvent.click(retry)
    rerender(<DriverStoreStatus {...figuresProps} ordersError ordersLoading onReload={onReload} />)
    rerender(<DriverStoreStatus {...figuresProps} ordersError onReload={onReload} />)
    expect(within(screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')).getByRole('button', { name: 'Try again' })).toHaveFocus()
  })

  it('Q-03 directed · a retry never takes the focus from where the person went while it loaded', () => {
    const onReload = vi.fn()
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} ordersError onReload={onReload} />)
    fireEvent.click(within(screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')).getByRole('button', { name: 'Try again' }))
    rerender(<DriverStoreStatus {...figuresProps} ordersLoading onReload={onReload} />)
    const search = screen.getByRole('searchbox', { name: 'Search store' })
    search.focus()
    rerender(<DriverStoreStatus {...figuresProps} onReload={onReload} />)
    expect(search).toHaveFocus()
  })

  it('Q-05 · «(N Busy)» never breaks inside its brackets', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const busy = metric('Total drivers').querySelector('[data-nowrap]')
    expect(busy).toHaveTextContent('(1 Busy)')
  })
})

// (row 31, driver-store-status P-9): a store whose connected drivers are all busy says so, in text, next to the Online drivers figure
describe('· P-9 · «All busy» per store', () => {
  const free = { id: 20, enabled: true, available: true, busy: false, drivergroups: [5] }
  const busy = { id: 21, enabled: true, available: true, busy: true, drivergroups: [5] }
  const busyDriver = [busy]
  const mixedDrivers = [busy, free]
  const onlineCell = row => row.querySelectorAll('td')[1]

  it('the table row shows the text mark in the Online drivers cell (it reads in the cell\'s accessible name)', () => {
    renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: busyDriver })} loading={false} ordersLoading={false} />)
    const row = screen.getByText('North Store').closest('tr')
    expect(within(onlineCell(row)).getByText('All busy')).toBeInTheDocument()
    expect(within(row).getByRole('cell', { name: /All busy/ })).toBe(onlineCell(row))
    expect(onlineCell(row).querySelector('bdi.odc-figure')).toHaveTextContent('1')
    expect(row.querySelectorAll('td')[0]).not.toHaveTextContent('All busy')
  })

  it('the table row has no mark when one connected driver is free', () => {
    renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: mixedDrivers })} loading={false} ordersLoading={false} />)
    expect(screen.queryByText('All busy')).toBeNull()
  })

  it('the table row has no mark with the drivers failed (the cell paints «—»)', () => {
    const rows = [{ ...buildStoreRows({ groups, drivers: busyDriver })[0], allBusy: true }]
    renderWithProviders(<StoresTable rows={rows} loading={false} ordersLoading={false} driversError />)
    expect(screen.queryByText('All busy')).toBeNull()
    expect(onlineCell(screen.getByText('North Store').closest('tr'))).toHaveTextContent('—')
  })

  it('a store with no connected drivers shows no mark', () => {
    renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: [] })} loading={false} ordersLoading={false} />)
    expect(screen.queryByText('All busy')).toBeNull()
  })

  it('the phone card shows the mark inside the Online drivers value, and not in the other figures', () => {
    phone.value = true
    try {
      renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: busyDriver })} loading={false} ordersLoading={false} />)
      const card = within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')[0]
      const values = Array.from(card.querySelectorAll('dd'))
      expect(values[0]).toHaveTextContent('All busy')
      expect(values[0].querySelector('bdi.odc-figure')).toHaveTextContent('1')
      values.slice(1).forEach(dd => expect(dd).not.toHaveTextContent('All busy'))
    } finally {
      phone.value = false
    }
  })

  it('the phone card has no mark when one connected driver is free, or with the drivers failed', () => {
    phone.value = true
    try {
      const { rerender } = renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: mixedDrivers })} loading={false} ordersLoading={false} />)
      expect(screen.queryByText('All busy')).toBeNull()
      const rows = [{ ...buildStoreRows({ groups, drivers: busyDriver })[0], allBusy: true }]
      rerender(<StoresTable rows={rows} loading={false} ordersLoading={false} driversError />)
      expect(screen.queryByText('All busy')).toBeNull()
    } finally {
      phone.value = false
    }
  })

  it('the screen passes it through: stores whose only connected driver is busy carry the mark', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    expect(screen.getAllByText('All busy')).toHaveLength(10) // 1 connected driver, busy, serves the 12 stores of group 5; 10 on the page
  })
})

// (row 30, driver-store-status P-8): the stores take their attention order when a load settles and when the search changes;
// between those moments the figures change in place and the rows keep their place
describe('· P-8 · the order is frozen between loads', () => {
  // attention order of figuresProps: Store 00 (3 unassigned), Store 01 (2), then the rest by name
  const names = () => screen.getAllByRole('rowheader').map(header => header.textContent)
  const hot = new Map([[111, 9], [100, 1]]) // a realtime event: Store 11 would now lead, Store 00 drops to 1
  const user = userEvent.setup()

  it('the first paint is the attention order', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    expect(names().slice(0, 3)).toEqual(['Store 00', 'Store 01', 'Store 02'])
  })

  it('a change of the figures that would change the order updates them in place and keeps the rows where they were', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const before = names()
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} />)
    expect(names()).toEqual(before)
    const first = screen.getAllByRole('rowheader')[0].closest('tr')
    expect(first).toHaveTextContent('Store 00')
    expect(first.querySelectorAll('td')[2]).toHaveTextContent('1') // the figure did move
    expect(valueOf(metric('Active unassigned'))).toHaveTextContent('10') // 9 + 1: the totals follow the data
  })

  it('a driver event that takes a store offline keeps its place too', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const before = names()
    rerender(<DriverStoreStatus {...figuresProps} drivers={[]} />) // every store now has no online driver; the attention order would not change here, the figure must
    expect(names()).toEqual(before)
    expect(screen.getAllByRole('rowheader')[0].closest('tr')).toHaveAttribute('data-no-online', '')
    rerender(<DriverStoreStatus {...figuresProps} drivers={[]} activeByBusiness={hot} />)
    expect(names()).toEqual(before)
  })

  it('a load cycle (loading true then false) takes the attention order again, the first load and every Reload', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} ordersLoading />)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} />)
    expect(names().slice(0, 2)).toEqual(['Store 11', 'Store 00']) // the first load settled: attention order
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={new Map([[105, 20]])} />)
    expect(names()[0]).toBe('Store 11') // an event: frozen
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={new Map([[105, 20]])} ordersLoading />)
    expect(names()[0]).toBe('Store 11') // still loading: frozen
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={new Map([[105, 20]])} />)
    expect(names()[0]).toBe('Store 05') // Reload settled
  })

  it('a structure load (stores or drivers) settling also takes the attention order again', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} groupsLoading />)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} driversLoading />)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} />)
    expect(names().slice(0, 2)).toEqual(['Store 11', 'Store 00'])
  })

  it('a change of the search text takes the attention order again', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} />)
    expect(names()[0]).toBe('Store 00')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: 'Store 1' } })
    expect(names().slice(0, 2)).toEqual(['Store 11', 'Store 10']) // new list: attention order (9 unassigned first)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={new Map([[110, 30]])} />)
    expect(names().slice(0, 2)).toEqual(['Store 11', 'Store 10']) // frozen while the same search stays
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: '' } })
    expect(names()[0]).toBe('Store 10') // clearing is a new list as well
  })

  it('a change of the page size keeps the frozen order (only the page resets)', async () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    rerender(<DriverStoreStatus {...figuresProps} activeByBusiness={hot} />)
    await user.click(screen.getByRole('button', { name: 'Items per page 10' }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    const all = names()
    expect(all).toHaveLength(12)
    expect(all[0]).toBe('Store 00')
    expect(all[11]).toBe('Store 11') // Store 11 would be the first by attention
  })

  it('a store that appears between loads goes after the stores in place, and the totals and KPIs follow the data', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    const grown = [{ id: 5, business: [...manyGroups[0].business, { id: 150, name: 'Store 50', enabled: true }] }]
    rerender(<DriverStoreStatus {...figuresProps} groups={grown} activeByBusiness={new Map([[150, 50]])} />)
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('13')
    expect(valueOf(metric('Active unassigned'))).toHaveTextContent('50')
    expect(names().slice(0, 3)).toEqual(['Store 00', 'Store 01', 'Store 02']) // Store 50 has the most orders but is new: it goes last
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(names()).toEqual(['Store 10', 'Store 11', 'Store 50'])
  })
})

// (row 29, driver-store-status P-4): the active stores that are in no delivery group are listed, tagged in text
describe('· P-4 · stores in no delivery group', () => {
  const TAG = 'Not in any delivery group'
  const loose = { id: 200, name: 'Zed Loose', enabled: true }
  const inGroups = manyGroups[0].business // Store 00 … Store 11, all of group 5
  const businesses = [...inGroups, loose]
  const withLoose = { ...figuresProps, businesses }

  it('the table row carries the tag as text under the store name, in the row header; it is not tinted «no online» and its 0 is not an alert (live check)', () => {
    const rows = buildStoreRows({ groups, businesses: [loose], drivers })
    renderWithProviders(<StoresTable rows={rows} loading={false} ordersLoading={false} />)
    const tr = screen.getByText('Zed Loose').closest('tr')
    expect(tr).not.toHaveAttribute('data-no-online')
    expect(tr.querySelector('[data-zero]')).toBeNull()
    expect(tr.querySelectorAll('td')[1]).toHaveTextContent(/^0/) // the Online drivers figure is still there, plain
    const header = within(tr).getByRole('rowheader')
    expect(header).toHaveTextContent(`Zed Loose${TAG}`)
    expect(within(header).getByText(TAG)).toBeInTheDocument()
    expect(screen.getAllByText(TAG)).toHaveLength(1)
    expect(within(screen.getByText('North Store').closest('tr')).queryByText(TAG)).toBeNull()
    expect(tr.querySelectorAll('.odc-figure')).toHaveLength(4)
  })

  it('the phone card carries the tag after the store name, outside the heading', () => {
    phone.value = true
    try {
      renderWithProviders(<StoresTable rows={buildStoreRows({ groups, businesses: [loose], drivers })} loading={false} ordersLoading={false} />)
      const cards = within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')
      const card = cards.find(item => item.textContent.includes('Zed Loose'))
      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(/^Zed Loose$/)
      expect(within(card).getByText(TAG)).toBeInTheDocument()
      expect(within(card).getByText(TAG).closest('h2')).toBeNull()
      expect(card).not.toHaveAttribute('data-no-online') // live check: the tag says why it has no drivers; the card is not an alert
      expect(card.querySelector('[data-zero]')).toBeNull()
      expect(cards.find(item => item.textContent.includes('North Store')).textContent).not.toContain(TAG)
    } finally {
      phone.value = false
    }
  })

  it('the screen lists the store of no group (13 stores, tag once) after the grouped ones, and the KPI counts it in the total and on its own line, not as «without online drivers» (live check)', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} />)
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('13')
    expect(refsOf(metric('Total active stores'))).toEqual(['0 without online drivers', '1 in no delivery group'])
    expect(metric('Total active stores').querySelector('[data-alert]')).toBeNull() // neutral: not the alert tone
    expect(metric('Total active stores').querySelectorAll('.odc-metric-ref bdi.odc-figure')).toHaveLength(2)
    expect(screen.getAllByRole('rowheader')).toHaveLength(10)
    expect(screen.queryByText(TAG)).toBeNull() // 13th by order: page 2
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('rowheader').map(header => header.textContent)).toEqual(['Store 10', 'Store 11', `Zed Loose${TAG}`])
    expect(screen.getAllByText(TAG)).toHaveLength(1)
  })

  it('the «in no delivery group» line shows only when the count is above 0', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    expect(refsOf(metric('Total active stores'))).toEqual(['0 without online drivers'])
  })

  it('«without online drivers» counts grouped stores only, and stays the alert when there are some', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} drivers={[]} />)
    expect(refsOf(metric('Total active stores'))).toEqual(['12 without online drivers', '1 in no delivery group'])
    expect(metric('Total active stores').querySelector('[data-alert]')).toHaveTextContent('12 without online drivers')
    expect(metric('Total active stores').querySelectorAll('[data-alert]')).toHaveLength(1)
  })

  it('the page that opens on many stores of no group lists the grouped stores first (live check: 23 of 35 in no group)', () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ id: 300 + i, name: `Aaa ${String(i).padStart(2, '0')}`, enabled: true }))
    renderWithProviders(<DriverStoreStatus {...figuresProps} businesses={[...inGroups, ...many]} />)
    const first = screen.getAllByRole('rowheader').map(header => header.textContent)
    expect(first.filter(name => name.includes(TAG))).toEqual([]) // 12 grouped stores fill page 1 before any of the 23
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('35')
    expect(refsOf(metric('Total active stores'))).toEqual(['0 without online drivers', '23 in no delivery group'])
  })

  it('the search finds the store by its name, not by the tag', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: 'delivery group' } })
    expect(screen.queryByText(TAG)).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search store' }), { target: { value: 'zed' } })
    expect(screen.getAllByRole('rowheader')).toHaveLength(1)
  })

  it('with no businesses (or none outside the groups) the screen is exactly today: 12 stores, no tag', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} />)
    expect(screen.queryByText(TAG)).toBeNull()
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
    rerender(<DriverStoreStatus {...figuresProps} businesses={inGroups} />)
    expect(screen.queryByText(TAG)).toBeNull()
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
  })

  it('a disabled business is not listed', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} businesses={[...inGroups, { id: 201, name: 'Closed', enabled: false }]} />)
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
    expect(screen.queryByText('Closed')).toBeNull()
  })

  it('an unassigned active order makes the store urgent: it stays first, with the figure', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} activeByBusiness={new Map([[200, 4], [100, 3]])} />)
    const first = screen.getAllByRole('rowheader')[0].closest('tr')
    expect(first).toHaveTextContent('Zed Loose')
    expect(first.querySelectorAll('td')[2]).toHaveTextContent('4')
    expect(first.querySelector('[data-attention]')).not.toBeNull()
  })

  it('a businesses error keeps the page as today (the stores of the groups) and shows the notice with «Try again»', () => {
    const onReload = vi.fn()
    renderWithProviders(<DriverStoreStatus {...figuresProps} businesses={[]} businessesError onReload={onReload} />)
    const notice = screen.getByText("Some figures couldn't be updated.").closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('rowheader')).toHaveLength(10)
    expect(screen.queryByText(TAG)).toBeNull()
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('12')
    fireEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('a businesses error that keeps the businesses it had still shows the notice (and their rows)', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} businessesError />)
    expect(screen.getByText("Some figures couldn't be updated.")).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' })) // the store of no group is last now
    expect(screen.getAllByText(TAG)).toHaveLength(1)
  })

  it('with the groups failed, no store is called «not in any delivery group»: the businesses are not added and the error shows', () => {
    renderWithProviders(<DriverStoreStatus {...withLoose} groups={[]} groupsError structureError />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the stores.")
    expect(screen.queryByText(TAG)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('the businesses loading counts as the structure loading: the table is busy and Reload is busy', () => {
    renderWithProviders(<DriverStoreStatus {...figuresProps} businessesLoading />)
    expect(screen.getByRole('table', { name: 'Driver store status' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveAttribute('aria-busy', 'true')
  })

  it('when the businesses settle, the attention order is taken again (the store of no group with unassigned orders leads)', () => {
    const urgent = new Map([...activeByBusiness, [200, 4]])
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} activeByBusiness={urgent} businesses={[]} businessesLoading />)
    rerender(<DriverStoreStatus {...withLoose} activeByBusiness={urgent} />)
    expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('Zed Loose')
  })

  it('a store that shows up between loads goes after the rows in place (row 30 still holds)', () => {
    const { rerender } = renderWithProviders(<DriverStoreStatus {...figuresProps} businesses={inGroups} />)
    rerender(<DriverStoreStatus {...figuresProps} businesses={businesses} />)
    expect(valueOf(metric('Total active stores'))).toHaveTextContent('13')
    expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('Store 00')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('rowheader').map(header => header.textContent)).toEqual(['Store 10', 'Store 11', `Zed Loose${TAG}`])
  })
})

// (row 28, driver-store-status P-1, D-22): each store has two exits, «View drivers» and «View unassigned orders»
describe('· P-1 · exits of each store (row 28, D-22)', () => {
  const LocationProbe = () => {
    const location = useLocation()
    return <output data-testid='location'>{location.pathname}{location.search}</output>
  }
  const hrefsOf = scope => within(scope).getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])
  const driversHref = '/drivers-dashboard?groups=5'
  const ordersHref = '/deliveries?status=inProgress&unassigned=1&business=8'
  const loose = { id: 200, name: 'Zed Loose', enabled: true }
  const multiGroups = [
    { id: 12, business: [{ id: 8, name: 'North Store', enabled: true }] },
    { id: 3, business: [{ id: 8, name: 'North Store', enabled: true }] }
  ]
  const northRows = () => buildStoreRows({ groups, drivers })
  const renderTable = (rows, props = {}, options) => renderWithProviders(
    <>
      <StoresTable rows={rows} loading={false} ordersLoading={false} {...props} />
      <LocationProbe />
    </>,
    options
  )

  it('the table has an «Actions» column heading, last', () => {
    renderTable(northRows())
    const headings = screen.getAllByRole('columnheader').map(heading => heading.textContent)
    expect(headings).toEqual(['Store', 'Total drivers', 'Online drivers', 'Active unassigned', 'Finished today', 'Actions'])
  })

  // (rows 28-29, live check): in the table the two exits sit behind one P/Menu per row (icon trigger), so the Actions column is
  // 44px wide and the Store column keeps its room at 1024; the phone cards keep the two text links
  const user = userEvent.setup()
  const triggerOf = name => screen.getByRole('button', { name: `Actions for ${name}` })
  const openMenu = async (name) => {
    await user.click(triggerOf(name))
    return screen.findByRole('menu')
  }
  const itemsOf = menu => within(menu).getAllByRole('menuitem').map(item => item.textContent)

  it('the row has a menu button named for the store, in its last cell, and no inline link', () => {
    renderTable(northRows())
    const row = screen.getByText('North Store').closest('tr')
    const trigger = within(row).getByRole('button', { name: 'Actions for North Store' })
    expect(trigger.closest('td')).toBe(row.querySelector('td:last-child'))
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveClass('odc-btn') // the Product icon button: it inherits the 44px touch area
    expect(within(row).queryByRole('link')).toBeNull()
    expect(within(row).queryByRole('group')).toBeNull()
  })

  it('the menu offers the two exits and each one goes to the exact route inside the app', async () => {
    renderTable(northRows())
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    expect(itemsOf(await openMenu('North Store'))).toEqual(['View drivers', 'View unassigned orders'])
    await user.click(screen.getByRole('menuitem', { name: 'View drivers' }))
    expect(screen.getByTestId('location')).toHaveTextContent(driversHref)
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View unassigned orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent(ordersHref)
  })

  const multiDrivers = [
    { id: 1, enabled: true, available: true, busy: false, drivergroups: [12] },
    { id: 2, enabled: true, available: false, busy: false, drivergroups: [3] }
  ]

  it('a store of several groups sends all of them (each with drivers), sorted, to the drivers board', async () => {
    renderTable(buildStoreRows({ groups: multiGroups, drivers: multiDrivers }))
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View drivers' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/drivers-dashboard?groups=3,12')
  })

  // (review L1): a group no driver serves would show its raw id in the drivers board pill
  it('review L1 · the link carries only the groups with an enabled driver, and a store with 0 drivers has no «View drivers»', async () => {
    renderTable(buildStoreRows({ groups: multiGroups, drivers: [multiDrivers[0], { id: 3, enabled: false, available: true, drivergroups: [3] }] }))
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View drivers' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/drivers-dashboard\?groups=12$/)
  })

  it('review L1 · a store of a group with no enabled driver offers only the unassigned orders (table and card)', async () => {
    const noDrivers = buildStoreRows({ groups, drivers: [{ id: 9, enabled: false, available: true, drivergroups: [5] }] })
    renderTable(noDrivers)
    expect(itemsOf(await openMenu('North Store'))).toEqual(['View unassigned orders'])
  })

  // (review M4): the tab that holds the store's unassigned orders (pending vs in progress)
  it('review M4 · the orders link opens «Pending» when every unassigned order of the store is pending', async () => {
    renderTable(buildStoreRows({ groups, drivers, activeByBusiness: new Map([[8, 2]]), activeInProgressByBusiness: new Map() }))
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View unassigned orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/deliveries?status=pending&unassigned=1&business=8')
  })

  it('review M4 · the screen hands the controller\'s in-progress counts to the rows', async () => {
    renderWithProviders(<><DriverStoreStatus drivers={drivers} groups={groups} activeByBusiness={new Map([[8, 2]])} activeInProgressByBusiness={new Map()} orderCounts={{ total: 0, assigned: 0, finished: 0 }} onReload={vi.fn()} /><LocationProbe /></>)
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View unassigned orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/deliveries?status=pending&unassigned=1&business=8')
  })

  it('review M4 · the orders link opens «In progress» when the store has any in-progress unassigned order', async () => {
    renderTable(buildStoreRows({ groups, drivers, activeByBusiness: new Map([[8, 2]]), activeInProgressByBusiness: new Map([[8, 1]]) }))
    await openMenu('North Store')
    await user.click(screen.getByRole('menuitem', { name: 'View unassigned orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent(ordersHref)
  })

  it('a store of no delivery group has no «View drivers», only the unassigned orders of that store', async () => {
    renderTable(buildStoreRows({ groups, businesses: [loose], drivers }))
    expect(itemsOf(await openMenu('Zed Loose'))).toEqual(['View unassigned orders'])
    await user.click(screen.getByRole('menuitem', { name: 'View unassigned orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/deliveries?status=inProgress&unassigned=1&business=200')
  })

  it('Escape closes the menu and hands the focus back to its button', async () => {
    renderTable(northRows())
    await openMenu('North Store')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(triggerOf('North Store')).toHaveFocus()
  })

  it('the exits show with the drivers failed or the orders failed (they open other pages)', async () => {
    const { rerender } = renderTable(northRows(), { driversError: true })
    expect(itemsOf(await openMenu('North Store'))).toHaveLength(2)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    rerender(<StoresTable rows={northRows()} loading={false} ordersLoading={false} ordersError />)
    expect(itemsOf(await openMenu('North Store'))).toHaveLength(2)
  })

  it('the loading table (skeleton rows) has no exits', () => {
    renderTable([], { loading: true })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Actions for / })).toBeNull()
  })

  it('the screen draws one Actions button on each of the 10 rows of the page, and no inline link in the table', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    expect(screen.getAllByRole('button', { name: /^Actions for Store / })).toHaveLength(10)
    expect(within(screen.getByRole('table', { name: 'Driver store status' })).queryByRole('link')).toBeNull()
  })

  it('the screen keeps the «Actions» column heading last', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} />)
    const headings = screen.getAllByRole('columnheader')
    expect(headings[headings.length - 1]).toHaveTextContent('Actions')
  })

  describe('phone cards', () => {
    const renderCards = (rows, props = {}) => {
      phone.value = true
      return renderTable(rows, props)
    }
    const cardOf = name => within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem').find(item => item.textContent.includes(name))
    afterEach(() => { phone.value = false })

    it('each card ends with the same group and the same hrefs, after the figures', () => {
      renderCards(northRows())
      const card = cardOf('North Store')
      const group = within(card).getByRole('group', { name: 'Actions for North Store' })
      expect(hrefsOf(group)).toEqual([['View drivers', driversHref], ['View unassigned orders', ordersHref]])
      expect(card.querySelector('dl').compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      within(group).getAllByRole('link').forEach(link => expect(link).toHaveClass('odc-btn'))
    })

    it('a card of a store of no group has only «View unassigned orders»', () => {
      renderCards(buildStoreRows({ groups, businesses: [loose], drivers }))
      expect(hrefsOf(within(cardOf('Zed Loose')).getByRole('group'))).toEqual([['View unassigned orders', '/deliveries?status=inProgress&unassigned=1&business=200']])
    })

    it('review M4 and L1 · a card links to the pending tab and has no «View drivers» when the store has 0 drivers', () => {
      renderCards(buildStoreRows({ groups, drivers: [], activeByBusiness: new Map([[8, 1]]), activeInProgressByBusiness: new Map() }))
      expect(hrefsOf(within(cardOf('North Store')).getByRole('group'))).toEqual([['View unassigned orders', '/deliveries?status=pending&unassigned=1&business=8']])
    })

    it('clicking a card exit goes inside the app', () => {
      renderCards(northRows())
      fireEvent.click(within(cardOf('North Store')).getByRole('link', { name: 'View drivers' }))
      expect(screen.getByTestId('location')).toHaveTextContent(driversHref)
    })

    it('a plain click on a card link goes inside the app; the browser keeps the modified clicks', () => {
      renderCards(northRows())
      const link = within(cardOf('North Store')).getByRole('link', { name: 'View drivers' })
      // the browser's default (a new tab) must stay: the app does not prevent it. jsdom cannot navigate, so a last listener stops it after the check.
      const seen = []
      const watch = event => { seen.push(event.defaultPrevented); event.preventDefault() }
      document.addEventListener('click', watch)
      fireEvent.click(link, { ctrlKey: true })
      fireEvent.click(link, { metaKey: true })
      fireEvent.click(link, { button: 1 })
      document.removeEventListener('click', watch)
      expect(seen).toEqual([false, false, false])
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    })

    it('the skeleton cards have no exits, and the exits show with an orders or drivers error', () => {
      const { rerender } = renderCards([], { loading: true })
      expect(screen.queryByRole('link')).toBeNull()
      rerender(<StoresTable rows={northRows()} loading={false} ordersLoading={false} ordersError driversError />)
      expect(within(cardOf('North Store')).getAllByRole('link')).toHaveLength(2)
    })
  })
})

// (T10): a store with no connected drivers is tinted red, and the tint never carries the meaning alone: «No drivers online» says it in text
describe('· «No drivers online» per store', () => {
  const loose = { id: 200, name: 'Zed Loose', enabled: true }
  const online = { id: 30, enabled: true, available: true, busy: false, drivergroups: [5] }
  const none = () => buildStoreRows({ groups, drivers: [] })
  const showsText = () => screen.queryByText('No drivers online')

  it('the table row of a store with 0 connected drivers says it in the Online drivers cell', () => {
    renderWithProviders(<StoresTable rows={none()} loading={false} ordersLoading={false} />)
    const row = screen.getByText('North Store').closest('tr')
    expect(within(row.querySelectorAll('td')[1]).getByText('No drivers online')).toBeInTheDocument()
  })

  it('a store in no delivery group (not tinted) and a store with connected drivers do not carry it', () => {
    renderWithProviders(<StoresTable rows={buildStoreRows({ groups: [], businesses: [loose], drivers: [online] })} loading={false} ordersLoading={false} />)
    expect(showsText()).toBeNull()
  })

  it('a store with connected drivers does not carry it', () => {
    renderWithProviders(<StoresTable rows={buildStoreRows({ groups, drivers: [online] })} loading={false} ordersLoading={false} />)
    expect(showsText()).toBeNull()
  })

  it('with the drivers failed the table paints «—» and no text', () => {
    renderWithProviders(<StoresTable rows={none()} loading={false} ordersLoading={false} driversError />)
    expect(showsText()).toBeNull()
  })

  describe('phone cards', () => {
    afterEach(() => { phone.value = false })

    it('the card of a store with 0 connected drivers says it inside the Online drivers value', () => {
      phone.value = true
      renderWithProviders(<StoresTable rows={none()} loading={false} ordersLoading={false} />)
      const card = within(screen.getByRole('list', { name: 'Driver store status' })).getAllByRole('listitem')[0]
      expect(card.querySelectorAll('dd')[0]).toHaveTextContent('No drivers online')
    })

    it('the card of an ungrouped store, of one with connected drivers, and with the drivers failed do not', () => {
      phone.value = true
      const { rerender } = renderWithProviders(<StoresTable rows={buildStoreRows({ groups: [], businesses: [loose], drivers: [online] })} loading={false} ordersLoading={false} />)
      expect(showsText()).toBeNull()
      rerender(<StoresTable rows={buildStoreRows({ groups, drivers: [online] })} loading={false} ordersLoading={false} />)
      expect(showsText()).toBeNull()
      rerender(<StoresTable rows={none()} loading={false} ordersLoading={false} driversError />)
      expect(showsText()).toBeNull()
    })
  })
})

// redesign tanda AB (O-3): /driver-store-status started at x = 272 (24px gutter after the 248px sidebar) while /deliveries,
// /all-in-one and /drivers-dashboard start at x = 268 (their 20px page padding). Same inset, written with the space tokens (24 - 4 = 20).
describe('· O-3 · the page inset is the one of the other operations pages', () => {
  it('pads the page with 20px (space-5 minus space-1), not with the 24px page gutter', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../styles.js'), 'utf8')
    const container = /export const Container = styled\.div`([\s\S]*?)`/.exec(source)[1]
    expect(container).toMatch(/padding:\s*calc\(var\(--od-space-5\) - var\(--od-space-1\)\);/)
    expect(container).not.toMatch(/page-gutter/)
  })
})

// the header writes the zone the day is counted in, and says when it is the browser's for lack of one
describe('DriverStoreStatus screen · time zone', () => {
  it('writes the user\'s zone under the title', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} timeZone={{ zone: 'America/Bogota', fallback: false }} />)
    expect(screen.getByText('Times in America/Bogota')).toBeInTheDocument()
  })

  it('says when it falls back to the browser\'s zone', () => {
    renderWithProviders(<DriverStoreStatus {...uiProps} timeZone={{ zone: 'Asia/Tokyo', fallback: true }} />)
    expect(screen.getByText('Times in Asia/Tokyo, your browser’s time zone (none is set here)')).toBeInTheDocument()
  })
})
