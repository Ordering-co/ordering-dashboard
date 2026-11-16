/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: ({ childRef, onChangeAddress: _onChangeAddress, apiKey: _apiKey, countryCode: _countryCode, ...props }) => {
    useEffect(() => { childRef({ value: '' }) }, [childRef])
    return <input {...props} />
  },
  GoogleMapsMap: () => <div role='region' aria-label='Address map' />,
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: true }],
  useOrder: () => [{ loading: false, options: {} }],
  useConfig: () => [{
    loading: false,
    configs: {
      meters_to_change_address: { value: '500' },
      google_maps_api_key: { value: '' },
      google_autocomplete_selection_required: { value: 'false' },
      country_autocomplete: { value: '*' }
    }
  }]
}))

vi.mock('../../GoogleGpsButton', () => ({ GoogleGpsButton: () => <button type='button'>Use current location</button> }))

import { AddressFormUI } from '..'

describe('AddressForm accessibility', () => {
  it('associates fields, preserves native validation, names cancel and exposes pressed address tags', () => {
    const onCancel = vi.fn()
    const handleChangeInput = vi.fn()
    const changes = {
      address: '100 Main Street',
      internal_number: '9',
      zipcode: '75001',
      address_notes: 'Front desk'
    }

    const { container } = renderWithProviders(
      <AddressFormUI
        address={{}}
        addressesList={[]}
        googleMapsControls={{}}
        formState={{ loading: false, error: null, changes }}
        addressState={{ address: { tag: 'home' } }}
        isRequiredField={() => false}
        showField={() => true}
        updateChanges={vi.fn()}
        onCancel={onCancel}
        handleChangeInput={handleChangeInput}
        saveAddress={vi.fn()}
        setIsEdit={vi.fn()}
        userCustomerSetup={null}
        isSeletectedUserAddresses
      />
    )

    expect(screen.getByLabelText('Address', { selector: 'input' })).toHaveValue('100 Main Street')
    expect(screen.getByLabelText('Internal number')).toHaveValue('9')
    expect(screen.getByLabelText('Zipcode')).toHaveValue('75001')
    expect(screen.getByLabelText('Address Notes')).toHaveValue('Front desk')
    expect(container.querySelector('form')).not.toHaveAttribute('novalidate')

    const home = screen.getByRole('button', { name: 'Home' })
    const office = screen.getByRole('button', { name: 'Office' })
    expect(home).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(office)
    expect(office).toHaveAttribute('aria-pressed', 'true')
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'tag', value: 'office' } })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
