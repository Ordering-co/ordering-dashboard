/* eslint-disable import/first */
// redesign F6h-3 (A2-04): in a right-to-left language the data of «Business and driver» and of the customer card
// (names, addresses, notes) reads in its own direction: each one is a <bdi>, so «17382 Haggerty Rd, USA» is not
// read «…USA 17382» and the line around it keeps the direction of the language.
import React from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} id={props.id} />,
  GoogleMapsMap: () => <div />,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))
vi.mock('../../../../utils', () => ({ getUserType: () => false }))
vi.mock('../../DriverSelector', () => ({ DriverSelector: () => null }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => null }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const order = {
  id: 13861,
  status: 7,
  delivery_type: 1,
  business: {
    name: 'Fast Bite',
    address: '17382 Haggerty Rd, Northville, USA',
    address_notes: 'Back door, ring twice',
    phone: '+1 555 0100',
    email: 'hello@fastbite.example'
  },
  customer: {
    id: 7,
    name: 'Customer',
    lastname: 'Demo',
    cellphone: '5552000',
    address: '200 Customer Street',
    address_notes: 'Gate code 4411'
  },
  external_driver_id: 3,
  external_driver: { name: 'Dana Driver', phone: '+1 555 0199' }
}

const renderPanel = () => renderWithProviders(
  <OrderContactInformation
    addressState={{}}
    commentInfoState={{}}
    customerInfoState={{ customer: {}, loading: false }}
    handleChangeCustomerInfoState={vi.fn()}
    handleOpenMessages={vi.fn()}
    handleUpdateCustomerInfo={vi.fn()}
    setAddressState={vi.fn()}
    setCommentInfostate={vi.fn()}
    order={order}
  />
)

describe('F6h-3 · isolated data in the contact card', () => {
  it('the business address and its notes are <bdi>, inside the link', () => {
    renderPanel()
    const address = screen.getByText('17382 Haggerty Rd, Northville, USA')
    expect(address.tagName).toBe('BDI')
    expect(address.closest('a')).not.toBeNull()
    expect(screen.getByText('Back door, ring twice').tagName).toBe('BDI')
  })

  it('names are <bdi>: business, customer and driver', () => {
    renderPanel()
    const business = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(business).getByText('Fast Bite').tagName).toBe('BDI')
    expect(within(business).getByText('Dana Driver').tagName).toBe('BDI')
    expect(screen.getByText('Customer Demo').tagName).toBe('BDI')
  })

  it('the customer address notes are <bdi> as the address already is', () => {
    renderPanel()
    expect(screen.getByText('200 Customer Street').tagName).toBe('BDI')
    expect(screen.getByText('Gate code 4411').tagName).toBe('BDI')
  })
})
