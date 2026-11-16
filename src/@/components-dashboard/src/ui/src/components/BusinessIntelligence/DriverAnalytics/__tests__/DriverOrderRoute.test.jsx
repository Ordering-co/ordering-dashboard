/* eslint-disable import/first */
// (port of «Driver route by order», main 5063dbb4): the card of /intelligence/drivers that looks up ONE order and paints where the
// driver was at each status change. The controller is the real one (`components/DriverOrderRoute` of ~components) with a simulated `fetch` and
// the contexts it reads stubbed; the map of `main` (`DriverRouteMap`, Google) is a stand-in that records what it is given. What is under test is
// the UI: the states, the summary, the table, the CSV and the CSS of the card.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const runtime = vi.hoisted(() => ({ configs: {}, map: null }))

vi.mock('../../../../../../index', async () => {
  const { DriverOrderRoute } = await import('../../../../../../components/DriverOrderRoute')
  return {
    DriverOrderRoute,
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useUtils: () => [{
      getOrderState: status => `State ${status}`,
      parseDate: date => `D(${date})`,
      parseDistance: meters => `${(meters / 1000).toFixed(1)} km`
    }]
  }
})
// the contexts the real controller reads
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v1/en' }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tkn' }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, text) => text] }))
// the map of `main` paints on Google Maps: here it records its props
vi.mock('../../AnalyticsDriverOrderRoute/DriverRouteMap', () => ({
  DriverRouteMap: props => {
    runtime.map = props
    return <div data-testid='driver-route-map' />
  }
}))
vi.mock('../../../../../../utils/businessReports', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: vi.fn()
}))

import { downloadCsv } from '../../../../../../utils/businessReports'
import { DriverOrderRoute } from '../DriverOrderRoute'

const ORDER_URL = /\/orders\/42\?mode=dashboard&params=/
const MESSAGES_URL = /\/orders\/42\/messages\?mode=dashboard/

const ROUTE = [
  { status: 7, location: { lat: '4.6000', lng: '-74.1000' } },
  { status: 7, location: { lat: '4.6001', lng: '-74.1001' } }, // the same status again: one stop per status
  { status: 8, location: { lat: '4.6100', lng: '-74.1100' } },
  { status: 9, location: { lat: '4.6200', lng: '-74.1200' } },
  { status: 11, location: { lat: '4.6300', lng: '-74.1300' } },
  { status: 4, location: { lat: 'x', lng: '1' } } // a point that cannot be read is left out
]
const MESSAGES = [
  { type: 1, created_at: '2026-10-01 10:00:00', change: { attribute: 'status', new: 7 } },
  { type: 1, created_at: '2026-10-01 10:10:00', change: { attribute: 'status', new: 8 } },
  { type: 1, created_at: '2026-10-01 10:30:00', change: { attribute: 'status', new: 11 } },
  { type: 0, created_at: '2026-10-01 10:40:00', comment: 'hello' }
]
const orderOf = (extra = {}) => ({
  id: 42,
  status: 11,
  driver_id: 9,
  driver: { id: 9, name: 'Ana', lastname: 'Pérez' },
  business: { name: 'Burger Place', location: { lat: 4.59, lng: -74.09 } },
  customer: { address: 'Calle 1 # 2-3', location: { lat: 4.6301, lng: -74.1301 } },
  driver_route: ROUTE,
  ...extra
})

