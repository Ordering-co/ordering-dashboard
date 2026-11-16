/* eslint-disable import/first */
import React from 'react'
import moment from 'moment'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook, screen, within } from '@testing-library/react'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'

const state = vi.hoisted(() => ({
  messages: { loading: false, error: null, messages: [] },
  level: 0,
  configs: {}
}))

// redesign W0-4a (T0-13, decision 13): parseDate is the REAL helper of UtilsContext (it follows dates_general_format), not a copy.
// `parse` is rebuilt with `useConfigs(...)` for the configs of each test.
const realUtils = vi.hoisted(() => ({ parse: null }))
const parseDate = (...args) => realUtils.parse(...args)

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: state.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true }, (_key, fallback) => fallback]
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{
    parseDate,
    optimizeImage: value => value,
    parseNumber: value => value,
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }],
  useConfig: () => [{ configs: state.configs }],
  useSession: () => [{ user: { level: state.level } }],
  useOrder: () => [{ loading: false }],
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} />,
  GoogleMapsMap: () => <div data-testid='map' />,
  Messages: ({ UIComponent, ...props }) => <UIComponent {...props} messages={state.messages} />
}))

vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1024, height: 768 }) }))

// redesign F6e (Q4-02): the driver card goes away only when the selector reports it shows the assigned driver
// (`onSelectedShown`), so the stand-in reports it (OrderContactInformation.f6d3.test.jsx runs the real selector
// through the cases where it does not)
vi.mock('../../DriverSelector', async () => {
  const { useEffect } = await import('react')
  return {
    DriverSelector: props => {
      useEffect(() => { props.onSelectedShown?.(props.order?.driver_id ?? null) }, [props.order?.driver_id])
      return (
        <div data-testid='driver-selector' data-order={props.orderId}>
          <div className='od-first-select-trigger'>{props.order?.driver?.name} {props.order?.driver?.lastname}</div>
        </div>
      )
    }
  }
})
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => <div data-testid='company-selector' /> }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))
vi.mock('../../../Shared', () => ({
  Modal: ({ children, open }) => open ? <div role='dialog'>{children}</div> : null,
  Alert: () => null,
  Confirm: () => null,
  FeeBillRows: () => null,
  TaxBillRows: () => null
}))

import { DetailsTab } from '../DetailsTab'

// The ETA is one left-to-right run inside the sentence (LRI ... PDI), so a right-to-left note does not reorder it.
const LRI = '\u2066'
const PDI = '\u2069'

const AT_PLACED = '2026-10-02 15:51:00'
const longAddress = '200 Another Very Long Customer Address, Apartment 98765'

const statusMessage = (status, createdAt) => ({
  id: `${status}-${createdAt}`,
  type: 1,
  change: { attribute: 'status', old: 0, new: String(status) },
  created_at: createdAt
})

const baseOrder = {
  id: 42,
  status: 7,
  delivery_type: 1,
  created_at: AT_PLACED,
  currency: 'USD',
  products: [],
  summary: { total: 0 },
  business: { name: 'Fast Bite', phone: '5551000', address: '5th Avenue, New York', email: 'bite@example.test' },
  customer: {
    id: 7,
    name: 'Ada',
    lastname: 'Lovelace',
    cellphone: '5552000',
    country_phone_code: '1',
    email: 'ada@example.test',
    address: longAddress,
    address_notes: 'Ring twice',
    zipcode: '10001',
    location: { lat: 40.7, lng: -73.9 }
  }
}

const renderTab = (orderPatch = {}, props = {}) => renderWithProviders(
  <DetailsTab
    order={{ loading: false, order: { ...baseOrder, ...orderPatch } }}
    customerInfoState={{ customer: {}, loading: false }}
    handleChangeCustomerInfoState={vi.fn()}
    handleUpdateCustomerInfo={vi.fn()}
    addressState={{}}
    setAddressState={vi.fn()}
    setCommentInfostate={vi.fn()}
    commentInfoState={{ open: false, driverId: null }}
    onSelectTab={vi.fn()}
    {...props}
  />
)

