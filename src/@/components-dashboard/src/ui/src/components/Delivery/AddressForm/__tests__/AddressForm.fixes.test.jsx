/* eslint-disable import/first */
// redesign UF-B5 (M-UF19, M-UF20, M-UF23): three crashes and a message the embedded address form had since `main`, now
// reachable from five more panels (the saved places of business owners, call center, admins, professionals and drivers).
import React, { useEffect } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ dictionary: {}, required: 'false' }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: ({ childRef, onChangeAddress: _a, apiKey: _k, countryCode: _c, ...props }) => {
    useEffect(() => { childRef({ value: '' }) }, [childRef])
    return <input {...props} />
  },
  GoogleMapsMap: (props) => (
    <div data-testid='map'>
      <button type='button' onClick={() => props.setErrors('ERROR_MAX_LIMIT_LOCATION')}>far</button>
    </div>
  ),
  useLanguage: () => [null, (key, fallback) => mocks.dictionary[key] ?? fallback],
  useSession: () => [{ auth: true }],
  useOrder: () => [{ loading: false, options: {} }],
  useConfig: () => [{
    loading: false,
    configs: {
      meters_to_change_address: { value: '500' },
      google_maps_api_key: { value: 'key' },
      google_autocomplete_selection_required: { value: mocks.required },
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

let consoleError
beforeEach(() => {
  window.reportError = vi.fn()
  mocks.dictionary = {}
  mocks.required = 'false'
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete window.reportError
  delete window.google
  consoleError.mockRestore()
})

describe('AddressForm · M-UF19 (the map moves under an address that had no location)', () => {
  const editing = { id: 3, address: 'Home street 1' }

  it('does not throw when the map reports a location for an address saved without one', () => {
    const { rerender, props } = renderForm({ address: editing, addressState: { address: editing, loading: false } })
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(() => {
      rerender(<AddressFormUI {...props} formState={{ loading: false, error: null, changes: { location: { lat: 4.5, lng: -74.1 } } }} />)
    }).not.toThrow()
    expect(screen.getByTestId('map')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edit address' })).toBeInTheDocument()
  })

  it('still ignores a small move of an address that has one (same degrees)', () => {
    const withLocation = { ...editing, location: { lat: 4.1, lng: -74.2 } }
    const { rerender, props } = renderForm({ address: withLocation, addressState: { address: withLocation, loading: false } })
    expect(screen.getByTestId('map')).toBeInTheDocument()
    expect(() => {
      rerender(<AddressFormUI {...props} formState={{ loading: false, error: null, changes: { location: { lat: 4.4, lng: -74.3 } } }} />)
    }).not.toThrow()
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })
})

describe('AddressForm · M-UF20 (messages)', () => {
  it('builds the required message key in upper case, one per field', async () => {
    const user = userEvent.setup()
    mocks.dictionary = {
      VALIDATION_ERROR_INTERNAL_NUMBER_REQUIRED: 'Falta el número interno',
      VALIDATION_ERROR_ZIPCODE_REQUIRED: 'Falta el código postal',
      VALIDATION_ERROR_ADDRESS_NOTES_REQUIRED: 'Faltan las notas'
    }
    renderForm({
      isRequiredField: name => name !== 'address',
      formState: { loading: false, error: null, changes: { address: 'Street 1', location: { lat: 1, lng: 2 } } }
    })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect((await screen.findAllByText('Falta el número interno')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Falta el código postal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Faltan las notas').length).toBeGreaterThan(0)
  })

  it('keeps the English default of a required field with no translation', async () => {
    const user = userEvent.setup()
    renderForm({
      isRequiredField: name => name === 'zipcode',
      formState: { loading: false, error: null, changes: { address: 'Street 1', location: { lat: 1, lng: 2 } } }
    })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect((await screen.findAllByText('The field Zipcode is required')).length).toBeGreaterThan(0)
  })

  it('says how far the marker may go, in one sentence and as a list, with an English default', async () => {
    const user = userEvent.setup()
    renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    await user.click(screen.getByRole('button', { name: 'far' }))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/^Sorry, You can only set the position to 500 meters/)
    expect(notice.textContent).not.toMatch(/500m|\[object|undefined/)
  })

  it('translates the sentence and leaves the number and the unit where they were', async () => {
    const user = userEvent.setup()
    mocks.dictionary = { ERROR_MAX_LIMIT_LOCATION: 'Solo puedes mover el punto hasta', METTERS: 'metros' }
    renderForm({ address: { id: 3 }, addressState: { address: { id: 3, location: { lat: 1, lng: 2 } }, loading: false } })
    await user.click(screen.getByRole('button', { name: 'far' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes mover el punto hasta 500 metros')
  })
})

describe('AddressForm · M-UF23 (saving a typed address without Google)', () => {
  const typed = { loading: false, error: null, changes: { address: 'Typed street 1' } }

  // redesign UF-R1 (F2): without Google the typed address has no coordinates; an address the geocoder cannot find is refused with
  // Google, so it is refused here too. The original crash (a throw on the missing Geocoder) stays fixed.
  it('does not save the typed address when Google is not loaded: it says so inline, does not throw and keeps what was typed', async () => {
    const user = userEvent.setup()
    const { props } = renderForm({ formState: typed })
    expect(window.google).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We can\'t check this address because the map didn\'t load. Try again in a moment.')
    expect(props.saveAddress).not.toHaveBeenCalled()
    expect(window.reportError).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('translates the message of a map that did not load', async () => {
    const user = userEvent.setup()
    mocks.dictionary = { USER_FORM_ADDRESS_MAPS_UNAVAILABLE: 'No podemos comprobar esta dirección.' }
    renderForm({ formState: typed })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos comprobar esta dirección.')
  })

  it('still saves a typed address that comes with a location, without Google', async () => {
    const user = userEvent.setup()
    const { props } = renderForm({ formState: { loading: false, error: null, changes: { address: 'Typed street 1', location: { lat: 1, lng: 2 } } } })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(props.saveAddress).toHaveBeenCalledTimes(1))
    expect(props.saveAddress).toHaveBeenCalledWith({}, null)
  })

  it('still refuses an address with no location inline when a suggestion is required', async () => {
    const user = userEvent.setup()
    mocks.required = 'true'
    const { props } = renderForm({ formState: typed })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The address needs a location, please select one of the suggested')
    expect(props.saveAddress).not.toHaveBeenCalled()
  })

  it('still asks the geocoder when Google is loaded, and saves what it finds', async () => {
    const user = userEvent.setup()
    const geocode = vi.fn((_query, done) => done([{
      address_components: [{ types: ['postal_code'], short_name: '11001' }],
      geometry: { location: { lat: () => 4.6, lng: () => -74.1 } },
      place_id: 'abc'
    }], 'OK'))
    window.google = { maps: { Geocoder: function Geocoder () { this.geocode = geocode } } }
    const { props } = renderForm({ formState: typed })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(props.saveAddress).toHaveBeenCalledTimes(1))
    expect(geocode).toHaveBeenCalledWith({ address: 'Typed street 1' }, expect.any(Function))
    expect(props.saveAddress).toHaveBeenCalledWith({
      address: 'Typed street 1',
      location: { lat: 4.6, lng: -74.1 },
      utc_offset: 0,
      map_data: { library: 'google', place_id: 'abc' },
      zipcode: '11001'
    }, null)
  })

  it('does not save a geocoded address that already exists', async () => {
    const user = userEvent.setup()
    const geocode = vi.fn((_query, done) => done([{
      address_components: [{ types: ['postal_code'], short_name: '11001' }],
      geometry: { location: { lat: () => 4.6, lng: () => -74.1 } },
      place_id: 'abc'
    }], 'OK'))
    window.google = { maps: { Geocoder: function Geocoder () { this.geocode = geocode } } }
    const existing = { id: 1, address: 'Typed street 1', zipcode: '11001', location: { lat: 4.6, lng: -74.1 } }
    const { props } = renderForm({ formState: typed, addressesList: [existing] })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const notice = await screen.findByRole('alert')
    expect(within(notice).getByText('The address already exists')).toBeInTheDocument()
    expect(props.saveAddress).not.toHaveBeenCalled()
  })

  it('does not save an address that already exists, with Google or without it', async () => {
    const user = userEvent.setup()
    // redesign UF-R1 (F2): without Google the duplicate check runs for an address that carries its location
    const located = { loading: false, error: null, changes: { address: 'Typed street 1', location: { lat: 4.6, lng: -74.1 } } }
    const { props } = renderForm({ formState: located, addressesList: [{ id: 1, address: 'Typed street 1', location: { lat: 4.6, lng: -74.1 } }] })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const notice = await screen.findByRole('alert')
    expect(within(notice).getByText('The address already exists')).toBeInTheDocument()
    expect(props.saveAddress).not.toHaveBeenCalled()
  })
})