// fetch simulated by URL; `pending` lets a test hold the answer to see the loading state
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const stubFetch = ({ order = { result: orderOf() }, messages = { result: MESSAGES } } = {}) => {
  const fetchMock = vi.fn((url) => {
    if (MESSAGES_URL.test(url)) return answer(messages)
    return answer(order)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const normal = (node) => node.textContent.replace(/\s+/g, ' ').trim()
const card = () => screen.getByRole('region', { name: 'Driver route by order' })
const search = async (value = '42') => {
  await userEvent.type(screen.getByRole('textbox', { name: 'Order number' }), value)
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
}
const tableRows = () => [...screen.getByRole('table', { name: 'Status changes' }).querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(normal))

beforeEach(() => {
  vi.clearAllMocks()
  runtime.map = null
  runtime.configs = { google_maps_api_key: { value: 'key' } }
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the card: initial state', () => {
  it('is a card named «Driver route by order» with its description and only the search (no table, no map, no summary)', () => {
    render(<DriverOrderRoute />)
    const root = card()
    expect(within(root).getByRole('heading', { level: 3, name: 'Driver route by order' })).toBeInTheDocument()
    expect(root).toHaveTextContent('Where the driver was at each status change of an order.')
    expect(within(root).getByRole('textbox', { name: 'Order number' })).toHaveAttribute('inputmode', 'numeric')
    expect(within(root).getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByTestId('driver-route-map')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the CSV is a real disabled button without data, named after the card', () => {
    render(<DriverOrderRoute />)
    expect(screen.getByRole('button', { name: 'Download CSV: Driver route by order' })).toBeDisabled()
  })

  it('«Search» is enabled once there is something typed, and the field is a native input with a label', async () => {
    render(<DriverOrderRoute />)
    const input = screen.getByRole('textbox', { name: 'Order number' })
    expect(input.tagName).toBe('INPUT')
    await userEvent.type(input, ' ')
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    await userEvent.type(input, '42')
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('type', 'submit')
  })
})

describe('a search that finds the order', () => {
  it('asks for the order and its messages with the token, and Enter in the field searches too', async () => {
    const fetchMock = stubFetch()
    render(<DriverOrderRoute />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Order number' }), '42{Enter}')
    await screen.findByRole('table', { name: 'Status changes' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map(call => call[0])
    expect(urls.some(url => ORDER_URL.test(url))).toBe(true)
    expect(urls.some(url => MESSAGES_URL.test(url))).toBe(true)
    fetchMock.mock.calls.forEach(call => expect(call[1].headers.Authorization).toBe('Bearer tkn'))
  })

  it('shows a skeleton while it loads (busy, search disabled) and then the result', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(url => gate.then(() => answer(MESSAGES_URL.test(url) ? { result: MESSAGES } : { result: orderOf() }))))
    const { container } = render(<DriverOrderRoute />)
    await search()
    expect(container.querySelector('[aria-busy="true"] .odc-skeleton')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"] .odc-sr-only')).toHaveTextContent('Loading')
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(screen.queryByRole('table')).toBeNull()
    release()
    await screen.findByRole('table', { name: 'Status changes' })
    expect(container.querySelector('.odc-skeleton')).toBeNull()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  it('paints the summary: order, driver (name and last name) and status', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('table', { name: 'Status changes' })
    const summary = card().querySelector('.odc-bi-route-summary')
    expect([...summary.querySelectorAll(':scope > div')].map(normal)).toEqual(['Order#42', 'DriverAna Pérez', 'StatusState 11'])
  })

  it('says «Not assigned» for an order without a driver', async () => {
    stubFetch({ order: { result: orderOf({ driver: null, driver_id: null }) } })
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('table', { name: 'Status changes' })
    expect(card().querySelector('.odc-bi-route-summary')).toHaveTextContent('Not assigned')
  })

  it('the table has headers # · Status · Date · Location and one row per status, in order, with the time of its change', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    const table = await screen.findByRole('table', { name: 'Status changes' })
    expect(within(table).getAllByRole('columnheader').map(normal)).toEqual(['#', 'Status', 'Date', 'Location'])
    expect(tableRows()).toEqual([
      ['1', 'State 7', 'D(2026-10-01 10:00:00)', '4.6, -74.1'],
      ['2', 'State 8', 'D(2026-10-01 10:10:00)', '4.61, -74.11'],
      ['3', 'State 9', '—', '4.62, -74.12'],
      ['4', 'State 11', 'D(2026-10-01 10:30:00)', '4.63, -74.13']
    ])
  })

  it('the table is a named scroll region, so at 390px it scrolls inside the card and does not widen the page', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('table', { name: 'Status changes' })
    expect(screen.getByRole('region', { name: 'Status changes' })).toHaveClass('odc-table-scroll')
  })

  it('draws the map of main with the stops, the business and the customer, the named markers and the legend', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByTestId('driver-route-map')
    expect(runtime.map.apiKey).toBe('key')
    expect(runtime.map.stops.map(stop => stop.status)).toEqual([7, 8, 9, 11])
    expect(runtime.map.businessLocation).toEqual({ lat: 4.59, lng: -74.09 })
    expect(runtime.map.customerLocation).toEqual({ lat: 4.6301, lng: -74.1301 })
    expect(runtime.map.businessTitle).toBe('Burger Place')
    expect(runtime.map.customerTitle).toBe('Calle 1 # 2-3')
    expect(runtime.map.getStopTitle(runtime.map.stops[1], 1)).toBe('2. State 8')
    expect(Object.keys(runtime.map.colors).sort()).toEqual(['business', 'customer', 'stop'])
    expect(screen.getByRole('region', { name: 'Driver route by order' }).querySelector('.odc-map-frame')).toHaveAttribute('data-state', 'ready')
    const legend = card().querySelector('.odc-bi-route-legend')
    expect([...legend.querySelectorAll('li')].map(normal)).toEqual(['BBusiness', 'CCustomer', '1Status changes'])
  })

  it('says how far from the customer the delivery was marked (meters under 1000, the project\'s distance above)', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByTestId('driver-route-map')
    expect(normal(card().querySelector('.odc-bi-route-distance'))).toMatch(/^Delivery was marked 1[56](\.\d+)? m from the customer's address\.$/)
  })

  it('writes a distance of 1000 m or more with the project\'s distance format', async () => {
    stubFetch({ order: { result: orderOf({ customer: { address: 'Far', location: { lat: 4.7, lng: -74.2 } } }) } })
    render(<DriverOrderRoute />)
    await search()
    await screen.findByTestId('driver-route-map')
    expect(normal(card().querySelector('.odc-bi-route-distance'))).toMatch(/^Delivery was marked \d+\.\d km from the customer's address\.$/)
  })

  it('has no distance when no status 11 was recorded', async () => {
    stubFetch({ order: { result: orderOf({ driver_route: ROUTE.filter(point => point.status !== 11) }) } })
    render(<DriverOrderRoute />)
    await search()
    await screen.findByTestId('driver-route-map')
    expect(card().querySelector('.odc-bi-route-distance')).toBeNull()
  })

  it('the CSV downloads driver_route_order_<id>.csv with the header of main and one row per status', async () => {
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('table', { name: 'Status changes' })
    const button = screen.getByRole('button', { name: 'Download CSV: Driver route by order' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(downloadCsv).toHaveBeenCalledTimes(1)
    const [fileName, csv] = downloadCsv.mock.calls[0]
    expect(fileName).toBe('driver_route_order_42.csv')
    expect(csv.split('\n')).toEqual([
      'Order,#,Status,Date,Latitude,Longitude,Driver,Driver ID',
      '42,1,State 7,D(2026-10-01 10:00:00),4.6,-74.1,Ana Pérez,9',
      '42,2,State 8,D(2026-10-01 10:10:00),4.61,-74.11,Ana Pérez,9',
      '42,3,State 9,,4.62,-74.12,Ana Pérez,9',
      '42,4,State 11,D(2026-10-01 10:30:00),4.63,-74.13,Ana Pérez,9'
    ])
  })
})

describe('the states that are not data', () => {
  it('a non-numeric number says «Enter a valid order number» (an alert) and asks for nothing', async () => {
    const fetchMock = stubFetch()
    render(<DriverOrderRoute />)
    await search('4x2')
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid order number')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Order number' })).toBeInvalid()
    // review r1: the error is the field's own (described by it), not a block further down
    expect(screen.getByRole('textbox', { name: 'Order number' })).toHaveAccessibleDescription('Enter a valid order number')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Download CSV: Driver route by order' })).toBeDisabled()
  })

  it('an order that does not exist says «Order not found»', async () => {
    stubFetch({ order: { error: true, result: 'not found' } })
    render(<DriverOrderRoute />)
    await search()
    expect(await screen.findByRole('alert')).toHaveTextContent('Order not found')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a failed request shows its message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network down'))))
    render(<DriverOrderRoute />)
    await search()
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('an error disappears with the next search, and a good one replaces it', async () => {
    stubFetch({ order: { error: true } })
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('alert')
    stubFetch()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByRole('table', { name: 'Status changes' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an order with no recorded locations says so, keeps the summary and offers neither map nor table nor CSV', async () => {
    stubFetch({ order: { result: orderOf({ driver_route: [{ status: 7, location: null }] }) } })
    render(<DriverOrderRoute />)
    await search()
    expect(await screen.findByText('No driver locations were recorded for this order.')).toBeInTheDocument()
    expect(card().querySelector('.odc-bi-route-summary')).toHaveTextContent('#42')
    expect(screen.queryByTestId('driver-route-map')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Download CSV: Driver route by order' })).toBeDisabled()
  })

  it('without a Google Maps key the frame of the map says so, and the table and the CSV still work', async () => {
    runtime.configs = {}
    stubFetch()
    render(<DriverOrderRoute />)
    await search()
    await screen.findByRole('table', { name: 'Status changes' })
    const frame = card().querySelector('.odc-map-frame')
    expect(frame).toHaveAttribute('data-state', 'unavailable')
    expect(frame).toHaveTextContent('A Google Maps API key is required to show the map.')
    expect(screen.queryByTestId('driver-route-map')).toBeNull()
    expect(tableRows()).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Download CSV: Driver route by order' })).toBeEnabled()
  })
})

describe('DriverOrderRoute.jsx', () => {
  // the file is not in scripts/product-ui/governed-files.json yet (outside the scope of ): the guard is run on it here
  it('has no literal color or size (the map markers read their colors from tokens)', () => {
    const file = path.join(__dirname, '..', 'DriverOrderRoute.jsx')
    expect(scanSource(readFileSync(file, 'utf8'), file)).toEqual([])
  })

  it('does not import styled-components', () => {
    expect(readFileSync(path.join(__dirname, '..', 'DriverOrderRoute.jsx'), 'utf8')).not.toMatch(/styled-components/)
  })
})

describe('driver-order-route.css', () => {
  const file = path.join(__dirname, '..', 'driver-order-route.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only styles classes of its own (odc-bi-route-*) or those it frames (P/ field and button), as a child of the form', () => {
    const css = strip(read())
    const own = (css.match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-bi-route'))
    expect([...new Set(own)].sort()).toEqual(['.odc-btn', '.odc-field'])
    ;(css.match(/[^{}]+(?=\{)/g) ?? []).filter(selector => /\.odc-(?:field|btn)\b/.test(selector)).forEach(selector => {
      expect(selector.trim()).toMatch(/^\.odc-bi-route-search > \.odc-(?:field|btn)$/)
    })
  })

  // redesign «Order number» measured 32 px at 390 (main: 43). Touch target of 44 px with a coarse pointer or under 768 px, the same
  // media query as field.css, by the one variable that sets the height of both the field and the «Search» button beside it
  it('on a phone the search row takes the touch target as its control height (field and button)', () => {
    const css = strip(read())
    const block = /@media\s*\(pointer:\s*coarse\),\s*\(max-width:\s*767px\)\s*\{([\s\S]*?\n\})/.exec(css)
    expect(block, 'the phone media query').not.toBeNull()
    expect(block[1]).toMatch(/\.odc-bi-route-search\s*\{[^}]*--od-x-control-height:\s*var\(--od-x-target-coarse\);[^}]*\}/)
  })

  it('has its breakpoints on the numbers of the dashboard', () => {
    const widths = [...strip(read()).matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map(match => Number(match[1]))
    widths.forEach(width => expect([767, 768, 1024, 1280]).toContain(width))
  })
})
