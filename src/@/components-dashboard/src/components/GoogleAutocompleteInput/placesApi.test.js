import { vi, it, expect, afterEach } from 'vitest'
import { fetchGoogleBusiness, searchNearbyBusinesses, waitForGooglePlaces, getPlacesApiMode, setPlacesApiMode, isPlacesApiNotEnabledError, LEGACY_BUSINESS_FIELDS } from './placesApi'

afterEach(() => {
  delete window.google
  setPlacesApiMode(null)
})

const legacyPlace = { place_id: 'place-1', name: 'Legacy Store', formatted_address: 'Legacy address', types: ['establishment'] }

const mockGoogle = (Place, { nearbySearch } = {}) => {
  const getDetails = vi.fn((request, callback) => callback(legacyPlace, 'OK'))
  window.google = {
    maps: {
      places: {
        Place,
        PlacesService: vi.fn(() => ({ getDetails, nearbySearch })),
        PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
        SearchNearbyRankPreference: { DISTANCE: 'DISTANCE' }
      }
    }
  }
  return getDetails
}

it('normalizes Places API (New) business details for the business forms', async () => {
  const getURI = vi.fn(({ maxWidth }) => `https://photo.example/${maxWidth}`)
  const Place = vi.fn(function ({ id }) {
    this.id = id
    this.fetchFields = vi.fn(async ({ fields }) => {
      expect(fields).toEqual(expect.arrayContaining(['websiteURI', 'businessStatus', 'regularOpeningHours', 'photos']))
      Object.assign(this, {
        displayName: 'Soet Muisberg',
        internationalPhoneNumber: '+27 21 000 0000',
        priceLevel: 'MODERATE',
        formattedAddress: '1 Main Rd, Cape Town',
        location: { lat: () => -33.92, lng: () => 18.42 },
        regularOpeningHours: { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } }] },
        types: ['restaurant', 'establishment'],
        photos: [{ getURI, authorAttributions: [] }]
      })
    })
  })
  const getDetails = mockGoogle(Place)

  const business = await fetchGoogleBusiness({ placeId: 'place-1' })

  expect(Place).toHaveBeenCalledWith({ id: 'place-1' })
  expect(business).toMatchObject({
    placeId: 'place-1',
    name: 'Soet Muisberg',
    phone: '+27 21 000 0000',
    priceLevel: 2,
    address: '1 Main Rd, Cape Town',
    location: { lat: -33.92, lng: 18.42 },
    isBusiness: true
  })
  expect(business.schedule[1].lapses).toEqual([{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 30 } }])
  expect(business.photos[0].url).toBe('https://photo.example/1600')
  expect(getDetails).not.toHaveBeenCalled()
  expect(getPlacesApiMode()).toBe('new')
})

it('reuses the autocomplete prediction so the details request closes the session', async () => {
  const place = { id: 'place-9', fetchFields: vi.fn(async () => Object.assign(place, { displayName: 'From session' })) }
  const prediction = { toPlace: vi.fn(() => place) }
  const Place = vi.fn()
  mockGoogle(Place)

  const business = await fetchGoogleBusiness({ placeId: 'place-9', prediction })

  expect(prediction.toPlace).toHaveBeenCalledOnce()
  expect(Place).not.toHaveBeenCalled()
  expect(business.name).toBe('From session')
})

it('normalizes a place picked through the legacy widget without another request', async () => {
  const Place = vi.fn()
  const getDetails = mockGoogle(Place)

  const business = await fetchGoogleBusiness({ placeId: 'place-1', place: legacyPlace })

  expect(business).toMatchObject({ placeId: 'place-1', name: 'Legacy Store' })
  expect(Place).not.toHaveBeenCalled()
  expect(getDetails).not.toHaveBeenCalled()
})

it('falls back to PlacesService.getDetails when Places API (New) is not enabled', async () => {
  const Place = vi.fn(function () {
    this.fetchFields = vi.fn(async () => { throw new Error('Places API (New) has not been used in project') })
  })
  const getDetails = mockGoogle(Place)

  const business = await fetchGoogleBusiness({ placeId: 'place-1' })

  expect(business).toMatchObject({ placeId: 'place-1', name: 'Legacy Store' })
  expect(getDetails).toHaveBeenCalledWith({ placeId: 'place-1', fields: LEGACY_BUSINESS_FIELDS }, expect.any(Function))
  expect(getPlacesApiMode()).toBe('legacy')
})

