/* eslint-disable import/first */
// redesign deliveries F2-B3 (decision 6, DV-07; DV-01): the order panel sits beside the board in a SplitView (layout='split'), the board
// is not remounted when it opens or closes (so no new `GET orders`), `?id=` opens it on load, and the page hands the board the
// read-only-owner rule and the SLA setter. The controller, the head and the board are simulated.
import React, { useEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  board: null,
  details: null,
  detailsMounts: 0,
  boardMounts: 0,
  boardUnmounts: 0,
  controllerMounts: 0,
  owner: { viewOnlyBusinessOwner: false, readOnlyBusinessOwner: false },
  configs: {}
}))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: runtime.configs }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  OrdersManage: ({ UIComponent, ...props }) => {
    useEffect(() => { runtime.controllerMounts += 1 }, [])
    return <UIComponent {...props} />
  }
}))
vi.mock('../../../../utils', () => ({
  learnOptionsValues: () => [],
  getUserType: type => !!runtime.owner[type]
}))
vi.mock('../../OrdersContentHeader', () => ({ OrdersContentHeader: () => <header data-testid='head' /> }))
vi.mock('../../OrderNotification', () => ({ OrderNotificationSlot: () => <div data-testid='notice-slot' /> }))
vi.mock('../../OrderDetails', () => ({
  OrderDetails: props => {
    runtime.details = props
    useEffect(() => { runtime.detailsMounts += 1 }, [])
    return <div data-testid='order-details' data-layout={props.layout ?? 'overlay'}>order {props.orderId}</div>
  }
}))
vi.mock('../../DeliveryDashboard', () => ({
  DeliveryDashboard: props => {
    runtime.board = props
    useEffect(() => {
      runtime.boardMounts += 1
      return () => { runtime.boardUnmounts += 1 }
    }, [])
    return <div data-testid='board' />
  }
}))

import { DeliveriesManager } from '..'

// jsdom resolves no CSS variable: SplitView measures its width limits with a probe `inline-size:var(--token)`, so the rect answers the token.
const TOKENS = { '--od-x-panel': 520, '--od-x-panel-narrow': 440, '--od-x-dialog-lg': 720, '--od-space-4': 16 }
const originalRect = Element.prototype.getBoundingClientRect

const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  Element.prototype.getBoundingClientRect = function () {
    const token = /var\((--[\w-]+)\)/.exec(this.style?.cssText ?? '')?.[1]
    return { width: TOKENS[token] ?? 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }
  }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+(?:\.\d+)?)px\s*\)/) || []
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
  return () => {
    Object.assign(window, original)
    Element.prototype.getBoundingClientRect = originalRect
  }
}

const baseProps = () => ({
  isUseQuery: true,
  driversList: { drivers: [{ id: 7 }] },
  filterValues: {},
  searchValue: '',
  handleChangeFilterValues: vi.fn(),
  handleChangeSearch: vi.fn(),
  setTimeStatus: vi.fn(),
  setDetailsOrder: vi.fn(),
  onOrderRedirect: vi.fn(),
  detailsOrder: null,
  ordersStatusGroup: 'pending',
  selectedSubOrderStatus: {}
})

const mount = (props, url = '/deliveries') => render(
  <MemoryRouter initialEntries={[url]}>
    <DeliveriesManager {...baseProps()} {...props} />
  </MemoryRouter>
)

