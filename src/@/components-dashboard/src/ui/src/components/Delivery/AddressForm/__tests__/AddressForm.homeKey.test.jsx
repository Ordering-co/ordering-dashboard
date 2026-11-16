/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign W0-4c (T0-15, decisión 19): the address type "Home" is HOME_ADDRESS; HOME stays for the menu.
const mocks = vi.hoisted(() => ({ calls: [] }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: ({ childRef, onChangeAddress: _a, apiKey: _k, countryCode: _c, ...props }) => {
    useEffect(() => { childRef({ value: '' }) }, [childRef])
    return <input {...props} />
  },
  GoogleMapsMap: () => <div data-testid='map' />,
  useLanguage: () => [null, (key, fallback) => { mocks.calls.push(key); return fallback }],
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
  ...overrides
})

beforeEach(() => { mocks.calls.length = 0 })

describe('AddressForm · address type key (W0-4c)', () => {
  it('embedded: the Home type of address is translated with HOME_ADDRESS, never HOME, and still reads "Home"', () => {
    renderWithProviders(<AddressFormUI {...baseProps({ isEmbedded: true })} />)
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(mocks.calls).toContain('HOME_ADDRESS')
    expect(mocks.calls).not.toContain('HOME')
  })
})
