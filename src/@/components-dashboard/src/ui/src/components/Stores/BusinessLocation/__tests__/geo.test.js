// redesign stores 5.3 (G2-13): the time zone and reverse geocoding lookups never throw and never ask without a key.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTimezone, reverseGeocode } from '../geo'

const json = body => Promise.resolve({ json: () => Promise.resolve(body) })

afterEach(() => {
  delete window.google
})

describe('fetchTimezone', () => {
  it('asks Google with the point and the key and normalizes the zone', async () => {
    const fetchImpl = vi.fn().mockReturnValue(json({ status: 'OK', timeZoneId: 'Europe/Kiev' }))
    const result = await fetchTimezone({ lat: 50.45, lng: 30.52 }, 'maps-key', fetchImpl)
    expect(result).toEqual({ ok: true, timezone: 'Europe/Kyiv' })
    const url = new URL(fetchImpl.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/timezone/json')
    expect(url.searchParams.get('location')).toBe('50.45,30.52')
    expect(url.searchParams.get('key')).toBe('maps-key')
  })

  it('does not ask without a key or a point', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchTimezone({ lat: 1, lng: 2 }, undefined, fetchImpl)).toEqual({ ok: false })
    expect(await fetchTimezone({ lat: undefined, lng: 2 }, 'k', fetchImpl)).toEqual({ ok: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('answers { ok: false } for a refused request, a bad answer or a network failure', async () => {
    expect(await fetchTimezone({ lat: 1, lng: 2 }, 'k', () => json({ status: 'REQUEST_DENIED' }))).toEqual({ ok: false })
    expect(await fetchTimezone({ lat: 1, lng: 2 }, 'k', () => Promise.resolve({ json: () => Promise.reject(new Error('bad')) }))).toEqual({ ok: false })
    expect(await fetchTimezone({ lat: 1, lng: 2 }, 'k', () => Promise.reject(new Error('offline')))).toEqual({ ok: false })
  })
})

describe('reverseGeocode', () => {
  const withGeocoder = (results, status = 'OK') => {
    window.google = {
      maps: {
        Geocoder: class {
          geocode (request, callback) { callback(results, status) }
        }
      }
    }
  }

  it('gives the formatted address and the postal code of the point', async () => {
    withGeocoder([{ formatted_address: 'Gran Vía 2, Madrid', address_components: [{ types: ['postal_code'], short_name: '28014' }] }])
    expect(await reverseGeocode({ lat: 40.42, lng: -3.71 })).toEqual({ ok: true, address: 'Gran Vía 2, Madrid', zipcode: '28014' })
  })

  it('answers { ok: false } without Maps, with no result or a failed status', async () => {
    expect(await reverseGeocode({ lat: 1, lng: 2 })).toEqual({ ok: false })
    withGeocoder([], 'ZERO_RESULTS')
    expect(await reverseGeocode({ lat: 1, lng: 2 })).toEqual({ ok: false })
  })
})
