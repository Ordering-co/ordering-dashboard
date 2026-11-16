/* eslint-disable import/first */
// redesign page-bugs Y (W1 review F2 and F3, decision n.º 1): /all-in-one and its bulk controls.
//  - F2: below 1024px the page scrolls and the sub-bar (Delete, Change status) scrolled away with the list and showed no count.
//    Now, while orders are selected, the page draws the SelectionBar of /orders (a named region, a polite «N selected», sticky at the
//    foot of the orders) and the two bulk actions live there instead of the sub-bar (one copy of each, never two). From 1024px the
//    sub-bar is unchanged and there is no bar (allInOne.w15.test.jsx pins that the list never draws its own).
//  - F3: after a bulk Change status (or a delete, or «Clear selection») focus fell to <body>. It now goes to the bar if it is still
//    there, otherwise to the orders list region; focus that is somewhere alive is never taken.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ stacked: false }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{ project: 'demo' }],
  OrdersManage: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../utils', async () => ({
  ...(await vi.importActual('../../../utils')),
  learnOptionsValues: () => []
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))
vi.mock('../../../hooks/useBoardStacked', () => ({ useBoardStacked: () => runtime.stacked }))

vi.mock('../OrdersContentHeader', () => ({ OrdersContentHeader: () => <div data-testid='header' /> }))
vi.mock('../OrderNotification', () => ({ OrderNotificationSlot: () => null }))
vi.mock('../AllInOne/DriversManager', () => ({ DriversManager: () => <div data-testid='drivers-manager' /> }))
vi.mock('../DriversLocation', () => ({ DriversLocation: () => <div data-testid='drivers-map' /> }))
vi.mock('../OrderStatusFilterBar', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusFilterBar: () => <div data-testid='status-tabs' />
}))
vi.mock('../OrderStatusSubFilter', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusSubFilter: () => <div data-testid='sub-filter' />
}))
vi.mock('../OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../WizardOrders', () => ({ WizardOrders: () => null }))
// The controls are real; what they put on screen is mocked at the leaves.
vi.mock('../CreateCustomOrder', () => ({ CreateCustomOrder: () => <button type='button'>Create custom order</button> }))
vi.mock('../OrdersExportCSV', () => ({ OrdersExportCSV: () => <button type='button'>Export</button> }))
vi.mock('../OrderDelete', () => ({ OrderDelete: () => <button type='button'>Delete</button> }))
// as in the browser, the trigger of OrderStatusTypeSelector is a <div role='button'>, not a <button> (tanda Y review, finding 2)
vi.mock('../OrderStatusTypeSelector', () => ({ OrderStatusTypeSelector: () => <div role='button' tabIndex={0}>Change status</div> }))
vi.mock('../OrdersDashboard', () => ({ OrdersDashboard: () => <div data-testid='orders-dashboard' /> }))

import { AllInOne } from '../AllInOne'

const baseProps = {
  isUseQuery: true,
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { inProgress: [4, 7] },
  handleSelectedSubOrderStatus: vi.fn(),
  handleOrdersStatusGroupFilter: vi.fn(),
  handleChangeFilterValues: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  handleChangeMultiOrdersStatus: vi.fn(),
  handleDeleteMultiOrders: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  setDetailsOrder: vi.fn(),
  setMapsData: vi.fn(),
  onOrderRedirect: vi.fn(),
  driversList: { drivers: [] },
  mapsData: {},
  selectedOrderIds: [],
  startMulitOrderStatusChange: false,
  filterValues: { statuses: [] },
  searchValue: '',
  allowColumns: {},
  setAllowColumns: vi.fn()
}

const tree = (props = {}) => (
  <ThemeProvider theme={{ colors: {} }}>
    <MemoryRouter initialEntries={['/all-in-one']}>
      <AllInOne {...baseProps} {...props} />
    </MemoryRouter>
  </ThemeProvider>
)
const mount = (props = {}) => render(tree(props))