describe('DeliveriesManager · order panel beside the board (decision 6)', () => {
  let restore
  beforeEach(() => {
    restore = installViewport(1440)
    runtime.board = null
    runtime.details = null
    runtime.detailsMounts = 0
    runtime.boardMounts = 0
    runtime.boardUnmounts = 0
    runtime.controllerMounts = 0
    runtime.owner = { viewOnlyBusinessOwner: false, readOnlyBusinessOwner: false }
    runtime.configs = {}
  })
  afterEach(() => restore())

  it('keeps id=deliveryDashboard on the page container, with the head, the notice slot and the board in it', () => {
    mount()
    const page = document.getElementById('deliveryDashboard')
    expect(page).not.toBeNull()
    expect(page).toContainElement(screen.getByTestId('head'))
    expect(page).toContainElement(screen.getByTestId('notice-slot'))
    expect(page).toContainElement(screen.getByTestId('board'))
    expect(screen.queryByTestId('order-details')).toBeNull()
  })

  it('draws the board inside a SplitView list', () => {
    const { container } = mount()
    const split = container.querySelector('.odc-split')
    expect(split).not.toBeNull()
    expect(split).toHaveAttribute('data-view', 'list')
    expect(split.querySelector('.odc-split-list')).toContainElement(document.getElementById('deliveryDashboard'))
  })

  it('opens the panel beside the board, as layout=split, when a card asks for the details', () => {
    const props = baseProps()
    const { container } = mount(props)
    act(() => runtime.board.handleOpenOrderDetail({ id: 321 }))
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'split')
    expect(screen.getByTestId('order-details')).toHaveAttribute('data-layout', 'split')
    expect(runtime.details).toMatchObject({ open: true, orderId: 321 })
    expect(props.onOrderRedirect).toHaveBeenCalledWith(321)
    expect(screen.getByRole('complementary', { name: 'Order 321' })).toContainElement(screen.getByTestId('order-details'))
    expect(screen.getByRole('separator', { name: 'Resize the order panel' })).toBeInTheDocument()
  })

  it('opens the panel on load when the URL carries ?id=', () => {
    mount({}, '/deliveries?id=77')
    expect(screen.getByTestId('order-details')).toHaveAttribute('data-layout', 'split')
    expect(runtime.details).toMatchObject({ open: true, orderId: '77' })
    expect(screen.getByRole('complementary', { name: 'Order 77' })).toBeInTheDocument()
  })

  it('closing the panel calls onOrderRedirect() with no id and puts the list back', () => {
    const props = baseProps()
    const { container } = mount(props, '/deliveries?id=77')
    act(() => runtime.details.onClose())
    expect(props.onOrderRedirect).toHaveBeenLastCalledWith()
    expect(screen.queryByTestId('order-details')).toBeNull()
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'list')
  })

  it('does not remount the board nor the controller when the panel opens and closes (no new GET orders)', () => {
    mount()
    expect(runtime.boardMounts).toBe(1)
    expect(runtime.controllerMounts).toBe(1)
    act(() => runtime.board.handleOpenOrderDetail({ id: 5 }))
    act(() => runtime.board.handleOpenOrderDetail({ id: 6 }))
    act(() => runtime.details.onClose())
    expect(runtime.boardMounts).toBe(1)
    expect(runtime.boardUnmounts).toBe(0)
    expect(runtime.controllerMounts).toBe(1)
  })

  it('remembers the width of the panel under od.deliveries.panel', () => {
    window.localStorage.setItem('od.deliveries.panel', '600')
    const { container } = mount({}, '/deliveries?id=1')
    expect(container.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).toBe('600px')
    window.localStorage.removeItem('od.deliveries.panel')
  })

  it('keeps the panel over the board below 1280px (overlay), as before', () => {
    restore()
    restore = installViewport(1100)
    const { container } = mount({}, '/deliveries?id=77')
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'overlay')
  })
})

describe('DeliveriesManager · what the board is handed', () => {
  let restore
  beforeEach(() => {
    restore = installViewport(1440)
    runtime.board = null
    runtime.owner = { viewOnlyBusinessOwner: false, readOnlyBusinessOwner: false }
  })
  afterEach(() => restore())

  it('passes setTimeStatus and the filter writers, for the Unassigned / Late toggles', () => {
    const props = baseProps()
    mount(props)
    expect(runtime.board.setTimeStatus).toBe(props.setTimeStatus)
    expect(runtime.board.handleChangeFilterValues).toBe(props.handleChangeFilterValues)
    expect(runtime.board.filterValues).toBe(props.filterValues)
  })

  it('passes readOnlyBusinessOwner as OrderContactInformation computes it', () => {
    mount()
    expect(runtime.board.readOnlyBusinessOwner).toBe(false)
    runtime.owner = { viewOnlyBusinessOwner: false, readOnlyBusinessOwner: true }
    mount()
    expect(runtime.board.readOnlyBusinessOwner).toBe(true)
    // «viewOnlyBusinessOwner» keeps the right to assign, as in the order panel.
    runtime.owner = { viewOnlyBusinessOwner: true, readOnlyBusinessOwner: true }
    mount()
    expect(runtime.board.readOnlyBusinessOwner).toBe(false)
  })
})
