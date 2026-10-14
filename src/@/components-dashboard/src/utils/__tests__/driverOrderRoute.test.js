import { describe, expect, it } from 'vitest'

import {
  buildRoutePoints,
  buildStopsCsv,
  buildStatusStops,
  distanceInMeters,
  formatStopNumbers,
  getDeliveryDistance,
  groupStopsByPosition,
  toRoutePoint
} from '../driverOrderRoute'

const route = [
  { status: 8, location: { lat: 20.6766007, lng: -103.3474992 } },
  { status: 3, location: { lat: 20.6766, lng: -103.3474983 } },
  { status: 3, location: { v: '1.0', lat: 20.6767, lng: -103.3474, mock: false } },
  { status: 9, location: {} },
  { status: 9, location: { lat: '20.6766', lng: '-103.3474983' } },
  { status: 11, location: { lat: 20.6618883, lng: -103.4239533 } }
]

const messages = [
  { type: 1, change: { attribute: 'status', old: 0, new: 7 }, created_at: '2026-10-13 16:06:48' },
  { type: 1, change: { attribute: 'status', old: 7, new: 8 }, created_at: '2026-10-13 16:09:08' },
  { type: 2, comment: 'hi', created_at: '2026-10-13 16:10:00' },
  { type: 1, change: { attribute: 'status', old: 8, new: 3 }, created_at: '2026-10-13 16:12:20' },
  { type: 1, change: { attribute: 'status', old: 23, new: 3 }, created_at: '2026-10-13 16:12:53' },
  { type: 1, change: { attribute: 'driver_id', old: null, new: 9 }, created_at: '2026-10-13 16:08:00' },
  { type: 1, change: { attribute: 'status', old: 26, new: 11 }, created_at: '2026-10-13 16:15:06' }
]

describe('driverOrderRoute', () => {
  it('normalizes coordinates and rejects locations without them', () => {
    expect(toRoutePoint({ lat: '20.5', lng: '-103.1' })).toEqual({ lat: 20.5, lng: -103.1 })
    expect(toRoutePoint({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 })
    expect(toRoutePoint({})).toBeNull()
    expect(toRoutePoint(null)).toBeNull()
    expect(toRoutePoint({ lat: null, lng: null })).toBeNull()
    expect(toRoutePoint({ lat: '', lng: '' })).toBeNull()
    expect(toRoutePoint({ lat: 'abc', lng: 1 })).toBeNull()
  })

  it('keeps the route order and drops points without coordinates', () => {
    const points = buildRoutePoints(route)
    expect(points).toHaveLength(5)
    expect(points.map(point => point.status)).toEqual([8, 3, 3, 9, 11])
    expect(points[3]).toEqual({ lat: 20.6766, lng: -103.3474983, status: 9 })
    expect(buildRoutePoints(undefined)).toEqual([])
  })

  it('takes the first point of each status and the time of its first status change', () => {
    const stops = buildStatusStops(buildRoutePoints(route), messages)
    expect(stops).toEqual([
      { status: 8, lat: 20.6766007, lng: -103.3474992, at: '2026-10-13 16:09:08' },
      { status: 3, lat: 20.6766, lng: -103.3474983, at: '2026-10-13 16:12:20' },
      { status: 9, lat: 20.6766, lng: -103.3474983, at: null },
      { status: 11, lat: 20.6618883, lng: -103.4239533, at: '2026-10-13 16:15:06' }
    ])
  })

  it('compresses stop numbers into ranges', () => {
    expect(formatStopNumbers([1, 2, 3, 5])).toBe('1-3,5')
    expect(formatStopNumbers([8, 6, 7])).toBe('6-8')
    expect(formatStopNumbers([7, 8])).toBe('7,8')
    expect(formatStopNumbers([4])).toBe('4')
    expect(formatStopNumbers([1, 3, 3, 5, 6, 7, 9])).toBe('1,3,5-7,9')
  })

  it('groups the stops that share a position into one marker', () => {
    const stops = buildStatusStops(buildRoutePoints([
      { status: 8, location: { lat: 20.6766, lng: -103.3475 } },
      { status: 3, location: { lat: 20.676600001, lng: -103.3475 } },
      { status: 23, location: { lat: 20.7011, lng: -103.3619 } },
      { status: 9, location: { lat: 20.6766, lng: -103.3475 } }
    ]), [])
    const groups = groupStopsByPosition(stops)
    expect(groups.map(group => group.numbers)).toEqual([[1, 2, 4], [3]])
    expect(groups[0].stops.map(stop => stop.status)).toEqual([8, 3, 9])
    expect(groups[1]).toMatchObject({ lat: 20.7011, lng: -103.3619 })
  })

  it('builds one CSV row per stop and escapes commas and quotes', () => {
    const csv = buildStopsCsv({
      headers: ['Order', '#', 'Status', 'Date', 'Latitude', 'Longitude', 'Driver', 'Driver ID'],
      orderId: 218,
      driverName: 'Sara "La Rápida", Pérez',
      driverId: 9,
      stops: [
        { status: 8, lat: 20.6779483, lng: -103.34664, at: '2026-10-13 17:32:10' },
        { status: 9, lat: 20.6774085, lng: -103.3471987, at: null }
      ],
      getStatusLabel: (status) => (status === 8 ? 'Accepted by driver' : 'Pick up completed, by driver'),
      formatDate: (date) => `local ${date}`
    })

    expect(csv.split('\n')).toEqual([
      'Order,#,Status,Date,Latitude,Longitude,Driver,Driver ID',
      '218,1,Accepted by driver,local 2026-10-13 17:32:10,20.6779483,-103.34664,"Sara ""La Rápida"", Pérez",9',
      '218,2,"Pick up completed, by driver",,20.6774085,-103.3471987,"Sara ""La Rápida"", Pérez",9'
    ])
  })

  it('measures distances in meters', () => {
    expect(distanceInMeters({ lat: 20.6766, lng: -103.3475 }, { lat: 20.6766, lng: -103.3475 })).toBe(0)
    expect(distanceInMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, 0)
    expect(distanceInMeters({ lat: 20.6766, lng: -103.3475 }, {})).toBeNull()
  })

  it('reports how far from the customer the delivery was marked', () => {
    const stops = buildStatusStops(buildRoutePoints(route), messages)
    expect(getDeliveryDistance(stops, { lat: 20.66189, lng: -103.423954 })).toBeLessThan(5)
    expect(getDeliveryDistance(stops.filter(stop => stop.status !== 11), { lat: 20.66189, lng: -103.423954 })).toBeNull()
    expect(getDeliveryDistance(stops, null)).toBeNull()
  })
})