const BAR = 'Actions for selected orders'
const listRegion = () => screen.getByRole('region', { name: 'Orders' })

beforeEach(() => {
  runtime.stacked = false
  baseProps.setSelectedOrderIds.mockClear()
  window.scrollTo = vi.fn()
  document.body.focus()
})

afterEach(() => { vi.useRealTimers() })

describe('F2: on a phone the bulk actions and the count stay in view while the list scrolls', () => {
  it('with orders selected draws the sticky bar: the count as a polite status, Change status, Delete and Clear selection', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1, 2] })
    const bar = screen.getByRole('region', { name: BAR })
    const count = within(bar).getByRole('status')
    expect(count).toHaveTextContent('2 selected')
    expect(count).toHaveAttribute('aria-live', 'polite')
    expect(within(bar).getByRole('button', { name: 'Change status' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Clear selection' })).toBeInTheDocument()
    // The sticky comes from the bar's own class (selection-bar.css) inside the orders panel, after the list, as on /orders.
    expect(bar).toHaveClass('odc-selbar', 'aio-selbar')
    expect(bar.parentElement).toHaveClass('aio-orders')
    expect(bar.previousElementSibling).toHaveClass('aio-orders-body')
  })

  it('names the bulk actions with how many orders they act on, as /orders does', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1, 2, 3] })
    const bar = screen.getByRole('region', { name: BAR })
    expect(within(bar).getByRole('group', { name: 'Change status of 3 orders' })).toBeInTheDocument()
    expect(within(bar).getByRole('group', { name: 'Delete 3 orders' })).toBeInTheDocument()
  })

  it('keeps one copy of each action: the sub-bar keeps Create custom order and Export, the bar has the bulk ones', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1] })
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Change status' })).toHaveLength(1)
    const bar = screen.getByRole('region', { name: BAR })
    const subBar = screen.getByRole('button', { name: 'Create custom order' }).parentElement
    expect(subBar).not.toContainElement(bar)
    expect(within(subBar).getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(within(subBar).queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('«Clear selection» empties the selection', async () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1, 2] })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(baseProps.setSelectedOrderIds).toHaveBeenCalledWith([])
  })

  it('with nothing selected nothing new renders', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [] })
    expect(screen.queryByRole('region', { name: BAR })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull()
  })

  it('from 1024px the bar is not drawn and the sub-bar keeps Delete and Change status (desktop unchanged)', () => {
    runtime.stacked = false
    mount({ selectedOrderIds: [1, 2] })
    expect(screen.queryByRole('region', { name: BAR })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    const subBar = screen.getByRole('button', { name: 'Create custom order' }).parentElement
    expect(within(subBar).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(subBar).getByRole('button', { name: 'Change status' })).toBeInTheDocument()
  })

  it('draws no bar when the page has no bulk handlers (nothing to act on)', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1], handleChangeMultiOrdersStatus: undefined, handleDeleteMultiOrders: undefined })
    expect(screen.queryByRole('region', { name: BAR })).toBeNull()
  })

  it('the panel lets the bar stick below 1024px (a clip, not a scroller) and the bar wraps on a phone', () => {
    const css = readFileSync(path.join(__dirname, '..', 'AllInOne', 'all-in-one-board.css'), 'utf8')
    const block = css.match(/@media \(max-width: 1023px\) \{\s*\.aio-orders \{([^}]*)\}/)
    expect(block, '.aio-orders under 1024px').toBeTruthy()
    expect(block[1]).toMatch(/overflow:\s*clip/)
    const selbar = css.match(/\.aio-orders > \.aio-selbar \{([^}]*)\}/)
    expect(selbar, '.aio-selbar rule').toBeTruthy()
  })
})

