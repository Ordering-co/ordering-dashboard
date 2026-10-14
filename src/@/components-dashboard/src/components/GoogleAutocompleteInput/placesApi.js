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
  'regularOpeningHours',
  'location',
  'photos'
]

const PRICE_LEVELS = {
  FREE: 0,
  INEXPENSIVE: 1,
  MODERATE: 2,
  EXPENSIVE: 3,
  VERY_EXPENSIVE: 4
}

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
        prediction: placePrediction
      }
    })
}

const toLegacyAddressComponents = (components) => (components || []).map(component => ({
  long_name: component.longText,
  short_name: component.shortText,
  types: component.types || []
}))

export const fetchNewPlace = async (prediction) => {
  const place = prediction.toPlace()
  await place.fetchFields({ fields: NEW_PLACE_FIELDS })
  return {
    place_id: place.id,
    formatted_address: place.formattedAddress,
    address_components: toLegacyAddressComponents(place.addressComponents),
    geometry: { location: place.location },
    utc_offset_minutes: place.utcOffsetMinutes
  }
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

const toLegacyPricePoint = (priceLevel) => {
  if (priceLevel === null || priceLevel === undefined) return undefined
  const key = `${priceLevel}`.replace('PRICE_LEVEL_', '')
  return PRICE_LEVELS[key]
}

const toLegacyTimePoint = (point) => {
  if (!point) return point
  const hours = point.hour ?? 0
  const minutes = point.minute ?? 0
  return {
    day: point.day,
    hours,
    minutes,
    time: `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`
  }
}

const toLegacyPhoto = (photo) => ({
  getUrl: (options) => photo.getURI(options || { maxWidth: 1600 })
})

export const fetchNewBusinessDetails = async (placeId) => {
  const place = new window.google.maps.places.Place({ id: placeId })
  await place.fetchFields({ fields: NEW_BUSINESS_FIELDS })
  const periods = place.regularOpeningHours?.periods
  return {
    place_id: place.id,
    name: place.displayName,
    international_phone_number: place.internationalPhoneNumber,
    price_level: toLegacyPricePoint(place.priceLevel),
    formatted_address: place.formattedAddress,
    geometry: { location: place.location },
    opening_hours: periods
      ? {
          periods: periods.map(period => ({
            open: toLegacyTimePoint(period.open),
            close: toLegacyTimePoint(period.close)
          }))
        }
      : undefined,
    photos: (place.photos || []).map(toLegacyPhoto)
  }
}

export const fetchLegacyBusinessDetails = (map, placeId) => new Promise((resolve, reject) => {
  const service = new window.google.maps.places.PlacesService(map)
  service.getDetails({ placeId }, (place, status) => {
    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
      resolve(place)
      return
    }
    reject(new Error(`PlacesService.getDetails failed: ${status}`))
  })
})

export const fetchBusinessDetails = async (map, placeId) => {
  const canUseNew = !!window.google?.maps?.places?.Place && getPlacesApiMode() !== PLACES_API_LEGACY
  if (canUseNew) {
    try {
      const details = await fetchNewBusinessDetails(placeId)
      setPlacesApiMode(PLACES_API_NEW)
      return details
    } catch (error) {
      if (getPlacesApiMode() === PLACES_API_NEW) throw error
      if (isPlacesApiNotEnabledError(error)) setPlacesApiMode(PLACES_API_LEGACY)
    }
  }
  return fetchLegacyBusinessDetails(map, placeId)
}
