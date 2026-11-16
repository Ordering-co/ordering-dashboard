/* eslint-disable import/first */
import React from 'react'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  configs: { google_maps_api_key: { value: 'key' } },
  mapProps: { current: null },
  throwOnRender: false,
  loadWith: null
}))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: mocks.configs }],
  useOrder: () => [{ options: { type: 1 } }]
}))

// The real component loads the Google script; the test decides what the script left behind.
vi.mock('google-map-react', async () => {
  const React = await import('react')
  const GoogleMapReact = props => {
    mocks.mapProps.current = props
    if (mocks.throwOnRender) throw new TypeError("Cannot read properties of undefined (reading 'maps')")
    React.useEffect(() => {
      if (mocks.loadWith) props.onGoogleApiLoaded?.(mocks.loadWith)
    }, [])
    return <div data-testid='google-map'>{props.children}</div>
  }
  return { default: GoogleMapReact, fitBounds: () => ({ center: { lat: 1, lng: 2 }, zoom: 12 }) }
})

vi.mock('../../../InterActOrderMarker', () => ({ InterActOrderMarker: () => <span data-testid='marker' /> }))

import { Map } from '..'

const props = { customer: { id: 1 }, customerLocation: { lat: 40, lng: -73 }, business: { id: 2, location: { lat: 41, lng: -74 } } }

// A Google that loaded but has no LatLngBounds: what a blocked or half-loaded script leaves.
const brokenMaps = { map: {}, maps: {} }

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => {
  mocks.configs = { google_maps_api_key: { value: 'key' } }
  mocks.throwOnRender = false
  mocks.loadWith = null
  mocks.mapProps.current = null
  delete window.google
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  delete window.google
})

describe('Map · without Google Maps', () => {
  it('says "Map unavailable" when the API loads without the classes the map needs, and does not throw', () => {
    window.google = { maps: {} }
    mocks.loadWith = brokenMaps
    renderWithProviders(<Map {...props} />)
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument()
  })

  it('says "Map unavailable" when there is no Google key, instead of a blank grey box', () => {
    mocks.configs = {}
    renderWithProviders(<Map {...props} />)
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
  })

  it('says "Map unavailable" when the Google script reports it could not load', () => {
    renderWithProviders(<Map {...props} />)
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'The Google Maps JavaScript API could not load.' }))
    })
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
  })

  it('a map that throws while it draws falls back to the empty state and leaves the rest alone', () => {
    mocks.throwOnRender = true
    renderWithProviders(<div><p>Rest of the step</p><Map {...props} /></div>)
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.getByText('Rest of the step')).toBeInTheDocument()
  })
})

describe('Map · with Google Maps', () => {
  it('keeps drawing the map when the API has what it needs', () => {
    class LatLng { constructor (lat, lng) { this.lat = () => lat; this.lng = () => lng } }
    class LatLngBounds {
      extend () {}
      union () {}
      getNorthEast () { return new LatLng(41, -73) }
      getSouthWest () { return new LatLng(40, -74) }
    }
    window.google = { maps: { LatLng, LatLngBounds } }
    mocks.loadWith = { map: { fitBounds () {} }, maps: window.google.maps }
    renderWithProviders(<Map {...props} />)
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    expect(screen.queryByText('Map unavailable')).not.toBeInTheDocument()
  })
})
