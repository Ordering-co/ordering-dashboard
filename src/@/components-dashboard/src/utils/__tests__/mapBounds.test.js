// redesign W1-2 (T1-4)
import { describe, expect, it } from 'vitest'
import { fitBounds } from 'google-map-react'

import { boundsFor, boundsOf, collectPoints, defaultCenter, parseLocation } from '../mapBounds'

const FB = { lat: 40.7744146, lng: -73.9678064 }
const OTHER = { lat: 1, lng: 2 }

describe('parseLocation', () => {
  it('accepts numeric objects', () => {
    expect(parseLocation({ lat: 10.5, lng: -20.25 }, FB)).toEqual({ lat: 10.5, lng: -20.25 })
  })
  it('accepts numeric strings inside objects and returns numbers', () => {
    expect(parseLocation({ lat: '10.5', lng: '-20' }, FB)).toEqual({ lat: 10.5, lng: -20 })
  })
  it('keeps zero coordinates (equator, meridian)', () => {
    expect(parseLocation({ lat: 0, lng: 0 }, FB)).toEqual({ lat: 0, lng: 0 })
  })
  it('parses "lat,lng" strings, cleaning stray characters', () => {
    expect(parseLocation('10.5,-20.25', FB)).toEqual({ lat: 10.5, lng: -20.25 })
    expect(parseLocation('(10.5), -20.25)', FB)).toEqual({ lat: 10.5, lng: -20.25 })
    expect(parseLocation(' 10.5 , -20.25 ', FB)).toEqual({ lat: 10.5, lng: -20.25 })
  })
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['string without comma', '10.5'],
    ['comma only', ','],
    ['letters', 'a,b'],
    ['one side empty', '10,'],
    ['NaN string', 'NaN,NaN'],
    ['number', 5],
    ['boolean', true],
    ['array', [1, 2]],
    ['empty object', {}],
    ['missing lng', { lat: 1 }],
    ['NaN', { lat: NaN, lng: 1 }],
    ['Infinity', { lat: Infinity, lng: 1 }],
    ['null members', { lat: null, lng: null }],
    ['empty string members', { lat: '', lng: '' }],
    ['lat out of range', { lat: 91, lng: 0 }],
    ['lng out of range', { lat: 0, lng: -181 }],
    ['string out of range', '95,10']
  ])('falls back on %s without throwing', (_name, value) => {
    expect(() => parseLocation(value, OTHER)).not.toThrow()
    expect(parseLocation(value, OTHER)).toBe(OTHER)
  })
  it('does not throw on hostile objects', () => {
    const hostile = { get lat () { throw new Error('boom') }, lng: 1 }
    expect(parseLocation(hostile, OTHER)).toBe(OTHER)
  })
})

describe('defaultCenter', () => {
  it('uses the project configs', () => {
    expect(defaultCenter({ location_default_latitude: { value: '4.6' }, location_default_longitude: { value: '-74.1' } }))
      .toEqual({ lat: 4.6, lng: -74.1 })
  })
  it.each([undefined, null, {}, { location_default_latitude: { value: 'x' }, location_default_longitude: { value: '1' } }])(
    'falls back for %j', (configs) => {
      expect(defaultCenter(configs)).toEqual(FB)
    })
})

describe('collectPoints', () => {
  it('parses each, replacing invalid with the fallback', () => {
    expect(collectPoints([{ lat: 1, lng: 2 }, '3,4', null, '', undefined], FB))
      .toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, FB, FB, FB])
  })
  it('returns [] for non arrays', () => {
    expect(collectPoints(undefined, FB)).toEqual([])
    expect(collectPoints(null, FB)).toEqual([])
  })
})

describe('boundsOf', () => {
  it('returns null without valid points', () => {
    expect(boundsOf([])).toBeNull()
    expect(boundsOf(undefined)).toBeNull()
    expect(boundsOf([null, { lat: NaN, lng: 1 }])).toBeNull()
  })
  it('returns the enclosing ne/sw', () => {
    expect(boundsOf([{ lat: 1, lng: 5 }, { lat: -3, lng: 9 }, { lat: 2, lng: -4 }]))
      .toEqual({ ne: { lat: 2, lng: 9 }, sw: { lat: -3, lng: -4 } })
  })

  // W1-PA1-06: the smallest arc that holds the points can cross ±180 (Fiji). Like google's LatLngBounds, sw.lng > ne.lng then.
  describe('across the antimeridian', () => {
    it('returns the short arc for points at 179 and -179', () => {
      expect(boundsOf([{ lat: -17, lng: 179 }, { lat: -18, lng: -179 }]))
        .toEqual({ ne: { lat: -17, lng: -179 }, sw: { lat: -18, lng: 179 } })
    })
    it('does not depend on the order of the points', () => {
      expect(boundsOf([{ lat: -18, lng: -179 }, { lat: -17, lng: 179 }]))
        .toEqual({ ne: { lat: -17, lng: -179 }, sw: { lat: -18, lng: 179 } })
    })
    it('keeps the points in between on the short arc', () => {
      expect(boundsOf([{ lat: 0, lng: 170 }, { lat: 1, lng: -175 }, { lat: 2, lng: 179 }, { lat: 3, lng: 180 }]))
        .toEqual({ ne: { lat: 3, lng: -175 }, sw: { lat: 0, lng: 170 } })
    })
    it('keeps min/max when the points are on one side or the wrap gap is the biggest', () => {
      expect(boundsOf([{ lat: 0, lng: 100 }, { lat: 0, lng: 170 }]).sw.lng).toBe(100)
      expect(boundsOf([{ lat: 0, lng: -179 }, { lat: 0, lng: -100 }]).ne.lng).toBe(-100)
      expect(boundsOf([{ lat: 0, lng: -60 }, { lat: 0, lng: 60 }]))
        .toEqual({ ne: { lat: 0, lng: 60 }, sw: { lat: 0, lng: -60 } })
    })
    it('keeps min/max for a single point and for equal points', () => {
      expect(boundsOf([{ lat: 1, lng: 179 }])).toEqual({ ne: { lat: 1, lng: 179 }, sw: { lat: 1, lng: 179 } })
      expect(boundsOf([{ lat: 1, lng: -180 }, { lat: 2, lng: -180 }]).sw.lng).toBe(-180)
    })
  })
})

