/* eslint-disable import/first */
// redesign deliveries F2-B3 (decisions 1, 2, 6, 7; DV-01, DV-04, DV-05, DV-07): the shell of the dispatch board. The toggles write the
// filters that already exist; the board hands the cards `canAssign` / `requestAssign` / `driversById` through DeliveryBoardContext and
// the dock `canAssign` / `focusCandidatesToken` / `onAssigned`; below 1024px a List | Map switch; the map column hides (not unmounts)
// while the order panel sits beside the list. The children are simulated: this suite only checks what the shell passes and shows.
import React, { useEffect } from 'react'
import { act, fireEvent, render as renderWith, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ configs: {}, user: null, board: null, location: null, list: null, listMounts: 0, listUnmounts: 0, dockTitle: true }))
vi.mock('../../../../../../index', () => ({ useConfig: () => [{ configs: runtime.configs }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ user: runtime.user }] }))
vi.mock('../../OrdersDashboardList', async () => {
  const { useDeliveryBoard } = await import('../DeliveryBoardContext')
  return {
    OrdersDashboardList: props => {
      const board = useDeliveryBoard()
      runtime.board = board
      runtime.list = props
      useEffect(() => {
        runtime.listMounts += 1
        return () => { runtime.listUnmounts += 1 }
      }, [])
      return <div data-testid='orders-list' />
    }
  }
})
// redesign deliveries R1 (finding 4): the strip's title is where the board sends the focus when it switches to «Map» (DriversDock's h2, tabIndex -1)
vi.mock('../../DeliveriesLocation', () => ({
  DeliveriesLocation: props => {
    runtime.location = props
    return <div data-testid='deliveries-location'>{runtime.dockTitle && <h2 className='odc-dock-title' tabIndex={-1}>Drivers</h2>}</div>
  }
}))
vi.mock('../../OrderStatusFilterBar', () => ({ OrderStatusFilterBar: () => <div data-testid='status-tabs' /> }))
vi.mock('../../OrderStatusSubFilter', async (importOriginal) => ({
  ...await importOriginal(),
  OrderStatusSubFilter: props => { runtime.subFilter = props; return <div data-testid='status-pill' /> }
}))

import { DeliveryDashboard } from '..'
import { CUSTOMER_PICKUP_STATUSES } from '../../OrderStatusSubFilter'
import { SplitView, useSplitView } from '../../../Shared/Product/SplitView'

// jsdom answers matchMedia with `matches: false` (or has none). The board and the split view read the window through (min|max)-width
// queries, so the tests install one that evaluates them against a width.
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
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
  return () => Object.assign(window, original)
}

// The pinned color expressions of styles.js read theme.colors (a project theme always has it).
const Themed = ({ children }) => <ThemeProvider theme={{ colors: {} }}>{children}</ThemeProvider>
const render = (ui, options) => renderWith(ui, { wrapper: Themed, ...options })

const baseProps = () => ({
  driversList: { drivers: [{ id: 7, name: 'Marcus' }, { id: 9, name: 'Sofia' }] },
  filterValues: { assigned: null, timeStatus: null, cities: [1] },
  handleChangeFilterValues: vi.fn(),
  setTimeStatus: vi.fn(),
  ordersStatusGroup: 'pending',
  selectedSubOrderStatus: {},
  handleOrdersStatusGroupFilter: vi.fn(),
  handleSelectedSubOrderStatus: vi.fn(),
  ordersAmountByStatus: {},
  setOrdersAmountByStatus: vi.fn()
})

const mapColumn = () => screen.getByTestId('deliveries-location').parentElement
const listColumn = () => screen.getByTestId('orders-list').closest('#cardOrders').parentElement

