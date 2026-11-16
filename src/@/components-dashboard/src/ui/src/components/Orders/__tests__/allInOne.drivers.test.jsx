/* eslint-disable import/first */
// redesign all-in-one B1 (decisions 2, 3, 7; AIO-04, AIO-05): the drivers of /all-in-one with the pieces of /drivers-dashboard.
// The controller is simulated (a state for the tab and the chosen driver, the lists it gives), the sheet and the key button are
// stand-ins: the suite sees what AllInOne/DriversManager asks of the controller, what it draws and what it hands to the map.
import React from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  config: { configs: { google_maps_api_key: { value: 'key' } } },
  controllerProps: null,
  data: null,
  setMapsData: null,
  handleChangeDriversSubFilter: null,
  setSelectedDriver: null,
  handleEmtpyOrderSelected: null,
  handleUpdateAssignedOrders: null,
  sheet: null
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (value) => value, parseDate: (date) => `parsed ${date}` }],
  useConfig: () => [runtime.config],
  // The controller of the page: it owns the tab and the chosen driver, and gives the lists it filtered. Like the real one with
  // `asDashboard`, it leaves `driversSubfilter` with both flags on.
  DriversList: ({ UIComponent, ...props }) => {
    const [driversIsOnline, setDriversIsOnline] = React.useState(true)
    const [selectedDriver, setSelectedDriverState] = React.useState(null)
    runtime.controllerProps = props
    return (
      <UIComponent
        {...props}
        driversList={runtime.data.driversList}
        onlineDrivers={runtime.data.onlineDrivers}
        offlineDrivers={runtime.data.offlineDrivers}
        driversSubfilter={{ busy: true, notBusy: true }}
        handleChangeDriversSubFilter={runtime.handleChangeDriversSubFilter}
        driversIsOnline={driversIsOnline}
        handleChangeDriverIsOnline={setDriversIsOnline}
        selectedDriver={selectedDriver}
        setSelectedDriver={(driver) => { runtime.setSelectedDriver(driver); setSelectedDriverState(driver) }}
        assignedOrders={runtime.data.assignedOrders}
      />
    )
  }
}))
vi.mock('../ContactOrdersSheet', () => ({
  ContactOrdersSheet: (props) => {
    runtime.sheet = props
    return <div data-testid='sheet' data-open={String(props.open)} data-user={props.user?.id} />
  }
}))
vi.mock('../GoogleMapsApiKeySettingButton', () => ({
  GoogleMapsApiKeySettingButton: () => <button type='button'>Set Google Maps key</button>
}))

import { DriversManager } from '../AllInOne/DriversManager'

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

const ANA = makeDriver(1, 'Ana')
const BOB = makeDriver(2, 'Bob', { busy: true, assigned_orders_count: 3 })
const CLEO = makeDriver(3, 'Cleo', { available: false })
const DAN = makeDriver(4, 'Dan', { available: false, busy: true })
// In the controller's `driversList.drivers` but not in its filtered lists (the «Driver» / «Driver group» filter left it out)
const ZED = makeDriver(9, 'Zed')

const lists = (overrides = {}) => ({
  driversList: { drivers: [ANA, BOB, CLEO, DAN, ZED], loading: false, error: null },
  onlineDrivers: [ANA, BOB],
  offlineDrivers: [CLEO, DAN],
  assignedOrders: { loading: false, error: null, orders: [] },
  ...overrides
})

const mount = (props = {}) => renderWithProviders(
  <DriversManager
    setMapsData={runtime.setMapsData}
    handleEmtpyOrderSelected={runtime.handleEmtpyOrderSelected}
    handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders}
    orderForMap={undefined}
    {...props}
  />
)

const rows = (container) => Array.from(container.querySelectorAll('li.odd-row:not([data-skeleton])'))
const rowNames = (container) => rows(container).map((row) => row.querySelector('.odd-row-name').textContent)
const lastMapsData = () => runtime.setMapsData.mock.calls.at(-1)[0]
const ids = (list) => list.map((driver) => driver.id)

beforeEach(() => {
  runtime.config = { configs: { google_maps_api_key: { value: 'key' } } }
  runtime.controllerProps = null
  runtime.data = lists()
  runtime.setMapsData = vi.fn()
  runtime.handleChangeDriversSubFilter = vi.fn()
  runtime.setSelectedDriver = vi.fn()
  runtime.handleEmtpyOrderSelected = vi.fn()
  runtime.handleUpdateAssignedOrders = vi.fn()
  runtime.sheet = null
})

