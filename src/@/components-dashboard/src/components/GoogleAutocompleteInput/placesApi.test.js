import { vi, it, expect, afterEach } from 'vitest'
import { fetchBusinessDetails, getPlacesApiMode, setPlacesApiMode, isPlacesApiNotEnabledError } from './placesApi'

afterEach(() => {
  delete window.google
  setPlacesApiMode(null)
})

const legacyPlace = { name: 'Legacy Store', formatted_address: 'Legacy address' }

const mockGoogle = (Place) => {
  const getDetails = vi.fn((request, callback) => callback(legacyPlace, 'OK'))
  window.google = {
    maps: {
      places: {
        Place,
        PlacesService: vi.fn(() => ({ getDetails })),
        PlacesServiceStatus: { OK: 'OK' }
      }
    }
  }
  return getDetails
}

it('maps Places API (New) business details to the legacy shape used by BusinessAdd', async () => {
  const location = { lat: () => -33.92, lng: () => 18.42 }
  const getURI = vi.fn(() => 'https://photo.example/1')
  const Place = vi.fn(function ({ id }) {
    this.id = id
    this.fetchFields = vi.fn(async () => {
      Object.assign(this, {
        displayName: 'Soet Muisberg',
        internationalPhoneNumber: '+27 21 000 0000',
        priceLevel: 'MODERATE',
        formattedAddress: '1 Main Rd, Cape Town',
        location,
        regularOpeningHours: {
          periods: [
            { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } },
            { open: { day: 0, hour: 0, minute: 0 }, close: null }
          ]
        },
        photos: [{ getURI }]
      })
    })
  })
  const getDetails = mockGoogle(Place)

  const details = await fetchBusinessDetails({}, 'place-1')

  expect(Place).toHaveBeenCalledWith({ id: 'place-1' })
  expect(details).toMatchObject({
    place_id: 'place-1',
    name: 'Soet Muisberg',
    international_phone_number: '+27 21 000 0000',
    price_level: 2,
    formatted_address: '1 Main Rd, Cape Town',
    geometry: { location },
    opening_hours: {
      periods: [
        { open: { day: 1, hours: 9, minutes: 0, time: '0900' }, close: { day: 1, hours: 17, minutes: 30, time: '1730' } },
        { open: { day: 0, hours: 0, minutes: 0, time: '0000' }, close: null }
      ]
    }
  })
  expect(details.photos[0].getUrl()).toBe('https://photo.example/1')
  expect(getURI).toHaveBeenCalledWith({ maxWidth: 1600 })
  expect(getDetails).not.toHaveBeenCalled()
  expect(getPlacesApiMode()).toBe('new')
})

it('falls back to PlacesService.getDetails when Places API (New) is not enabled', async () => {
  const Place = vi.fn(function () {
    this.fetchFields = vi.fn(async () => { throw new Error('Places API (New) has not been used in project') })
  })
  const getDetails = mockGoogle(Place)

  const details = await fetchBusinessDetails({}, 'place-1')

  expect(details).toBe(legacyPlace)
  expect(getDetails).toHaveBeenCalledWith({ placeId: 'place-1' }, expect.any(Function))
  expect(getPlacesApiMode()).toBe('legacy')
})

it('tries the legacy service on a transient Places API (New) error without locking legacy mode', async () => {
  const Place = vi.fn(function () {
    this.fetchFields = vi.fn(async () => { throw new Error('Failed to fetch') })
  })
  const getDetails = mockGoogle(Place)

  const details = await fetchBusinessDetails({}, 'place-1')

  expect(details).toBe(legacyPlace)
  expect(getDetails).toHaveBeenCalledOnce()
  expect(getPlacesApiMode()).toBeNull()
})

it('uses the legacy service directly once legacy mode was detected', async () => {
  const Place = vi.fn()
  const getDetails = mockGoogle(Place)
  setPlacesApiMode('legacy')

  await fetchBusinessDetails({}, 'place-1')

  expect(Place).not.toHaveBeenCalled()
  expect(getDetails).toHaveBeenCalledOnce()
})

it('rejects when the legacy service does not return the place', async () => {
  window.google = {
    maps: {
      places: {
        PlacesService: vi.fn(() => ({ getDetails: (request, callback) => callback(null, 'NOT_FOUND') })),
        PlacesServiceStatus: { OK: 'OK' }
      }
    }
  }

  await expect(fetchBusinessDetails({}, 'place-1')).rejects.toThrow('NOT_FOUND')
})

it('detects Places API (New) being unavailable for the project or the key', () => {
  expect(isPlacesApiNotEnabledError(new Error('Places API (New) has not been used in project 1 before or it is disabled.'))).toBe(true)
  expect(isPlacesApiNotEnabledError(new Error('Requests to this API places.googleapis.com method google.maps.places.v1.Places.GetPlace are blocked.'))).toBe(true)
  expect(isPlacesApiNotEnabledError({ code: 'PERMISSION_DENIED', message: 'Request denied' })).toBe(true)
  expect(isPlacesApiNotEnabledError({ code: 7, message: 'Request denied' })).toBe(true)
  expect(isPlacesApiNotEnabledError(new Error('Failed to fetch'))).toBe(false)
})
