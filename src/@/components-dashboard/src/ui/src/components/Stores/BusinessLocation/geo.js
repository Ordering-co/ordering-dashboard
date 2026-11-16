// redesign stores 5.3 (G2-13): the two lookups of Store details › Location, with their failures handled. Neither throws:
// each answers `{ ok: true, … }` or `{ ok: false }`.
import { normalizeTimezone } from '../../../../../utils'

const finite = value => typeof value === 'number' && Number.isFinite(value)

/**
 * The time zone of a point, from Google's Time Zone API (the same request as before). Without a key or a point it does not ask.
 */
export const fetchTimezone = async ({ lat, lng } = {}, apiKey, fetchImpl = (...args) => window.fetch(...args)) => {
  if (!apiKey || !finite(lat) || !finite(lng)) return { ok: false }
  const timestamp = Math.floor(Date.now() / 1000)
  const params = new URLSearchParams({ location: `${lat},${lng}`, timestamp: String(timestamp), key: apiKey })
  try {
    const response = await fetchImpl(`https://maps.googleapis.com/maps/api/timezone/json?${params}`, { method: 'GET' })
    const result = await response.json()
    if (result?.status === 'OK' && result?.timeZoneId) return { ok: true, timezone: normalizeTimezone(result.timeZoneId) }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

/**
 * The address at a point (reverse geocoding with the Maps SDK already loaded): its formatted text and its postal code.
 */
export const reverseGeocode = ({ lat, lng } = {}) => new Promise(resolve => {
  const Geocoder = window.google?.maps?.Geocoder
  if (!Geocoder || !finite(lat) || !finite(lng)) return resolve({ ok: false })
  try {
    new Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      const first = Array.isArray(results) ? results[0] : null
      if ((status && status !== 'OK') || !first?.formatted_address) return resolve({ ok: false })
      const postal = (first.address_components || []).find(component => component.types?.includes('postal_code'))
      resolve({ ok: true, address: first.formatted_address, zipcode: postal?.short_name ?? null })
    })
  } catch {
    resolve({ ok: false })
  }
})
