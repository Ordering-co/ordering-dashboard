/* eslint-disable import/first */
// redesign all-in-one B2 (decisions 1, 5, 6; AIO-01, AIO-02, AIO-03, AIO-06, AIO-08): the board of /all-in-one.
//  - Decision 1: from 1024px two columns: the orders (.aio-orders) and the side (.aio-side) with the map (.aio-map) over the drivers.
//  - Decision 6: below 1024px one column with a List | Map switch. The map is mounted only in «Map»; the drivers and the orders never unmount
//    (they are hidden), and going back to «List» gives the page the scroll it had.
//  - Decision 5 (AIO-06): the title is «All in one», in the head and in the alert dialog.
//  - AIO-04: the drivers come as `driversList` + `driversLoading` (one request), and `last_location_at` is asked for.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  stacked: false,
  header: null,
  drivers: null,
  controller: null,
  unmounts: { drivers: 0, orders: 0, map: 0 }
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{ project: 'demo' }],
  OrdersManage: ({ UIComponent, ...props }) => { runtime.controller = props; return <UIComponent {...props} /> }
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

// The neighbours of the page: this suite is about the board, not about them.
vi.mock('../OrdersContentHeader', () => ({ OrdersContentHeader: (props) => { runtime.header = props; return <h1 data-testid='header'>{props.title}</h1> } }))
vi.mock('../OrderNotification', () => ({ OrderNotificationSlot: () => null }))
vi.mock('../AllInOne/DriversManager', async () => {
  const React = await import('react')
  return {
    DriversManager: (props) => {
      runtime.drivers = props
      React.useEffect(() => () => { runtime.unmounts.drivers += 1 }, [])
      return <div data-testid='drivers-manager' className={props.className} />
    }
  }
})
vi.mock('../DriversLocation', async () => {
  const React = await import('react')
  return {
    DriversLocation: () => {
      React.useEffect(() => () => { runtime.unmounts.map += 1 }, [])
      return <div data-testid='drivers-map' />
    }
  }
})
vi.mock('../OrderStatusFilterBar', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusFilterBar: () => <div data-testid='status-tabs' />
}))
vi.mock('../OrderStatusSubFilter', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusSubFilter: () => <div data-testid='sub-filter' />
}))
vi.mock('../OrdersDashboardControls', () => ({ OrdersDashboardControls: () => <div data-testid='controls' /> }))
vi.mock('../OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../WizardOrders', () => ({ WizardOrders: () => null }))
vi.mock('../OrdersDashboard', async () => {
  const React = await import('react')
  return {
    OrdersDashboard: () => {
      React.useEffect(() => () => { runtime.unmounts.orders += 1 }, [])
      return <div data-testid='orders-dashboard' />
    }
  }
})

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
  driversList: { drivers: [{ id: 7 }], loading: true },
  mapsData: {},
  selectedOrderIds: [],
  filterValues: { statuses: [] },
  searchValue: '',
  allowColumns: {},
  setAllowColumns: vi.fn()
}

const mount = (props = {}) => render(
  <ThemeProvider theme={{ colors: {} }}>
    <MemoryRouter initialEntries={['/all-in-one']}>
      <AllInOne {...baseProps} {...props} />
    </MemoryRouter>
  </ThemeProvider>
)

beforeEach(() => {
  runtime.stacked = false
  runtime.header = null
  runtime.drivers = null
  runtime.controller = null
  runtime.unmounts = { drivers: 0, orders: 0, map: 0 }
  window.scrollTo = vi.fn()
})

describe('decision 5 (AIO-06): the title is «All in one»', () => {
  it('the head and the alert dialog both say «All in one»', async () => {
    mount()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All in one')
    expect(runtime.header.title).toBe('All in one')
    act(() => { runtime.header.handleOpenTour() })
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('All in one')).toBeInTheDocument()
    expect(within(dialog).getByText('One order is required')).toBeInTheDocument()
    expect(screen.queryByText('Orders manager')).toBeNull()
  })
})

