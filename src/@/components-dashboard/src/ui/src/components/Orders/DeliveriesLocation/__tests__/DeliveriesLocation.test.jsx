/* eslint-disable import/first */
// redesign W1-2 (T1-4): DeliveriesLocation survives a Google that did not load and locations that are not well formed (M-01).
import React from 'react'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ mapProps: null, fitBounds: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: 'key' } } }],
  useApi: () => [{ setAccessToken: () => ({ controls: () => ({ get: async () => ({ content: { result: { drivers: [] } } }) }) }) }],
  useSession: () => [{ token: 'token' }]
}))
vi.mock('google-map-react', () => {
  mocks.fitBounds = vi.fn(() => ({ center: { lat: 5, lng: 6 }, zoom: 7 }))
  return {
    default: (props) => {
      mocks.mapProps = props
      return <div data-testid='google-map'>{props.children}</div>
    },
    fitBounds: (...args) => mocks.fitBounds(...args)
  }
})
vi.mock('../../InterActOrderMarker', () => ({
  InterActOrderMarker: ({ lat, lng, driver, business, customer }) => (
    <i data-testid='marker' data-kind={driver ? 'driver' : business ? 'business' : customer ? 'customer' : 'unknown'} data-lat={String(lat)} data-lng={String(lng)} />
  )
}))
vi.mock('../../../Shared', () => ({ AutoScroll: ({ children }) => <div>{children}</div> }))

import { DeliveriesLocation } from '..'

const drivers = [
  { id: 1, name: 'Ada', location: { lat: 10, lng: 20 }, enabled: true, available: true, busy: false },
  { id: 2, name: 'Linh', location: '11, 21', enabled: true, available: true, busy: false }
]
const fakeMaps = { LatLngBounds: function () {}, LatLng: function () {} }

const renderMap = (props = {}) => renderWithProviders(
  <DeliveriesLocation driversList={{ loading: false, drivers }} interActionMapOrder={null} {...props} />
)
const loadGoogle = (arg) => act(() => { mocks.mapProps.onGoogleApiLoaded(arg) })

let sizeSpy
beforeEach(() => {
  mocks.mapProps = null
  mocks.fitBounds.mockClear()
  sizeSpy = [
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800),
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  ]
  delete window.google
  window.reportError = vi.fn()
})
afterEach(() => {
  sizeSpy.forEach(spy => spy.mockRestore())
  delete window.reportError
})

describe('DeliveriesLocation', () => {
  it('does not throw when Google fails to load (maps null) and says Map unavailable in the same region', () => {
    renderMap()
    expect(() => loadGoogle({ map: null, maps: null })).not.toThrow()
    const region = screen.getByRole('region', { name: 'Delivery map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('Map unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('The map could not load. Everything else on this page still works.')
    expect(mocks.fitBounds).not.toHaveBeenCalled()
  })

  it('does not throw when onGoogleApiLoaded arrives with no arguments', () => {
    renderMap()
    expect(() => loadGoogle(undefined)).not.toThrow()
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-state', 'unavailable')
  })

  it('fits the bounds only after Google loaded for real', () => {
    renderMap()
    expect(mocks.fitBounds).not.toHaveBeenCalled()
    loadGoogle({ map: {}, maps: fakeMaps })
    expect(mocks.fitBounds).toHaveBeenCalledTimes(1)
    expect(mocks.fitBounds.mock.calls[0][0]).toEqual({ ne: { lat: 11, lng: 21 }, sw: { lat: 10, lng: 20 } })
    expect(mocks.fitBounds.mock.calls[0][1]).toEqual({ width: 800, height: 600 })
    expect(mocks.mapProps.zoom).toBe(7)
    expect(mocks.mapProps.center).toEqual({ lat: 5, lng: 6 })
  })

  // redesign deliveries F2-B2 (decision 1: the «Drivers online» panel became the drivers dock, a second named region in the column, outside the frame)
  it('draws the map in one region and the drivers dock outside the frame', () => {
    const order = { id: 9, driver: null, business: { location: { lat: 1, lng: 2 } }, customer: { location: { lat: 3, lng: 4 } } }
    renderMap({ interActionMapOrder: order })
    expect(screen.getAllByRole('region')).toHaveLength(2)
    const region = screen.getByRole('region', { name: 'Delivery map' })
    expect(region).toHaveAttribute('data-size', 'fill')
    expect(region).toContainElement(screen.getByTestId('google-map'))
    const dock = screen.getByRole('region', { name: /Candidates for #9/ })
    expect(region).not.toContainElement(dock)
    expect(dock.parentElement).toBe(region.parentElement)
  })

  // redesign deliveries F2-B2 (decision 1: same, with the new dock)
  it('keeps the drivers dock when the map is unavailable', () => {
    const order = { id: 9, driver: null, business: { location: { lat: 1, lng: 2 } }, customer: { location: { lat: 3, lng: 4 } } }
    renderMap({ interActionMapOrder: order })
    loadGoogle({ map: null, maps: null })
    expect(screen.queryByTestId('google-map')).toBeNull()
    expect(screen.getByRole('region', { name: /Candidates for #9/ })).toBeInTheDocument()
  })

  it.each([
    ['business without location', { business: {}, customer: { location: { lat: 3, lng: 4 } } }],
    ['no business at all', { customer: { location: { lat: 3, lng: 4 } } }],
    ['business location as a string without comma', { business: { location: '40.7' }, customer: { location: '' } }],
    ['customer location null', { business: { location: null }, customer: { location: null } }]
  ])('renders and fits with %s, falling back to the project centre', (_name, partial) => {
    const order = { id: 9, driver: null, ...partial }
    renderMap({ interActionMapOrder: order })
    expect(() => loadGoogle({ map: {}, maps: fakeMaps })).not.toThrow()
    const markers = screen.getAllByTestId('marker')
    for (const marker of markers) {
      expect(Number.isFinite(Number(marker.dataset.lat))).toBe(true)
      expect(Number.isFinite(Number(marker.dataset.lng))).toBe(true)
    }
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-state', 'ready')
  })

  it('renders drivers whose location is malformed', () => {
    const bad = [
      { id: 1, location: 'abc', enabled: true, available: true, busy: false },
      { id: 2, location: null, enabled: true, available: true, busy: false },
      { id: 3, location: { lat: 'x' }, enabled: true, available: true, busy: false }
    ]
    renderMap({ driversList: { loading: false, drivers: bad } })
    expect(() => loadGoogle({ map: {}, maps: fakeMaps })).not.toThrow()
    expect(screen.getAllByTestId('marker')).toHaveLength(3)
  })

  it('centres on the point with the default zoom when every driver is at the same place', () => {
    const same = [
      { id: 1, location: { lat: 10, lng: 20 }, enabled: true, available: true, busy: false },
      { id: 2, location: '10,20', enabled: true, available: true, busy: false }
    ]
    renderMap({ driversList: { loading: false, drivers: same } })
    loadGoogle({ map: {}, maps: fakeMaps })
    expect(mocks.fitBounds).not.toHaveBeenCalled()
    expect(mocks.mapProps.center).toEqual({ lat: 10, lng: 20 })
    expect(mocks.mapProps.zoom).toBe(10)
  })
})
