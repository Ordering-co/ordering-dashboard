/* eslint-disable import/first */
// «Select all N» on /orders (decision 3 of the orders pilot, 2026-10-06). The bar offers the
// matching orders of the tab + filters + search, not only the page; acting on more than the
// page asks first; the bulk handlers are the same ones the page selection uses.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ tableProps: null, project: 'demo', level: 0 }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ replace: vi.fn(), location: { pathname: '/orders' } })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: mocks.level } }],
  useApi: () => [{ project: mocks.project }]
}))
vi.mock('../../OrdersTable', () => ({
  OrdersTable: (props) => {
    mocks.tableProps = props
    return <div data-testid='table' />
  }
}))
vi.mock('../../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
vi.mock('../../OrderStatusTypeSelector', () => ({
  OrderStatusTypeSelector: (props) => (
    <button type='button' onClick={() => props.handleChangeMultiOrdersStatus(7)}>Change status</button>
  )
}))
vi.mock('../../OrderDelete', () => ({
  OrderDelete: (props) => <button type='button' onClick={() => props.handleDeleteMultiOrders('code')}>Delete</button>
}))
vi.mock('../../OrdersDashboardControls/styles', () => ({
  WrapOrderStatusTypeSelector: ({ children }) => <div>{children}</div>
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersListing } from '..'

const EMPTY_FILTERS = { orderId: null, statuses: [], businessIds: [], customerName: null }
const PAGE = [{ id: 1 }, { id: 2 }, { id: 3 }]
const ALL_IDS = Array.from({ length: 340 }, (_, index) => index + 1)

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })
  return { promise, resolve, reject }
}

// A stand-in for the controller: it owns `selectedOrderIds` and toggles a row like the real one.
const Harness = ({ initialSelected = [1, 2, 3], spies, listProps }) => {
  const [selected, setSelected] = useState(initialSelected)
  spies.selected = selected
  const setSelectedOrderIds = (ids) => { spies.setSelectedOrderIds(ids); setSelected(ids) }
  const handleSelectedOrderIds = (id) => {
    spies.handleSelectedOrderIds(id)
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }
  return (
    <FilterValuesContext.Provider value={[EMPTY_FILTERS, { handleFilterValues: vi.fn() }]}>
      <OrdersListing
        orderList={{ loading: false, orders: PAGE }}
        pagination={{ total: 340, currentPage: 1, pageSize: 3 }}
        ordersStatusGroup='pending'
        groupStatus='pending'
        orderListView='table'
        filterValues={EMPTY_FILTERS}
        searchValue={null}
        allowColumns={{}}
        setAllowColumns={vi.fn()}
        saveUserSettings={vi.fn()}
        selectedOrderIds={selected}
        setSelectedOrderIds={setSelectedOrderIds}
        handleSelectedOrderIds={handleSelectedOrderIds}
        handleChangeMultiOrdersStatus={spies.handleChangeMultiOrdersStatus}
        handleDeleteMultiOrders={spies.handleDeleteMultiOrders}
        getPageOrders={vi.fn()}
        canSelectAllMatching
        getAllMatchingOrderIds={spies.getAllMatchingOrderIds}
        {...listProps}
      />
    </FilterValuesContext.Provider>
  )
}

const makeSpies = () => ({
  setSelectedOrderIds: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  handleChangeMultiOrdersStatus: vi.fn(),
  handleDeleteMultiOrders: vi.fn(),
  getAllMatchingOrderIds: vi.fn(() => Promise.resolve(ALL_IDS)),
  selected: []
})

const setup = (options = {}) => {
  const spies = options.spies ?? makeSpies()
  const view = render(<Harness spies={spies} {...options} />)
  const rerenderWith = (listProps) => view.rerender(<Harness spies={spies} {...options} listProps={listProps} />)
  return { spies, rerenderWith, user: userEvent.setup(), ...view }
}

const linkName = 'Select all 340 orders'
const bar = () => screen.getByRole('region', { name: 'Actions for selected orders' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tableProps = null
  mocks.project = 'demo'
  mocks.level = 0
  window.localStorage.clear()
})