const routeSteps = () => within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem')
const stepText = () => routeSteps().map(item => item.querySelector('.odc-sr-only').textContent)

const useConfigs = (configs) => {
  state.configs = configs
  const { result } = renderHook(() => useUtils(), { wrapper: UtilsProviders })
  realUtils.parse = result.current[0].parseDate
}

beforeEach(() => {
  state.messages = { loading: false, error: null, messages: [] }
  state.level = 0
  useConfigs({})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DetailsTab — the route', () => {
  it('writes each step from the order itself and only the times of real status events', () => {
    state.messages = {
      loading: false,
      error: null,
      messages: [
        { id: 1, type: 0, comment: 'hello', created_at: '2026-10-02 15:53:00' },
        statusMessage(7, '2026-10-02 15:58:00'),
        { id: 3, type: 1, change: { attribute: 'driver_id', new: '9' }, created_at: '2026-10-02 16:02:00' }
      ]
    }
    renderTab()
    const placed = moment.utc(AT_PLACED, 'YYYY-MM-DD HH:mm:ss').local().format('HH:mm')
    const accepted = moment.utc('2026-10-02 15:58:00', 'YYYY-MM-DD HH:mm:ss').local().format('HH:mm')
    expect(stepText()).toEqual([
      `Placed, done at ${placed}`,
      `Accepted, done at ${accepted}`,
      'Ready, next step',
      'Picked up, not reached',
      'Delivered, not reached'
    ])
  })

  // redesign F6d (Q3-15): a time with its date («Oct 3, 03:58 AM») used to wrap wherever the column ended. Now the date and
  // the time are two fixed lines that never wrap; the time of the placing day stays one line. Mono is kept on purpose: the
  // brand allows it for timestamps (tokens.md) and Activity and the chat draw theirs the same way.
  it('draws the date and the time of a step from another day as two fixed lines, and reads them whole', () => {
    state.messages = { loading: false, error: null, messages: [statusMessage(7, '2026-10-03 15:58:00')] }
    renderTab()
    const other = moment.utc('2026-10-03 15:58:00', 'YYYY-MM-DD HH:mm:ss').local()
    const accepted = routeSteps()[1]
    const at = accepted.querySelector('.odc-route-time .odt-route-at')
    expect(at.querySelector('.odt-route-date').textContent).toBe(other.format('DD MMM'))
    expect(at.querySelector('.odt-route-clock').textContent).toBe(other.format('HH:mm'))
    expect(accepted.querySelector('.odc-sr-only').textContent).toBe(`Accepted, done at ${other.format('DD MMM')}, ${other.format('HH:mm')}`)
    // the placing day keeps its single line
    const placed = routeSteps()[0].querySelector('.odc-route-time .odt-route-at')
    expect(placed.querySelector('.odt-route-date')).toBeNull()
    expect(placed.querySelector('.odt-route-clock')).not.toBeNull()
  })

  // redesign W0-4a (T0-13, decision 13): one date format per surface, the project's dates_general_format; an ISO date is never visible.
  it('paints the dates of the detail with dates_general_format, and no ISO date is visible with a non-ISO format', () => {
    useConfigs({ dates_general_format: { value: 'DD/MM/YYYY hh:mm a' }, format_time: { value: '12' } })
    state.messages = { loading: false, error: null, messages: [statusMessage(7, '2026-10-03 15:58:00')] }
    const { container } = renderTab({
      status: 7,
      time_status: 'delayed',
      delivery_datetime_utc: '2026-10-03 16:00:00',
      eta_time: 30,
      reservation: { reserve_date: '2026-10-04 10:00:00' }
    })
    const other = moment.utc('2026-10-03 15:58:00', 'YYYY-MM-DD HH:mm:ss').local()
    const at = routeSteps()[1].querySelector('.odc-route-time .odt-route-at')
    expect(at.querySelector('.odt-route-date').textContent).toBe(other.format('DD/MM'))
    expect(at.querySelector('.odt-route-clock').textContent).toBe(other.format('hh:mm A'))
    const requested = moment.utc('2026-10-03 16:00:00', 'YYYY-MM-DD HH:mm:ss').local().format('DD/MM/YYYY hh:mm a')
    expect(container.textContent).toContain(`Requested for${requested}`)
    // the delayed note says when the estimate was: the date part of the project format, then the clock
    expect(container.textContent).toMatch(/Delayed .* past the estimated delivery time \(⁦\d{2}\/\d{2}(\/\d{4})?, \d{2}:\d{2} (AM|PM)⁩\)/)
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(container.textContent).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/)
  })

  // redesign F6g-2: the date and the time of a step are left-to-right runs (a right-to-left page would reorder «Oct 3» and «03:58 PM»)
  it('keeps the date and the time of a route step as left-to-right runs', () => {
    state.messages = { loading: false, error: null, messages: [statusMessage(7, '2026-10-03 15:58:00')] }
    renderTab()
    const at = routeSteps()[1].querySelector('.odc-route-time .odt-route-at')
    expect(at.querySelector('.odt-route-date')).toHaveAttribute('dir', 'ltr')
    expect(at.querySelector('.odt-route-clock')).toHaveAttribute('dir', 'ltr')
    expect(routeSteps()[0].querySelector('.odt-route-clock')).toHaveAttribute('dir', 'ltr')
  })

  it('never wraps a line of the route time', () => {
    const css = readFileSync(resolve(__dirname, '../details-tab.css'), 'utf8')
    expect(css).toMatch(/\.odt-route-at\s*>\s*span\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap/)
  })

  it('never borrows a time for a step the order skipped', () => {
    state.messages = { loading: false, error: null, messages: [statusMessage(7, '2026-10-02 15:58:00')] }
    renderTab({ status: 9 })
    const text = stepText()
    expect(text[2]).toBe('Ready, done')
    expect(text[3]).toBe('Picked up, done')
    expect(text[4]).toBe('Delivered, next step')
  })

  it('draws the route without times while the history loads', () => {
    state.messages = { loading: true, error: null, messages: [] }
    renderTab()
    expect(stepText()).toEqual([
      'Placed, done',
      'Accepted, done',
      'Ready, next step',
      'Picked up, not reached',
      'Delivered, not reached'
    ])
  })

  it('uses the pickup flow for a pickup order', () => {
    renderTab({ delivery_type: 2, status: 0 })
    expect(routeSteps().map(item => item.querySelector('.odc-route-label').textContent)).toEqual(['Placed', 'Accepted', 'Ready', 'Collected'])
  })

  it('says how late an in-progress order is against its estimate', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const now = moment('2026-10-05 12:00:00', 'YYYY-MM-DD HH:mm:ss')
    vi.setSystemTime(now.toDate())
    const deliveredAt = moment(now).subtract(60, 'minutes').utc().format('YYYY-MM-DD HH:mm:ss')
    renderTab({ time_status: 'delayed', delivery_datetime_utc: deliveredAt, eta_time: 30 })
    expect(screen.getByText(`Delayed 30 min past the estimated delivery time (${LRI}11:30${PDI}).`)).toBeInTheDocument()
  })

  it('says nothing about lateness when the order is on time and still open', () => {
    renderTab({ time_status: 'in_time' })
    expect(screen.queryByText(/past the estimated/)).toBeNull()
    expect(screen.queryByText('Completed on time.')).toBeNull()
  })

  it('closed on time and closed late', () => {
    const { unmount } = renderTab({ status: 11, time_status: 'in_time' })
    expect(screen.getByText('Completed on time.')).toBeInTheDocument()
    unmount()
    renderTab({ status: 11, time_status: 'delayed' })
    expect(screen.getByText('Late.')).toBeInTheDocument()
  })

  it('a rejected order ends in a stop step with its real time and reason', () => {
    state.messages = {
      loading: false,
      error: null,
      messages: [statusMessage(7, '2026-10-02 04:10:00'), statusMessage(5, '2026-10-02 04:12:00')]
    }
    renderTab({ status: 5, reject_reason: 'closing_early', created_at: '2026-10-02 04:05:00' })
    const stop = moment.utc('2026-10-02 04:12:00', 'YYYY-MM-DD HH:mm:ss').local().format('HH:mm')
    expect(stepText().at(-1)).toBe('Rejected by business, the order stopped here')
    expect(screen.getByText(`Rejected by business at ${stop}. Reason: closing early`)).toBeInTheDocument()
  })

  it('a rejected order without its event gives no invented time', () => {
    renderTab({ status: 5 })
    expect(screen.getByText('Rejected by business.')).toBeInTheDocument()
  })
})

