/* eslint-disable import/first */
// redesign drivers-dashboard B4 (decisions 1, 2, 3, 6, 7, 8): the board of /drivers-dashboard. The list (tabs, load filter, rows, pager),
// the map column (map + panel of the chosen driver) and, below 1024px, the List | Map switch. The map is simulated: the suite sees the
// props the board gives it.
import React, { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ stacked: false, location: null, locationMounts: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (value) => value, parseDate: (date) => `parsed ${date}` }],
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../hooks/useBoardStacked', () => ({ useBoardStacked: () => runtime.stacked }))
vi.mock('../../DriversLocation', () => ({
  DriversLocation: (props) => {
    runtime.location = props
    React.useEffect(() => { runtime.locationMounts += 1 }, [])
    return <div data-testid='drivers-location' />
  }
}))

import { DriversDashboard } from '../index'

const NOW = Date.parse('2026-10-09T12:00:00Z')

const makeDriver = (id, name, overrides = {}) => ({
  id,
  name,
  lastname: 'Test',
  enabled: true,
  available: true,
  busy: false,
  assigned_orders_count: 0,
  last_location_at: '2026-10-09 11:57:00',
  ...overrides
})

// 2 online (Ana free, Bob busy), 2 offline (Cleo free, Dan busy), 1 disabled (Eve: in neither list)
const FIVE = [
  makeDriver(1, 'Ana'),
  makeDriver(2, 'Bob', { busy: true }),
  makeDriver(3, 'Cleo', { available: false }),
  makeDriver(4, 'Dan', { available: false, busy: true }),
  makeDriver(5, 'Eve', { enabled: false })
]

const twelveOnline = () => Array.from({ length: 12 }, (_, index) => makeDriver(100 + index, `Driver${index + 1}`))

const baseProps = (overrides = {}) => ({
  driversList: { drivers: FIVE, loading: false, error: null },
  driversIsOnline: true,
  searchValue: '',
  selectedDriver: null,
  handleChangeDriverIsOnline: vi.fn(),
  assignedOrders: { loading: false, error: null, orders: [] },
  ordersOpeningId: null,
  now: NOW,
  onSelectDriver: vi.fn(),
  onOpenOrders: vi.fn(),
  onClosePanel: vi.fn(),
  ...overrides
})

const renderBoard = (overrides = {}) => {
  const props = baseProps(overrides)
  return { props, ...renderWithProviders(<DriversDashboard {...props} />) }
}

const rows = (container) => Array.from(container.querySelectorAll('li.odd-row:not([data-skeleton])'))
const rowNames = (container) => rows(container).map((row) => row.querySelector('.odd-row-name').textContent)

beforeEach(() => {
  runtime.stacked = false
  runtime.location = null
  runtime.locationMounts = 0
})

