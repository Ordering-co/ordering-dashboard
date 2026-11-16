/* eslint-disable import/first */
// redesign deliveries F2-B1 (decisions 3, 4, 5 and 8; DV-02, DV-03, DV-08, DV-10): the three-line dispatch card.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import moment from 'moment'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { DeliveryBoardContext } from '../../DeliveryDashboard/DeliveryBoardContext'

const translate = vi.fn((_key, fallback) => fallback)
let externalIdConfig = '0'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: { change_order_id: { value: externalIdConfig } } }],
  useLanguage: () => [{ dictionary: {} }, (key, fallback) => translate(key, fallback)],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: value => value
  }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440 }) }))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: vi.fn(),
  getOrderStatusPrefix: () => 'Accepted'
}))

import { OrdersCards } from '..'
import { slaParityCases } from '../../__tests__/slaParityCases'

const order = {
  id: 910001,
  status: 7,
  delivery_type: 1,
  delivery_datetime: '2026-09-15 08:30:00',
  time_status: 'in_time',
  business: { name: 'Synthetic Store Alpha', city: { name: 'Fixture City' } }
}

const Wrapper = ({ children, board = {} }) => (
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    <DeliveryBoardContext.Provider value={board}>
      {children}
    </DeliveryBoardContext.Provider>
  </ConfigFileContext.Provider>
)

const makeHandlers = () => ({
  handleOpenOrderDetail: vi.fn(),
  handleOrderCardClick: vi.fn(),
  getPageOrders: vi.fn()
})

const cardsFor = (orders, { loading = false, handlers, pagination, ...rest } = {}) => (
  <OrdersCards
    orderList={{ loading, orders }}
    franchisesList={{ loading: false, franchises: [] }}
    pagination={pagination}
    {...handlers}
    {...rest}
  />
)

const renderCards = (orders = [order], { board, ...options } = {}) => {
  const handlers = makeHandlers()
  const wrapper = ({ children }) => <Wrapper board={board}>{children}</Wrapper>
  const view = renderWithProviders(cardsFor(orders, { handlers, ...options }), { wrapper })
  return { ...view, ...handlers, handlers, rerenderCards: (next, more = {}) => view.rerender(cardsFor(next, { handlers, ...more })) }
}

// (T10, decision X-2): «On time» needs a closed order or an ETA still ahead, so these fixtures sit a day ahead
const aheadStamp = () => moment().add(1, 'day').format('YYYY-MM-DD HH:mm:ss')
const onTimeOrder = (overrides) => ({ ...order, delivery_datetime_utc: aheadStamp(), delivery_datetime: aheadStamp(), ...overrides })

const cardOf = () => document.querySelector('[data-delivery-card]')
const liveRegion = () => document.querySelector('[data-arrival-live]')