it('tries the legacy service on a transient Places API (New) error without locking legacy mode', async () => {
  const Place = vi.fn(function () {
    this.fetchFields = vi.fn(async () => { throw new Error('Failed to fetch') })
  })
  const getDetails = mockGoogle(Place)

  const business = await fetchGoogleBusiness({ placeId: 'place-1' })

  expect(business.name).toBe('Legacy Store')
  expect(getDetails).toHaveBeenCalledOnce()
  expect(getPlacesApiMode()).toBeNull()
})

it('uses the legacy service directly once legacy mode was detected', async () => {
  const Place = vi.fn()
  const getDetails = mockGoogle(Place)
  setPlacesApiMode('legacy')

  await fetchGoogleBusiness({ placeId: 'place-1' })

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

  await expect(fetchGoogleBusiness({ placeId: 'place-1' })).rejects.toThrow('NOT_FOUND')
})

it('lists only establishments found around an address', async () => {
  const Place = vi.fn()
  Place.searchNearby = vi.fn(async () => ({
    places: [
      { id: 'a', displayName: 'Pizza Place', formattedAddress: '1 Main St', primaryTypeDisplayName: 'Pizza restaurant', types: ['establishment'] },
      { id: 'b', displayName: '1 Main St', formattedAddress: '1 Main St', types: ['premise'] }
    ]
  }))
  mockGoogle(Place)

  const businesses = await searchNearbyBusinesses({ lat: 1, lng: 2 })

  expect(Place.searchNearby).toHaveBeenCalledWith(expect.objectContaining({
    locationRestriction: { center: { lat: 1, lng: 2 }, radius: 50 },
    rankPreference: 'DISTANCE'
  }))
  expect(businesses).toEqual([{ placeId: 'a', name: 'Pizza Place', address: '1 Main St', category: 'Pizza restaurant' }])
})

it('searches nearby businesses with the legacy service in legacy mode', async () => {
  const nearbySearch = vi.fn((request, callback) => callback([
    { place_id: 'c', name: 'Cafe', vicinity: '2 Main St', types: ['cafe', 'establishment'] }
  ], 'OK'))
  mockGoogle(vi.fn(), { nearbySearch })
  setPlacesApiMode('legacy')

  const businesses = await searchNearbyBusinesses({ lat: 1, lng: 2 })

  expect(nearbySearch).toHaveBeenCalledWith({ location: { lat: 1, lng: 2 }, radius: 50, type: 'establishment' }, expect.any(Function))
  expect(businesses).toEqual([{ placeId: 'c', name: 'Cafe', address: '2 Main St', category: '' }])
})

it('waits for the Maps SDK to load before asking Google for a place from a deep link', async () => {
  vi.useFakeTimers()
  const Place = vi.fn(function ({ id }) {
    this.id = id
    this.fetchFields = vi.fn(async () => Object.assign(this, { displayName: 'Loaded later' }))
  })
  const pending = fetchGoogleBusiness({ placeId: 'place-1' })
  await vi.advanceTimersByTimeAsync(300)
  expect(Place).not.toHaveBeenCalled()
  mockGoogle(Place)
  await vi.advanceTimersByTimeAsync(100)
  await expect(pending).resolves.toMatchObject({ name: 'Loaded later' })
  vi.useRealTimers()
})

it('gives up waiting for the Maps SDK after the timeout', async () => {
  vi.useFakeTimers()
  const pending = waitForGooglePlaces(500)
  const assertion = expect(pending).rejects.toThrow('google_places_not_loaded')
  await vi.advanceTimersByTimeAsync(700)
  await assertion
  vi.useRealTimers()
})

it('detects Places API (New) being unavailable for the project or the key', () => {
  expect(isPlacesApiNotEnabledError(new Error('Places API (New) has not been used in project 1 before or it is disabled.'))).toBe(true)
  expect(isPlacesApiNotEnabledError(new Error('Requests to this API places.googleapis.com method google.maps.places.v1.Places.GetPlace are blocked.'))).toBe(true)
  expect(isPlacesApiNotEnabledError({ code: 'PERMISSION_DENIED', message: 'Request denied' })).toBe(true)
  expect(isPlacesApiNotEnabledError({ code: 7, message: 'Request denied' })).toBe(true)
  expect(isPlacesApiNotEnabledError(new Error('Failed to fetch'))).toBe(false)
})
