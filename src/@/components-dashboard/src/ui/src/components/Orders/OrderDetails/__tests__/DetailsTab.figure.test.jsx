/* eslint-disable import/first */
// redesign W0-3a (T0-9, decisión 11a): the dates and hours of the Details tab are figures (mono, tabular digits through
// `odc-figure`) on the run that holds them. The label beside them («Created at», «ETA») and the IDs never get the class.
import React from 'react'
import moment from 'moment'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ messages: { loading: false, error: null, messages: [] } }))

const parseDate = (date, options = {}) => {
  const input = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm:ss']
  const output = options.outputFormat || 'YYYY-MM-DD HH:mm'
  if (!moment(date, input).isValid()) return 'invalid format'
  return moment.utc(date, input).local().format(output)
}

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate, optimizeImage: value => value, parseNumber: value => value, parsePrice: value => `$${value}` }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useOrder: () => [{ loading: false }],
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} />,
  GoogleMapsMap: () => <div data-testid='map' />,
  Messages: ({ UIComponent, ...props }) => <UIComponent {...props} messages={state.messages} />
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1024, height: 768 }) }))
vi.mock('../../DriverSelector', () => ({ DriverSelector: () => <div data-testid='driver-selector' /> }))
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

const local = (stamp, format) => moment.utc(stamp, 'YYYY-MM-DD HH:mm:ss').local().format(format)

const baseOrder = {
  id: 42,
  status: 7,
  delivery_type: 1,
  created_at: '2026-10-02 15:51:00',
  currency: 'USD',
  products: [],
  summary: { total: 0 },
  business: { name: 'Fast Bite' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace' }
}

const renderTab = (patch = {}) => renderWithProviders(
  <DetailsTab
    order={{ loading: false, order: { ...baseOrder, ...patch } }}
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

const factOf = (label) => screen.getByText(label, { selector: 'dt' }).closest('div')

beforeEach(() => { state.messages = { loading: false, error: null, messages: [] } })

describe('DetailsTab · dates and hours are figures (W0-3a, T0-9)', () => {
  it('puts odc-figure on the date of Created at, Placed to, Business time and Reservation, not on the label', () => {
    renderTab({
      delivery_type: 7,
      delivery_datetime_utc: '2026-10-02 16:00:00',
      delivery_datetime: '2026-10-02 18:00:00'
    })
    const pairs = [
      ['Created at', local('2026-10-02 15:51:00', 'YYYY-MM-DD HH:mm')],
      ['Placed to', local('2026-10-02 16:00:00', 'YYYY-MM-DD HH:mm')]
    ]
    pairs.forEach(([label, text]) => {
      const fact = factOf(label)
      expect(within(fact).getByText(text)).toHaveClass('odc-figure')
      expect(within(fact).getByText(text).tagName).toBe('BDI')
      expect(screen.getByText(label, { selector: 'dt' })).not.toHaveClass('odc-figure')
      expect(fact.querySelector('dd')).not.toHaveClass('odc-figure')
    })
    const business = factOf('Business time')
    expect(business.querySelector('bdi')).toHaveClass('odc-figure')
    expect(screen.getByText('Business time', { selector: 'dt' })).not.toHaveClass('odc-figure')
  })

  it('puts odc-figure on the date of a reservation and leaves the guests count as it was', () => {
    renderTab({ delivery_type: 9, status: 13, reservation: { reserve_date: '2026-10-09 19:00:00', guests_reservation: 4 } })
    const reservation = factOf('Reservation scheduled to')
    expect(reservation.querySelector('bdi')).toHaveClass('odc-figure')
    expect(screen.getByText('Reservation scheduled to', { selector: 'dt' })).not.toHaveClass('odc-figure')
    expect(factOf('Guests').querySelector('.odc-figure')).toBeNull()
  })

  it('leaves the cloned order id and the car registration out of the figures', () => {
    renderTab({ cloned_order_id: 7, vehicle: { type: 'car', model: 'Civic', car_registration: 'ABC123', color: 'Blue' } })
    expect(factOf('Cloned from order No').querySelector('.odc-figure')).toBeNull()
    expect(screen.getByText('ABC123')).not.toHaveClass('odc-figure')
  })

  it('puts odc-figure on the ETA and not on the ETA label', () => {
    renderTab({ delivery_datetime_utc: '2026-10-02 16:00:00', eta_time: 20 })
    const fact = factOf('ETA')
    expect(fact.querySelector('bdi')).toHaveClass('odc-figure')
    expect(fact.querySelector('bdi').textContent).toMatch(/\d\d:\d\d/)
    expect(screen.getByText('ETA', { selector: 'dt' })).not.toHaveClass('odc-figure')
  })

  it('puts odc-figure on the clock and on the date of every route step', () => {
    state.messages = {
      loading: false,
      error: null,
      messages: [{ id: 1, type: 1, change: { attribute: 'status', old: 0, new: '7' }, created_at: '2026-10-03 15:58:00' }]
    }
    renderTab()
    const steps = within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem')
    const accepted = steps[1].querySelector('.odt-route-at')
    expect(accepted.querySelector('.odt-route-date')).toHaveClass('odc-figure')
    expect(accepted.querySelector('.odt-route-clock')).toHaveClass('odc-figure')
    expect(steps[0].querySelector('.odt-route-clock')).toHaveClass('odc-figure')
    // the step name is a label
    expect(steps[1].querySelector('.odc-route-label')).not.toHaveClass('odc-figure')
  })
})