describe('delivery card · line 1: identity, status and SLA from the server (decision 8, DV-02, DV-10)', () => {
  it.each([
    ['in_time', 'On time'],
    ['at_risk', 'At risk'],
    ['delayed', 'Delayed']
  ])('shows the SLA badge in text for time_status %s', (timeStatus, text) => {
    renderCards([onTimeOrder({ time_status: timeStatus })])
    const badge = within(cardOf()).getByText(text)
    expect(badge).toBeInTheDocument()
    expect(badge.closest('[data-level]')).not.toBeNull()
  })

  it('maps the server value to the Product levels (ok, risk, late)', () => {
    const { rerenderCards } = renderCards([onTimeOrder({ time_status: 'in_time' })])
    expect(cardOf().querySelector('[data-level="ok"]')).not.toBeNull()
    rerenderCards([{ ...order, time_status: 'at_risk' }])
    expect(cardOf().querySelector('[data-level="risk"]')).not.toBeNull()
    rerenderCards([{ ...order, time_status: 'delayed' }])
    expect(cardOf().querySelector('[data-level="late"]')).not.toBeNull()
  })

  it('shows no SLA badge when the server sends no time_status', () => {
    renderCards([{ ...order, time_status: undefined }])
    expect(cardOf().querySelector('[data-level]')).toBeNull()
  })

  it('shows the delay figure neutral (no colour class), in a figure node, named ETA', () => {
    const late = { ...order, time_status: 'delayed', delivery_datetime: '2000-01-01 00:00:00', delivery_datetime_utc: '2000-01-01 00:00:00' }
    renderCards([late])
    const eta = cardOf().querySelector('[title="ETA"]')
    expect(eta).not.toBeNull()
    expect(eta).toHaveAccessibleName(/ETA/)
    const figure = eta.querySelector('.odc-figure')
    expect(figure).not.toBeNull()
    expect(figure.textContent).toMatch(/^- \d+ days? \d{2}:\d{2}$|^- \d{2}:\d{2}$/)
    for (const node of [eta, figure]) {
      expect(node.className).not.toMatch(/in_time|at_risk|delayed/)
      expect(node.getAttribute('data-status')).toBeNull()
    }
    // isolated for the right-to-left languages (DV-03)
    expect(figure.closest('bdi') || figure.tagName === 'BDI').toBeTruthy()
  })

  it('paints no status bar (the colour-only signal is gone) and no «Timer» label', () => {
    renderCards([{ ...order, time_status: 'delayed' }])
    expect(cardOf().querySelector('[data-status-bar]')).toBeNull()
    expect(screen.queryByText('Timer')).toBeNull()
  })

  it('shows the status with P/Status (family and exact text), not a bare paragraph', () => {
    renderCards()
    const status = cardOf().querySelector('.odc-status')
    expect(status).not.toBeNull()
    expect(status).toHaveAttribute('data-family', 'progress')
    expect(status).toHaveTextContent('Accepted')
  })

  it('names the reservation status as before (type 9 + status 13)', () => {
    renderCards([{ ...order, delivery_type: 9, status: 13 }])
    expect(cardOf().querySelector('.odc-status')).toHaveTextContent('Reservation')
  })

  it('writes the number as «#» plus the figure in its own isolated node', () => {
    renderCards()
    const heading = cardOf().querySelector('h2')
    const figure = heading.querySelector('bdi.odc-figure')
    expect(figure).not.toBeNull()
    expect(figure.textContent).toBe('910001')
    expect(heading.textContent).toMatch(/#\s*910001/)
  })

  it('keeps the external id when change_order_id is on, as before', () => {
    externalIdConfig = '1'
    try {
      renderCards([{ ...order, external_id: 'EXT-42' }])
      expect(cardOf().querySelector('h2 bdi.odc-figure').textContent).toBe('EXT-42')
      expect(screen.getByRole('button', { name: /EXT-42/ })).toBeInTheDocument()
    } finally {
      externalIdConfig = '0'
    }
  })
})

describe('delivery card · line 2: the trip and the hour', () => {
  it('shows store, city, an arrow and the customer destination when the order carries it', () => {
    renderCards([{ ...order, customer: { zipcode: '77388' } }])
    const scope = within(cardOf())
    expect(scope.getByText('Synthetic Store Alpha')).toBeInTheDocument()
    expect(scope.getByText('Fixture City')).toBeInTheDocument()
    expect(scope.getByText('77388')).toBeInTheDocument()
    // the arrow is decoration
    expect(cardOf().querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  // in Arabic a Latin store or city name in a plain span took the right-to-left direction, so the ellipsis cut
  // its start («…'s Cafe»). Each name is isolated in its own direction, like the destination.
  it('isolates the store and the city names, so a cut name keeps its start in right-to-left', () => {
    renderCards()
    expect(cardOf().querySelector('.odc-dcard-store').tagName).toBe('BDI')
    expect(cardOf().querySelector('.odc-dcard-city').tagName).toBe('BDI')
  })

  it('invents no destination when the order has none', () => {
    renderCards()
    expect(cardOf().querySelector('[data-destination]')).toBeNull()
  })

  it('paints the store logo as a business avatar, with initials as the fallback', () => {
    renderCards()
    const avatar = cardOf().querySelector('.odc-avatar[data-kind="business"]')
    expect(avatar).not.toBeNull()
    expect(avatar).toHaveTextContent('SA')
    renderCards([{ ...order, id: 910009, business: { ...order.business, logo: 'https://example.test/logo.png' } }])
    expect(document.querySelector('.odc-avatar[data-kind="business"] img')).toHaveAttribute('src', 'https://example.test/logo.png')
  })

  it('isolates the delivery hour (DV-03)', () => {
    renderCards()
    const hour = within(cardOf()).getByText('2026-09-15 08:30:00')
    expect(hour.closest('bdi') || (hour.closest('[dir]') && hour.closest('[dir]').getAttribute('dir'))).toBeTruthy()
  })

  it('uses delivery_datetime_utc when the order has it, as before', () => {
    renderCards([{ ...order, delivery_datetime_utc: '2026-09-15 13:30:00' }])
    expect(within(cardOf()).getByText('2026-09-15 13:30:00')).toBeInTheDocument()
  })

  it('keeps «Created at» and «Placed to» for catering, and the Pod', () => {
    renderCards([{ ...order, delivery_type: 7, created_at: '2026-09-14 10:00:00', codigoPod: 'POD-77' }])
    const scope = within(cardOf())
    expect(scope.getByText(/Created at:/)).toHaveTextContent('Created at: 2026-09-14 10:00:00')
    expect(scope.getByText(/Placed to:/)).toHaveTextContent('Placed to: 2026-09-15 08:30:00')
    expect(scope.getByText(/Pod:/)).toHaveTextContent('Pod: POD-77')
  })

  it('shows no catering dates for a regular order', () => {
    renderCards()
    expect(screen.queryByText(/Created at/)).toBeNull()
    expect(screen.queryByText(/Placed to/)).toBeNull()
  })
})

describe('delivery card · line 3: driver, call and assign (decision 3)', () => {
  const driver = { name: 'Fixture Driver', cellphone: '5550101' }

  it('shows the driver with an avatar and the name, and no Unassigned', () => {
    renderCards([{ ...order, driver }])
    const scope = within(cardOf())
    expect(scope.getByText('Fixture Driver')).toBeInTheDocument()
    expect(cardOf().querySelector('.odc-avatar[data-kind="person"]')).toHaveTextContent('FD')
    expect(scope.queryByText('Unassigned')).toBeNull()
    expect(scope.queryByText('No Driver')).toBeNull()
  })

  it('gives the phone as a call link with tel: and the name «Call _name_», not as plain text', () => {
    renderCards([{ ...order, driver }])
    const call = screen.getByRole('link', { name: 'Call Fixture Driver' })
    expect(call).toHaveAttribute('href', 'tel:5550101')
    expect(call).toHaveAttribute('data-card-action')
    expect(within(cardOf()).queryByText('5550101')).toBeNull()
  })

  it('does not select the card when the call link is used', async () => {
    const user = userEvent.setup()
    const { handleOrderCardClick } = renderCards([{ ...order, driver }])
    const call = screen.getByRole('link', { name: 'Call Fixture Driver' })
    call.addEventListener('click', event => event.preventDefault())
    await user.click(call)
    expect(handleOrderCardClick).not.toHaveBeenCalled()
  })

  it('shows no call link when the driver has no phone', () => {
    renderCards([{ ...order, driver: { name: 'Fixture Driver' } }])
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows the external driver and the company name, as before', () => {
    renderCards([{ ...order, external_driver: { name: 'Outside Rider' }, driver_company: { name: 'Fleet Co' } }])
    const scope = within(cardOf())
    expect(scope.getByText('Outside Rider')).toBeInTheDocument()
    expect(scope.getByText('Fleet Co')).toBeInTheDocument()
  })

  it('shows the company name when the order is for a delivery company', () => {
    renderCards([{ ...order, driver_company_id: 4, driver_company: { name: 'Fleet Co' } }], { board: { canAssign: () => true } })
    expect(within(cardOf()).getByText('Fleet Co')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Assign/ })).toBeNull()
  })

  it('says «Unassigned» with no Assign button outside the board (no context)', () => {
    renderCards()
    expect(within(cardOf()).getByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Assign/ })).toBeNull()
  })

  it('says «Unassigned» with no Assign button when the board says the user cannot assign', () => {
    renderCards([order], { board: { canAssign: () => false, requestAssign: vi.fn() } })
    expect(within(cardOf()).getByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Assign/ })).toBeNull()
  })

  it('shows Assign only when the board says so, named with the order', () => {
    const canAssign = vi.fn(() => true)
    renderCards([order], { board: { canAssign, requestAssign: vi.fn() } })
    const assign = screen.getByRole('button', { name: 'Assign a driver to order 910001' })
    expect(assign).toHaveTextContent('Assign')
    expect(assign).toHaveAttribute('data-card-action')
    expect(canAssign).toHaveBeenCalledWith(order)
  })

  it('calls requestAssign with the order, and does not select the card', async () => {
    const user = userEvent.setup()
    const requestAssign = vi.fn()
    const { handleOrderCardClick, handleOpenOrderDetail } = renderCards([order], { board: { canAssign: () => true, requestAssign } })
    await user.click(screen.getByRole('button', { name: 'Assign a driver to order 910001' }))
    expect(requestAssign).toHaveBeenCalledOnce()
    expect(requestAssign).toHaveBeenCalledWith(order)
    expect(handleOrderCardClick).not.toHaveBeenCalled()
    expect(handleOpenOrderDetail).not.toHaveBeenCalled()
  })

  it.each([
    ['a driver', { driver }],
    ['an external driver', { external_driver: { name: 'Outside Rider' } }],
    ['a driver company id', { driver_company_id: 4 }],
    ['a driver company', { driver_company: { name: 'Fleet Co' } }]
  ])('shows no Assign for an order with %s, even if the board would allow it', (_, extra) => {
    renderCards([{ ...order, ...extra }], { board: { canAssign: () => true, requestAssign: vi.fn() } })
    expect(screen.queryByRole('button', { name: /Assign/ })).toBeNull()
  })

  it('keeps «View details» on the line, and it opens the panel without selecting the card', async () => {
    const user = userEvent.setup()
    const { handleOpenOrderDetail, handleOrderCardClick } = renderCards()
    const details = screen.getByRole('button', { name: 'View details' })
    expect(details).toHaveAttribute('data-card-action')
    await user.click(details)
    expect(handleOpenOrderDetail).toHaveBeenCalledWith(order)
    expect(handleOrderCardClick).not.toHaveBeenCalled()
  })
})