// tanda Y review, finding 1: below 1024px the floating «x/y» of a running bulk change sat on the corner of the sticky bar
describe('F2: the progress of a bulk change goes into the bar, not over it', () => {
  it('with the bar on screen there is no floating indicator: the bar counts «x/y»', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true })
    const bar = screen.getByRole('region', { name: BAR })
    expect(within(bar).getByRole('status')).toHaveTextContent('2 selected · 2/2')
    expect(screen.getAllByRole('status').filter(node => !bar.contains(node))).toHaveLength(0)
  })

  it('from 1024px the floating indicator stays as it was', () => {
    mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true })
    expect(screen.getAllByRole('status').some(node => /^2\/2$/.test(node.textContent))).toBe(true)
  })
})

describe('F3: after a bulk change focus goes to a stable place, not <body>', () => {
  it('after the bulk change ends on a phone (selection emptied) focus is the orders list region', () => {
    runtime.stacked = true
    const { rerender } = mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: false })
    screen.getByRole('button', { name: 'Change status' }).focus()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change status' }))
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true }))
    rerender(tree({ selectedOrderIds: [], startMulitOrderStatusChange: true }))
    rerender(tree({ selectedOrderIds: [], startMulitOrderStatusChange: false }))
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(listRegion())
    expect(listRegion()).toHaveAttribute('tabindex', '-1')
  })

  it('and on desktop, where the focused sub-bar control goes away with the selection', () => {
    runtime.stacked = false
    const { rerender } = mount({ selectedOrderIds: [1, 2] })
    screen.getByRole('button', { name: 'Change status' }).focus()
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true }))
    rerender(tree({ selectedOrderIds: [], startMulitOrderStatusChange: false }))
    expect(document.activeElement).toBe(listRegion())
  })

  it('when the bulk change stops with the selection still there (the reason modal was cancelled) focus goes back into the bar', async () => {
    vi.useFakeTimers()
    runtime.stacked = true
    const { rerender } = mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true })
    // the modal closed and the focus it held fell to the body
    act(() => { document.activeElement?.blur?.() })
    expect(document.activeElement).toBe(document.body)
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: false }))
    await act(async () => { vi.runAllTimers() })
    const bar = screen.getByRole('region', { name: BAR })
    expect(bar).toContainElement(document.activeElement)
    expect(document.activeElement).not.toBe(document.body)
  })

  // tanda Y review, finding 2: the first control of the bar is Change status (a div role=button); Delete must not get the focus
  it('lands on Change status, not on the destructive Delete', async () => {
    vi.useFakeTimers()
    runtime.stacked = true
    const { rerender } = mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true })
    act(() => { document.activeElement?.blur?.() })
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: false }))
    await act(async () => { vi.runAllTimers() })
    expect(document.activeElement).toHaveTextContent('Change status')
  })

  it('a cancelled bulk change on desktop (no bar) lands on the list region', async () => {
    vi.useFakeTimers()
    runtime.stacked = false
    const { rerender } = mount({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true })
    expect(document.activeElement).toBe(document.body)
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: false }))
    await act(async () => { vi.runAllTimers() })
    expect(document.activeElement).toBe(listRegion())
  })

  it('«Clear selection» (which removes the focused button) also leaves focus on the list region', async () => {
    runtime.stacked = true
    const { rerender } = mount({ selectedOrderIds: [1] })
    screen.getByRole('button', { name: 'Clear selection' }).focus()
    rerender(tree({ selectedOrderIds: [] }))
    expect(document.activeElement).toBe(listRegion())
  })

  it('does not take the focus when it is somewhere that is still there', () => {
    runtime.stacked = false
    const { rerender } = mount({ selectedOrderIds: [1, 2] })
    const create = screen.getByRole('button', { name: 'Create custom order' })
    create.focus()
    rerender(tree({ selectedOrderIds: [1, 2], startMulitOrderStatusChange: true }))
    rerender(tree({ selectedOrderIds: [], startMulitOrderStatusChange: false }))
    expect(document.activeElement).toBe(create)
  })

  it('does nothing on mount, with or without a selection', () => {
    runtime.stacked = true
    mount({ selectedOrderIds: [1] })
    expect(document.activeElement).toBe(document.body)
  })
})