describe('DeliveryDashboard · dispatch toggles (decision 2)', () => {
  let restore
  beforeEach(() => { restore = installViewport(1440); runtime.board = null; runtime.location = null })
  afterEach(() => restore())

  it('draws «Unassigned» and «Late» as toggle buttons that start released', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(screen.getByRole('button', { name: 'Unassigned' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reads the pressed state from filterValues (assigned === 1, timeStatus === delayed)', () => {
    const props = baseProps()
    const { rerender } = render(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, assigned: 1 }} />)
    expect(screen.getByRole('button', { name: 'Unassigned' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, assigned: 0, timeStatus: 'delayed' }} />)
    expect(screen.getByRole('button', { name: 'Unassigned' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true')
    // The SLA pill chose another value: it is the same state, so «Late» lets go on its own.
    rerender(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, timeStatus: 'at_risk' }} />)
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('«Unassigned» writes assigned: 1 and, pressed, assigned: null; nothing else changes', () => {
    const props = baseProps()
    const { rerender } = render(<DeliveryDashboard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    expect(props.handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(props.handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: 1, timeStatus: null, cities: [1] })
    expect(props.setTimeStatus).not.toHaveBeenCalled()

    rerender(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, assigned: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    expect(props.handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: null, timeStatus: null, cities: [1] })
  })

  it('«Late» writes the SLA pill state: timeStatus delayed in the filters and in setTimeStatus, and null when released', () => {
    const props = baseProps()
    const { rerender } = render(<DeliveryDashboard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    expect(props.handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: null, timeStatus: 'delayed', cities: [1] })
    expect(props.setTimeStatus).toHaveBeenLastCalledWith('delayed')

    rerender(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, timeStatus: 'delayed' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    expect(props.handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: null, timeStatus: null, cities: [1] })
    expect(props.setTimeStatus).toHaveBeenLastCalledWith(null)
  })

  it('the two combine: each press keeps what the other wrote', () => {
    const props = baseProps()
    render(<DeliveryDashboard {...props} filterValues={{ ...props.filterValues, assigned: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    expect(props.handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: 1, timeStatus: 'delayed', cities: [1] })
  })

  it('sits in the list column, with the Status pill', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    const column = listColumn()
    expect(within(column).getByRole('button', { name: 'Unassigned' })).toBeInTheDocument()
    expect(within(column).getByTestId('status-pill')).toBeInTheDocument()
    expect(within(mapColumn()).queryByRole('button', { name: 'Unassigned' })).toBeNull()
  })

  // redesign deliveries-followups P2 (DV-11): the page only lists delivery_type 1 and 7
  it('hides the customer pick-up statuses from the Status pill', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(runtime.subFilter.hiddenStatuses).toEqual(CUSTOMER_PICKUP_STATUSES)
  })
})

describe('DeliveryDashboard · assigning from the board (decision 3)', () => {
  let restore
  beforeEach(() => { restore = installViewport(1440); runtime.board = null; runtime.location = null })
  afterEach(() => restore())

  const free = { id: 11, driver_id: null, driver_company_id: null, external_driver: null }

  it('canAssign: a free order is assignable; one with a driver, a company or an external driver is not', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    const { canAssign } = runtime.board
    expect(canAssign(free)).toBe(true)
    expect(canAssign({ ...free, driver_id: 7 })).toBe(false)
    expect(canAssign({ ...free, driver_company_id: 3 })).toBe(false)
    expect(canAssign({ ...free, external_driver: { name: 'Pat' } })).toBe(false)
    expect(runtime.location.canAssign(free)).toBe(true)
    expect(runtime.location.canAssign({ ...free, driver_id: 7 })).toBe(false)
  })

  // redesign deliveries R1 fix (finding 3, card side): the card of an order the board just assigned offers no «Assign» either
  it('canAssign: an order the board just assigned is not assignable from its card until the list brings its driver', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(runtime.board.canAssign(free)).toBe(true)
    act(() => { runtime.location.onAssigned(free, { id: 70, name: 'Marcus' }) })
    expect(runtime.board.canAssign(free)).toBe(false)
  })

  it('canAssign: a read-only business owner assigns nothing', () => {
    render(<DeliveryDashboard {...baseProps()} readOnlyBusinessOwner />)
    expect(runtime.board.canAssign(free)).toBe(false)
    expect(runtime.location.canAssign(free)).toBe(false)
  })

  describe('manual assignment configs', () => {
    afterEach(() => { runtime.configs = {}; runtime.user = null })

    const bothOff = {
      store_app_manual_driver_assignment_enabled: { value: '0' },
      delivery_manager_manual_driver_assignment_enabled: { value: '0' }
    }

    it('a business owner assigns nothing when the business config is off', () => {
      runtime.user = { level: 2 }
      runtime.configs = { store_app_manual_driver_assignment_enabled: { value: '0' } }
      render(<DeliveryDashboard {...baseProps()} />)
      expect(runtime.board.canAssign(free)).toBe(false)
      expect(runtime.location.canAssign(free)).toBe(false)
    })

    it('a delivery manager assigns nothing when the delivery manager config is off', () => {
      runtime.user = { level: 5 }
      runtime.configs = { delivery_manager_manual_driver_assignment_enabled: { value: '0' } }
      render(<DeliveryDashboard {...baseProps()} />)
      expect(runtime.board.canAssign(free)).toBe(false)
      expect(runtime.location.canAssign(free)).toBe(false)
    })

    it('a delivery manager still assigns when only the business config is off', () => {
      runtime.user = { level: 5 }
      runtime.configs = { store_app_manual_driver_assignment_enabled: { value: '0' } }
      render(<DeliveryDashboard {...baseProps()} />)
      expect(runtime.board.canAssign(free)).toBe(true)
    })

    it('an administrator still assigns with both configs off', () => {
      runtime.user = { level: 0 }
      runtime.configs = bothOff
      render(<DeliveryDashboard {...baseProps()} />)
      expect(runtime.board.canAssign(free)).toBe(true)
      expect(runtime.location.canAssign(free)).toBe(true)
    })
  })

  it('driversById is a Map of driversList.drivers by id', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(runtime.board.driversById).toBeInstanceOf(Map)
    expect(runtime.board.driversById.get(7)).toMatchObject({ name: 'Marcus' })
    expect(runtime.board.driversById.get(9)).toMatchObject({ name: 'Sofia' })
    expect(runtime.board.driversById.size).toBe(2)
  })

  it('requestAssign selects the order without toggling it off and raises focusCandidatesToken each time', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    const token0 = runtime.location.focusCandidatesToken
    expect(typeof token0).toBe('number')
    expect(runtime.location.interActionMapOrder).toBeNull()

    act(() => runtime.board.requestAssign(free))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11 })
    expect(runtime.location.focusCandidatesToken).toBe(token0 + 1)

    // Already chosen: it stays chosen (handleLocation would have let it go) and the token still moves.
    act(() => runtime.board.requestAssign(free))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11 })
    expect(runtime.location.focusCandidatesToken).toBe(token0 + 2)

    // Another order replaces it.
    act(() => runtime.board.requestAssign({ ...free, id: 12 }))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 12 })
    expect(runtime.location.focusCandidatesToken).toBe(token0 + 3)
  })

  it('the card click still toggles the order on a wide window', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.list.handleOrderCardClick(free))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11 })
    act(() => runtime.list.handleOrderCardClick(free))
    expect(runtime.location.interActionMapOrder).toBeNull()
  })

  it('onAssigned puts the new driver on the chosen order (and ignores another order)', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.board.requestAssign(free))
    act(() => runtime.location.onAssigned({ id: 11 }, { id: 7, name: 'Marcus' }))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, driver_id: 7 })
    act(() => runtime.location.onAssigned({ id: 99 }, { id: 9, name: 'Sofia' }))
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, driver_id: 7 })
  })

  // redesign deliveries R1 (finding 3): the list's copy of an order that was just assigned still has no driver until its own update arrives
  describe('an assignment survives a stale update from the list', () => {
    const sofia = { id: 9, name: 'Sofia' }
    const marcus = { id: 7, name: 'Marcus' }

    it('keeps the assigned driver when the list sends the same order without one', () => {
      render(<DeliveryDashboard {...baseProps()} />)
      act(() => runtime.board.requestAssign(free))
      act(() => runtime.location.onAssigned({ id: 11 }, marcus))
      act(() => runtime.list.handleUpdateDriverLocation({ ...free }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, driver_id: 7, driver: marcus })
      expect(runtime.location.canAssign(runtime.location.interActionMapOrder)).toBe(false)
      // and again, for every later change of the list
      act(() => runtime.list.handleUpdateDriverLocation({ ...free, status: 3 }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, status: 3, driver_id: 7, driver: marcus })
    })

    it('lets a real update replace it: the list brings a driver_id (this one or another)', () => {
      render(<DeliveryDashboard {...baseProps()} />)
      act(() => runtime.board.requestAssign(free))
      act(() => runtime.location.onAssigned({ id: 11 }, marcus))
      act(() => runtime.list.handleUpdateDriverLocation({ ...free, driver_id: 9, driver: sofia }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, driver_id: 9, driver: sofia })
      // the remembered assignment is gone: a later copy without a driver is not patched any more
      act(() => runtime.list.handleUpdateDriverLocation({ ...free }))
      expect(runtime.location.interActionMapOrder.driver_id).toBeNull()
    })

    it('does not touch another order', () => {
      render(<DeliveryDashboard {...baseProps()} />)
      act(() => runtime.board.requestAssign(free))
      act(() => runtime.location.onAssigned({ id: 11 }, marcus))
      act(() => runtime.list.handleOrderCardClick({ ...free, id: 12 }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 12, driver_id: null })
      act(() => runtime.list.handleUpdateDriverLocation({ ...free, id: 12 }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 12, driver_id: null })
    })

    it('chooses it again from a stale card with its driver still on it', () => {
      render(<DeliveryDashboard {...baseProps()} />)
      act(() => runtime.board.requestAssign(free))
      act(() => runtime.location.onAssigned({ id: 11 }, marcus))
      act(() => runtime.list.handleOrderCardClick({ ...free, id: 12 }))
      act(() => runtime.list.handleOrderCardClick({ ...free }))
      expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11, driver_id: 7, driver: marcus })
    })
  })

  it('the board context reaches the list', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(runtime.board).toEqual(expect.objectContaining({
      canAssign: expect.any(Function),
      requestAssign: expect.any(Function),
      driversById: expect.any(Map)
    }))
  })
})

