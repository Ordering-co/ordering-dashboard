/* eslint-disable import/first */
// redesign W1-2 (T1-4): DriversLocation survives a Google that did not load and locations that are not well formed (M-01).
import React from 'react'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ mapProps: null, fitBounds: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: 'key' } } }]
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
  InterActOrderMarker: ({ lat, lng, business, customer }) => (
    <i data-testid='order-marker' data-kind={business ? 'business' : customer ? 'customer' : 'unknown'} data-lat={String(lat)} data-lng={String(lng)} />
  )
}))
vi.mock('../../DriverMapMarkerAndInfo', () => ({
  DriverMapMarkerAndInfo: ({ lat, lng }) => <i data-testid='driver-marker' data-lat={String(lat)} data-lng={String(lng)} />
}))
vi.mock('../../../Shared', () => ({ SpinnerLoader: () => <div data-testid='spinner' /> }))

import { DriversLocation } from '..'

const online = [
  { id: 1, name: 'Ada', location: { lat: 10, lng: 20 } },
  { id: 2, name: 'Linh', location: '11, 21' }
]
const fakeMaps = { LatLngBounds: function () {}, LatLng: function () {} }

const renderMap = (props = {}) => renderWithProviders(
  <DriversLocation driversIsOnline onlineDrivers={online} offlineDrivers={[]} assignedOrders={{ orders: [] }} {...props} />
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

describe('DriversLocation', () => {
  it('does not throw when Google fails to load (maps null) and says Map unavailable in the same region', () => {
    renderMap()
    expect(() => loadGoogle({ map: null, maps: null })).not.toThrow()
    const region = screen.getByRole('region', { name: 'Drivers map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('Map unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('The map could not load. Everything else on this page still works.')
    expect(mocks.fitBounds).not.toHaveBeenCalled()
  })

  it('does not throw when onGoogleApiLoaded arrives with no arguments', () => {
    renderMap()
    expect(() => loadGoogle(undefined)).not.toThrow()
    expect(screen.getByRole('region', { name: 'Drivers map' })).toHaveAttribute('data-state', 'unavailable')
  })

  it('fits the bounds only after Google loaded for real, in one region', () => {
    renderMap()
    expect(mocks.fitBounds).not.toHaveBeenCalled()
    loadGoogle({ map: {}, maps: fakeMaps })
    expect(mocks.fitBounds).toHaveBeenCalled()
    expect(mocks.fitBounds.mock.calls[0][0]).toEqual({ ne: { lat: 11, lng: 21 }, sw: { lat: 10, lng: 20 } })
    expect(mocks.fitBounds.mock.calls[0][1]).toEqual({ width: 800, height: 600 })
    expect(mocks.mapProps.zoom).toBe(7)
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Drivers map' })).toHaveAttribute('data-size', 'fill')
  })

  it.each([
    ['business without location', { business: {}, customer: { location: { lat: 3, lng: 4 } } }],
    ['no business at all', { customer: { location: { lat: 3, lng: 4 } } }],
    ['locations as strings without a comma', { business: { location: '40.7' }, customer: { location: '' } }],
    ['driver with a malformed string', { business: { location: null }, customer: { location: null }, driver: { id: 3, location: 'abc' } }]
  ])('renders and fits a selected order with %s', (_name, partial) => {
    renderMap({ selectedOrder: { id: 9, ...partial } })
    expect(() => loadGoogle({ map: {}, maps: fakeMaps })).not.toThrow()
    for (const marker of [...screen.queryAllByTestId('order-marker'), ...screen.queryAllByTestId('driver-marker')]) {
      expect(Number.isFinite(Number(marker.dataset.lat))).toBe(true)
      expect(Number.isFinite(Number(marker.dataset.lng))).toBe(true)
    }
    expect(screen.getByRole('region', { name: 'Drivers map' })).toHaveAttribute('data-state', 'ready')
  })

  it('renders drivers whose location is malformed', () => {
    const bad = [
      { id: 1, location: 'abc' },
      { id: 2, location: null },
      { id: 3, location: { lat: 'x' } }
    ]
    renderMap({ onlineDrivers: bad })
    expect(() => loadGoogle({ map: {}, maps: fakeMaps })).not.toThrow()
    expect(screen.getAllByTestId('driver-marker')).toHaveLength(3)
  })

  it('renders the assigned orders of the selected driver even if their places are malformed', () => {
    const orders = [{ id: 1, business: {}, customer: { location: 'x' } }, { id: 2 }]
    renderMap({ selectedDriver: online[0], assignedOrders: { orders } })
    expect(() => loadGoogle({ map: {}, maps: fakeMaps })).not.toThrow()
    expect(screen.getAllByTestId('order-marker')).toHaveLength(4)
  })

  it('keeps the view the user chose: a manual move stops the refits', () => {
    renderMap()
    loadGoogle({ map: {}, maps: fakeMaps })
    const fits = mocks.fitBounds.mock.calls.length
    expect(fits).toBeGreaterThan(0)
    // the fit that just ran releases its programmatic flag on the next tick; a move after that is the user's
    return new Promise(resolve => setTimeout(resolve, 5)).then(() => {
      act(() => { mocks.mapProps.onChange({ zoom: 4, center: { lat: 1, lng: 1 } }) })
      expect(mocks.mapProps.zoom).toBe(4)
      expect(mocks.fitBounds.mock.calls.length).toBe(fits)
    })
  })

  it('centres on the point with the default zoom when every driver is at the same place', () => {
    renderMap({ onlineDrivers: [{ id: 1, location: { lat: 10, lng: 20 } }, { id: 2, location: '10,20' }] })
    loadGoogle({ map: {}, maps: fakeMaps })
    expect(mocks.fitBounds).not.toHaveBeenCalled()
    expect(mocks.mapProps.center).toEqual({ lat: 10, lng: 20 })
    expect(mocks.mapProps.zoom).toBe(10)
  })
})
