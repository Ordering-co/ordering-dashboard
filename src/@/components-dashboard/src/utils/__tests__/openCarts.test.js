import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CART_STATUS,
  CART_VIEWS,
  DAY_FIGURES_CAP,
  DETAIL_CONCURRENCY,
  FOLLOW_UP_CAP,
  FOLLOW_UP_DAYS,
  LIVE_MINUTES,
  LIVE_POLL_MS,
  MAILTO_MAX,
  buildCartEmail,
  buildCartsPath,
  buildCartsWhere,
  buildMailtoHref,
  cartTotal,
  contactOf,
  copyText,
  parseApiUtc,
  rankFollowUp,
  searchDigits,
  startOfLocalDay,
  summarizeItems,
  toApiUtc,
  viewsOfCart
} from '../openCarts'

// redesign OC-A (data contract)
const NOW = new Date(Date.UTC(2026, 9, 9, 15, 30, 45))

describe('constants', () => {
  it('match the data contract', () => {
    expect(CART_VIEWS).toEqual(['followUp', 'paymentFailed', 'live', 'all'])
    expect(CART_STATUS).toEqual({ OPEN: 0, PAYMENT_FAILED: 4 })
    expect([FOLLOW_UP_DAYS, LIVE_MINUTES, LIVE_POLL_MS, FOLLOW_UP_CAP, DAY_FIGURES_CAP, DETAIL_CONCURRENCY, MAILTO_MAX])
      .toEqual([7, 30, 60000, 100, 50, 10, 1800])
  })
})

describe('UTC conversion', () => {
  it('reads and writes the API date as UTC, whatever the browser zone', () => {
    const date = parseApiUtc('2026-10-08 23:27:05')
    expect(date.toISOString()).toBe('2026-10-08T23:27:05.000Z')
    expect(toApiUtc(date)).toBe('2026-10-08 23:27:05')
    expect(toApiUtc(NOW)).toBe('2026-10-09 15:30:45')
  })

  it('answers null for text that is not a date', () => {
    expect(parseApiUtc(null)).toBeNull()
    expect(parseApiUtc('yesterday')).toBeNull()
    expect(parseApiUtc('')).toBeNull()
  })

  it('starts the local day at the browser midnight', () => {
    const local = new Date(2026, 9, 9, 18, 45, 10)
    const start = startOfLocalDay(local)
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()])
      .toEqual([2026, 9, 9, 0, 0, 0])
  })
})

describe('searchDigits', () => {
  it('keeps only the digits', () => {
    expect(searchDigits('#18 3')).toBe('183')
    expect(searchDigits('abc')).toBe('')
    expect(searchDigits(null)).toBe('')
    expect(searchDigits(1832)).toBe('1832')
  })
})

describe('buildCartsWhere', () => {
  it('has no conditions for All without search or filters', () => {
    expect(buildCartsWhere({ view: 'all', now: NOW })).toBeNull()
    expect(buildCartsWhere({ view: 'all', search: 'abc', businessIds: [], customerIds: [], lastActivity: { from: null, to: null }, now: NOW })).toBeNull()
  })

  it('Follow up asks for the last 7 days, in UTC', () => {
    expect(buildCartsWhere({ view: 'followUp', now: NOW })).toEqual([
      { attribute: 'updated_at', value: { condition: '>=', value: '2026-10-02 15:30:45' } }
    ])
  })

  it('Live now asks for the last 30 minutes, in UTC', () => {
    expect(buildCartsWhere({ view: 'live', now: NOW })).toEqual([
      { attribute: 'updated_at', value: { condition: '>=', value: '2026-10-09 15:00:45' } }
    ])
  })

  it('Payment failed filters status 4', () => {
    expect(buildCartsWhere({ view: 'paymentFailed', now: NOW })).toEqual([
      { attribute: 'status', value: [4] }
    ])
  })

  it('searches the digits of the text as a partial cart id', () => {
    expect(buildCartsWhere({ view: 'all', search: '#18 3', now: NOW })).toEqual([
      { attribute: 'id', value: { condition: 'ilike', value: '%183%' } }
    ])
  })

  it('filters business and customer ids', () => {
    expect(buildCartsWhere({ view: 'all', businessIds: [5, 7], customerIds: [9], now: NOW })).toEqual([
      { attribute: 'business_id', value: [5, 7] },
      { attribute: 'user_id', value: [9] }
    ])
  })

  it('turns the last activity range into UTC strings', () => {
    const from = new Date(Date.UTC(2026, 9, 1, 4, 0, 0))
    const to = new Date(Date.UTC(2026, 9, 3, 3, 59, 59))
    expect(buildCartsWhere({ view: 'all', lastActivity: { from, to }, now: NOW })).toEqual([
      { attribute: 'updated_at', value: { condition: '>=', value: '2026-10-01 04:00:00' } },
      { attribute: 'updated_at', value: { condition: '<=', value: '2026-10-03 03:59:59' } }
    ])
    expect(buildCartsWhere({ view: 'all', lastActivity: { from, to: null }, now: NOW })).toHaveLength(1)
  })

  it('combines the view with everything else, in a fixed order', () => {
    const where = buildCartsWhere({
      view: 'live',
      search: '18',
      businessIds: [5],
      customerIds: [9],
      lastActivity: { from: new Date(Date.UTC(2026, 9, 9, 10, 0, 0)), to: null },
      now: NOW
    })
    expect(where.map(condition => condition.attribute)).toEqual(['updated_at', 'id', 'business_id', 'user_id', 'updated_at'])
  })
})

