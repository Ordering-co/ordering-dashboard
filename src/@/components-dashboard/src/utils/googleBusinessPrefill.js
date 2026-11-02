const PRICE_LEVELS = {
  FREE: 0,
  INEXPENSIVE: 1,
  MODERATE: 2,
  EXPENSIVE: 3,
  VERY_EXPENSIVE: 4
}

const MAX_PHOTOS = 10

const fullDay = () => ({ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } })

const toMinutes = point => point.hour * 60 + point.minute

const toPoint = point => ({ hour: point.hour ?? point.hours ?? 0, minute: point.minute ?? point.minutes ?? 0 })

const mergeLapses = lapses => [...lapses]
  .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))
  .reduce((merged, lapse) => {
    const last = merged[merged.length - 1]
    if (last && toMinutes(lapse.open) <= toMinutes(last.close)) {
      if (toMinutes(lapse.close) > toMinutes(last.close)) last.close = { ...lapse.close }
      return merged
    }
    return [...merged, { open: { ...lapse.open }, close: { ...lapse.close } }]
  }, [])

export const googleHoursToSchedule = (periods) => {
  if (!Array.isArray(periods) || !periods.length) return null
  const days = Array.from({ length: 7 }, () => [])
  periods.forEach(period => {
    if (!period?.open || !Number.isInteger(period.open.day)) return
    const day = period.open.day
    const open = toPoint(period.open)
    if (!period.close) {
      days.forEach(lapses => lapses.push(fullDay()))
      return
    }
    const close = toPoint(period.close)
    const span = (period.close.day - day + 7) % 7
    if (span === 0 && toMinutes(close) > toMinutes(open)) {
      days[day].push({ open, close })
      return
    }
    const length = span === 0 ? 7 : span
    days[day].push({ open, close: { hour: 23, minute: 59 } })
    for (let offset = 1; offset < length; offset++) days[(day + offset) % 7].push(fullDay())
    if (toMinutes(close) > 0) days[(day + length) % 7].push({ open: { hour: 0, minute: 0 }, close })
  })
  return days.map(lapses => lapses.length
    ? { enabled: true, lapses: mergeLapses(lapses) }
    : { enabled: false, lapses: [fullDay()] })
}

const toLatLng = (location) => {
  if (!location) return null
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

const toPriceLevel = (priceLevel) => {
  if (priceLevel === null || priceLevel === undefined) return null
  if (Number.isInteger(priceLevel)) return priceLevel
  return PRICE_LEVELS[`${priceLevel}`.replace('PRICE_LEVEL_', '')] ?? null
}

const findZipcode = components => components.find(component => component.types?.includes('postal_code'))?.short_name ?? null

const decodeHtml = text => text
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, '\'')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

const parseHtmlAttribution = (html) => {
  const match = /href="([^"]+)"[^>]*>([^<]*)</.exec(html || '')
  if (match) return { name: decodeHtml(match[2]), uri: match[1] }
  const name = decodeHtml(`${html || ''}`.replace(/<[^>]*>/g, '')).trim()
  return name ? { name, uri: null } : null
}

export const isGoogleBusiness = types => Array.isArray(types) && types.includes('establishment')

export const fromNewPlace = (place) => {
  const addressComponents = (place.addressComponents || []).map(component => ({
    long_name: component.longText,
    short_name: component.shortText,
    types: component.types || []
  }))
  return {
    placeId: place.id,
    name: place.displayName || '',
    phone: place.internationalPhoneNumber || '',
    address: place.formattedAddress || '',
    location: toLatLng(place.location),
    zipcode: findZipcode(addressComponents),
    schedule: googleHoursToSchedule(place.regularOpeningHours?.periods),
    priceLevel: toPriceLevel(place.priceLevel),
    website: place.websiteURI || '',
    mapsUrl: place.googleMapsURI || '',
    category: place.primaryTypeDisplayName || '',
    status: place.businessStatus || '',
    isBusiness: isGoogleBusiness(place.types),
    canCopyPhotos: true,
    photos: (place.photos || []).slice(0, MAX_PHOTOS).map((photo, index) => ({
      id: `photo-${index}`,
      thumbnailUrl: photo.getURI({ maxWidth: 400, maxHeight: 400 }),
      url: photo.getURI({ maxWidth: 1600 }),
      logoUrl: photo.getURI({ maxWidth: 512, maxHeight: 512 }),
      attributions: (photo.authorAttributions || []).map(author => ({ name: author.displayName, uri: author.uri || null }))
    }))
  }
}

export const fromLegacyPlace = (place) => {
  const addressComponents = place.address_components || []
  return {
    placeId: place.place_id,
    name: place.name || '',
    phone: place.international_phone_number || '',
    address: place.formatted_address || '',
    location: toLatLng(place.geometry?.location),
    zipcode: findZipcode(addressComponents),
    schedule: googleHoursToSchedule(place.opening_hours?.periods),
    priceLevel: toPriceLevel(place.price_level),
    website: place.website || '',
    mapsUrl: place.url || '',
    category: '',
    status: place.business_status || '',
    isBusiness: isGoogleBusiness(place.types),
    canCopyPhotos: false,
    photos: (place.photos || []).slice(0, MAX_PHOTOS).map((photo, index) => ({
      id: `photo-${index}`,
      thumbnailUrl: photo.getUrl({ maxWidth: 400, maxHeight: 400 }),
      url: photo.getUrl({ maxWidth: 1600 }),
      logoUrl: photo.getUrl({ maxWidth: 512, maxHeight: 512 }),
      attributions: (photo.html_attributions || []).map(parseHtmlAttribution).filter(Boolean)
    }))
  }
}

export const toE164 = phone => `${phone || ''}`.trim().startsWith('+') ? `+${phone.replace(/\D/g, '')}` : ''

const isBlank = value => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)

const isSame = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const clearedValue = (key, value, defaults) => {
  if (Object.prototype.hasOwnProperty.call(defaults, key)) return defaults[key]
  return typeof value === 'string' ? '' : undefined
}

export const mergePrefill = ({ current = {}, next = {}, applied = {}, defaults = {} }) => {
  const changes = {}
  const nextApplied = {}
  const suggestions = {}
  const groups = new Set([...Object.keys(next), ...Object.keys(applied)])
  groups.forEach(group => {
    const values = next[group]
    const previous = applied[group] || {}
    const keys = new Set([...Object.keys(values || {}), ...Object.keys(previous)])
    const owned = [...keys].every(key =>
      isBlank(current[key]) ||
      (Object.prototype.hasOwnProperty.call(defaults, key) && isSame(current[key], defaults[key])) ||
      (Object.prototype.hasOwnProperty.call(previous, key) && isSame(current[key], previous[key]))
    )
    const filled = Object.fromEntries(Object.entries(values || {}).filter(([, value]) => !isBlank(value)))
    const hasValues = Object.keys(filled).length > 0
    if (!owned) {
      if (hasValues && Object.keys(filled).some(key => !isSame(current[key], filled[key]))) suggestions[group] = filled
      return
    }
    Object.entries(filled).forEach(([key, value]) => {
      if (!isSame(current[key], value)) changes[key] = value
    })
    Object.entries(previous).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(filled, key) && isSame(current[key], value) && !isBlank(current[key])) changes[key] = clearedValue(key, value, defaults)
    })
    if (hasValues) nextApplied[group] = filled
  })
  return { changes, applied: nextApplied, suggestions }
}