describe('DeliveryDashboard · below 1024px (decision 7, DV-05)', () => {
  let restore
  beforeEach(() => { restore = installViewport(390); runtime.board = null; runtime.location = null })
  afterEach(() => restore())

  const free = { id: 11, driver_id: null }

  it('starts on «List»: a View group with List and Map, the list shown and the map column hidden but mounted', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
    expect(listColumn()).not.toHaveAttribute('hidden')
    expect(mapColumn()).toHaveAttribute('hidden')
    expect(screen.getByTestId('deliveries-location')).toBeInTheDocument()
  })

  it('«Map» swaps the columns; «List» swaps them back; the list is never unmounted', () => {
    runtime.listMounts = 0
    runtime.listUnmounts = 0
    render(<DeliveryDashboard {...baseProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(mapColumn()).not.toHaveAttribute('hidden')
    expect(listColumn()).toHaveAttribute('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(listColumn()).not.toHaveAttribute('hidden')
    expect(mapColumn()).toHaveAttribute('hidden')
    expect(runtime.listUnmounts).toBe(0)
  })

  it('choosing a card goes to «Map» with that order; choosing it again keeps it', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.list.handleOrderCardClick(free))
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11 })
    expect(mapColumn()).not.toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    act(() => runtime.list.handleOrderCardClick(free))
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 11 })
  })

  // redesign deliveries R1 (finding 4): the tapped card's column hides, so the focus has to go somewhere that is still there
  it('tapping a card moves the focus to the strip title in the Map view, never to <body>', () => {
    runtime.dockTitle = true
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.list.handleOrderCardClick(free))
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(within(mapColumn()).getByRole('heading', { name: 'Drivers' }))
  })

  it('falls back to the «Map» button of the switch when the strip has no title', () => {
    runtime.dockTitle = false
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.list.handleOrderCardClick(free))
    runtime.dockTitle = true
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Map' }))
  })

  it('choosing the same card again, already on «Map», does not pull the focus again', () => {
    runtime.dockTitle = true
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.list.handleOrderCardClick(free))
    const button = screen.getByRole('button', { name: 'List' })
    button.focus()
    act(() => runtime.list.handleOrderCardClick(free))
    expect(document.activeElement).toBe(button)
  })

  it('requestAssign also goes to «Map»', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    act(() => runtime.board.requestAssign(free))
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    expect(mapColumn()).not.toHaveAttribute('hidden')
  })

  it('keeps the toggles reachable', () => {
    render(<DeliveryDashboard {...baseProps()} />)
    expect(screen.getByRole('button', { name: 'Unassigned' })).toBeInTheDocument()
  })
})