describe('buildCartsPath', () => {
  it('encodes the whole where as JSON', () => {
    const where = [{ attribute: 'id', value: { condition: 'ilike', value: '%18%' } }]
    const path = buildCartsPath({ page: 2, pageSize: 25, orderBy: '-updated_at', where })
    expect(path).toBe(`/carts/dashboard?orderBy=-updated_at&page=2&page_size=25&where=${encodeURIComponent(JSON.stringify(where))}`)
    expect(path).toContain('%25') // the % of ilike travels encoded
    const url = new URL(`https://api.test${path}`)
    expect(JSON.parse(url.searchParams.get('where'))).toEqual(where)
  })

  it('leaves out the where and the order when there are none', () => {
    expect(buildCartsPath({ page: 1, pageSize: 1, where: null })).toBe('/carts/dashboard?page=1&page_size=1')
  })
})

describe('contactOf', () => {
  it('knows a guest', () => {
    expect(contactOf({ id: 1, user: null })).toEqual({
      name: null, email: null, phone: null, address: null, hasContact: false, isGuest: true
    })
    expect(contactOf({ user: { name: '', email: '  ', phone: null, cellphone: '' } }).isGuest).toBe(true)
    expect(contactOf(undefined).isGuest).toBe(true)
  })

  it('reads an email-only customer', () => {
    const contact = contactOf({ user: { name: 'Ana', email: 'ana@example.com', phone: null, cellphone: null } })
    expect(contact).toMatchObject({ name: 'Ana', email: 'ana@example.com', phone: null, hasContact: true, isGuest: false })
  })

  it('reads a phone-only customer and prefers the cellphone', () => {
    expect(contactOf({ user: { phone: '555-1000' } })).toMatchObject({ name: null, email: null, phone: '555-1000', hasContact: true, isGuest: false })
    expect(contactOf({ user: { phone: '555-1000', cellphone: '555-2000' } }).phone).toBe('555-2000')
  })

  it('joins the full name without double spaces', () => {
    expect(contactOf({ user: { name: 'Maria', middle_name: 'del Carmen', lastname: 'Lopez', second_lastname: 'Ruiz' } }).name)
      .toBe('Maria del Carmen Lopez Ruiz')
    expect(contactOf({ user: { name: 'Maria', middle_name: null, lastname: ' Lopez ', second_lastname: '' } }).name)
      .toBe('Maria Lopez')
  })

  it('takes the address from the user or from the cart', () => {
    expect(contactOf({ user: { name: 'Ana', address: '1 Main St' } }).address).toBe('1 Main St')
    expect(contactOf({ user: { name: 'Ana' }, address: { address: '2 Side St' } }).address).toBe('2 Side St')
  })
})

