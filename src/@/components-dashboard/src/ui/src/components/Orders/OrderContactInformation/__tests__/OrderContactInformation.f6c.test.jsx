/* eslint-disable import/first */
// redesign F6c: the driver is shown once in «Business and driver» (Q2-25) and the Address label of Edit customer is the
// same as the other labels (Q2-21).
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ readOnlyOwner: false, configs: {} }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} id={props.id} />,
  GoogleMapsMap: () => <div />,
  useConfig: () => [{ configs: runtime.configs }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))

vi.mock('../../../../utils', () => ({
  getUserType: (type) => runtime.readOnlyOwner && type === 'readOnlyBusinessOwner'
}))

// redesign F6d (P4-02): the card goes away only when the selector's trigger shows the driver, so this stand-in does (the
// cases where it does not are in OrderContactInformation.f6d3.test.jsx, with the real selector)
// redesign F6e-2 (Q4-02): and it says so, as the real one does (`onSelectedShown` with the id it shows)
vi.mock('../../DriverSelector', () => ({
  DriverSelector: ({ order, onSelectedShown }) => {
    React.useEffect(() => { onSelectedShown?.(order?.driver_id ?? null) }, [order?.driver_id])
    return (
      <div data-testid='driver-selector'>
        <div className='od-first-select-trigger'>{order?.driver?.name} {order?.driver?.lastname}</div>
      </div>
    )
  }
}))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => <div data-testid='company-selector' /> }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const baseOrder = {
  id: 42,
  status: 7,
  delivery_type: 1,
  business: { name: 'Restaurant' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace', cellphone: '5552000', address: '200 Customer Street' }
}

const makeProps = (order = {}) => ({
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn(),
  order: { ...baseOrder, ...order }
})

const withDriver = { driver_id: 9, driver: { name: 'Dan', lastname: 'Driver', cellphone: '5559000' } }

beforeEach(() => {
  runtime.readOnlyOwner = false
  runtime.configs = {}
})

describe('Business and driver: the assigned driver is shown once (Q2-25)', () => {
  it('leaves the person to the selector and keeps the call button where main had it', () => {
    renderWithProviders(<OrderContactInformation {...makeProps(withDriver)} />)
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).getByTestId('driver-selector')).toBeInTheDocument()
    // no second card with the same person
    expect(within(section).queryByText('Dan Driver', { selector: '.odt-party-name' })).toBeNull()
    expect(section.querySelectorAll('.odt-party')).toHaveLength(1)
    // the phone of the driver stays, next to the selector's label
    const call = within(section).getByRole('button', { name: 'Call Dan' })
    expect(call.closest('.odt-assign')).not.toBeNull()
    expect(within(section).getByText('Driver', { selector: '.odt-assign-label' })).toBeInTheDocument()
  })

  it('still calls the driver', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithProviders(<OrderContactInformation {...makeProps(withDriver)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Call Dan' }))
    expect(open).toHaveBeenCalledWith('tel:5559000')
    open.mockRestore()
  })

  it('keeps the card when there is no selector to show the person (a read-only owner)', () => {
    runtime.readOnlyOwner = true
    renderWithProviders(<OrderContactInformation {...makeProps(withDriver)} />)
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).queryByTestId('driver-selector')).toBeNull()
    expect(within(section).getByText('Dan Driver')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Call Dan' })).toBeInTheDocument()
  })

  it('keeps the card of an external driver (the selector does not show them)', () => {
    renderWithProviders(<OrderContactInformation {...makeProps({ external_driver_id: 3, external_driver: { name: 'Uber Rider', phone: '5558000' } })} />)
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).getByText('Uber Rider')).toBeInTheDocument()
  })

  it('keeps «No driver» and the selector when nobody is assigned', () => {
    renderWithProviders(<OrderContactInformation {...makeProps()} />)
    const section = screen.getByRole('region', { name: 'Business and driver' })
    expect(within(section).getByText('No driver')).toBeInTheDocument()
    expect(within(section).getByTestId('driver-selector')).toBeInTheDocument()
  })
})

describe('Edit customer: one label style (Q2-21)', () => {
  const CSS = readFileSync(resolve(__dirname, '../../OrderDetails/details-tab.css'), 'utf8')

  it('gives the Address label the markup class of the others and no margin of its own', () => {
    runtime.configs = { google_maps_api_key: { value: 'key' } }
    renderWithProviders(<OrderContactInformation {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Customer' }))
    const labels = [...document.querySelectorAll('.odt-edit .odt-field-label')]
    expect(labels.map(node => node.textContent)).toEqual(['Phone / Mobile', 'Email', 'Address', 'Notes'])
    // the <label> element of Address picks up the browser/bootstrap `margin-bottom`; the class zeroes it for all four
    expect(CSS).toMatch(/\.odt-field-label\s*\{[^}]*margin:\s*0\s*;/)
  })
})

describe('Open as page: the selects and the edit form keep a reasonable width (Q2-24)', () => {
  const CSS = readFileSync(resolve(__dirname, '../../OrderDetails/details-tab.css'), 'utf8')

  it('caps the driver and company selectors and the edit form where the panel is a page', () => {
    const block = CSS.match(/@media \(min-width: 768px\) \{[\s\S]*?\n\}/g).join('\n')
    // redesign F6d (Q2-24): the cap sits on the select, not on the head that carries the phone (OrderContactInformation.f6d3.test.jsx)
    expect(block).toMatch(/\.odc-od\[data-expanded\] \.odt-assign[^{]*\{[^}]*max-inline-size:\s*var\(--od-x-dialog-md\)/)
    expect(block).toMatch(/\.odc-od\[data-expanded\] \.odt-edit[^{]*\{[^}]*max-inline-size:\s*var\(--od-x-dialog-md\)/)
  })
})
