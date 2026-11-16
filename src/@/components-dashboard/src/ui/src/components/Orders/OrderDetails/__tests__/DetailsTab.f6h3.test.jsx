/* eslint-disable import/first */
import React from 'react'
import moment from 'moment'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

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

// redesign F6h-3 (A2-04): the data of the Details tab (names, plates, comments) is not translated copy: in a right-to-left
// language each one is its own run (<bdi>), and an id or a plate is a left-to-right run.
const orderBase = {
  id: 13861,
  status: 11,
  delivery_type: 3,
  created_at: '2026-10-02 08:00:00',
  currency: 'USD',
  products: [],
  summary: { total: 0 },
  business: { name: 'Fast Bite' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace' },
  place: { name: 'Patio 4' },
  cloned_order_id: 13800,
  vehicle: { type: 'car', model: 'Model Y', car_registration: 'ABC-1234', color: 'Blue' },
  comment: 'Leave it at the door',
  student: { name: 'Sam', lastname: 'Student', classroom: { name: 'Room 12B' }, grade: { name: 'Grade 4' } }
}

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
})

describe('F6h-3 · isolated data in the Details tab', () => {
  it('names and comments are <bdi>: spot, vehicle, comment and student', () => {
    renderTab()
    for (const text of ['Patio 4', 'Model Y', 'Blue', 'Leave it at the door', 'Sam Student', 'Room 12B', 'Grade 4']) {
      expect(screen.getByText(text).closest('bdi')).not.toBeNull()
    }
  })

  it('the plate and the cloned order number are left-to-right runs', () => {
    renderTab()
    for (const text of ['ABC-1234', '13800']) {
      expect(screen.getByText(text).closest('bdi')).toHaveAttribute('dir', 'ltr')
    }
  })
})
