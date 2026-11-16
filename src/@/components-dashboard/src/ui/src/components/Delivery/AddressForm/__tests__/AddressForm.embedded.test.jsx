/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { act, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: the embedded mode (`isEmbedded`) of the address form, used inside the create-order wizard.
const mocks = vi.hoisted(() => ({ mapThrows: false }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: ({ childRef, onChangeAddress: _a, apiKey: _k, countryCode: _c, ...props }) => {
    useEffect(() => { childRef({ value: '' }) }, [childRef])
    return <input {...props} />
  },
  GoogleMapsMap: (props) => {
    if (mocks.mapThrows) throw new TypeError("Cannot read properties of undefined (reading 'maps')")
    return <div data-testid='map' data-fill={props.fillContainer ? 'true' : undefined} />
  },
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: true }],
  useOrder: () => [{ loading: false, options: {} }],
  useConfig: () => [{
    loading: false,
    configs: {
      meters_to_change_address: { value: '500' },
      google_maps_api_key: { value: 'key' },
      google_autocomplete_selection_required: { value: 'false' },
      country_autocomplete: { value: '*' }
    }
  }]
}))
vi.mock('../../GoogleGpsButton', () => ({
  GoogleGpsButton: ({ IconButton }) => <button type='button'><IconButton /></button>
}))
vi.mock('../../../Shared', () => ({ Alert: () => <div data-testid='legacy-alert' /> }))

import { AddressFormUI } from '..'

const baseProps = (overrides = {}) => ({
  address: {},
  addressesList: [],
  googleMapsControls: {},
  formState: { loading: false, error: null, changes: {} },
  addressState: { address: {}, loading: false },
  isRequiredField: () => false,
  showField: () => true,
  updateChanges: vi.fn(),
  onCancel: vi.fn(),
  handleChangeInput: vi.fn(),
  saveAddress: vi.fn(),
  setIsEdit: vi.fn(),
  userCustomerSetup: null,
  isSeletectedUserAddresses: true,
  isEmbedded: true,
  ...overrides
})

const renderForm = (overrides = {}) => {
  const props = baseProps(overrides)
  return { props, ...renderWithProviders(<AddressFormUI {...props} />) }
}

let outerKeys
const spy = event => outerKeys(event.key)
let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => {
  mocks.mapThrows = false
  outerKeys = vi.fn()
  document.addEventListener('keydown', spy)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  document.removeEventListener('keydown', spy)
  consoleError.mockRestore()
})

describe('AddressForm · embedded', () => {
  it('has one title, which takes the focus, and no close button of its own (the Sheet has the only X)', async () => {
    renderForm()
    const title = screen.getByRole('heading', { name: 'Add address' })
    await waitFor(() => expect(title).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('titles an existing address "Edit address"', () => {
    renderForm({ address: { id: 3, address: 'Home street 1' }, addressState: { address: { id: 3, address: 'Home street 1' }, loading: false } })
    expect(screen.getByRole('heading', { name: 'Edit address' })).toBeInTheDocument()
  })

  it('keeps the fields labelled, with the values the controller holds', () => {
    renderForm({ formState: { loading: false, error: null, changes: { address: '100 Main Street', internal_number: '9', zipcode: '75001', address_notes: 'Front desk' } } })
    expect(screen.getByLabelText('Address', { selector: 'input' })).toHaveValue('100 Main Street')
    expect(screen.getByLabelText('Internal number')).toHaveValue('9')
    expect(screen.getByLabelText('Zipcode')).toHaveValue('75001')
    expect(screen.getByLabelText('Address Notes')).toHaveValue('Front desk')
  })

  it('the type of address is one group of choices, the saved one chosen, and the choice goes to the controller', async () => {
    const user = userEvent.setup()
    const { props } = renderForm({ addressState: { address: { tag: 'home' }, loading: false } })
    const group = screen.getByRole('group', { name: 'Address type' })
    expect(within(group).getByRole('button', { name: 'Home' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('button', { name: 'Office' }))
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'tag', value: 'office' } })
  })

  it('offers Add (disabled until something changes) and Cancel, which goes back', async () => {
    const user = userEvent.setup()
    const { props, unmount } = renderForm()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    unmount()
    renderForm({ formState: { loading: false, error: null, changes: { address: 'x' } } })
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('names the button of the GPS lookup', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument()
  })

  it('shows the error of the API inline, not in a modal', () => {
    renderForm({ formState: { loading: false, error: null, changes: {}, result: { error: true, result: ['The address already exists'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent('The address already exists')
    expect(screen.queryByTestId('legacy-alert')).not.toBeInTheDocument()
  })

  // redesign fix-qa E9: the map took an inline absolute 70% x 50% box and spilled out of its container
  it('asks the map to fill the box of the form (the legacy form keeps its own sizing)', () => {
    renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    expect(screen.getByTestId('map')).toHaveAttribute('data-fill', 'true')
    expect(screen.getByTestId('map').closest('.odc-addr-map')).not.toBeNull()
  })

  it('a map that throws (no Google) leaves the form working with "Map unavailable"', () => {
    mocks.mapThrows = true
    renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.getByLabelText('Internal number')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  // the boundary puts the focus on the notice, not on <body>, when the map fails
  it('a map that throws moves the focus to the "Map unavailable" notice instead of leaving it on the body', () => {
    const { props, rerender } = renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    expect(screen.getByTestId('map')).toBeInTheDocument()
    // the control inside the map that had the focus goes away with it: the focus is on <body> when the boundary catches
    act(() => { document.activeElement.blur() })
    mocks.mapThrows = true
    rerender(<AddressFormUI {...props} />)
    expect(document.activeElement).toBe(screen.getByText('Map unavailable').closest('.odc-state'))
  })

  it('says "Map unavailable" when the Google loader reports it could not load', () => {
    renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    expect(screen.getByTestId('map')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'The Google Maps JavaScript API could not load.' }))
    })
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.getByLabelText('Internal number')).toBeInTheDocument()
  })
})
