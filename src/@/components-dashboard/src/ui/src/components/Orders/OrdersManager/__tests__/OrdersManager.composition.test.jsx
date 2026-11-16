/* eslint-disable import/first */
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const LEARN = vi.hoisted(() => [{ value: 'order_details', name: 'Order details', url: 'https://help.ordering.co/details' }])
const runtime = vi.hoisted(() => ({ dashboard: null, header: null, filterBar: null, controls: null, details: null, socketDisconnected: false }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  OrdersManage: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../utils', () => ({
  learnOptionsValues: () => LEARN,
  addQueryToUrl: vi.fn()
}))
vi.mock('../../../../hooks/useListingSearchSeed', () => ({ useListingSearchSeed: () => null }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
vi.mock('../../../../styles', () => ({ IconButton: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null, LearnDropDown: () => null }))
// redesign 5.3-A: the mock keeps the props OrdersManager hands to the panel, to assert the split wiring.
vi.mock('../../OrderDetails', () => ({
  OrderDetails: (props) => { runtime.details = props; return <div data-testid='order-details' data-layout={props.layout ?? 'overlay'} /> }
}))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../../WizardOrders', () => ({ WizardOrders: () => null }))
vi.mock('../../GoogleMapsApiKeySettingButton', () => ({ GoogleMapsApiKeySettingButton: () => null }))
vi.mock('../../OrderNotification', () => ({ OrderNotification: () => <p data-testid='sound-notice'>sound notice</p> }))
// The live status hands the page a notice only while disconnected, like the real one.
vi.mock('../../WebsocketStatus', () => ({
  WebsocketStatus: ({ renderNotice }) => (runtime.socketDisconnected ? renderNotice?.(<p data-testid='lost-notice'>connection lost</p>) : null)
}))
// redesign 5.2: the filter bar is built by 5.2-B in parallel; this suite only checks the composition around it.
vi.mock('../../OrdersFilterBar', () => ({
  OrdersFilterBar: (props) => { runtime.filterBar = props; return <div data-testid='filter-bar' /> }
}))
// redesign F6c: OrdersManager hosts the create-order form (CreateCustomOrderProvider); this suite is not about it.
vi.mock('../../CreateCustomOrder', () => ({ CreateCustomOrderProvider: ({ children }) => <>{children}</> }))
vi.mock('../../OrdersDashboardControls', () => ({
  OrdersDashboardControls: (props) => { runtime.controls = props; return <div data-testid='header-actions' /> }
}))
vi.mock('../../OrdersDashboard', () => ({
  OrdersDashboard: (props) => { runtime.dashboard = props; return <div data-testid='orders-list'>list</div> }
}))

import { OrdersManager } from '..'

const baseProps = {
  isUseQuery: true,
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { inProgress: [] },
  handleSelectedSubOrderStatus: vi.fn(),
  handleOrdersStatusGroupFilter: vi.fn(),
  handleChangeMultiOrdersStatus: vi.fn(),
  handleDeleteMultiOrders: vi.fn(),
  multiOrderUpdateStatus: 'completed',
  handleChangeFilterValues: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  setDetailsOrder: vi.fn(),
  onOrderRedirect: vi.fn(),
  driversList: { drivers: [] },
  selectedOrderIds: [],
  filterValues: { cities: [1] },
  searchValue: '',
  allowColumns: {},
  setAllowColumns: vi.fn()
}

const mount = (props = {}) => render(
  <MemoryRouter initialEntries={['/orders?status=inProgress']}>
    <OrdersManager {...baseProps} {...props} />
  </MemoryRouter>
)

// jsdom answers matchMedia with `matches: false`. The split view reads the window through
// (min|max)-width queries, so the tests install one that evaluates them against a width.
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

const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('OrdersManager · composition (redesign 5.2-A)', () => {
  beforeEach(() => {
    runtime.dashboard = null
    runtime.header = null
    runtime.filterBar = null
    runtime.controls = null
    runtime.details = null
    runtime.socketDisconnected = false
    window.scrollTo = vi.fn()
  })

  it('draws title, tabs, filter bar, notices and the list, in that order', () => {
    mount()
    const title = screen.getByRole('heading', { level: 1, name: 'Orders list' })
    const tabs = screen.getByRole('tablist', { name: 'Order status' })
    const bar = screen.getByTestId('filter-bar')
    const sound = screen.getByTestId('sound-notice')
    const list = screen.getByTestId('orders-list')
    expect([title, tabs, bar, sound, list].every((node, index, all) => index === 0 || before(all[index - 1], node))).toBe(true)
  })

  it('wraps the list in one tab panel labelled by the selected tab', () => {
    mount()
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByTestId('orders-list')).toBeInTheDocument()
    expect(panel).toHaveAccessibleName(/In progress/)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('no longer draws the substatus row or the controls row under the tabs', () => {
    mount()
    // The only controls are the page actions in the head (variant header) and the filter bar.
    expect(runtime.controls.variant).toBe('header')
    expect(screen.getAllByTestId('header-actions')).toHaveLength(1)
    expect(screen.getByTestId('header-actions').closest('.odc-page-head')).not.toBeNull()
  })

  // redesign 5.6-B: on phones the Learn articles are items of the page actions' «More actions» menu, so the
  // controls get the very options the head gets (the head draws Learn itself on wide screens).
  it('hands the page actions the Learn options of the page', () => {
    mount()
    expect(runtime.controls.learnOptions).toBe(LEARN)
  })

  it('hands the filter bar the status props and asks for the tools slot', () => {
    mount()
    expect(runtime.filterBar).toMatchObject({
      ordersStatusGroup: 'inProgress',
      selectedSubOrderStatus: baseProps.selectedSubOrderStatus,
      handleSelectedSubOrderStatus: baseProps.handleSelectedSubOrderStatus,
      filterValues: baseProps.filterValues,
      toolsSlot: true
    })
  })

  // redesign 5.2 audit-1 (C4): with the order panel open the page action steps back, so the controls must know.
  it('tells the page actions whether an order is open beside the list', () => {
    const { unmount } = mount()
    expect(runtime.controls.isOpenOrderDetail).toBe(false)
    unmount()
    render(
      <MemoryRouter initialEntries={['/orders?status=inProgress&id=5']}>
        <OrdersManager {...baseProps} />
      </MemoryRouter>
    )
    expect(runtime.controls.isOpenOrderDetail).toBe(true)
  })

  it('hands the dashboard the counters of the tabs, the ones the first-time empty state compares', () => {
    mount()
    expect(runtime.dashboard.ordersAmountByStatus).toEqual({ pending: null, inProgress: null, completed: null, cancelled: null })
    expect(typeof runtime.dashboard.setOrdersAmountByStatus).toBe('function')
  })

  it('hands the dashboard the bulk handlers for the selection bar of 5.2-C', () => {
    mount()
    expect(runtime.dashboard.handleChangeMultiOrdersStatus).toBe(baseProps.handleChangeMultiOrdersStatus)
    expect(runtime.dashboard.handleDeleteMultiOrders).toBe(baseProps.handleDeleteMultiOrders)
    expect(runtime.dashboard.multiOrderUpdateStatus).toBe('completed')
  })

  // «Select all N» (orders pilot, decision 3): only the /orders page turns it on.
  it('turns «Select all N» on for /orders and off for lateral bars and detail tabs', () => {
    const page = mount()
    expect(runtime.dashboard.canSelectAllMatching).toBe(true)
    page.unmount()
    mount({ isSelectedOrders: true })
    expect(runtime.dashboard.canSelectAllMatching).toBe(false)
  })

  it('announces the progress of a bulk status change (x/y) as a status', async () => {
    mount({ startMulitOrderStatusChange: true, selectedOrderIds: [1, 2, 3] })
    expect(await screen.findByRole('status')).toHaveTextContent('3/3')
  })

  it('puts the connection-lost notice above the list, in the notices stack, only while disconnected', () => {
    const { rerender } = mount()
    expect(screen.queryByTestId('lost-notice')).not.toBeInTheDocument()

    runtime.socketDisconnected = true
    rerender(
      <MemoryRouter initialEntries={['/orders?status=inProgress']}>
        <OrdersManager {...baseProps} />
      </MemoryRouter>
    )
    const notice = screen.getByTestId('lost-notice')
    expect(notice.closest('.odc-orders-notices')).not.toBeNull()
    expect(before(notice, screen.getByTestId('orders-list'))).toBe(true)
    expect(before(screen.getByRole('tablist'), notice)).toBe(true)
  })

  it('lateral bars (isSelectedOrders): no title line, no page actions, no sound notice, no tools slot', () => {
    mount({ isSelectedOrders: true })
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sound-notice')).not.toBeInTheDocument()
    expect(runtime.filterBar.toolsSlot).toBe(false)
    expect(screen.getByRole('tablist', { name: 'Order status' })).toBeInTheDocument()
    expect(screen.getByTestId('orders-list')).toBeInTheDocument()
  })
})

// redesign 5.3-A: /orders opens the order in a split view (list and panel side by side).
describe('OrdersManager · split view of the order detail (redesign 5.3-A)', () => {
  let restoreViewport
  const mountWithOrder = (props = {}, entry = '/orders?status=inProgress&id=5') => render(
    <MemoryRouter initialEntries={[entry]}>
      <OrdersManager {...baseProps} {...props} />
    </MemoryRouter>
  )

  beforeEach(() => {
    runtime.dashboard = null
    runtime.details = null
    window.scrollTo = vi.fn()
    restoreViewport = installViewport(1440)
  })

  afterEach(() => {
    restoreViewport()
  })

  it('wraps the list in the split view and shows the panel beside it from 1280px', () => {
    const { container } = mountWithOrder()
    const split = container.querySelector('.odc-split')
    expect(split).not.toBeNull()
    expect(split).toHaveAttribute('data-mode', 'split')
    expect(split).toHaveAttribute('data-view', 'split')
    const panel = screen.getByRole('complementary', { name: 'Order 5' })
    expect(within(panel).getByTestId('order-details')).toHaveAttribute('data-layout', 'split')
    expect(within(split.querySelector('.odc-split-list')).getByTestId('orders-list')).toBeInTheDocument()
  })

  it('keeps the list alone (and no panel) while no order is open', () => {
    const { container } = mountWithOrder({}, '/orders?status=inProgress')
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'list')
    expect(screen.queryByTestId('order-details')).not.toBeInTheDocument()
  })

  it('hands the panel the same props as before plus the layout and the expanded flag', () => {
    mountWithOrder()
    expect(runtime.details).toMatchObject({
      layout: 'split',
      open: true,
      orderId: '5',
      expanded: false,
      handleDeleteOrder: baseProps.handleDeleteMultiOrders,
      isSelectedOrders: undefined
    })
    expect(typeof runtime.details.onClose).toBe('function')
    expect(typeof runtime.details.handleBackRedirect).toBe('function')
    expect(typeof runtime.details.handleOpenOrderDetail).toBe('function')
    expect(typeof runtime.details.onExpandedChange).toBe('function')
  })

  it('Open as page turns the split into a full-width panel and closing resets it', () => {
    const { container } = mountWithOrder()
    act(() => runtime.details.onExpandedChange(true))
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-expanded')
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'panel')
    expect(runtime.details.expanded).toBe(true)

    act(() => runtime.details.onClose())
    expect(baseProps.onOrderRedirect).toHaveBeenLastCalledWith()
    expect(baseProps.setDetailsOrder).toHaveBeenLastCalledWith(null)
    expect(container.querySelector('.odc-split')).not.toHaveAttribute('data-expanded')
  })

  it('Escape inside the panel closes it through the same handler as the Close button', () => {
    mountWithOrder()
    const panel = screen.getByRole('complementary', { name: 'Order 5' })
    baseProps.onOrderRedirect.mockClear()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(baseProps.onOrderRedirect).toHaveBeenCalledTimes(1)
    expect(baseProps.onOrderRedirect).toHaveBeenCalledWith()
  })

  it('between 768 and 1279px the panel is a modal over the list', async () => {
    restoreViewport()
    restoreViewport = installViewport(1024)
    const { container } = mountWithOrder()
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-mode', 'overlay')
    expect(await screen.findByRole('dialog', { name: 'Order 5' })).toBeInTheDocument()
  })

  it('lateral bars (isSelectedOrders) keep the overlay panel and no split view', () => {
    const { container } = mountWithOrder({ isSelectedOrders: true }, '/orders?status=inProgress')
    act(() => runtime.dashboard.handleOpenOrderDetail({ id: 8 }))
    expect(container.querySelector('.odc-split')).toBeNull()
    expect(runtime.details.isSelectedOrders).toBe(true)
    expect(runtime.details.layout).toBeUndefined()
  })
})

// redesign 5.4-A: the two duplicated Alerts (same state, opened together) became one Product Dialog.
describe('OrdersManager · list alert (redesign 5.4-A)', () => {
  // OrdersManager clears its selection counter 500 ms after a render with nothing selected. Let that
  // timer fire before the environment is torn down, or it lands on a window that is gone.
  afterAll(() => new Promise(resolve => setTimeout(resolve, 600)))
  beforeEach(() => {
    runtime.dashboard = null
    window.scrollTo = vi.fn()
  })
  afterEach(() => {
    document.getElementById('app-modals')?.remove()
    document.querySelector('[data-tour="tour_start"]')?.remove()
  })

  const openTour = () => act(() => runtime.dashboard.handleOpenTour())

  it('asking for the tour with no order opens one small dialog, Orders manager, with the same text', async () => {
    mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openTour()
    const dialogs = await screen.findAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]).toHaveAccessibleName('Orders manager')
    expect(dialogs[0]).toHaveAttribute('data-size', 'sm')
    expect(within(dialogs[0]).getByText('One order is required')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('footer is one primary OK that closes it, with the focus on it', async () => {
    const user = userEvent.setup()
    mount()
    openTour()
    const dialog = await screen.findByRole('dialog')
    const footer = within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button')
    expect(footer.map(button => button.textContent)).toEqual(['OK'])
    expect(footer[0]).toHaveAttribute('data-variant', 'primary')
    await waitFor(() => expect(footer[0]).toHaveFocus())
    await user.click(footer[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it.each([
    ['Escape', user => user.keyboard('{Escape}')],
    ['the close button', user => user.click(screen.getByRole('button', { name: 'Close' }))]
  ])('%s closes it', async (_, dismiss) => {
    const user = userEvent.setup()
    mount()
    openTour()
    await screen.findByRole('dialog')
    await dismiss(user)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens again on the next request', async () => {
    const user = userEvent.setup()
    mount()
    openTour()
    await user.click(await screen.findByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    openTour()
    expect(await screen.findByText('One order is required')).toBeInTheDocument()
  })

  it('with an order on screen the tour starts and no alert opens', () => {
    const anchor = document.createElement('div')
    anchor.setAttribute('data-tour', 'tour_start')
    document.body.appendChild(anchor)
    mount()
    openTour()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(runtime.dashboard.isTourOpen).toBe(true)
  })
})

// main the driver panel (a lateral manager with a driverId) opens on the first tab with orders, once every
// count is in; a group the opener chose (DD-06) wins. Only the calls made after the counts change are the rule's (the mount may sync the tab).
describe('OrdersManager · driver panel opens on the first tab with orders (main )', () => {
  const counts = { pending: 0, inProgress: 0, completed: 3, cancelled: 1 }
  const callsAfter = (spy, run) => {
    const before = spy.mock.calls.length
    act(run)
    return spy.mock.calls.slice(before).map(([group]) => group)
  }

  it('picks the first tab with orders once every count has arrived, and only once', () => {
    const handleOrdersStatusGroupFilter = vi.fn()
    mount({ isLateralBar: true, isSelectedOrders: true, driverId: 7, handleOrdersStatusGroupFilter })
    expect(callsAfter(handleOrdersStatusGroupFilter, () => runtime.dashboard.setOrdersAmountByStatus({ ...counts, cancelled: null }))).toEqual([])
    expect(callsAfter(handleOrdersStatusGroupFilter, () => runtime.dashboard.setOrdersAmountByStatus(counts))).toEqual(['completed'])
    expect(callsAfter(handleOrdersStatusGroupFilter, () => runtime.dashboard.setOrdersAmountByStatus({ ...counts, inProgress: 2 }))).toEqual([])
  })

  it('leaves the tab alone when the opener chose a group, outside a lateral panel, or without a driver', () => {
    for (const props of [
      { isLateralBar: true, isSelectedOrders: true, driverId: 7, statusGroup: 'pending' },
      { isLateralBar: false, driverId: 7 },
      { isLateralBar: true, isSelectedOrders: true, customerId: 9 }
    ]) {
      const handleOrdersStatusGroupFilter = vi.fn()
      const { unmount } = mount({ ...props, handleOrdersStatusGroupFilter })
      expect(callsAfter(handleOrdersStatusGroupFilter, () => runtime.dashboard.setOrdersAmountByStatus(counts))).toEqual([])
      unmount()
    }
  })
})