describe('DetailsTab — customer', () => {
  it('shows the address, notes, zipcode and preference without opening anything', () => {
    renderTab()
    const customer = screen.getByRole('region', { name: 'Customer' })
    expect(within(customer).getByText('Ada Lovelace')).toBeVisible()
    expect(within(customer).getByText(longAddress)).toBeVisible()
    expect(within(customer).getByText('Ring twice')).toBeVisible()
    expect(within(customer).getByText(/10001/)).toBeVisible()
    expect(within(customer).getByText(/Either way/)).toBeVisible()
    expect(within(customer).getByText('ada@example.test')).toBeInTheDocument()
    expect(customer.querySelector('[aria-expanded]')).toBeNull()
  })

  it('shows the delivery preference the customer chose', () => {
    renderTab({ delivery_option: { name: 'Leave at door' } })
    expect(within(screen.getByRole('region', { name: 'Customer' })).getByText(/LEAVE_AT_DOOR|Leave at door/)).toBeVisible()
  })

  it('opens the address in maps with the same link as before', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Open address in maps' }))
    expect(open).toHaveBeenCalledWith(`http://maps.google.com/?q=${longAddress}`, '_blank', 'noopener,noreferrer')
  })

  it('calls the customer and sends the user to the Chat tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const onSelectTab = vi.fn()
    renderTab({}, { onSelectTab })
    fireEvent.click(screen.getByRole('button', { name: 'Call Ada' }))
    expect(open).toHaveBeenCalledWith('tel:+15552000')
    fireEvent.click(screen.getByRole('button', { name: 'Message Ada' }))
    expect(onSelectTab).toHaveBeenCalledWith('chat')
  })

  it('does not offer messaging to a user who has no chat (level 5)', () => {
    state.level = 5
    renderTab()
    expect(screen.queryByRole('button', { name: 'Message Ada' })).toBeNull()
  })

  // redesign fix-qa E6 (parity with main, OrderContactInformation/index.js:325-358): a pickup keeps the
  // customer's address, coordinates, notes and zipcode; it used to hide them.
  it('keeps the address of a pickup order, with its map link', () => {
    renderTab({ delivery_type: 2 })
    const customer = screen.getByRole('region', { name: 'Customer' })
    expect(within(customer).getByText(longAddress)).toBeVisible()
    expect(within(customer).getByText('Ring twice')).toBeVisible()
    expect(within(customer).getByRole('button', { name: 'Open address in maps' })).toBeInTheDocument()
  })
})