describe('DriversDashboard · tabs and load filter', () => {
  it('counts every driver of each state on the tabs (the disabled one is in neither)', () => {
    renderBoard()
    expect(screen.getByRole('tab', { name: 'Online 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Offline 2' })).toHaveAttribute('aria-selected', 'false')
  })

  it('lists the drivers of the tab in the order of the API', () => {
    const { container, rerender, props } = renderBoard()
    expect(rowNames(container)).toEqual(['Ana Test', 'Bob Test'])
    rerender(<DriversDashboard {...props} driversIsOnline={false} />)
    expect(rowNames(container)).toEqual(['Cleo Test', 'Dan Test'])
  })

  it('«Busy» keeps only the busy drivers in the list and on the map, and the tabs keep counting everyone', async () => {
    const { container } = renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    expect(rowNames(container)).toEqual(['Bob Test'])
    expect(runtime.location.onlineDrivers.map((driver) => driver.id)).toEqual([2])
    expect(runtime.location.offlineDrivers.map((driver) => driver.id)).toEqual([4])
    expect(screen.getByRole('tab', { name: 'Online 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Offline 2' })).toBeInTheDocument()
    expect(container.querySelector('p.odd-summary')).toHaveTextContent('2 drivers · 1 not busy · 1 busy')
  })

  it('«Not busy» keeps the free ones', async () => {
    const { container } = renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Not busy' }))
    expect(rowNames(container)).toEqual(['Ana Test'])
    expect(runtime.location.onlineDrivers.map((driver) => driver.id)).toEqual([1])
    expect(runtime.location.offlineDrivers.map((driver) => driver.id)).toEqual([3])
  })

  it('changing the tab asks the controller for it and puts the load filter back on «All»', async () => {
    const changed = vi.fn()
    const Harness = () => {
      const [online, setOnline] = useState(true)
      return (
        <DriversDashboard
          {...baseProps()}
          driversIsOnline={online}
          handleChangeDriverIsOnline={(value) => { changed(value); setOnline(value) }}
        />
      )
    }
    const { container } = renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    expect(screen.getByRole('button', { name: 'Busy' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Offline 2' }))
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(rowNames(container)).toEqual(['Cleo Test', 'Dan Test'])
  })
})

describe('DriversDashboard · rows, pager and states', () => {
  it('draws 10 rows and the pager for 12 connected drivers, and 2 on page 2', async () => {
    const { container } = renderBoard({ driversList: { drivers: twelveOnline(), loading: false, error: null } })
    expect(rows(container)).toHaveLength(10)
    expect(container.querySelector('ul.odd-rows')).toHaveAttribute('id', 'driversList')
    const pager = within(container.querySelector('.odd-list-foot')).getByRole('navigation', { name: 'Pagination' })
    expect(pager).toHaveTextContent('Showing 1–10 of 12')
    await userEvent.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(rows(container)).toHaveLength(2)
    expect(rowNames(container)).toEqual(['Driver11 Test', 'Driver12 Test'])
    expect(pager).toHaveTextContent('Showing 11–12 of 12')
  })

  // W1-PA1-03: with 2+ pages the foot has the «Page» field, like the orders lists
  it('has a Page field to jump to a page when there are 2 or more pages', () => {
    const { container } = renderBoard({ driversList: { drivers: twelveOnline(), loading: false, error: null } })
    const input = within(container.querySelector('.odd-list-foot')).getByRole('textbox', { name: 'Page' })
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rowNames(container)).toEqual(['Driver11 Test', 'Driver12 Test'])
  })

  it('has no pager when the tab is empty', () => {
    const { container } = renderBoard({ driversList: { drivers: [], loading: false, error: null } })
    expect(container.querySelector('.odd-list-foot')).toBeNull()
  })

  it('says «No drivers» for an empty tab and «No drivers found» when there is a search', () => {
    const { unmount } = renderBoard({ driversList: { drivers: [], loading: false, error: null } })
    expect(screen.getByText('No drivers')).toBeInTheDocument()
    expect(screen.queryByText('No drivers found')).toBeNull()
    unmount()
    renderBoard({ driversList: { drivers: [], loading: false, error: null }, searchValue: 'zzz' })
    expect(screen.getByText('No drivers found')).toBeInTheDocument()
  })

  it('draws 10 skeleton rows and a hidden «Loading» while the drivers load', () => {
    const { container } = renderBoard({ driversList: { drivers: [], loading: true, error: null } })
    expect(container.querySelectorAll('li.odd-row[data-skeleton]')).toHaveLength(10)
    expect(rows(container)).toHaveLength(0)
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    expect(container.querySelector('#driversList')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('No drivers')).toBeNull()
  })

  it('choosing a row calls onSelectDriver with that driver', async () => {
    const { props } = renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Bob Test' }))
    expect(props.onSelectDriver).toHaveBeenCalledTimes(1)
    expect(props.onSelectDriver).toHaveBeenCalledWith(FIVE[1])
  })

  it('«n assigned orders» of a row calls onOpenOrders with the driver alone (the page works out the tab)', async () => {
    const drivers = [makeDriver(1, 'Ana', { assigned_orders_count: 3 })]
    const { props } = renderBoard({ driversList: { drivers, loading: false, error: null } })
    await userEvent.click(screen.getByRole('button', { name: '3 assigned orders' }))
    expect(props.onOpenOrders).toHaveBeenCalledTimes(1)
    expect(props.onOpenOrders.mock.calls[0]).toEqual([drivers[0]])
  })

  it('puts busy on the orders button of the row that is opening', () => {
    const drivers = [makeDriver(1, 'Ana', { assigned_orders_count: 3 }), makeDriver(2, 'Bob', { assigned_orders_count: 1 })]
    renderBoard({ driversList: { drivers, loading: false, error: null }, ordersOpeningId: 1 })
    expect(screen.getByRole('button', { name: '3 assigned orders' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: '1 assigned order' })).not.toHaveAttribute('aria-busy', 'true')
  })
})

describe('DriversDashboard · map column and panel of the chosen driver', () => {
  it('gives the map the drivers of both tabs, the chosen one and the orders without the inherited spinner', () => {
    const assignedOrders = { loading: true, error: null, orders: [{ id: 9, status: 7 }] }
    renderBoard({ selectedDriver: FIVE[0], assignedOrders })
    expect(runtime.location.driversIsOnline).toBe(true)
    expect(runtime.location.selectedDriver).toBe(FIVE[0])
    expect(runtime.location.onlineDrivers.map((driver) => driver.id)).toEqual([1, 2])
    expect(runtime.location.offlineDrivers.map((driver) => driver.id)).toEqual([3, 4])
    expect(runtime.location.assignedOrders).toEqual({ ...assignedOrders, loading: false })
  })

  it('draws no panel without a chosen driver', () => {
    const { container } = renderBoard()
    expect(container.querySelector('.odd-panel')).toBeNull()
  })

  it('draws the panel of the chosen driver under the map, with its name as an h2', () => {
    const { container } = renderBoard({ selectedDriver: FIVE[0] })
    expect(screen.getByRole('heading', { level: 2, name: 'Ana Test' })).toBeInTheDocument()
    const column = container.querySelector('.odd-map')
    expect(column.querySelector('[data-testid="drivers-location"]')).not.toBeNull()
    expect(column.lastElementChild).toHaveClass('odd-panel')
  })

  it('the × of the panel calls onClosePanel and «All orders» calls onOpenOrders with the group the panel worked out', async () => {
    const assignedOrders = { loading: false, error: null, orders: [{ id: 9, status: 7, business: { name: 'Burger' } }] }
    const selected = makeDriver(1, 'Ana', { assigned_orders_count: 1 })
    const { props } = renderBoard({ selectedDriver: selected, assignedOrders })
    await userEvent.click(screen.getByRole('button', { name: 'Close Ana Test' }))
    expect(props.onClosePanel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'All orders' }))
    expect(props.onOpenOrders).toHaveBeenCalledWith(selected, 'inProgress')
  })

  it('puts busy on «All orders» of the panel while its driver is opening', () => {
    const selected = makeDriver(1, 'Ana', { assigned_orders_count: 1 })
    renderBoard({ selectedDriver: selected, ordersOpeningId: 1 })
    expect(screen.getByRole('button', { name: 'All orders' })).toHaveAttribute('aria-busy', 'true')
  })

  it('draws both columns, with no switch and no data-view, from 1024px', () => {
    const { container } = renderBoard()
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
    expect(container.querySelector('.odd-board')).not.toHaveAttribute('data-view')
    expect(container.querySelector('.odd-list')).not.toHaveAttribute('hidden')
    expect(screen.getByTestId('drivers-location')).toBeInTheDocument()
  })
})