describe('summarizeItems', () => {
  const products = [
    { name: 'Hamburger', quantity: 2 },
    { name: 'Fries', quantity: 1 },
    { name: 'Soda', quantity: 3 },
    { name: 'Salad', quantity: 1 }
  ]

  it('takes the first max products and says how many are left', () => {
    expect(summarizeItems(products)).toEqual({
      items: [{ quantity: 2, name: 'Hamburger' }, { quantity: 1, name: 'Fries' }],
      more: 2
    })
    expect(summarizeItems(products, 4)).toEqual({ items: products.map(({ quantity, name }) => ({ quantity, name })), more: 0 })
    expect(summarizeItems(products, 1).more).toBe(3)
  })

  it('answers null for the products of the list, which have no names', () => {
    expect(summarizeItems([{ product_id: 1, code: 'a', quantity: 2, options: [] }])).toBeNull()
    expect(summarizeItems(undefined)).toBeNull()
  })

  it('answers an empty summary for a cart without products', () => {
    expect(summarizeItems([])).toEqual({ items: [], more: 0 })
  })
})

describe('cartTotal', () => {
  it('is null without a detail and never negative', () => {
    expect(cartTotal(null)).toBeNull()
    expect(cartTotal({ loading: true, error: null, cart: null })).toBeNull()
    expect(cartTotal({ total: 26.86 })).toBe(26.86)
    expect(cartTotal({ loading: false, cart: { total: 12 } })).toBe(12)
    expect(cartTotal({ total: -4 })).toBe(0)
    expect(cartTotal({ total: undefined })).toBe(0)
  })
})

describe('rankFollowUp', () => {
  const hoursAgo = (hours) => toApiUtc(new Date(NOW.getTime() - hours * 3600 * 1000))
  const cart = (id, hours, status = 0) => ({ id, status, updated_at: hoursAgo(hours) })
  const ids = (groups) => groups.map(group => ({ key: group.key, ids: group.carts.map(item => item.id) }))

  it('splits two bands by age and omits an empty one', () => {
    const groups = rankFollowUp([cart(1, 30), cart(2, 2), cart(3, 100)], {}, NOW)
    expect(ids(groups)).toEqual([
      { key: 'last24h', ids: [2] },
      { key: 'earlier', ids: [1, 3] }
    ])
    expect(ids(rankFollowUp([cart(1, 2)], {}, NOW))).toEqual([{ key: 'last24h', ids: [1] }])
    expect(ids(rankFollowUp([cart(1, 48)], {}, NOW))).toEqual([{ key: 'earlier', ids: [1] }])
    expect(rankFollowUp([], {}, NOW)).toEqual([])
  })

  it('puts failed payments first, then the highest total, then the most recent', () => {
    const carts = [
      cart(1, 1),
      cart(2, 2),
      cart(3, 3, 4),
      cart(4, 4, 4),
      cart(5, 5),
      cart(6, 6)
    ]
    const details = {
      1: { loading: false, error: null, cart: { total: 10 } },
      2: { loading: false, error: null, cart: { total: 50 } },
      3: { loading: false, error: null, cart: { total: 5 } },
      4: { loading: false, error: null, cart: { total: 80 } },
      5: { loading: false, error: null, cart: { total: 50 } },
      6: { loading: true, error: null, cart: null }
    }
    // 4 (failed, 80), 3 (failed, 5), then 2 and 5 tie on 50 (2 is more recent), 1 (10), 6 (no total yet)
    expect(ids(rankFollowUp(carts, details, NOW))).toEqual([{ key: 'last24h', ids: [4, 3, 2, 5, 1, 6] }])
  })

  it('accepts details stored as the bare cart too, and orders ties by recency', () => {
    const groups = rankFollowUp([cart(1, 5), cart(2, 1), cart(3, 3)], { 1: { total: 20 }, 2: { total: 20 }, 3: { total: 20 } }, NOW)
    expect(ids(groups)).toEqual([{ key: 'last24h', ids: [2, 3, 1] }])
  })

  it('ranks inside each band on its own', () => {
    const carts = [cart(1, 30), cart(2, 40, 4), cart(3, 1), cart(4, 2, 4)]
    const details = { 1: { total: 99 }, 2: { total: 1 }, 3: { total: 5 }, 4: { total: 2 } }
    expect(ids(rankFollowUp(carts, details, NOW))).toEqual([
      { key: 'last24h', ids: [4, 3] },
      { key: 'earlier', ids: [2, 1] }
    ])
  })

  it('does not change the list it receives', () => {
    const carts = [cart(1, 5), cart(2, 1)]
    rankFollowUp(carts, {}, NOW)
    expect(carts.map(item => item.id)).toEqual([1, 2])
  })
})

