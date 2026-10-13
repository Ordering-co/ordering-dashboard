import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessDetails } from './index'
const native = vi.hoisted(() => ({ input: null, map: null }))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: 'native-test-key' }, country_autocomplete: { value: 'mx' } } }],
  GoogleAutocompleteInput: props => { native.input = props; return <input id={props.id} data-testid='native-address' name='address' defaultValue={props.defaultValue} /> },
  GoogleMapsMap: props => { native.map = props; return <div data-testid='native-map' /> }
}))
afterEach(cleanup)
const props = { formState: { changes: { name: 'Existing', address: 'Old address', slug: 'existing', cellphone: '12345', location: { lat: 0, lng: 2 } } }, handleChangeAddress: vi.fn(), handleChangeInput: vi.fn() }
const renderDetails = extra => render(<ThemeProvider theme={theme}><BusinessDetails {...props} {...extra} /></ThemeProvider>)
it('preserves the current business form when the new mode is omitted', () => {
  const { container } = renderDetails({ placeId: 'existing-place' })
  expect(container.querySelector('input[name=name]').value).toBe('Existing')
  expect(container.querySelector('input[name=slug]').value).toBe('existing')
  expect(container.querySelector('input[name=cellphone]').value).toBe('12345')
  expect(screen.getByText('Google place ID')).toBeTruthy(); expect(screen.getByText('existing-place')).toBeTruthy()
  expect(native.input.defaultValue).toBe('Old address'); expect(native.input.apiKey).toBe('native-test-key'); expect(native.input.managedLifecycle).not.toBe(true)
  expect(native.map.isFitCenter).toBe(true)
})
it('uses the same native address/map section without duplicate details or API key output', () => {
  const { container } = renderDetails({ addressOnly: true, disabled: true, handleChangeCenter: vi.fn() })
  expect(container.querySelector('input[name=name]')).toBeNull(); expect(container.querySelector('input[name=slug]')).toBeNull(); expect(container.querySelector('input[name=cellphone]')).toBeNull()
  expect(screen.queryByText('Google place ID')).toBeNull(); expect(screen.queryByText('native-test-key')).toBeNull()
  expect(screen.getByLabelText('Address')).toBeTruthy(); expect(native.input.managedLifecycle).toBe(true)
  expect(native.input.apiKey).toBe('native-test-key'); expect(native.input.countryCode).toBe('mx'); expect(native.map.apiKey).toBe(native.input.apiKey)
  expect(native.map.isFitCenter).toBe(false); expect(native.map.location).toEqual({ lat: 0, lng: 2 }); expect(native.map.onlyMarkerChangeCenter).toBe(true); expect(native.map.mapControls.isMarkerDraggable).toBe(false)
})
