import { fromLegacyPlace, fromNewPlace, isGoogleBusiness } from '../../utils/googleBusinessPrefill'

export const PLACES_API_NEW = 'new'
export const PLACES_API_LEGACY = 'legacy'

const NEW_PLACE_FIELDS = [
  'id',
  'formattedAddress',
  'addressComponents',
  'location',
  'utcOffsetMinutes'
]

const NEW_BUSINESS_FIELDS = [
  'id',
  'displayName',
  'internationalPhoneNumber',
  'priceLevel',
  'formattedAddress',
  'addressComponents',
  'regularOpeningHours',
  'location',
  'websiteURI',
  'googleMapsURI',
  'primaryTypeDisplayName',
  'businessStatus',
  'types',
  'photos'
]

export const LEGACY_BUSINESS_FIELDS = [
  'place_id',
  'name',
  'international_phone_number',
  'price_level',
  'formatted_address',
  'address_components',
  'opening_hours',
  'geometry',
  'website',
  'url',
  'business_status',
  'types',
  'photos'
]

const NEARBY_FIELDS = ['id', 'displayName', 'formattedAddress', 'primaryTypeDisplayName', 'types']

const NEARBY_RADIUS_METERS = 50

const NEARBY_MAX_RESULTS = 10

const PLACES_READY_TIMEOUT_MS = 15000

const PERMISSION_DENIED_CODES = [7, 'PERMISSION_DENIED']

const NOT_ENABLED_PATTERNS = [
  /has not been used/i,
  /is disabled/i,
  /not enabled/i,
  /are blocked/i,
  /API_KEY_SERVICE_BLOCKED/i,
  /PERMISSION_DENIED/i,
  /not authorized to use this API/i
]

let placesApiMode = null

export const isPlacesApiNotEnabledError = (error) => {
  if (PERMISSION_DENIED_CODES.includes(error?.code)) return true
  const message = error?.message || `${error ?? ''}`
  return NOT_ENABLED_PATTERNS.some(pattern => pattern.test(message))
}

export const getPlacesApiMode = () => placesApiMode

export const setPlacesApiMode = (mode) => {
  placesApiMode = mode
}

export const isNewPlacesApiAvailable = () => !!window.google?.maps?.places?.AutocompleteSuggestion

export const createSessionToken = () => {
  const SessionToken = window.google?.maps?.places?.AutocompleteSessionToken
  return SessionToken ? new SessionToken() : undefined
}

const toRegionCodes = (countryCode) => {
  if (!countryCode || countryCode === '*') return []
  const codes = Array.isArray(countryCode) ? countryCode : `${countryCode}`.split(',')
  return codes.map(code => `${code}`.trim().toLowerCase()).filter(Boolean)
}

export const fetchNewSuggestions = async ({ input, sessionToken, types, countryCode }) => {
  const request = { input }
  if (sessionToken) request.sessionToken = sessionToken
  if (types?.length) request.includedPrimaryTypes = types
  const regionCodes = toRegionCodes(countryCode)
  if (regionCodes.length) request.includedRegionCodes = regionCodes

  const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)

  return (suggestions || [])
    .filter(suggestion => suggestion?.placePrediction)
    .map(({ placePrediction }) => {
      const text = placePrediction.text?.text ?? ''
      return {
        placeId: placePrediction.placeId,
        text,
        mainText: placePrediction.mainText?.text ?? text,
        secondaryText: placePrediction.secondaryText?.text ?? '',
        types: placePrediction.types || [],
        prediction: placePrediction
      }
    })
}

const toLegacyAddressComponents = (components) => (components || []).map(component => ({
  long_name: component.longText,
  short_name: component.shortText,
  types: component.types || []
}))

const toLegacyAddressPlace = (place) => ({
  place_id: place.id,
  formatted_address: place.formattedAddress,
  address_components: toLegacyAddressComponents(place.addressComponents),
  geometry: { location: place.location },
  utc_offset_minutes: place.utcOffsetMinutes
})

export const fetchNewPlace = async (prediction) => {
  const place = prediction.toPlace()
  await place.fetchFields({ fields: NEW_PLACE_FIELDS })
  return toLegacyAddressPlace(place)
}