describe('«Select all N» · when the link appears', () => {
  it('shows it when every row of the page is selected and there are more matching orders', () => {
    setup()
    expect(within(bar()).getByRole('status')).toHaveTextContent('3 selected')
    expect(within(bar()).getByRole('button', { name: linkName })).toBeInTheDocument()
  })

  it('does not show it while the page is only partly selected', () => {
    setup({ initialSelected: [1, 2] })
    expect(within(bar()).queryByRole('button', { name: linkName })).toBeNull()
  })

  it('does not show it when the page already holds every matching order', () => {
    setup({ listProps: { pagination: { total: 3, currentPage: 1, pageSize: 3 } } })
    expect(within(bar()).queryByRole('button', { name: /Select all/ })).toBeNull()
  })

  it('is only on /orders: no link without the gate or without the controller function', () => {
    const first = setup({ listProps: { canSelectAllMatching: false } })
    expect(screen.queryByRole('button', { name: linkName })).toBeNull()
    first.unmount()
    setup({ listProps: { getAllMatchingOrderIds: undefined } })
    expect(screen.queryByRole('button', { name: linkName })).toBeNull()
  })

  it('stays per page where the project locks final orders for the role (their ids carry no status)', () => {
    mocks.project = 'quickiedelivery'
    mocks.level = 2
    setup()
    expect(within(bar()).getByRole('status')).toHaveTextContent('3 selected')
    expect(within(bar()).queryByRole('button', { name: linkName })).toBeNull()
  })

  it('draws no bar at all for the lateral bars and detail tabs (isSelectedOrders)', () => {
    setup({ listProps: { isSelectedOrders: true } })
    expect(screen.queryByRole('region', { name: 'Actions for selected orders' })).toBeNull()
  })

  it('sits in the tab order right after the count, before the actions', async () => {
    const { user } = setup()
    const link = within(bar()).getByRole('button', { name: linkName })
    const count = within(bar()).getByRole('status')
    expect(Boolean(count.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // Tabbing into the bar lands on the link first (the count is not focusable), then on the first action.
    for (let step = 0; step < 10 && !bar().contains(document.activeElement); step += 1) await user.tab()
    expect(link).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Change status' })).toHaveFocus()
  })
})

describe('«Select all N» · pressing it', () => {
  it('asks the controller for the ids once and selects all of them through the same setter', async () => {
    const { spies, user } = setup()
    await user.click(screen.getByRole('button', { name: linkName }))
    await waitFor(() => expect(spies.setSelectedOrderIds).toHaveBeenCalledWith(ALL_IDS))
    expect(spies.getAllMatchingOrderIds).toHaveBeenCalledTimes(1)
  })

  it('reads «All N orders selected» in the live region, with Clear selection, and the focus on it', async () => {
    const { user } = setup()
    within(bar()).getByRole('button', { name: linkName }).focus()
    await user.keyboard('{Enter}')
    const status = await within(bar()).findByText('All 340 orders selected')
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(within(bar()).queryByRole('button', { name: /Select all/ })).toBeNull()
    expect(within(bar()).getByRole('button', { name: 'Clear selection' })).toHaveFocus()
  })

  it('is busy while the ids load: aria-busy, a status that says so, no second request', async () => {
    const pending = deferred()
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockReturnValue(pending.promise)
    const { user } = setup({ spies })
    await user.click(screen.getByRole('button', { name: linkName }))
    expect(bar()).toHaveAttribute('aria-busy', 'true')
    expect(within(bar()).getByRole('status')).toHaveTextContent('Selecting all 340 orders…')
    await user.click(screen.getByRole('button', { name: linkName }))
    expect(spies.getAllMatchingOrderIds).toHaveBeenCalledTimes(1)
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
    await act(async () => pending.resolve(ALL_IDS))
    expect(bar()).not.toHaveAttribute('aria-busy')
    expect(within(bar()).getByRole('status')).toHaveTextContent('All 340 orders selected')
  })

  it('counts what it really got: the ids it received, not the figure of the footer', async () => {
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockResolvedValue(ALL_IDS.slice(0, 338))
    const { user } = setup({ spies })
    await user.click(screen.getByRole('button', { name: linkName }))
    expect(await within(bar()).findByText('All 338 orders selected')).toBeInTheDocument()
  })

  it('on error says so inside the bar, keeps the page selection and lets it try again', async () => {
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockRejectedValueOnce(new Error('boom'))
    const { user } = setup({ spies })
    await user.click(screen.getByRole('button', { name: linkName }))
    const alert = await within(bar()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t select all the orders. The page selection stays.')
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
    expect(within(bar()).getByRole('status')).toHaveTextContent('3 selected')
    await user.click(within(bar()).getByRole('button', { name: linkName }))
    expect(await within(bar()).findByText('All 340 orders selected')).toBeInTheDocument()
    expect(within(bar()).queryByRole('alert')).toBeNull()
  })

  it('Clear selection while the ids load cancels them: a late answer selects nothing', async () => {
    const pending = deferred()
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockReturnValue(pending.promise)
    const { user } = setup({ spies })
    await user.click(screen.getByRole('button', { name: linkName }))
    await user.click(within(bar()).getByRole('button', { name: 'Clear selection' }))
    expect(spies.setSelectedOrderIds).toHaveBeenLastCalledWith([])
    spies.setSelectedOrderIds.mockClear()
    await act(async () => pending.resolve(ALL_IDS))
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
  })
})

// redesign fix-qa C2 (B10): the table is memoised and does not compare its handlers, so it keeps calling the
// handler of the render it last drew. A row clicked while the ids load must still cancel the load: the handlers the
// listing hands the table read the current state, not the state of that render.
describe('«Select all N» · a row clicked while the ids load', () => {
  it('cancels the load: the late ids do not overwrite the manual selection (handler of a stale table render)', async () => {
    const pending = deferred()
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockReturnValue(pending.promise)
    const { user } = setup({ spies })
    // what a memoised table still holds while the listing re-renders around it
    const staleTableProps = mocks.tableProps
    await user.click(screen.getByRole('button', { name: linkName }))
    expect(bar()).toHaveAttribute('aria-busy', 'true')
    act(() => staleTableProps.handleSelectedOrderIds(2))
    expect(spies.handleSelectedOrderIds).toHaveBeenCalledWith(2)
    spies.setSelectedOrderIds.mockClear()
    await act(async () => pending.resolve(ALL_IDS))
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
    expect(spies.selected).toEqual([1, 3])
    expect(bar()).not.toHaveAttribute('aria-busy')
    expect(within(bar()).getByRole('status')).toHaveTextContent('2 selected')
  })

  it('the select-page checkbox while it loads cancels it too', async () => {
    const pending = deferred()
    const spies = makeSpies()
    spies.getAllMatchingOrderIds.mockReturnValue(pending.promise)
    const { user } = setup({ spies })
    const staleTableProps = mocks.tableProps
    await user.click(screen.getByRole('button', { name: linkName }))
    act(() => staleTableProps.setSelectedOrderIds([1, 2]))
    spies.setSelectedOrderIds.mockClear()
    await act(async () => pending.resolve(ALL_IDS))
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
    expect(spies.selected).toEqual([1, 2])
  })

  it('gives the table handlers that do not change between renders', async () => {
    const { rerenderWith } = setup()
    const first = mocks.tableProps
    rerenderWith({ searchValue: null })
    expect(mocks.tableProps.handleSelectedOrderIds).toBe(first.handleSelectedOrderIds)
    expect(mocks.tableProps.setSelectedOrderIds).toBe(first.setSelectedOrderIds)
  })
})

describe('«Select all N» · going back to the page selection', () => {
  const pressAndWait = async (ctx) => {
    await ctx.user.click(screen.getByRole('button', { name: linkName }))
    await within(bar()).findByText('All 340 orders selected')
    ctx.spies.setSelectedOrderIds.mockClear()
  }

  it('unchecking a row leaves «all» mode and keeps the other rows of the page', async () => {
    const ctx = setup()
    await pressAndWait(ctx)
    act(() => mocks.tableProps.handleSelectedOrderIds(2))
    expect(ctx.spies.setSelectedOrderIds).toHaveBeenCalledWith([1, 3])
    expect(ctx.spies.handleSelectedOrderIds).not.toHaveBeenCalled()
    expect(within(bar()).getByRole('status')).toHaveTextContent('2 selected')
    expect(within(bar()).queryByText(/All 340/)).toBeNull()
  })

  it('unchecking the page header clears everything, not just the page', async () => {
    const ctx = setup()
    await pressAndWait(ctx)
    // The table's «select page» off: the full list minus the page ids.
    act(() => mocks.tableProps.setSelectedOrderIds(ALL_IDS.filter(id => ![1, 2, 3].includes(id))))
    expect(ctx.spies.setSelectedOrderIds).toHaveBeenCalledWith([])
  })

  it.each([
    ['the page changes', { pagination: { total: 340, currentPage: 2, pageSize: 3 } }],
    ['the page size changes', { pagination: { total: 340, currentPage: 1, pageSize: 10 } }],
    ['a filter changes', { filterValues: { ...EMPTY_FILTERS, customerName: 'Ana' } }],
    ['the search changes', { searchValue: 'pizza' }],
    ['the tab changes', { ordersStatusGroup: 'completed' }]
  ])('clears «all» and the selection when %s', async (_name, change) => {
    const ctx = setup()
    await pressAndWait(ctx)
    ctx.rerenderWith(change)
    expect(ctx.spies.setSelectedOrderIds).toHaveBeenCalledWith([])
    expect(screen.queryByText(/All 340 orders selected/)).toBeNull()
  })

  it('the controller shrinking the selection (the status queue advancing) leaves «all» mode without touching it', async () => {
    const spies = makeSpies()
    const Wrapper = () => {
      const [selected, setSelected] = useState([1, 2, 3])
      return (
        <>
          <button type='button' onClick={() => setSelected(prev => prev.slice(1))}>advance queue</button>
          <FilterValuesContext.Provider value={[EMPTY_FILTERS, { handleFilterValues: vi.fn() }]}>
            <OrdersListing
              orderList={{ loading: false, orders: PAGE }}
              pagination={{ total: 340, currentPage: 1, pageSize: 3 }}
              ordersStatusGroup='pending'
              groupStatus='pending'
              orderListView='table'
              filterValues={EMPTY_FILTERS}
              allowColumns={{}}
              setAllowColumns={vi.fn()}
              selectedOrderIds={selected}
              setSelectedOrderIds={(ids) => { spies.setSelectedOrderIds(ids); setSelected(ids) }}
              handleSelectedOrderIds={vi.fn()}
              handleChangeMultiOrdersStatus={vi.fn()}
              handleDeleteMultiOrders={vi.fn()}
              getPageOrders={vi.fn()}
              canSelectAllMatching
              getAllMatchingOrderIds={() => Promise.resolve([1, 2, 3, 4, 5])}
            />
          </FilterValuesContext.Provider>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    await user.click(screen.getByRole('button', { name: linkName }))
    await within(bar()).findByText('All 5 orders selected')
    spies.setSelectedOrderIds.mockClear()
    await user.click(screen.getByRole('button', { name: 'advance queue' }))
    expect(within(bar()).getByRole('status')).toHaveTextContent('4 selected')
    expect(spies.setSelectedOrderIds).not.toHaveBeenCalled()
  })
})

describe('«Select all N» · acting on more than the page', () => {
  const selectAll = async (ctx) => {
    await ctx.user.click(screen.getByRole('button', { name: linkName }))
    await within(bar()).findByText('All 340 orders selected')
  }

  it('asks first for a status change: title with the count, the status in the text, nothing sent yet', async () => {
    const ctx = setup()
    await selectAll(ctx)
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Change the status of 340 orders?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Each order moves to Accepted by business. This can’t be undone in one step.')
    expect(ctx.spies.handleChangeMultiOrdersStatus).not.toHaveBeenCalled()
    // (3): Base UI moves the initial focus to Cancel a frame after the dialog mounts, so the opener
    // can still hold it at the first read (failed 9/20 in isolation). Wait for it; the focus must still land on Cancel.
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    await waitFor(() => expect(cancel).toHaveFocus())
  })

  it('Cancel sends nothing and keeps «all» selected', async () => {
    const ctx = setup()
    await selectAll(ctx)
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    await ctx.user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctx.spies.handleChangeMultiOrdersStatus).not.toHaveBeenCalled()
    expect(within(bar()).getByRole('status')).toHaveTextContent('All 340 orders selected')
  })

  it('Confirm calls the same bulk handler with the status, once', async () => {
    const ctx = setup()
    await selectAll(ctx)
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    await ctx.user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Change status' }))
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledTimes(1)
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
  })

  // redesign fix-qa C2 (B5): only «all» asks. A manual selection that spans several pages goes straight, as in main
  // (OrdersDashboardControls:46-58); it was the owner's own selection, not a sweep of the whole list.
  it('does not ask for a manual selection larger than the page: the handler is called straight away', async () => {
    const ctx = setup({ initialSelected: [1, 2, 3, 4] })
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledTimes(1)
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
  })

  it('leaving «all» by hand puts the straight-through behaviour back: the page selection does not ask', async () => {
    const ctx = setup()
    await selectAll(ctx)
    act(() => mocks.tableProps.handleSelectedOrderIds(2))
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
  })

  it('does not ask when the selection fits in the page: the handler is called straight away', async () => {
    const ctx = setup()
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
  })

  it('other screens (no gate) never ask: same as before', async () => {
    const ctx = setup({ initialSelected: [1, 2, 3, 4], listProps: { canSelectAllMatching: false } })
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Change status' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctx.spies.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
  })

  it('delete keeps its own password confirmation: the handler goes straight to OrderDelete, no dialog of ours', async () => {
    const ctx = setup()
    await selectAll(ctx)
    await ctx.user.click(within(bar()).getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctx.spies.handleDeleteMultiOrders).toHaveBeenCalledWith('code')
    expect(ctx.spies.selected).toEqual(ALL_IDS)
  })
})