afterEach(() => { vi.useRealTimers() })

describe('all-in-one B1 · the row of /drivers-dashboard, not the old cards', () => {
  it('draws DriverRow with the state in words, and no old card', () => {
    const { container } = mount()
    expect(rowNames(container)).toEqual(['Ana Test', 'Bob Test'])
    const [ana, bob] = rows(container)
    expect(within(ana).getByText('Available')).toBeInTheDocument()
    expect(within(bob).getByText('Busy')).toBeInTheDocument()
    expect(container.querySelector('.driver-info-container')).toBeNull()
    expect(screen.queryByText(/^Orders$/)).toBeNull()
    expect(screen.getByRole('button', { name: '3 assigned orders' })).toBeInTheDocument()
  })

  it('has the root class of the block and takes an extra className', () => {
    const { container } = mount({ className: 'on-the-board' })
    expect(container.querySelector('.aio-drivers')).toHaveClass('on-the-board')
  })

  it('the Google Maps key button goes first, and only without a key', () => {
    const { unmount } = mount()
    expect(screen.queryByRole('button', { name: 'Set Google Maps key' })).toBeNull()
    unmount()
    runtime.config = { configs: {} }
    const { container } = mount()
    expect(screen.getByRole('button', { name: 'Set Google Maps key' })).toBeInTheDocument()
    expect(container.querySelector('.aio-drivers').firstElementChild).toContainElement(screen.getByRole('button', { name: 'Set Google Maps key' }))
  })
})

describe('all-in-one B1 · the tabs list the lists of the controller (audit A2)', () => {
  it('counts onlineDrivers / offlineDrivers, not the drivers of driversList', () => {
    const { container } = mount()
    // 5 drivers in driversList.drivers (Zed included); the controller filtered them down to 2 + 2
    expect(screen.getByRole('tab', { name: 'Online 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Offline 2' })).toHaveAttribute('aria-selected', 'false')
    expect(rowNames(container)).not.toContain('Zed Test')
  })

  it('a different split in the controller changes the tabs and the rows', () => {
    runtime.data = lists({ onlineDrivers: [ANA], offlineDrivers: [CLEO, DAN, ZED] })
    const { container } = mount()
    expect(screen.getByRole('tab', { name: 'Online 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Offline 3' })).toBeInTheDocument()
    expect(rowNames(container)).toEqual(['Ana Test'])
  })

  it('leaves the busy sub-filter of the controller alone (both flags on, never changed)', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Offline 2' }))
    expect(runtime.handleChangeDriversSubFilter).not.toHaveBeenCalled()
  })
})

describe('all-in-one B1 · load filter and map', () => {
  it('hands the map the lists as they come while the load is «All»', () => {
    mount()
    expect(lastMapsData().driversIsOnline).toBe(true)
    expect(ids(lastMapsData().onlineDrivers)).toEqual([1, 2])
    expect(ids(lastMapsData().offlineDrivers)).toEqual([3, 4])
  })

  it('«Busy» keeps only the busy ones in the list and on the map; the tabs keep counting everyone', async () => {
    const { container } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    expect(rowNames(container)).toEqual(['Bob Test'])
    expect(ids(lastMapsData().onlineDrivers)).toEqual([2])
    expect(ids(lastMapsData().offlineDrivers)).toEqual([4])
    expect(screen.getByRole('tab', { name: 'Online 2' })).toBeInTheDocument()
    expect(container.querySelector('p.odd-summary')).toHaveTextContent('2 drivers · 1 not busy · 1 busy')
  })

  it('«Not busy» keeps the free ones', async () => {
    const { container } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Not busy' }))
    expect(rowNames(container)).toEqual(['Ana Test'])
    expect(ids(lastMapsData().onlineDrivers)).toEqual([1])
    expect(ids(lastMapsData().offlineDrivers)).toEqual([3])
  })

  it('does not hand the map new lists when nothing changed (they are memoized)', () => {
    const { rerender } = mount()
    const calls = runtime.setMapsData.mock.calls.length
    rerender(<DriversManager setMapsData={runtime.setMapsData} handleEmtpyOrderSelected={runtime.handleEmtpyOrderSelected} handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders} />)
    expect(runtime.setMapsData.mock.calls.length).toBe(calls)
  })

  it('changing the tab puts the load back on «All» and lets go of the chosen driver', async () => {
    const { container } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    expect(screen.getByRole('button', { name: 'Busy' })).toHaveAttribute('aria-pressed', 'true')
    runtime.setSelectedDriver.mockClear()
    await userEvent.click(screen.getByRole('tab', { name: 'Offline 2' }))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(rowNames(container)).toEqual(['Cleo Test', 'Dan Test'])
    expect(runtime.setSelectedDriver).toHaveBeenCalledWith(null)
    expect(lastMapsData().driversIsOnline).toBe(false)
    expect(ids(lastMapsData().offlineDrivers)).toEqual([3, 4])
  })
})