describe('decision 1: from 1024px, two columns', () => {
  it('draws the orders on the left and, on the right, the map over the drivers, with no switch', () => {
    runtime.stacked = false
    const { container } = mount()
    const orders = container.querySelector('.aio-orders')
    const side = container.querySelector('.aio-side')
    expect(orders).not.toBeNull()
    expect(side).not.toBeNull()
    expect(orders.querySelector('.aio-orders-body.order-content')).not.toBeNull()
    expect(within(orders).getByTestId('status-tabs')).toBeInTheDocument()
    expect(within(orders).getByTestId('sub-filter')).toBeInTheDocument()
    expect(within(orders.querySelector('.aio-orders-body')).getByTestId('orders-dashboard')).toBeInTheDocument()
    const map = side.querySelector('.aio-map')
    expect(map).not.toBeNull()
    expect(within(map).getByTestId('drivers-map')).toBeInTheDocument()
    expect(within(side).getByTestId('drivers-manager')).toBeInTheDocument()
    expect(map.compareDocumentPosition(screen.getByTestId('drivers-manager')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Map' })).toBeNull()
    expect(container.querySelector('[hidden]')).toBeNull()
  })

  it('leaves no grey 5px separators: the old containers are gone', () => {
    const { container } = mount()
    expect(container.querySelector('#orderTable')).toBeNull()
    expect(container.querySelectorAll('.aio-board')).toHaveLength(1)
  })
})

describe('decision 6: below 1024px, List | Map', () => {
  beforeEach(() => { runtime.stacked = true })

  it('starts on «List»: orders and drivers, no map, and the switch above the board', () => {
    const { container } = mount()
    const board = container.querySelector('.aio-board')
    expect(board.getAttribute('data-view')).toBe('list')
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('drivers-map')).toBeNull()
    expect(screen.getByTestId('drivers-manager')).toBeInTheDocument()
    expect(screen.getByTestId('drivers-manager').closest('[hidden]')).toBeNull()
    expect(screen.getByTestId('orders-dashboard').closest('[hidden]')).toBeNull()
  })

  it('«Map» mounts the map and hides, without unmounting, the drivers and the orders; «List» brings them back as they were', async () => {
    const user = userEvent.setup()
    const { container } = mount()

    await user.click(screen.getByRole('button', { name: 'Map' }))
    expect(container.querySelector('.aio-board').getAttribute('data-view')).toBe('map')
    expect(screen.getByTestId('drivers-map')).toBeInTheDocument()
    expect(screen.getByTestId('drivers-manager')).toBeInTheDocument()
    expect(screen.getByTestId('drivers-manager').closest('[hidden]')).not.toBeNull()
    expect(screen.getByTestId('orders-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('orders-dashboard').closest('[hidden]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.queryByTestId('drivers-map')).toBeNull()
    expect(screen.getByTestId('drivers-manager')).toBeInTheDocument()
    expect(screen.getByTestId('drivers-manager').closest('[hidden]')).toBeNull()
    expect(screen.getByTestId('orders-dashboard').closest('[hidden]')).toBeNull()
    // never unmounted: the selection and the requests of both survive the switch
    expect(runtime.unmounts.drivers).toBe(0)
    expect(runtime.unmounts.orders).toBe(0)
    // the map was mounted only in «Map»
    expect(runtime.unmounts.map).toBe(1)
  })

  it('going back to «List» gives the page the scroll it had when it went to «Map»', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const page = container.querySelector('.aio-page')
    expect(page).not.toBeNull()
    // jsdom has no layout: a backing value stands for the scroll position, and «Map» clamps it to 0 as a short page would
    let top = 480
    Object.defineProperty(page, 'scrollTop', { configurable: true, get: () => top, set: (value) => { top = value } })

    await user.click(screen.getByRole('button', { name: 'Map' }))
    top = 0
    await user.click(screen.getByRole('button', { name: 'List' }))
    expect(top).toBe(480)
  })
})

describe('AIO-04: the drivers come from the controller, once', () => {
  it('hands DriversManager driversList and driversLoading, and not drivers', () => {
    mount({ driversList: { drivers: [{ id: 7 }], loading: true } })
    expect(runtime.drivers.driversList).toBe(runtime.controller.driversList)
    expect(runtime.drivers.driversList.drivers).toEqual([{ id: 7 }])
    expect(runtime.drivers.driversLoading).toBe(true)
    expect(runtime.drivers).not.toHaveProperty('drivers')
    expect(runtime.drivers.className).toBeTruthy()
  })

  it('driversLoading is false once the list has loaded', () => {
    mount({ driversList: { drivers: [], loading: false } })
    expect(runtime.drivers.driversLoading).toBe(false)
  })

  it('asks the controller for last_location_at', () => {
    mount()
    expect(runtime.controller.driversPropsToFetch).toContain('last_location_at')
    expect(runtime.controller.driversPropsToFetch[runtime.controller.driversPropsToFetch.length - 1]).toBe('last_location_at')
  })
})

// fila 48: with no order selected the page resets the selected count 500 ms later; that timer outlived the page, and on a
// loaded machine it fired after the test environment was gone («window is not defined», an unhandled error that failed the run).
describe('unmount', () => {
  it('leaves no timer of its own behind, and the reset still runs while it is mounted', () => {
    vi.useFakeTimers()
    try {
      const first = mount()
      expect(vi.getTimerCount()).toBeGreaterThan(0)
      act(() => { vi.advanceTimersByTime(500) })
      expect(vi.getTimerCount()).toBe(0)
      first.unmount()

      const second = mount()
      second.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
