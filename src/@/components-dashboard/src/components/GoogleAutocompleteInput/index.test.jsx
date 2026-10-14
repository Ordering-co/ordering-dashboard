import React from 'react'
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { GoogleAutocompleteInput } from './index'
import { setPlacesApiMode, getPlacesApiMode } from './placesApi'
const sdk = vi.hoisted(() => ({ widgets: [] }))
afterEach(() => { cleanup(); delete window.google; sdk.widgets = []; setPlacesApiMode(null); document.getElementById('__googleMapsScriptId')?.remove(); document.getElementById('google-maps-cluster')?.remove(); document.getElementById('google-maps-heatmap')?.remove() })
const setup = () => {
  for (const id of ['__googleMapsScriptId', 'google-maps-cluster', 'google-maps-heatmap']) { const script = document.createElement('script'); script.id = id; document.head.append(script) }
  class Autocomplete {
    constructor (input, options) { this.input = input; this.options = options; this.remove = vi.fn(); sdk.widgets.push(this) }
    setComponentRestrictions (value) { this.restrictions = value }
    addListener (type, callback) { this.callback = callback; return { remove: this.remove } }
    getPlace () { return this.place }
  }
  window.google = { maps: { Map: function () {}, places: { Autocomplete } } }
}
const validPlace = () => ({ formatted_address: 'Selected address', place_id: 'place-1', address_components: [{ types: ['locality'], long_name: 'City' }], geometry: { location: { lat: () => 0, lng: () => 2 } } })
it('keeps existing callers on the same native widget, options and selection payload', () => {
  setup(); const selected = vi.fn(); const { container } = render(<GoogleAutocompleteInput apiKey='test-key' onChangeAddress={selected} countryCode='mx' />)
  const widget = sdk.widgets[0]; widget.place = validPlace(); widget.callback()
  expect(widget.options).toEqual({ types: [], fields: ['ALL'], componentRestrictions: { country: 'mx' } })
  expect(selected.mock.calls[0][0]).toMatchObject({ address: 'Selected address', location: { lat: 0, lng: 2 }, map_data: { library: 'google', place_id: 'place-1' } })
  expect(container.querySelector('input').disabled).toBe(false)
})
it('opts into frozen and current callbacks without changing omitted-prop callers', () => {
  setup(); const first = vi.fn(); const next = vi.fn(); const { container, rerender } = render(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle disabled onChangeAddress={first} />)
  expect(container.querySelector('input').disabled).toBe(true)
  const widget = sdk.widgets[0]; widget.place = validPlace(); widget.callback(); expect(first).not.toHaveBeenCalled()
  rerender(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle onChangeAddress={next} />)
  widget.callback(); expect(next).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled()
})
it('ignores free text without geometry and removes the listener for the new managed caller', () => {
  setup(); const selected = vi.fn(); const { container, unmount } = render(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle value='Typed only' onChange={vi.fn()} onChangeAddress={selected} />)
  fireEvent.change(container.querySelector('input'), { target: { value: 'Typed again' } })
  const widget = sdk.widgets[0]; widget.place = { name: 'Typed only' }
  expect(() => widget.callback()).not.toThrow(); expect(selected).not.toHaveBeenCalled()
  unmount(); expect(widget.remove).toHaveBeenCalledOnce(); widget.place = validPlace(); widget.callback(); expect(selected).not.toHaveBeenCalled()
})

it('changes managed country restrictions without constructing a second dropdown', () => {
  setup()
  const selected = vi.fn()
  const view = render(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle countryCode='mx' onChangeAddress={selected} />)
  const first = sdk.widgets[0]
  view.rerender(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle countryCode='us' onChangeAddress={selected} />)
  expect(sdk.widgets).toHaveLength(1)
  expect(first.restrictions).toEqual({ country: 'us' })
  view.rerender(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle countryCode='*' onChangeAddress={selected} />)
  expect(first.restrictions).toEqual({ country: [] })
  expect(first.remove).not.toHaveBeenCalled()
})

const newPrediction = () => {
  const place = {
    id: 'new-place-1',
    formattedAddress: '1 Main Rd, Cape Town, South Africa',
    addressComponents: [
      { types: ['locality', 'political'], longText: 'Cape Town', shortText: 'Cape Town' },
      { types: ['country', 'political'], longText: 'South Africa', shortText: 'ZA' }
    ],
    location: { lat: () => -33.92, lng: () => 18.42 },
    utcOffsetMinutes: 120,
    fetchFields: vi.fn(async () => ({}))
  }
  return { placeId: 'new-place-1', text: { text: '1 Main Rd, Cape Town, South Africa' }, mainText: { text: '1 Main Rd' }, secondaryText: { text: 'Cape Town' }, toPlace: () => place }
}

