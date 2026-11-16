/* eslint-disable import/first */
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign fix-qa E9: the map div carries an inline `position: absolute; width: 70%; height: 50%` that no stylesheet
// can beat. `fillContainer` is the opt-in for the surfaces that give the map a box of their own (order detail,
// create-order wizard); without it the element is exactly what it always was.
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [{ emit: vi.fn() }] }))
vi.mock('../../../contexts/UtilsContext', () => ({ useUtils: () => [{ optimizeImage: value => value }] }))

import { GoogleMaps } from '..'

const created = []

beforeEach(() => {
  created.length = 0
  window.google = {
    maps: {
      Map: function Map (element, options) { created.push({ element, options }); this.addListener = vi.fn(); this.panTo = vi.fn() },
      Marker: function Marker () { this.setPosition = vi.fn(); this.getPosition = vi.fn() },
      LatLng: function LatLng (lat, lng) { this.lat = () => lat; this.lng = () => lng },
      LatLngBounds: function LatLngBounds () { this.extend = vi.fn() },
      event: { addListener: vi.fn(), clearListeners: vi.fn() }
    }
  }
})

afterEach(() => {
  cleanup()
  delete window.google
})

const mount = (extra = {}) => render(
  <GoogleMaps googleReady location={{ lat: 1, lng: 2 }} mapControls={{ defaultZoom: 15 }} {...extra} />
)

describe('GoogleMaps box', () => {
  it('keeps its absolute 70% x 50% box by default (every other screen)', () => {
    const { container } = mount()
    const box = container.querySelector('#map')
    expect(box.style.position).toBe('absolute')
    expect(box.style.width).toBe('70%')
    expect(box.style.height).toBe('50%')
  })

  it('fills the box its parent gives it when fillContainer is set', () => {
    const { container } = mount({ fillContainer: true })
    const box = container.querySelector('#map')
    expect(box.style.position).toBe('relative')
    expect(box.style.width).toBe('100%')
    expect(box.style.height).toBe('100%')
    expect(created).toHaveLength(1)
    expect(created[0].element).toBe(box)
  })
})