describe('DeliveryDashboard · from 1024px', () => {
  let restore
  afterEach(() => restore())

  it.each([1024, 1280, 1440])('at %ipx both columns are drawn and there is no List | Map switch', (width) => {
    restore = installViewport(width)
    render(<DeliveryDashboard {...baseProps()} />)
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
    expect(listColumn()).not.toHaveAttribute('hidden')
    expect(mapColumn()).not.toHaveAttribute('hidden')
  })
})

describe('DeliveryDashboard · beside the order panel (decision 6, DV-07)', () => {
  let restore
  beforeEach(() => { runtime.listMounts = 0; runtime.listUnmounts = 0 })
  afterEach(() => restore())

  const inSplit = (open) => (
    <SplitView
      list={<DeliveryDashboard {...baseProps()} />}
      panel={<div data-testid='panel'>panel</div>}
      open={open}
      panelLabel='Order 11'
      resizeLabel='Resize the order panel'
      onClose={() => {}}
    />
  )

  it('hides the map column (kept mounted) while the panel is beside the list, and shows it again on close; the list is not remounted', () => {
    restore = installViewport(1440)
    const { rerender } = render(inSplit(false))
    expect(mapColumn()).not.toHaveAttribute('hidden')

    rerender(inSplit(true))
    expect(screen.getByTestId('panel')).toBeInTheDocument()
    expect(mapColumn()).toHaveAttribute('hidden')
    expect(screen.getByTestId('deliveries-location')).toBeInTheDocument()
    expect(listColumn()).not.toHaveAttribute('hidden')

    rerender(inSplit(false))
    expect(mapColumn()).not.toHaveAttribute('hidden')
    expect(runtime.listMounts).toBe(1)
    expect(runtime.listUnmounts).toBe(0)
  })

  // (review R2): with the panel beside the list (≥1280) the candidates strip lives in the hidden map column, so «Assign» on
  // a card chose the order and showed nothing. It asks the split view to close the panel (its own way out, so unsaved text is still
  // asked about) and, once the map column is back, sends the focus to the order's candidates.
  it('«Assign» with the panel beside the list closes the panel, then focuses the candidates once the map column is back', () => {
    restore = installViewport(1440)
    const onClose = vi.fn()
    const split = (open) => (
      <SplitView
        list={<DeliveryDashboard {...baseProps()} />}
        panel={<div data-testid='panel'>panel</div>}
        open={open}
        panelLabel='Order 11'
        resizeLabel='Resize the order panel'
        onClose={onClose}
      />
    )
    const { rerender } = render(split(true))
    expect(mapColumn()).toHaveAttribute('hidden')
    const token0 = runtime.location.focusCandidatesToken
    act(() => runtime.board.requestAssign({ id: 21, driver_id: null }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(runtime.location.interActionMapOrder).toMatchObject({ id: 21 })
    // nothing to focus while the column is still hidden
    expect(runtime.location.focusCandidatesToken).toBe(token0)

    rerender(split(false))
    expect(mapColumn()).not.toHaveAttribute('hidden')
    expect(runtime.location.focusCandidatesToken).toBe(token0 + 1)
  })

  // review of when the panel asks first (unsaved text) and the user keeps editing, «Assign» must leave nothing behind:
  // no order chosen for the hidden map and no focus waiting for the next time the panel closes.
  it('«Assign» does nothing when the panel asks first, and a later close does not jump to the candidates', () => {
    restore = installViewport(1440)
    const onClose = vi.fn()
    const Guarded = ({ asks }) => {
      const { registerCloseGuard } = useSplitView()
      useEffect(() => registerCloseGuard(() => asks), [registerCloseGuard, asks])
      return <div data-testid='panel'>panel</div>
    }
    const split = (open) => (
      <SplitView
        list={<DeliveryDashboard {...baseProps()} />}
        panel={<Guarded asks />}
        open={open}
        panelLabel='Order 11'
        resizeLabel='Resize the order panel'
        onClose={onClose}
      />
    )
    const { rerender } = render(split(true))
    const token0 = runtime.location.focusCandidatesToken
    act(() => runtime.board.requestAssign({ id: 21, driver_id: null }))
    expect(onClose).not.toHaveBeenCalled()
    expect(runtime.location.interActionMapOrder).toBeNull()

    rerender(split(false))
    expect(runtime.location.focusCandidatesToken).toBe(token0)
  })

  it('keeps the map where the panel is an overlay (1024 to 1279px)', () => {
    restore = installViewport(1100)
    const { rerender } = render(inSplit(false))
    rerender(inSplit(true))
    expect(mapColumn()).not.toHaveAttribute('hidden')
  })
})