describe('DetailsTab — business and driver', () => {
  it('marks the section for the Learn tour and offers the selectors on an open order', () => {
    renderTab({ status: 7 })
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(section).toHaveAttribute('data-tour', 'tour_driver')
    expect(within(section).getByText('Fast Bite')).toBeInTheDocument()
    expect(within(section).getByText('No driver')).toBeInTheDocument()
    expect(within(section).getByTestId('driver-selector')).toHaveAttribute('data-order', '42')
  })

  // redesign fix-qa E6 (parity with main, OrderContactInformation/index.js:371-404, no status condition):
  // the D10 decision to take the selectors off closed orders is reverted, a finished order can be reassigned.
  it.each([[11], [5], [15]])('keeps the driver and company selectors on a closed order (status %i)', (status) => {
    state.configs = { addon_delivery_companies: { value: '1' } }
    renderTab({ status })
    expect(screen.getByTestId('driver-selector')).toBeInTheDocument()
    expect(screen.getByTestId('company-selector')).toBeInTheDocument()
  })

  it('keeps the company selector for an open order without a driver when the addon is on', () => {
    state.configs = { addon_delivery_companies: { value: '1' } }
    renderTab({ status: 0 })
    expect(screen.getByTestId('company-selector')).toBeInTheDocument()
  })

  // redesign F6c (Q2-25): the selector shows the assigned person, so the card with the same name is gone; the call action stays
  it('shows the assigned driver once (in the selector) with a call action, once closed', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderTab({ status: 11, driver_id: 9, driver: { name: 'Dan', lastname: 'Driver', cellphone: '5553000' } })
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).getByTestId('driver-selector')).toBeInTheDocument()
    expect(within(section).queryByText('Dan Driver', { selector: '.odt-party-name' })).toBeNull()
    fireEvent.click(within(section).getByRole('button', { name: 'Call Dan' }))
    expect(open).toHaveBeenCalledWith('tel:5553000')
  })

  it('names an external driver', () => {
    renderTab({ status: 11, external_driver_id: 3, external_driver: { name: 'Ext Rider', phone: '5554000' } })
    expect(screen.getByText('Ext Rider')).toBeInTheDocument()
  })

  it('has no driver part for a pickup order', () => {
    renderTab({ delivery_type: 2 })
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    expect(screen.queryByTestId('driver-selector')).toBeNull()
    expect(screen.queryByText('No driver')).toBeNull()
  })

  it('has no driver part for a service (appointment) order', () => {
    renderTab({}, { isServiceOrder: true })
    expect(screen.queryByTestId('driver-selector')).toBeNull()
  })
})

