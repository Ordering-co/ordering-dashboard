/* eslint-disable import/first */
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign tramo B r4 (W0-PB3-01): a boundary swallows the error React would have rethrown to the window, where DashboardAnalytics listens.
// Each of the four boundaries of the wizard and the address map reports it ONCE with window.reportError, as main does by having none.
const flags = vi.hoisted(() => ({ wizard: null }))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useOrder: () => [{ loading: false, options: { type: 1 } }, { changeAddress: vi.fn() }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  useConfig: () => [{ configs: { google_maps_api_key: { value: 'key' } } }],
  useCustomer: () => [{}, { setUserCustomer: vi.fn(), deleteUserCustomer: vi.fn() }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  GoogleMapsMap: () => { throw new TypeError("Cannot read properties of undefined (reading 'maps')") },
  GoogleAutocompleteInput: ({ childRef, onChangeAddress: _a, apiKey: _k, countryCode: _c, ...props }) => <input {...props} />
}))
vi.mock('google-map-react', () => ({
  default: () => { throw new TypeError("Cannot read properties of undefined (reading 'maps')") },
  fitBounds: () => ({ center: {}, zoom: 1 })
}))
vi.mock('../../../../../utils', () => ({ findExitingCountryPhoneCode: () => '1' }))
vi.mock('../../../InterActOrderMarker', () => ({ InterActOrderMarker: () => null }))
vi.mock('../../CustomOrderDetails', () => ({
  CustomOrderDetails: () => {
    if (flags.wizard) throw flags.wizard
    return <h3>Customer</h3>
  }
}))
vi.mock('../../../../Delivery/GoogleGpsButton', () => ({ GoogleGpsButton: () => null }))
vi.mock('../../../../Shared', () => ({ Alert: () => null }))

import { CreateCustomOrder } from '../../index'
import { Map } from '../../Map/index'
import { AddressFormUI } from '../../../../Delivery/AddressForm'

let consoleError
beforeEach(() => {
  flags.wizard = null
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.reportError = vi.fn()
})
afterEach(() => {
  consoleError.mockRestore()
  delete window.reportError
  document.getElementById('app-modals')?.remove()
})

describe('W0-PB3-01 · the wizard boundaries report to the window, once', () => {
  it('the sheet boundary: a render error of the wizard', async () => {
    flags.wizard = new TypeError('wizard broke')
    const user = userEvent.setup()
    renderWithProviders(<CreateCustomOrder />)
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create custom order' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be shown')
    expect(window.reportError).toHaveBeenCalledTimes(1)
    expect(window.reportError).toHaveBeenCalledWith(flags.wizard)
  })

  it('the sheet boundary: a wizard chunk that did not load draws «Reload», not «Try again»', async () => {
    flags.wizard = new TypeError('Failed to fetch dynamically imported module: /assets/CustomOrderDetails.js')
    const user = userEvent.setup()
    renderWithProviders(<CreateCustomOrder />)
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create custom order' })
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveAttribute('data-error-kind', 'load')
    // redesign tramo B cierre (W0-QB4-03, W0-PB4-02): the title speaks of the form, not of «this page»: the page behind is intact
    expect(within(alert).getByText('The order form could not be loaded')).toBeInTheDocument()
    expect(within(alert).queryByText('This page could not be loaded')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(window.reportError).toHaveBeenCalledTimes(1)
  })

  it('the map of the wizard', () => {
    renderWithProviders(<Map business={{ id: 1 }} customer={{}} customerLocation={{ lat: 1, lng: 2 }} />)
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(window.reportError).toHaveBeenCalledTimes(1)
  })

  it('the map of the address form', () => {
    renderWithProviders(
      <AddressFormUI
        address={{}}
        addressesList={[]}
        googleMapsControls={{}}
        formState={{ loading: false, error: null, changes: { location: { lat: 1, lng: 2 } } }}
        addressState={{ address: { location: { lat: 1, lng: 2 } }, loading: false }}
        isRequiredField={() => false}
        showField={() => true}
        updateChanges={vi.fn()}
        onCancel={vi.fn()}
        handleChangeInput={vi.fn()}
        saveAddress={vi.fn()}
        setIsEdit={vi.fn()}
        isSeletectedUserAddresses
        isEmbedded
      />
    )
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(window.reportError).toHaveBeenCalledTimes(1)
  })
})
