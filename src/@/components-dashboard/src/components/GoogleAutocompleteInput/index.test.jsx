import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { GoogleAutocompleteInput } from './index'
const sdk = vi.hoisted(() => ({ widgets: [] }))
afterEach(() => { cleanup(); delete window.google; sdk.widgets = []; document.getElementById('__googleMapsScriptId')?.remove(); document.getElementById('google-maps-cluster')?.remove(); document.getElementById('google-maps-heatmap')?.remove() })
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