const setupNew = (fetchAutocompleteSuggestions) => {
  setup()
  window.google.maps.places.AutocompleteSuggestion = { fetchAutocompleteSuggestions }
  window.google.maps.places.AutocompleteSessionToken = vi.fn()
}

it('uses Places API (New) when it is enabled and keeps the dashboard address payload', async () => {
  setupNew(vi.fn(async () => ({ suggestions: [{ placePrediction: newPrediction() }] })))
  const selected = vi.fn()
  const { container } = render(<GoogleAutocompleteInput apiKey='test-key' countryCode='za' onChangeAddress={selected} />)
  fireEvent.change(container.querySelector('input'), { target: { value: '1 Main' } })
  fireEvent.click(await screen.findByRole('option'))
  await waitFor(() => expect(selected).toHaveBeenCalledOnce())
  expect(selected.mock.calls[0][0]).toMatchObject({ address: '1 Main Rd, Cape Town, South Africa', city_name: 'Cape Town', country_code: 'ZA', location: { lat: -33.92, lng: 18.42 }, map_data: { library: 'google', place_id: 'new-place-1' } })
  expect(window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions).toHaveBeenCalledWith(expect.objectContaining({ includedRegionCodes: ['za'] }))
  expect(sdk.widgets).toHaveLength(0)
})

it('falls back to the legacy widget when Places API (New) is not enabled', async () => {
  setupNew(vi.fn(async () => { throw new Error('Places API (New) has not been used in project') }))
  const selected = vi.fn()
  const { container } = render(<GoogleAutocompleteInput apiKey='test-key' onChangeAddress={selected} />)
  expect(sdk.widgets).toHaveLength(0)
  fireEvent.change(container.querySelector('input'), { target: { value: 'cape' } })
  await waitFor(() => expect(sdk.widgets).toHaveLength(1))
  expect(getPlacesApiMode()).toBe('legacy')
  const widget = sdk.widgets[0]; widget.place = validPlace(); widget.callback()
  expect(selected.mock.calls[0][0]).toMatchObject({ address: 'Selected address', city_name: 'City' })
})

it('stays on Places API (New) when the first request fails for a transient reason', async () => {
  const fetchAutocompleteSuggestions = vi.fn()
    .mockRejectedValueOnce(new Error('Failed to fetch'))
    .mockResolvedValue({ suggestions: [{ placePrediction: newPrediction() }] })
  setupNew(fetchAutocompleteSuggestions)
  const { container } = render(<GoogleAutocompleteInput apiKey='test-key' onChangeAddress={vi.fn()} />)
  const input = container.querySelector('input')
  fireEvent.change(input, { target: { value: 'cape' } })
  await waitFor(() => expect(fetchAutocompleteSuggestions).toHaveBeenCalledTimes(1))
  expect(getPlacesApiMode()).toBeNull()
  expect(sdk.widgets).toHaveLength(0)
  fireEvent.change(input, { target: { value: 'cape town' } })
  expect(await screen.findByRole('option')).toBeTruthy()
  expect(getPlacesApiMode()).toBe('new')
})

it('ignores Places API (New) selections while a managed input is disabled', async () => {
  setupNew(vi.fn(async () => ({ suggestions: [{ placePrediction: newPrediction() }] })))
  const selected = vi.fn()
  const view = render(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle onChangeAddress={selected} />)
  fireEvent.change(view.container.querySelector('input'), { target: { value: '1 Main' } })
  const option = await screen.findByRole('option')
  view.rerender(<GoogleAutocompleteInput apiKey='test-key' managedLifecycle disabled onChangeAddress={selected} />)
  fireEvent.click(option)
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(selected).not.toHaveBeenCalled()
})

it('closes the suggestions on Escape without letting the key reach window listeners', async () => {
  const windowKeyDown = vi.fn()
  window.addEventListener('keydown', windowKeyDown)
  setupNew(vi.fn(async () => ({ suggestions: [{ placePrediction: newPrediction() }] })))
  const { container } = render(<GoogleAutocompleteInput apiKey='test-key' onChangeAddress={vi.fn()} />)
  const input = container.querySelector('input')
  fireEvent.change(input, { target: { value: '1 Main' } })
  await screen.findByRole('option')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.queryByRole('option')).toBeNull()
  expect(windowKeyDown).not.toHaveBeenCalled()
  window.removeEventListener('keydown', windowKeyDown)
})