describe('all-in-one B1 · choosing a driver and the orders of a driver', () => {
  it('choosing a row empties the chosen order and chooses the driver; the same row again lets it go', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(runtime.handleEmtpyOrderSelected).toHaveBeenCalledTimes(1)
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(ANA)
    expect(lastMapsData().selectedDriver).toBe(ANA)
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(runtime.handleEmtpyOrderSelected).toHaveBeenCalledTimes(2)
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(null)
  })

  it('the row keeps working when the parent gives no handleEmtpyOrderSelected', async () => {
    mount({ handleEmtpyOrderSelected: undefined })
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(ANA)
  })

  // redesign bugs-d row 4: with an order picked, the first click on a driver emptied the order and the effect on orderForMap wiped the driver
  it('with an order picked, the first click on a driver chooses it (the order it empties does not let it go)', async () => {
    const Parent = () => {
      const [orderForMap, setOrderForMap] = React.useState({ id: 5 })
      return (
        <DriversManager
          setMapsData={runtime.setMapsData}
          handleEmtpyOrderSelected={() => { runtime.handleEmtpyOrderSelected(); setOrderForMap(null) }}
          handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders}
          orderForMap={orderForMap}
        />
      )
    }
    renderWithProviders(<Parent />)
    runtime.setSelectedDriver.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(runtime.handleEmtpyOrderSelected).toHaveBeenCalledTimes(1)
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(ANA)
    expect(runtime.setSelectedDriver).not.toHaveBeenCalledWith(null)
    expect(lastMapsData().selectedDriver).toBe(ANA)
  })

  it('«n assigned orders» opens the sheet of that driver (isDriver, no statusGroup)', async () => {
    mount()
    expect(runtime.sheet).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '3 assigned orders' }))
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-user', '2')
    expect(runtime.sheet.isDriver).toBe(true)
    expect(runtime.sheet.statusGroup).toBeUndefined()
    act(() => { runtime.sheet.onClose() })
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'false')
  })

  // redesign all-in-one R1-01: as in main (O/DriversList onOpenDriverOrdersDetail)
  it('«n assigned orders» also chooses that driver for the map, as main did', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: '3 assigned orders' }))
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(BOB)
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true')
  })

  it('«n assigned orders» of the chosen driver does not let go of it', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Bob Test' }))
    expect(runtime.setSelectedDriver).toHaveBeenLastCalledWith(BOB)
    runtime.setSelectedDriver.mockClear()
    await userEvent.click(screen.getByRole('button', { name: '3 assigned orders' }))
    expect(runtime.setSelectedDriver).not.toHaveBeenCalled()
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true')
  })

  it('a handler that reads the latest parent props: the row answers with the current handleEmtpyOrderSelected', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = mount({ handleEmtpyOrderSelected: first })
    rerender(<DriversManager setMapsData={runtime.setMapsData} handleEmtpyOrderSelected={second} handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders} />)
    await userEvent.click(screen.getByRole('button', { name: 'Select driver Ana Test' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('all-in-one B1 · effects that stay as they were', () => {
  it('lets go of the driver when the order for the map becomes null', async () => {
    const { rerender } = mount({ orderForMap: { id: 5 } })
    runtime.setSelectedDriver.mockClear()
    rerender(<DriversManager setMapsData={runtime.setMapsData} handleEmtpyOrderSelected={runtime.handleEmtpyOrderSelected} handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders} orderForMap={null} />)
    expect(runtime.setSelectedDriver).toHaveBeenCalledWith(null)
  })

  it('hands the assigned orders to the parent', () => {
    mount()
    expect(runtime.handleUpdateAssignedOrders).toHaveBeenCalledWith(runtime.data.assignedOrders)
  })
})

describe('all-in-one B1 · rows, pager, states (AIO-04)', () => {
  it('shows the skeleton with aria-busy while the parent says the drivers load, even if the controller does not', () => {
    const { container } = mount({ driversLoading: true })
    expect(container.querySelector('.odd-rows')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('li.odd-row[data-skeleton]')).toHaveLength(10)
    expect(rows(container)).toHaveLength(0)
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No drivers')).toBeNull()
    expect(container.querySelector('nav')).toBeNull()
  })

  it('shows the skeleton while the controller itself loads', () => {
    runtime.data = lists({ driversList: { drivers: [], loading: true, error: null }, onlineDrivers: [], offlineDrivers: [] })
    const { container } = mount()
    expect(container.querySelector('.odd-rows')).toHaveAttribute('aria-busy', 'true')
  })

  it('says «No drivers» for an empty tab', () => {
    runtime.data = lists({ onlineDrivers: [], offlineDrivers: [] })
    const { container } = mount()
    expect(screen.getByText('No drivers')).toBeInTheDocument()
    expect(container.querySelector('nav')).toBeNull()
  })

  it('pages 12 drivers by 10 and the pager reads «Showing 1–10 of 12»', async () => {
    const twelve = Array.from({ length: 12 }, (_, index) => makeDriver(100 + index, `Driver${index + 1}`))
    runtime.data = lists({ onlineDrivers: twelve })
    const { container } = mount()
    expect(rows(container)).toHaveLength(10)
    const pager = screen.getByRole('navigation', { name: 'Pagination' })
    expect(pager).toHaveTextContent('Showing 1–10 of 12')
    await userEvent.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(rowNames(container)).toEqual(['Driver11 Test', 'Driver12 Test'])
  })

  // W1-PA1-03: with 2+ pages the foot has the «Page» field, like the orders lists
  it('has a Page field to jump to a page when there are 2 or more pages', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => makeDriver(100 + index, `Driver${index + 1}`))
    runtime.data = lists({ onlineDrivers: twelve })
    const { container } = mount()
    const input = within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('textbox', { name: 'Page' })
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rowNames(container)).toEqual(['Driver11 Test', 'Driver12 Test'])
  })

  it('goes back to the last page that exists when the list shrinks', async () => {
    const twelve = Array.from({ length: 12 }, (_, index) => makeDriver(100 + index, `Driver${index + 1}`))
    runtime.data = lists({ onlineDrivers: twelve })
    const { container, rerender } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows(container)).toHaveLength(2)
    runtime.data = lists({ onlineDrivers: twelve.slice(0, 3) })
    rerender(<DriversManager setMapsData={runtime.setMapsData} handleEmtpyOrderSelected={runtime.handleEmtpyOrderSelected} handleUpdateAssignedOrders={runtime.handleUpdateAssignedOrders} />)
    expect(rows(container)).toHaveLength(3)
  })
})

