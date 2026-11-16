import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MapFrame } from '../MapFrame'

// redesign W0-7 (T0-25)
const Map = () => <div data-testid='map'>real map</div>
const Boom = () => { throw new Error('map exploded') }

const frame = props => (
  <MapFrame label='Delivery map' apiKey='key' unavailableTitle='Map unavailable' unavailableDescription='The map could not load.' {...props}>
    <Map />
  </MapFrame>
)

const css = readFileSync(resolve(__dirname, '../map-frame.css'), 'utf8')

// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

afterEach(() => { vi.restoreAllMocks() })

describe('MapFrame', () => {
  it('draws the real map and no notice when the provider is there', () => {
    render(frame())
    const region = screen.getByRole('region', { name: 'Delivery map' })
    expect(region).toHaveAttribute('data-state', 'ready')
    expect(region).toContainElement(screen.getByTestId('map'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([undefined, null, ''])('with apiKey %j draws the notice in the same slot and not the map', apiKey => {
    render(frame({ apiKey }))
    const region = screen.getByRole('region', { name: 'Delivery map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(screen.queryByTestId('map')).toBeNull()
    const status = screen.getByRole('status')
    expect(region).toContainElement(status)
    expect(status).toHaveTextContent('Map unavailable')
    expect(status).toHaveTextContent('The map could not load.')
  })

  it('paints the notice with no description when none is given', () => {
    render(frame({ apiKey: '', unavailableDescription: undefined }))
    expect(screen.getByRole('status')).toHaveTextContent('Map unavailable')
    expect(screen.getByRole('status').querySelector('.odc-state-text')).toBeNull()
  })

  it('the consumer can report an unavailable provider', () => {
    render(frame({ unavailable: true }))
    expect(screen.queryByTestId('map')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('swaps the map for the notice when the Google script is reported blocked', () => {
    render(frame())
    expect(screen.getByTestId('map')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'The Google Maps JavaScript API could not load.' }))
    })
    expect(screen.queryByTestId('map')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Map unavailable')
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-state', 'unavailable')
  })

  it('a child that throws does not take the page down: the notice appears and the rest stays', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(
      <main>
        <p>Form fields</p>
        <MapFrame label='Delivery map' apiKey='key' unavailableTitle='Map unavailable' onError={onError}><Boom /></MapFrame>
        <button type='button'>Save</button>
      </main>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Map unavailable')
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-state', 'unavailable')
    expect(screen.getByText('Form fields')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe('map exploded')
  })

  it('a map that fails while it has the focus hands it to the frame, not to <body>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Focusable = ({ fail }) => {
      if (fail) throw new Error('late failure')
      return <button type='button'>Zoom in</button>
    }
    const ui = fail => (
      <MapFrame label='Delivery map' apiKey='key' unavailableTitle='Map unavailable'><Focusable fail={fail} /></MapFrame>
    )
    const { rerender } = render(ui(false))
    screen.getByRole('button', { name: 'Zoom in' }).focus()
    rerender(ui(true))
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Delivery map' }))
  })

  it('tries the map again when resetKey changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let broken = true
    const Flaky = () => {
      if (broken) throw new Error('flaky')
      return <div data-testid='map' />
    }
    const ui = key => <MapFrame label='Delivery map' apiKey='key' unavailableTitle='Map unavailable' resetKey={key}><Flaky /></MapFrame>
    const { rerender } = render(ui(1))
    expect(screen.getByRole('status')).toBeInTheDocument()
    broken = false
    rerender(ui(2))
    expect(screen.getByTestId('map')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-state', 'ready')
  })

  it('takes its height from a token, never from a literal or an inline style', () => {
    render(frame())
    const region = screen.getByRole('region', { name: 'Delivery map' })
    expect(region).not.toHaveAttribute('style')
    expect(region).toHaveAttribute('data-size', 'default')
    expect(css).toMatch(/\.odc-map-frame\s*\{[^}]*block-size:\s*var\(--od-x-map-height\);/)
    expect(css).toMatch(/\[data-size='compact'\]\s*\{\s*block-size:\s*var\(--od-x-map-height-compact\);/)
    expect(css).toMatch(/\[data-size='fill'\]\s*\{[^}]*min-block-size:\s*var\(--od-x-map-height-compact\);/)
    expect(css).toMatch(/\.odc-map-frame\s*\{[^}]*inline-size:\s*100%;[^}]*max-inline-size:\s*100%;[^}]*overflow:\s*hidden;/)
    expect(css).toMatch(/border-radius:\s*var\(--od-radius-component\)/)
    expect(css).toMatch(/border:\s*var\(--od-x-hairline\)\s+solid\s+var\(--od-border\)/)
  })

  it.each(['compact', 'fill'])('size %s reaches data-size', size => {
    render(frame({ size }))
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveAttribute('data-size', size)
  })

  it('throws on an unknown size', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(frame({ size: 'huge' }))).toThrow('MapFrame size must be one of')
  })

  it('paints no actions of its own', () => {
    render(frame({ apiKey: '' }))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('forwards the ref and extra attributes, and merges className', () => {
    const ref = React.createRef()
    render(frame({ ref, className: 'mine', 'data-qa': 'x' }))
    expect(ref.current).toBe(screen.getByRole('region', { name: 'Delivery map' }))
    expect(ref.current).toHaveClass('odc-map-frame', 'mine')
    expect(ref.current).toHaveAttribute('data-qa', 'x')
  })

  describe('contract', () => {
    beforeEachSilence()

    it.each([undefined, null])('throws without a label (%s)', label => {
      expect(() => render(frame({ label }))).toThrow('MapFrame needs a label')
    })

    it.each([undefined, null])('throws without an unavailableTitle (%s)', unavailableTitle => {
      expect(() => render(frame({ unavailableTitle }))).toThrow('MapFrame needs an unavailableTitle')
    })

    it('an empty label and an empty title paint empty, they do not throw', () => {
      render(frame({ label: '', unavailableTitle: '', apiKey: '' }))
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('status').querySelector('.odc-state-title')).toHaveTextContent('')
    })
  })
})

function beforeEachSilence () {
  vi.spyOn(console, 'error').mockImplementation(() => {})
}