describe('DetailsTab — items and totals', () => {
  const products = [
    {
      id: 1,
      name: 'Margherita',
      quantity: 2,
      price: 10,
      options: [{ id: 3, name: 'Toppings', rank: 1, suboptions: [{ id: 8, name: 'Olives', quantity: 1, position: 'whole', price: 1 }] }]
    },
    { id: 2, name: 'Cola', quantity: 1, price: 2, options: [] }
  ]

  it('counts the items and lists them compactly with options on a secondary line', () => {
    renderTab({ products, summary: { total: 24, subtotal: 24 } })
    const section = screen.getByRole('region', { name: /Items/ })
    expect(within(section).getByRole('heading', { name: /Items\s*2/ })).toBeInTheDocument()
    expect(within(section).getByText('2×')).toBeInTheDocument()
    expect(within(section).getByText('Margherita')).toBeInTheDocument()
    expect(within(section).getByText(/Toppings.*1 x Olives/)).toBeInTheDocument()
    expect(within(section).getByText('Cola')).toBeInTheDocument()
    expect(within(section).queryAllByRole('button')).toHaveLength(0)
  })

  it('has no items section for an order without products', () => {
    renderTab({ products: [] })
    expect(screen.queryByRole('region', { name: /Items/ })).toBeNull()
  })
})

describe('DetailsTab — logistics', () => {
  it('shows the logistic grid for a delivery order', () => {
    renderTab({ logistic_status: 2, logistic_attemps: 3, priority: 1, app_id: 'web', eta_time: 45 })
    const section = screen.getByRole('region', { name: 'Logistics' })
    const grid = section.querySelector('dl')
    const pairs = Array.from(grid.querySelectorAll('div')).map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])
    expect(pairs).toEqual(expect.arrayContaining([
      ['Logistic status', 'In queue'],
      ['Attempts', '3'],
      ['Priority', 'High'],
      ['Channel', 'web'],
      ['Estimated time', '45 min']
    ]))
  })

  it('writes a dash where the order has no estimate or channel', () => {
    renderTab({ logistic_status: 0 })
    const section = screen.getByRole('region', { name: 'Logistics' })
    const dd = Array.from(section.querySelectorAll('dd')).map(item => item.textContent)
    expect(dd.some(text => text.startsWith('—'))).toBe(true)
    expect(within(section).queryByText(/min$/)).toBeNull()
  })

  // redesign fix-qa E6 (parity with main, where the logistic grid and the estimate showed on every
  // order, not only on deliveries): a pickup has the grid too.
  it.each([[2], [3], [9]])('is for every order: delivery type %i has it too', (type) => {
    renderTab({ delivery_type: type, logistic_status: 1, logistic_attemps: 2, priority: 2, eta_time: 30 })
    const section = screen.getByRole('region', { name: 'Logistics' })
    const dd = Array.from(section.querySelectorAll('dd')).map(item => item.textContent)
    expect(dd).toEqual(expect.arrayContaining(['In progress', '2', 'Urgent', '30 min']))
  })

  it('shows it on a service order as well', () => {
    renderTab({ delivery_type: 1 }, { isServiceOrder: true })
    expect(screen.getByRole('region', { name: 'Logistics' })).toBeInTheDocument()
  })
})