describe('DriversDashboard · below 1024px (decision 7)', () => {
  beforeEach(() => { runtime.stacked = true })

  it('opens on the list with the List | Map switch and does not mount the map yet', () => {
    const { container } = renderBoard()
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.odd-board')).toHaveAttribute('data-view', 'list')
    expect(container.querySelector('.odd-list')).not.toHaveAttribute('hidden')
    expect(screen.queryByTestId('drivers-location')).toBeNull()
    expect(runtime.locationMounts).toBe(0)
  })

  it('draws the panel after the list in the list view, with no map', () => {
    const { container } = renderBoard({ selectedDriver: FIVE[0] })
    const panel = container.querySelector('.odd-panel')
    expect(panel).not.toBeNull()
    expect(screen.queryByTestId('drivers-location')).toBeNull()
    expect(container.querySelector('.odd-list').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('«Map» mounts the map, hides the list and keeps the panel under the map', async () => {
    const { container } = renderBoard({ selectedDriver: FIVE[0] })
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(container.querySelector('.odd-board')).toHaveAttribute('data-view', 'map')
    expect(container.querySelector('.odd-list')).toHaveAttribute('hidden')
    expect(screen.getByTestId('drivers-location')).toBeInTheDocument()
    expect(runtime.locationMounts).toBe(1)
    expect(container.querySelector('.odd-map').lastElementChild).toHaveClass('odd-panel')
  })

  it('«List» unmounts the map again and shows the list', async () => {
    const { container } = renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.queryByTestId('drivers-location')).toBeNull()
    expect(container.querySelector('.odd-list')).not.toHaveAttribute('hidden')
  })

  it('choosing a row does not change the view', async () => {
    const { container, props } = renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(props.onSelectDriver).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.odd-board')).toHaveAttribute('data-view', 'list')
  })
})

// redesign drivers-dashboard R1-02: closing the panel with its × left the focus on <body>; it goes back to the chosen row
describe('DriversDashboard · focus after closing the panel (R1-02)', () => {
  it('puts the focus back on the chosen row', async () => {
    renderBoard({ selectedDriver: FIVE[0] })
    await userEvent.click(screen.getByRole('button', { name: 'Close Ana Test' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Select driver Ana Test' }))
  })
})

// (row 26, drivers-dashboard P1, D-33): the filter by driver group. The groups come from the drivers themselves
// (`drivergroups`), the pill sits in the head of the list, and the choice narrows the tabs, the counts, the rows, the pager and the map.
describe('DriversDashboard · filter by driver group', () => {
  const NORTH = { id: 10, name: 'North' }
  const SOUTH = { id: 20, name: 'South' }
  // Ana (online, free) North; Bob (online, busy) South; Cleo (offline, free) North; Dan (offline, busy) no group; Eve disabled, South
  const GROUPED = [
    makeDriver(1, 'Ana', { drivergroups: [NORTH] }),
    makeDriver(2, 'Bob', { busy: true, drivergroups: [SOUTH] }),
    makeDriver(3, 'Cleo', { available: false, drivergroups: [NORTH] }),
    makeDriver(4, 'Dan', { available: false, busy: true, drivergroups: [] }),
    makeDriver(5, 'Eve', { enabled: false, drivergroups: [SOUTH] })
  ]

  // the controller keeps the choice: the board gets `groupIds` and `onGroupIdsChange`, as DriversManager gives them
  const Harness = ({ drivers = GROUPED, initial = [], onChange }) => {
    const [groupIds, setGroupIds] = useState(initial)
    return (
      <DriversDashboard
        {...baseProps({ driversList: { drivers, loading: false, error: null } })}
        groupIds={groupIds}
        onGroupIdsChange={(ids) => { onChange?.(ids); setGroupIds(ids) }}
      />
    )
  }
  const pill = () => screen.getByRole('button', { name: /Driver group/ })

  it('draws the «Driver group» pill in the head of the list, beside the load filter', () => {
    const { container } = renderWithProviders(<Harness />)
    expect(container.querySelector('.odd-list-head')).toContainElement(pill())
  })

  it('draws no pill when no driver has a group', () => {
    renderBoard()
    expect(screen.queryByRole('button', { name: /Driver group/ })).toBeNull()
  })

  it('lists each group once, by name, whatever tab is on screen', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(pill())
    const list = screen.getByRole('group', { name: 'Driver group' })
    expect(Array.from(list.querySelectorAll('.odc-orders-picker-name')).map((name) => name.textContent)).toEqual(['North', 'South'])
  })

  it('choosing a group narrows the rows, the tab counts, the summary and the map', async () => {
    const onChange = vi.fn()
    const { container } = renderWithProviders(<Harness onChange={onChange} />)
    expect(rowNames(container)).toEqual(['Ana Test', 'Bob Test'])
    await userEvent.click(pill())
    await userEvent.click(screen.getByRole('checkbox', { name: /North/ }))
    expect(onChange).toHaveBeenCalledWith([10])
    expect(rowNames(container)).toEqual(['Ana Test'])
    expect(screen.getByRole('tab', { name: 'Online 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Offline 1' })).toBeInTheDocument()
    expect(container.querySelector('p.odd-summary')).toHaveTextContent('1 driver · 1 not busy · 0 busy')
    expect(runtime.location.onlineDrivers.map((driver) => driver.id)).toEqual([1])
    expect(runtime.location.offlineDrivers.map((driver) => driver.id)).toEqual([3])
  })

  it('a second group widens it (any of the chosen), and «Clear» brings every driver back', async () => {
    const { container } = renderWithProviders(<Harness initial={[10]} />)
    expect(rowNames(container)).toEqual(['Ana Test'])
    await userEvent.click(pill())
    await userEvent.click(screen.getByRole('checkbox', { name: /South/ }))
    expect(rowNames(container)).toEqual(['Ana Test', 'Bob Test'])
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(rowNames(container)).toEqual(['Ana Test', 'Bob Test'])
    expect(screen.getByRole('tab', { name: 'Offline 2' })).toBeInTheDocument()
  })

  it('keeps every group in the list while one is chosen', async () => {
    renderWithProviders(<Harness initial={[10]} />)
    await userEvent.click(pill())
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('reads the groups of a driver from driver_groups too', () => {
    const drivers = [makeDriver(1, 'Ana', { driver_groups: [NORTH] }), makeDriver(2, 'Bob')]
    const { container } = renderWithProviders(<Harness drivers={drivers} initial={[10]} />)
    expect(rowNames(container)).toEqual(['Ana Test'])
    expect(pill()).toBeInTheDocument()
  })

  it('a change of group goes back to page 1', async () => {
    const drivers = Array.from({ length: 12 }, (_, index) => makeDriver(100 + index, `Driver${index + 1}`, { drivergroups: index < 11 ? [NORTH] : [SOUTH] }))
    const { container } = renderWithProviders(<Harness drivers={drivers} />)
    await userEvent.click(within(container.querySelector('.odd-list-foot')).getByRole('button', { name: 'Next page' }))
    expect(rows(container)).toHaveLength(2)
    await userEvent.click(pill())
    await userEvent.click(screen.getByRole('checkbox', { name: /North/ }))
    expect(rows(container)).toHaveLength(10)
    expect(container.querySelector('.odd-list-foot')).toHaveTextContent('Showing 1–10 of 11')
  })
})