describe('viewsOfCart', () => {
  it('lists every view a cart is in (they do not exclude each other)', () => {
    const at = (minutes) => toApiUtc(new Date(NOW.getTime() - minutes * 60000))
    expect(viewsOfCart({ status: 0, updated_at: at(10) }, NOW)).toEqual(['all', 'followUp', 'live'])
    expect(viewsOfCart({ status: 4, updated_at: at(60 * 24 * 3) }, NOW)).toEqual(['all', 'followUp', 'paymentFailed'])
    expect(viewsOfCart({ status: 0, updated_at: at(60 * 24 * 20) }, NOW)).toEqual(['all'])
  })
})

describe('buildMailtoHref', () => {
  it('encodes subject and body and keeps the @ of the address', () => {
    const href = buildMailtoHref({ email: 'ana+test@example.com', subject: 'Your cart at Joe & Co', body: 'Hi Ana,\n2× Fries — $5.00' })
    expect(href).toBe(
      'mailto:ana%2Btest@example.com?subject=' + encodeURIComponent('Your cart at Joe & Co') +
      '&body=' + encodeURIComponent('Hi Ana,\n2× Fries — $5.00')
    )
    expect(href).toContain('%0A')
    expect(href).not.toContain(' ')
    expect(href).toContain('%26') // the & of the subject must not split the query
  })

  it('leaves out an empty subject or body', () => {
    expect(buildMailtoHref({ email: 'a@b.co', subject: '', body: '' })).toBe('mailto:a@b.co')
    expect(buildMailtoHref({ email: 'a@b.co', subject: 'Hi' })).toBe('mailto:a@b.co?subject=Hi')
  })
})

describe('buildCartEmail', () => {
  const base = {
    subject: 'Your cart at Joe',
    greeting: 'Hi Ana,',
    totalLine: 'Total: $34.20',
    signOff: 'Can we help you finish your order?',
    moreLabel: (count) => `+${count} more items`,
    formatLine: ({ quantity, name, total }) => `${quantity}× ${name} — $${total.toFixed(2)}`
  }
  const items = (count) => Array.from({ length: count }, (_, index) => ({ quantity: 1, name: `Product number ${index + 1}`, total: 3.5 }))

  it('writes the whole body when it fits', () => {
    const email = buildCartEmail({ ...base, items: items(2), maxLength: 1800 })
    expect(email.subject).toBe('Your cart at Joe')
    expect(email.body).toBe(
      'Hi Ana,\n\n1× Product number 1 — $3.50\n1× Product number 2 — $3.50\n\nTotal: $34.20\n\nCan we help you finish your order?'
    )
  })

  it('replaces the lines that do not fit with moreLabel(n) and respects maxLength', () => {
    const all = items(40)
    const email = buildCartEmail({ ...base, items: all, maxLength: 600 })
    const href = buildMailtoHref({ email: '', subject: email.subject, body: email.body })
    expect(href.length).toBeLessThanOrEqual(600)
    const kept = email.body.split('\n').filter(line => line.startsWith('1× Product'))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(40)
    expect(email.body).toContain(`+${40 - kept.length} more items`)
    // the total and the sign-off survive the cut
    expect(email.body).toContain('Total: $34.20')
    expect(email.body).toContain('Can we help you finish your order?')
  })

  it('keeps the default limit under MAILTO_MAX', () => {
    const email = buildCartEmail({ ...base, items: items(200), maxLength: MAILTO_MAX })
    expect(buildMailtoHref({ subject: email.subject, body: email.body }).length).toBeLessThanOrEqual(MAILTO_MAX)
    expect(email.body).toMatch(/\+\d+ more items/)
  })

  it('cuts the text itself when even the fixed parts do not fit', () => {
    const email = buildCartEmail({ ...base, items: items(3), maxLength: 80 })
    expect(buildMailtoHref({ subject: email.subject, body: email.body }).length).toBeLessThanOrEqual(80)
  })
})

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete document.execCommand
  })

  it('uses the clipboard when it is there', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await expect(copyText('555-1000')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('555-1000')
  })

  it('falls back to selecting a temporary textarea', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => true)
    await expect(copyText('ana@example.com')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('answers false when nothing works', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    document.execCommand = vi.fn(() => false)
    await expect(copyText('x')).resolves.toBe(false)
  })
})