describe('all-in-one B1 · one request less: the drivers come from the parent (AIO-04)', () => {
  it('passes the parent driversList to the controller, so it does not ask', () => {
    const fromParent = { drivers: [ANA, BOB], loading: false, error: null }
    mount({ driversList: fromParent })
    expect(runtime.controllerProps.driversList).toBe(fromParent)
    expect(runtime.controllerProps.asDashboard).toBe(true)
  })

  it('without a driversList from the parent the controller gets none (it asks, as before) and asks for last_location_at', () => {
    mount()
    expect(runtime.controllerProps.driversList).toBeUndefined()
    expect(runtime.controllerProps.propsToFetch).toEqual(expect.arrayContaining(['id', 'name', 'lastname', 'busy', 'assigned_orders_count', 'last_location_at']))
  })
})

describe('all-in-one B1 · the signal clock (decision 6 of /drivers-dashboard)', () => {
  it('moves every minute and stops on unmount', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['setInterval', 'clearInterval', 'Date'] })
    const { container, unmount } = mount()
    const signal = () => container.querySelector('li.odd-row .odd-signal')
    expect(signal()).toHaveTextContent('Location 3 minutes ago')
    act(() => { vi.advanceTimersByTime(120000) })
    expect(signal()).toHaveTextContent('Location 5 minutes ago')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
