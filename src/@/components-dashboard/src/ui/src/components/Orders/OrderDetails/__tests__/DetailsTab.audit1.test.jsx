/* eslint-disable import/first */
import React from 'react'
import moment from 'moment'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// `catalog` plays the translation catalog of the API: texts that still carry the old wording.
const state = vi.hoisted(() => ({
  messages: { loading: false, error: null, messages: [] },
  level: 0,
  configs: {},
  catalog: {}
}))

// Same contract as useUtils().parseDate: UTC string in, local string out.
const parseDate = (date, options = {}) => {
  const input = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm:ss']
  const output = options.outputFormat || 'YYYY-MM-DD HH:mm'
  if (!moment(date, input).isValid()) return 'invalid format'
  return moment.utc(date, input).local().format(output)
}

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, fallback) => state.catalog[key] ?? fallback],
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

vi.mock('../../DriverSelector', () => ({
  DriverSelector: props => <div data-testid='driver-selector' data-order={props.orderId} />
}))
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

// redesign 5.3 audit-1 (FD-2, FD-3): the note of a late closed order uses real event times only,
// and the copy of the tab owns its keys where the catalog still has another wording.
// The ETA is one left-to-right run inside the sentence (LRI ... PDI), so a right-to-left note does not reorder it.
const LRI = '\u2066'
const PDI = '\u2069'

const placedAt = '2026-10-02 08:00:00'
const orderBase = {
  id: 42,
  status: 11,
  delivery_type: 1,
  created_at: placedAt,
  currency: 'USD',
  products: [],
  summary: { total: 0 },
  business: { name: 'Fast Bite' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace' }
}

const statusEvent = (status, createdAt) => ({
  id: `${status}-${createdAt}`,
  type: 1,
  change: { attribute: 'status', old: 0, new: String(status) },
  created_at: createdAt
})

const utc = (value) => value.clone().utc().format('YYYY-MM-DD HH:mm:ss')

const renderTab = (orderPatch = {}) => renderWithProviders(
  <DetailsTab
    order={{ loading: false, order: { ...orderBase, ...orderPatch } }}
    customerInfoState={{ customer: {}, loading: false }}
    handleChangeCustomerInfoState={vi.fn()}
    handleUpdateCustomerInfo={vi.fn()}
    addressState={{}}
    setAddressState={vi.fn()}
    setCommentInfostate={vi.fn()}
    commentInfoState={{ open: false, driverId: null }}
    onSelectTab={vi.fn()}
  />
)

beforeEach(() => {
  state.messages = { loading: false, error: null, messages: [] }
  state.level = 0
  state.configs = {}
  state.catalog = {}
  // 12:00 local; the estimate of the orders below is 11:30
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(moment('2026-10-02 12:00:00', 'YYYY-MM-DD HH:mm:ss').toDate())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DetailsTab — a closed order that arrived late (FD-2)', () => {
  const now = () => moment('2026-10-02 12:00:00', 'YYYY-MM-DD HH:mm:ss')
  const lateOrder = (patch = {}) => ({
    time_status: 'delayed',
    delivery_datetime_utc: utc(now().subtract(60, 'minutes')),
    eta_time: 30,
    ...patch
  })

  it('says how late it was against the estimate, with the real time of the delivery event', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().subtract(5, 'minutes')))] }
    renderTab(lateOrder())
    expect(screen.getByText(`Delivered 25 min late (ETA ${LRI}11:30${PDI}).`)).toBeInTheDocument()
    expect(screen.queryByText('Late.')).toBeNull()
  })

  it('names the last milestone of the flow (Completed for a dine-in order)', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().subtract(5, 'minutes')))] }
    renderTab(lateOrder({ delivery_type: 3 }))
    expect(screen.getByText(`Completed 25 min late (ETA ${LRI}11:30${PDI}).`)).toBeInTheDocument()
  })

  it('writes hours the way the rest of the panel does', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().add(60, 'minutes').subtract(0, 'minutes')))] }
    renderTab(lateOrder())
    // 11:30 estimate, event at 13:00: 1 h 30 min late
    expect(screen.getByText(`Delivered 1 h 30 min late (ETA ${LRI}11:30${PDI}).`)).toBeInTheDocument()
  })

  it('says only Late when the history has no event of the delivery (nothing is invented)', () => {
    renderTab(lateOrder())
    expect(screen.getByText('Late.')).toBeInTheDocument()
    expect(screen.queryByText(/min late/)).toBeNull()
  })

  it('says only Late when the order has no estimate to compare with', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().subtract(5, 'minutes')))] }
    renderTab(lateOrder({ eta_time: 0 }))
    expect(screen.getByText('Late.')).toBeInTheDocument()
  })

  it('says only Late when the event is not after the estimate (it would read as early)', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().subtract(40, 'minutes')))] }
    renderTab(lateOrder())
    expect(screen.getByText('Late.')).toBeInTheDocument()
  })

  it('does not change the note of an order closed on time', () => {
    state.messages = { loading: false, error: null, messages: [statusEvent(11, utc(now().subtract(5, 'minutes')))] }
    renderTab(lateOrder({ time_status: 'in_time' }))
    expect(screen.getByText('Completed on time.')).toBeInTheDocument()
  })
})

describe('DetailsTab — copy of its own (FD-3)', () => {
  const logisticsOrder = { logistic_status: 2, logistic_attemps: 1, priority: 0, app_id: 'web' }

  it('labels the logistic status with its own key, in sentence case', () => {
    state.catalog = { LOGISTIC_STATUS: 'logistic status' }
    renderTab(logisticsOrder)
    const section = screen.getByRole('region', { name: 'Logistics' })
    expect(within(section).getByText('Logistic status')).toBeInTheDocument()
    expect(within(section).queryByText('logistic status')).toBeNull()
  })

  it('titles the facts block with its own key, in sentence case', () => {
    state.catalog = { ORDER_DETAILS: 'Order Details' }
    renderTab({ ...logisticsOrder, comment: 'No onions' })
    expect(screen.getByRole('heading', { name: 'Order details' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Order Details' })).toBeNull()
  })

  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [120, '2 h'],
    [150, '2 h 30 min'],
    [1440, '1 d'],
    [1500, '1 d 1 h']
  ])('writes the estimated time of %i minutes as a duration (%s)', (minutes, expected) => {
    renderTab({ ...logisticsOrder, eta_time: minutes })
    const section = screen.getByRole('region', { name: 'Logistics' })
    const row = within(section).getByText('Estimated time').closest('div')
    expect(row.querySelector('dd')).toHaveTextContent(new RegExp(`^${expected}$`))
    expect(within(section).queryByText(/Min$/)).toBeNull()
  })

  it('labels the driver selector Driver, not Driver assign', () => {
    state.catalog = { DRIVER_ASSIGN: 'Driver assign' }
    renderTab({ ...logisticsOrder, status: 7 })
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).queryByText('Driver assign')).toBeNull()
    const label = section.querySelector('.odt-assign-label')
    expect(label).toHaveTextContent(/^Driver$/)
  })
})