export const isValidLegacyPlace = (place) => {
  if (!Array.isArray(place?.address_components) || typeof place?.formatted_address !== 'string' ||
    typeof place?.geometry?.location?.lat !== 'function' || typeof place?.geometry?.location?.lng !== 'function') return false
  const lat = place.geometry.location.lat()
  const lng = place.geometry.location.lng()
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export const placeToAddress = (place) => {
  if (!place?.address_components) return null

  const addressObj = {
    street_number: null,
    neighborhood: null,
    route: null,
    city_name: null,
    locality: null,
    sublocality: null,
    country: null,
    country_code: null,
    state: null,
    state_code: null,
    zipcode: null
  }
  const cityFallback = place.address_components.find(component => component.types?.includes('administrative_area_level_2'))
  for (const component of place.address_components) {
    const addressType = component.types?.[0]
    if (addressType === 'postal_code') {
      addressObj.zipcode = component.short_name
    }
    if (addressType === 'street_number') {
      addressObj.street_number = component.long_name
    }
    if (addressType === 'neighborhood') {
      addressObj.neighborhood = component.long_name
    }
    if (addressType === 'route') {
      addressObj.route = component.long_name
    }
    if (addressType === 'locality') {
      addressObj.city_name = component.long_name || cityFallback?.long_name
      addressObj.locality = component.long_name
    }
    if (component.types?.includes('sublocality')) {
      addressObj.sublocality = component.long_name
    }
    if (addressType === 'country') {
      addressObj.country = component.long_name
      addressObj.country_code = component.short_name
    }
    if (addressType === 'administrative_area_level_1') {
      addressObj.state = component.long_name
      addressObj.state_code = component.short_name
    }
  }

  return {
    address: place.formatted_address,
    location: {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    },
    utc_offset: place.utc_offset_minutes,
    map_data: {
      library: 'google',
      place_id: place.place_id
    },
    ...addressObj
  }
}

const createLegacyService = () => new window.google.maps.places.PlacesService(document.createElement('div'))

const fetchLegacyDetails = (placeId, fields) => new Promise((resolve, reject) => {
  createLegacyService().getDetails({ placeId, fields }, (place, status) => {
    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
      resolve(place)
      return
    }
    reject(new Error(`PlacesService.getDetails failed: ${status}`))
  })
})

const fetchLegacyNearby = (location) => new Promise((resolve, reject) => {
  createLegacyService().nearbySearch({ location, radius: NEARBY_RADIUS_METERS, type: 'establishment' }, (results, status) => {
    const statuses = window.google.maps.places.PlacesServiceStatus
    if (status === statuses.OK || status === statuses.ZERO_RESULTS) {
      resolve(results || [])
      return
    }
    reject(new Error(`PlacesService.nearbySearch failed: ${status}`))
  })
})

export const waitForGooglePlaces = (timeout = PLACES_READY_TIMEOUT_MS) => new Promise((resolve, reject) => {
  const isReady = () => !!window.google?.maps?.places
  if (isReady()) {
    resolve()
    return
  }
  const startedAt = Date.now()
  const timer = setInterval(() => {
    if (isReady()) {
      clearInterval(timer)
      resolve()
    } else if (Date.now() - startedAt > timeout) {
      clearInterval(timer)
      reject(new Error('google_places_not_loaded'))
    }
  }, 100)
})

const canUseNewPlace = () => !!window.google?.maps?.places?.Place && getPlacesApiMode() !== PLACES_API_LEGACY

const withLegacyFallback = async (runNew, runLegacy) => {
  await waitForGooglePlaces()
  if (canUseNewPlace()) {
    try {
      const result = await runNew()
      setPlacesApiMode(PLACES_API_NEW)
      return result
    } catch (error) {
      if (getPlacesApiMode() === PLACES_API_NEW) throw error
      if (isPlacesApiNotEnabledError(error)) setPlacesApiMode(PLACES_API_LEGACY)
    }
  }
  return runLegacy()
}

const toNewPlace = ({ placeId, prediction }) => prediction?.toPlace
  ? prediction.toPlace()
  : new window.google.maps.places.Place({ id: placeId })

export const fetchGoogleBusiness = async ({ placeId, prediction, place }) => {
  if (place) return fromLegacyPlace(place)
  return withLegacyFallback(
    async () => {
      const target = toNewPlace({ placeId, prediction })
      await target.fetchFields({ fields: NEW_BUSINESS_FIELDS })
      return fromNewPlace(target)
    },
    async () => fromLegacyPlace(await fetchLegacyDetails(placeId, LEGACY_BUSINESS_FIELDS))
  )
}

export const fetchGoogleAddress = async ({ placeId, prediction, place }) => {
  if (place) return placeToAddress(place)
  return withLegacyFallback(
    async () => {
      const target = toNewPlace({ placeId, prediction })
      await target.fetchFields({ fields: NEW_PLACE_FIELDS })
      return placeToAddress(toLegacyAddressPlace(target))
    },
    async () => placeToAddress(await fetchLegacyDetails(placeId, ['place_id', 'formatted_address', 'address_components', 'geometry', 'utc_offset_minutes']))
  )
}

export const searchNearbyBusinesses = async (location) => withLegacyFallback(
  async () => {
    const { places } = await window.google.maps.places.Place.searchNearby({
      fields: NEARBY_FIELDS,
      locationRestriction: { center: location, radius: NEARBY_RADIUS_METERS },
      maxResultCount: NEARBY_MAX_RESULTS,
      rankPreference: window.google.maps.places.SearchNearbyRankPreference?.DISTANCE
    })
    return (places || [])
      .filter(place => isGoogleBusiness(place.types))
      .map(place => ({ placeId: place.id, name: place.displayName || '', address: place.formattedAddress || '', category: place.primaryTypeDisplayName || '' }))
  },
  async () => (await fetchLegacyNearby(location))
    .filter(place => isGoogleBusiness(place.types))
    .slice(0, NEARBY_MAX_RESULTS)
    .map(place => ({ placeId: place.place_id, name: place.name || '', address: place.vicinity || '', category: '' }))
)