describe('boundsFor', () => {
  const base = { width: 800, height: 600, defaultZoom: 10, fitBounds }
  const spread = [{ lat: 40.7, lng: -74 }, { lat: 40.9, lng: -73.8 }, { lat: 40.8, lng: -73.9 }]

  it('matches the old inline calculation for valid inputs', () => {
    // The two old copies: LatLngBounds.extend (min/max), then fitBounds(newBounds, mapSize).
    const old = (points) => {
      const lats = points.map((p) => p.lat)
      const lngs = points.map((p) => p.lng)
      const newBounds = {
        ne: { lat: Math.max(...lats), lng: Math.max(...lngs) },
        sw: { lat: Math.min(...lats), lng: Math.min(...lngs) }
      }
      return { ...fitBounds(newBounds, { width: 800, height: 600 }), newBounds }
    }
    for (const points of [spread, spread.slice(0, 2), [{ lat: -34.6, lng: -58.4 }, { lat: 4.7, lng: -74.1 }]]) {
      const expected = old(points)
      const got = boundsFor(points, base)
      expect(got.center).toEqual(expected.center)
      expect(got.zoom).toBe(expected.zoom)
      expect(got.bounds).toEqual(expected.newBounds)
    }
  })
  // W1-PA1-06: 179 and -179 are 2 degrees apart; the min/max box was the whole world (zoom 1)
  it('zooms to the short arc across the antimeridian', () => {
    const got = boundsFor([{ lat: -17, lng: 179 }, { lat: -18, lng: -179 }], base)
    expect(got.zoom).toBe(9)
    expect(got.bounds.sw.lng).toBe(179)
    expect(got.bounds.ne.lng).toBe(-179)
    expect(Math.abs(got.center.lng)).toBe(180)
  })
  it('centres on a single point with the default zoom (old: zoom 1)', () => {
    expect(boundsFor([spread[0]], base)).toMatchObject({ center: spread[0], zoom: 10 })
  })
  it('does the same when all points are equal', () => {
    const p = { lat: 40.7744146, lng: -73.9678064 }
    expect(boundsFor([p, { ...p }, { ...p }], base)).toMatchObject({ center: p, zoom: 10 })
    expect(fitBounds({ ne: p, sw: p }, { width: 800, height: 600 }).zoom).toBe(1)
  })
  it('does not adjust with zero or invalid size', () => {
    expect(boundsFor(spread, { ...base, width: 0 })).toBeNull()
    expect(boundsFor(spread, { ...base, height: 0 })).toBeNull()
    expect(boundsFor(spread, { ...base, width: undefined })).toBeNull()
    expect(boundsFor([spread[0]], { ...base, width: 0 })).toBeNull()
  })
  it('does not adjust without points', () => {
    expect(boundsFor([], base)).toBeNull()
    expect(boundsFor(undefined, base)).toBeNull()
    expect(boundsFor(spread)).toBeNull()
  })
  it('returns null when fitBounds gives nothing usable', () => {
    expect(boundsFor(spread, { ...base, fitBounds: () => ({ center: null, zoom: null }) })).toBeNull()
    expect(boundsFor(spread, { ...base, fitBounds: () => undefined })).toBeNull()
    expect(boundsFor(spread, { ...base, fitBounds: undefined })).toBeNull()
  })
  it('calls the injected fitBounds with bounds and size', () => {
    const calls = []
    boundsFor(spread, { ...base, fitBounds: (...args) => { calls.push(args); return { center: spread[0], zoom: 7 } } })
    expect(calls).toEqual([[{ ne: { lat: 40.9, lng: -73.8 }, sw: { lat: 40.7, lng: -74 } }, { width: 800, height: 600 }]])
  })
})