describe('DetailsTab — what the old status block showed keeps its place', () => {
  it('shows the Forter fraud notice only with the plugin and a fraud status', () => {
    const { unmount } = renderTab({ fraud_status: 'invalid', fraud_message: 'Card flagged' }, { forterPluginInstalled: true })
    expect(screen.getByRole('status')).toHaveTextContent('Fraud: Declined')
    expect(screen.getByRole('status')).toHaveTextContent('Card flagged')
    unmount()
    renderTab({ fraud_status: 'invalid' }, { forterPluginInstalled: false })
    expect(screen.queryByText(/Fraud/)).toBeNull()
  })

  it('keeps the cloned-from, spot, comment, vehicle and student data', () => {
    renderTab({
      cloned_order_id: 7,
      delivery_type: 3,
      place: { name: 'Table 4' },
      spot_number: '12',
      comment: 'No onions please',
      vehicle: { type: 'car', model: 'Civic', car_registration: 'ABC123', color: 'Blue' },
      student: { name: 'Sam', lastname: 'Small', classroom: { name: '3B' }, grade: { name: 'Third' } }
    })
    expect(screen.getByText('Cloned from order No').closest('div')).toHaveTextContent('7')
    expect(screen.getByText('Table 4')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('No onions please')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('Sam Small')).toBeInTheDocument()
    expect(screen.getByText('3B')).toBeInTheDocument()
  })

  it('keeps the reservation data', () => {
    renderTab({
      delivery_type: 9,
      status: 13,
      reservation: { reserve_date: '2026-10-09 19:00:00', guests_reservation: 4 }
    })
    expect(screen.getByText(/Reservation scheduled to/)).toBeInTheDocument()
    expect(screen.getByText('Guests').closest('div')).toHaveTextContent('4')
  })
})

// redesign fix-qa E6: low-severity parity items with main (OrderDetails/index.js:435-440, 489-498, 548-556).
describe('DetailsTab — parity with main (fix-qa E6)', () => {
  it('catering says "Placed to", other types "Requested for"', () => {
    const { unmount } = renderTab({ delivery_type: 7, delivery_datetime_utc: '2026-10-02 16:00:00' })
    expect(screen.getByText('Placed to')).toBeInTheDocument()
    expect(screen.queryByText('Requested for')).toBeNull()
    unmount()
    renderTab({ delivery_type: 1, delivery_datetime_utc: '2026-10-02 16:00:00' })
    expect(screen.getByText('Requested for')).toBeInTheDocument()
    expect(screen.queryByText('Placed to')).toBeNull()
  })

  it.each([[11], [12], [6], [10]])('status %i shows the reject reason', (status) => {
    renderTab({ status, reject_reason: 'closing_early' })
    expect(screen.getByText(/Reason: closing early/)).toBeInTheDocument()
  })

  it('status 11 keeps its on-time note next to the reason', () => {
    renderTab({ status: 11, reject_reason: 'closing_early', time_status: 'in_time' })
    expect(screen.getByText(/Completed on time\. Reason: closing early/)).toBeInTheDocument()
  })

  it('a closed order without a reason shows no reason', () => {
    renderTab({ status: 11, time_status: 'in_time' })
    expect(screen.queryByText(/Reason:/)).toBeNull()
  })

  it('keeps Refund to wallet when there are no products, no total and no payments', () => {
    state.configs = { refund_cash_wallet_allow_when_order_cancelled: { value: '1' } }
    renderTab({ products: [], summary: { total: 0 }, payment_events: [] }, { handleOrderRefund: vi.fn() })
    expect(screen.getByRole('button', { name: /Refund to wallet/ })).toBeInTheDocument()
  })
})