describe('delivery card · what stays (decision 5)', () => {
  it('chooses the order for the map with a click on the card', async () => {
    const user = userEvent.setup()
    const { handleOrderCardClick } = renderCards()
    await user.click(cardOf())
    expect(handleOrderCardClick).toHaveBeenCalledWith(order)
  })

  it('marks the chosen card and its pressed button', () => {
    renderCards([order], { selectedOrderCard: order })
    expect(cardOf()).toHaveAttribute('data-active')
    expect(screen.getByRole('button', { name: /Order number 910001 Accepted/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the name of the pressed button as number + status (+ unread)', () => {
    renderCards([{ ...order, unread_count: 2 }], { isMessagesView: true })
    expect(screen.getByRole('button', { name: /^Order number 910001 Accepted 2 unread messages$/ })).toBeInTheDocument()
  })

  it('paints the loading skeleton with the structure of the card', () => {
    const { container } = renderCards([], { loading: true })
    const skeletons = container.querySelectorAll('[data-delivery-card][data-skeleton]')
    expect(skeletons.length).toBe(10)
    expect(skeletons[0].querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(8)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})

describe('delivery card · a new order by socket (DV-08)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const second = { ...order, id: 910002 }
  const pagination = { currentPage: 1, pageSize: 10, total: 2 }

  it('marks the first load as nothing new', () => {
    const { rerenderCards } = renderCards([], { loading: true, pagination })
    rerenderCards([order, second], { pagination })
    expect(document.querySelectorAll('[data-new]')).toHaveLength(0)
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('marks an id that was not in the previous render, announces it, and clears it after 2 s', () => {
    const { rerenderCards } = renderCards([order], { pagination })
    rerenderCards([second, order], { pagination: { ...pagination, total: 2 } })
    const fresh = document.querySelectorAll('[data-new]')
    expect(fresh).toHaveLength(1)
    expect(fresh[0]).toHaveTextContent('910002')
    const live = liveRegion()
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('role', 'status')
    expect(live).toHaveTextContent('New order #910002')

    act(() => { vi.advanceTimersByTime(1900) })
    expect(document.querySelectorAll('[data-new]')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(200) })
    expect(document.querySelectorAll('[data-new]')).toHaveLength(0)
    expect(live).toBeEmptyDOMElement()
  })

  it('does not count a page change as an arrival', () => {
    const { rerenderCards } = renderCards([order], { pagination })
    rerenderCards([second], { pagination: { currentPage: 2, pageSize: 10, total: 12 } })
    expect(document.querySelectorAll('[data-new]')).toHaveLength(0)
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('does not count a reload (filters) as an arrival', () => {
    const { rerenderCards } = renderCards([order], { pagination })
    rerenderCards([order], { loading: true, pagination })
    rerenderCards([second], { pagination })
    expect(document.querySelectorAll('[data-new]')).toHaveLength(0)
  })
})

describe('delivery card · interaction details kept from before', () => {
  it('does not select the card with the click that ends a text selection inside it', () => {
    const { handleOrderCardClick } = renderCards()
    const text = screen.getByText('Synthetic Store Alpha')
    const range = document.createRange()
    range.selectNodeContents(text)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.click(text, { detail: 1 })
    expect(handleOrderCardClick).not.toHaveBeenCalled()
    selection.removeAllRanges()
  })
})

// redesign deliveries R1 (finding 5): at 1024 the list column is 400px. Layout is not measured in jsdom, so this checks the two things
// that decide it: every text that can be cut carries its full text in `title`, and the CSS gives the destination its share and keeps the ETA on line 1.
const CSS = readFileSync(path.resolve(__dirname, '../delivery-card.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The at-rule blocks (@media, @container), by their prelude and nested as written, and the rules outside them (added a
// phone block with a card-width block inside).
const parseBlocks = (source) => {
  const blocks = {}
  let base = ''
  let index = 0
  while (index < source.length) {
    const at = source.indexOf('@', index)
    if (at === -1) { base += source.slice(index); break }
    base += source.slice(index, at)
    const open = source.indexOf('{', at)
    let depth = 1
    let end = open + 1
    while (depth > 0 && end < source.length) {
      if (source[end] === '{') depth += 1
      if (source[end] === '}') depth -= 1
      end += 1
    }
    const prelude = source.slice(at, open).trim()
    blocks[prelude] = (blocks[prelude] || '') + source.slice(open + 1, end - 1)
    index = end
  }
  return { base, blocks }
}
const { base: BASE, blocks: BLOCKS } = parseBlocks(CSS)
const MEDIA = Object.fromEntries(Object.entries(BLOCKS).map(([prelude, body]) => [prelude.replace(/^@media\s*/, ''), body]))

// Every declaration of `prop` in the rules whose selector list contains `selector`, last one wins (what the cascade does at equal specificity).
const cssValue = (selector, prop, source = BASE) => {
  let value
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').map(item => item.trim()).includes(selector)) continue
    for (const declaration of body.split(';')) {
      const [name, ...rest] = declaration.split(':')
      if (name.trim() === prop) value = rest.join(':').trim()
    }
  }
  return value
}
const shrinkOf = (selector) => Number((cssValue(selector, 'flex') || '').split(/\s+/)[1])

describe('delivery card · 1024 width (R1 finding 5)', () => {
  const full = { ...order, status: 7, business: { name: 'Oasi In Piazza Bar and Grill', city: { name: 'Fixture City Upon Tyne' } }, customer: { zipcode: '77388-1234' } }

  it('gives the cut texts their full text in title: store, city, destination and status', () => {
    renderCards([full])
    const card = cardOf()
    expect(card.querySelector('.odc-dcard-store')).toHaveAttribute('title', 'Oasi In Piazza Bar and Grill')
    expect(card.querySelector('.odc-dcard-city')).toHaveAttribute('title', 'Fixture City Upon Tyne')
    expect(card.querySelector('.odc-dcard-dest')).toHaveAttribute('title', '77388-1234')
    expect(card.querySelector('.odc-status')).toHaveAttribute('title', 'Accepted')
  })

  it('keeps line 1 in one row so the ETA figure never drops to a line of its own', () => {
    expect(cssValue('.odc-dcard-l1', 'flex-wrap')).toBe('nowrap')
    expect(cssValue('.odc-dcard-eta', 'flex')).toBe('none')
    expect(cssValue('.odc-dcard-eta', 'white-space')).toBe('nowrap')
    expect(cssValue('.odc-dcard-id', 'flex')).toBe('none')
  })

  it('lets the status text ellipsize before anything on line 1 is cut', () => {
    expect(cssValue('.odc-dcard-l1 > .odc-status', 'min-inline-size')).toBe('0')
    expect(Number(cssValue('.odc-dcard-l1 > .odc-status', 'flex').split(/\s+/)[1])).toBeGreaterThan(0)
    expect(cssValue('.odc-dcard-l1 > .odc-status > :not(.odc-dot)', 'text-overflow')).toBe('ellipsis')
    expect(cssValue('.odc-dcard-l1 > .odc-status > :not(.odc-dot)', 'overflow')).toBe('hidden')
    expect(cssValue('.odc-dcard-l1', 'gap')).toBe('var(--od-x-space-1-5)')
  })

  it('makes the city give way first, then the store, and keeps the destination (zipcode) whole', () => {
    expect(shrinkOf('.odc-dcard-dest')).toBe(0)
    expect(shrinkOf('.odc-dcard-city')).toBeGreaterThan(shrinkOf('.odc-dcard-store'))
    expect(shrinkOf('.odc-dcard-store')).toBeGreaterThan(shrinkOf('.odc-dcard-dest'))
    // a very long destination still stops at half of the route instead of pushing the store out
    expect(cssValue('.odc-dcard-dest', 'max-inline-size')).toBe('50%')
    expect(cssValue('.odc-dcard-dest', 'text-overflow')).toBe('ellipsis')
  })
})

// (review R2): at 390 line 1 kept one row and the status gave way: «Accepted by Business» showed 55 of its 138px
// («Accept…»), the store went to «Tim's …» and the city to 0px, and a phone cannot show `title`. On a phone viewport the ETA
// figure drops to its own row and the trip takes its whole row with the hour under it, as a catering order already does.
// The desktop column keeps decision 4 (three lines) and R1 finding 5 (one row for line 1).
describe('delivery card · phone viewport', () => {
  const PHONE = '(max-width: 767px)'
  // review of the viewport alone also wrapped a 735px card at 767px; the card's own width decides too
  const NARROW_CARD = '@container odc-dcard (max-width: 479px)'
  const phoneCard = () => parseBlocks(MEDIA[PHONE] || '').blocks[NARROW_CARD]

  it('has a phone block with a narrow-card block inside, and the card is that container', () => {
    expect(MEDIA[PHONE]).toBeTruthy()
    expect(phoneCard()).toBeTruthy()
    expect(cssValue('.odc-dcard', 'container')).toBe('odc-dcard / inline-size')
  })

  it('lets line 1 wrap on a phone, so the status keeps its text and the ETA goes to its own row', () => {
    expect(cssValue('.odc-dcard-l1', 'flex-wrap', phoneCard())).toBe('wrap')
  })

  it('gives the trip its whole row on a phone, so the store keeps its name; the hour goes under it', () => {
    expect(cssValue('.odc-dcard-route', 'flex-basis', phoneCard())).toBe('100%')
  })
})

// (T10, decision X-2): an open order whose ETA already passed does not say «On time» next to a timer that is
// negative; a closed order, or an ETA still ahead, keeps the server badge. The timer always shows.
describe('delivery card · «On time» against the ETA timer', () => {
  const NOW = new Date('2026-10-21T12:00:00')
  const at = (minutesFromNow) => {
    const date = new Date(NOW.getTime() + minutesFromNow * 60000)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  }
  const withEta = (overrides) => ({ ...order, time_status: 'in_time', eta_time: 0, ...overrides })

  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })

  it('does not say «On time» for an open pending order whose ETA passed 6 days 18:24 ago, and keeps the timer', () => {
    const stamp = at(-(6 * 1440 + 18 * 60 + 24))
    renderCards([withEta({ status: 0, delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(within(cardOf()).queryByText('On time')).toBeNull()
    expect(cardOf().querySelector('[data-level="ok"]')).toBeNull()
    expect(cardOf().querySelector('[title="ETA"] .odc-figure').textContent).toBe('- 6 days 18:24')
  })

  it('keeps «On time» for an open order whose ETA is 30 minutes ahead', () => {
    const stamp = at(30)
    renderCards([withEta({ status: 0, delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(within(cardOf()).getByText('On time')).toBeInTheDocument()
    expect(cardOf().querySelector('[title="ETA"] .odc-figure').textContent).toBe('00:30')
  })

  it('keeps «On time» for a closed order (completed) whose ETA is in the past', () => {
    const stamp = at(-(6 * 1440 + 18 * 60 + 24))
    renderCards([withEta({ status: 1, delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(within(cardOf()).getByText('On time')).toBeInTheDocument()
  })

  it('does not change «At risk» and «Delayed» for an open order with a past ETA', () => {
    const stamp = at(-120)
    const { rerenderCards } = renderCards([withEta({ time_status: 'at_risk', delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(within(cardOf()).getByText('At risk')).toBeInTheDocument()
    rerenderCards([withEta({ time_status: 'delayed', delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(within(cardOf()).getByText('Delayed')).toBeInTheDocument()
  })

  it.each([
    [-(1 * 1440 + 2 * 60 + 5), '- 1 day 02:05'],
    [-(2 * 1440 + 60), '- 2 days 01:00'],
    [-(18 * 60 + 24), '- 18:24']
  ])('writes the day suffix in lower case with the number inside the key (%s min)', (minutes, text) => {
    const stamp = at(minutes)
    translate.mockClear()
    renderCards([withEta({ time_status: 'delayed', delivery_datetime_utc: stamp, delivery_datetime: stamp })])
    expect(cardOf().querySelector('[title="ETA"] .odc-figure').textContent).toBe(text)
    if (minutes <= -1440) {
      expect(translate).toHaveBeenCalledWith(Math.abs(minutes) >= 2 * 1440 ? 'ETA_TIMER_DAYS' : 'ETA_TIMER_DAY_ONE', expect.stringContaining('_count_'))
    }
  })
})

// (tanda Y): the cases the orders table checks too (slaParityCases), so card and table decide «On time» alike; and X-R6:
// a closed order has no count-down timer (it counted from the ETA for ever: «- 5 days 20:29»). Its hour stays on line 2.
describe('delivery card · the same SLA decisions as the orders table (tanda Y, X-R6)', () => {
  it.each(slaParityCases().map(item => [item.name, item]))('%s', (_name, item) => {
    renderCards([item.order])
    const card = cardOf()
    expect(card.textContent.includes('On time')).toBe(item.onTime)
    expect(Boolean(card.querySelector('.odc-dcard-eta'))).toBe(item.timer)
  })
})
