const EARTH_RADIUS_METERS = 6371000

const isBlank = (value) => value === null || value === undefined || value === ''

export const toRoutePoint = (location) => {
  if (isBlank(location?.lat) || isBlank(location?.lng)) return null
  const lat = Number(location.lat)
  const lng = Number(location.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export const buildRoutePoints = (driverRoute) => {
  if (!Array.isArray(driverRoute)) return []
  return driverRoute.reduce((points, row) => {
    const point = toRoutePoint(row?.location)
    if (point) points.push({ ...point, status: Number(row?.status) })
    return points
  }, [])
}

const getStatusChangeTimes = (messages) => {
  const times = {}
  if (!Array.isArray(messages)) return times
  messages.forEach((message) => {
    if (message?.type !== 1 || message?.change?.attribute !== 'status') return
    const status = Number(message.change.new)
    if (!(status in times)) times[status] = message.created_at ?? null
  })
  return times
}

export const buildStatusStops = (routePoints, messages) => {
  const times = getStatusChangeTimes(messages)
  const seen = new Set()
  return routePoints.reduce((stops, point) => {
    if (seen.has(point.status)) return stops
    seen.add(point.status)
    stops.push({ ...point, at: times[point.status] ?? null })
    return stops
  }, [])
}

export const formatStopNumbers = (numbers) => {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const ranges = []
  sorted.forEach((number) => {
    const last = ranges[ranges.length - 1]
    if (last && number === last[1] + 1) last[1] = number
    else ranges.push([number, number])
  })
  return ranges.map(([from, to]) => {
    if (from === to) return String(from)
    if (to === from + 1) return `${from},${to}`
    return `${from}-${to}`
  }).join(',')
}

export const groupStopsByPosition = (stops) => {
  const groups = []
  const byKey = {}
  stops.forEach((stop, index) => {
    const key = `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`
    if (!byKey[key]) {
      byKey[key] = { lat: stop.lat, lng: stop.lng, numbers: [], stops: [] }
      groups.push(byKey[key])
    }
    byKey[key].numbers.push(index + 1)
    byKey[key].stops.push(stop)
  })
  return groups
}

export const distanceInMeters = (from, to) => {
  const a = toRoutePoint(from)
  const b = toRoutePoint(to)
  if (!a || !b) return null
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const buildStopsCsv = ({ headers, orderId, driverName, driverId, stops, getStatusLabel, formatDate }) => {
  const rows = stops.map((stop, index) => [
    orderId,
    index + 1,
    getStatusLabel(stop.status),
    stop.at ? formatDate(stop.at) : '',
    stop.lat,
    stop.lng,
    driverName,
    driverId
  ])
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}

export const getDeliveryDistance = (stops, customerLocation) => {
  const delivered = stops.find(stop => stop.status === 11)
  if (!delivered) return null
  return distanceInMeters(delivered, customerLocation)
}
