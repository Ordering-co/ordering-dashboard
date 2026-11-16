import { describe, expect, it } from 'vitest'

import { getHistoryComment, getSafeHttpHref } from '../historyComment'

const XSS = '<img src=x onerror=alert(1)>'
const escapedXss = '&lt;img src=x onerror=alert(1)&gt;'

const t = (key, fallback) => fallback || key

const buildComment = (message, extra = {}) => getHistoryComment({
  message,
  userLevel: 0,
  t,
  getOrderState: (status) => `status-${status}`,
  parsePrice: (value) => `$${value}`,
  googleMapsApiKey: 'test-key',
  capitalize: (value) => value,
  ...extra
})

describe('getSafeHttpHref', () => {
  it('accepts http and https URLs', () => {
    expect(getSafeHttpHref('https://example.com/path')).toBe('https://example.com/path')
    expect(getSafeHttpHref('http://example.com')).toBe('http://example.com/')
  })

  it('rejects javascript URLs even when they contain http', () => {
    expect(getSafeHttpHref('javascript:alert(1)//http')).toBeNull()
  })

  it('rejects values that are not a single URL', () => {
    expect(getSafeHttpHref(`${XSS} http://example.com`)).toBeNull()
  })
})

describe('getHistoryComment', () => {
  it('escapes a crafted status comment', () => {
    const html = buildComment({
      change: { attribute: 'status', old: 1, new: 2, comment: XSS }
    })

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })

  it('escapes a crafted driver name', () => {
    const html = buildComment({
      change: { attribute: 'driver_id' },
      driver: { name: XSS, lastname: 'Smith' }
    })

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })

  it('escapes a crafted user-agent', () => {
    const html = buildComment({
      change: { attribute: 'status', old: 1, new: 2 },
      user_agent: XSS,
      author: { name: 'Admin' }
    })

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })

  it('escapes a crafted attribute value', () => {
    const html = buildComment({
      change: { attribute: 'external_id', old: 'abc', new: XSS }
    })

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })

  it('does not turn a javascript URL into an href even if it contains http', () => {
    const html = buildComment({
      change: { attribute: 'external_id', new: 'javascript:alert(1)//http' }
    })

    expect(html.toLowerCase()).not.toContain('href="javascript:')
    expect(html).toContain('javascript:alert(1)//http')
  })

  it('still renders a safe https URL as a link', () => {
    const html = buildComment({
      change: { attribute: 'external_id', new: 'https://example.com/order' }
    })

    expect(html).toContain('<a href="https://example.com/order" target="_blank" rel="noopener noreferrer">https://example.com/order</a>')
  })

  // redesign F6c (Q2-19): a history line never shows a raw key, and never ends on an empty value
  describe('readable lines', () => {
    it('names the manual driver assignment comment instead of showing its key', () => {
      const html = buildComment({ change: { attribute: 'dashboard_manual_driver_assignment_comment', old: null, new: 'test' } })

      expect(html).not.toContain('dashboard_manual_driver_assignment_comment')
      expect(html).toBe('Order <b>driver assignment comment</b> changed to <b>test</b>.')
    })

    // tanda P: the catalog has no PREPARED_IN, DELIVERED_IN nor DELIVERY_DATETIME, so these fell back on the raw
    // attribute in English in every language; they have keys of their own
    it.each([
      ['prepared_in', 'ORDER_HISTORY_PREPARED_IN', 'preparation time'],
      ['delivered_in', 'ORDER_HISTORY_DELIVERED_IN', 'delivery time'],
      ['delivery_datetime', 'ORDER_HISTORY_DELIVERY_DATETIME', 'delivery date']
    ])('names %s with its own key', (attribute, key, label) => {
      const keys = []
      const spy = (k, fallback) => { keys.push(k); return fallback || k }
      const html = getHistoryComment({ message: { change: { attribute, old: 0, new: 12 } }, t: spy, getOrderState: () => '' })
      expect(keys).toContain(key)
      expect(html).toContain(`<b>${label}</b>`)
    })

    it('turns any other unknown attribute into words, in both phrasings', () => {
      expect(buildComment({ change: { attribute: 'delivery_note_text', old: null, new: 'x' } })).toContain('<b>delivery note text</b>')
      expect(buildComment({ change: { attribute: 'delivery_note_text', old: 'a', new: 'b' } })).toContain('<b>delivery note text</b>')
    })

    it('says a value was removed instead of ending with an empty «to»', () => {
      const html = buildComment({ change: { attribute: 'driver_group_id', old: 496, new: '' } })

      expect(html).toBe('Order <b>driver group id</b> was removed (was <b>496</b>).')
      expect(html).not.toMatch(/to\s*\.$/)
    })

    it.each([null, undefined])('treats a %s new value as removed too', (value) => {
      expect(buildComment({ change: { attribute: 'driver_group_id', old: 496, new: value } })).toContain('was removed')
    })

    it('falls back to a plain «updated» when neither side has a value', () => {
      expect(buildComment({ change: { attribute: 'driver_group_id', old: null, new: '' } })).toBe('Order <b>driver group id</b> was updated.')
    })

    it('keeps the usual lines when both values exist', () => {
      expect(buildComment({ change: { attribute: 'driver_group_id', old: 1, new: 2 } })).toBe('Order <b>driver group id</b> changed from <b>1</b> to <b>2</b>.')
    })
  })
})

// redesign W1-6 (T1-6-4a, W1-D-18, decision 13): the dates of the history events are painted by parseDate; the minutes stay as sent.
describe('getHistoryComment · dates of the history (W1-D-18)', () => {
  const calls = []
  const parseDate = (value, options) => {
    calls.push([value, options])
    return `PARSED(${value})`
  }
  const withDates = (message) => buildComment(message, { parseDate })

  it('paints the delivery date, old and new, with parseDate and without the UTC shift (delivery_datetime is the local one)', () => {
    calls.length = 0
    const html = withDates({ change: { attribute: 'delivery_datetime', old: '2026-10-02 17:00:00', new: '2026-10-03T09:30:00Z' } })

    expect(html).toContain('<b>PARSED(2026-10-02 17:00:00)</b>')
    expect(html).toContain('<b>PARSED(2026-10-03T09:30:00Z)</b>')
    expect(html).not.toContain('<b>2026')
    expect(calls.map(([, options]) => options)).toEqual([{ utc: false }, { utc: false }])
  })

  it('leaves the minutes of prepared_in and delivered_in as the API sent them', () => {
    calls.length = 0
    expect(withDates({ change: { attribute: 'prepared_in', old: 15, new: '30' } })).toContain('changed from <b>15</b> to <b>30</b>')
    expect(withDates({ change: { attribute: 'delivered_in', old: null, new: 45 } })).toContain('changed from <b>0</b> to <b>45</b>')
    expect(calls).toEqual([])
  })

  it('paints prepared_in and delivered_in with parseDate only when the value is a date', () => {
    expect(withDates({ change: { attribute: 'prepared_in', old: 0, new: '2026-10-02 17:20:00' } })).toContain('<b>PARSED(2026-10-02 17:20:00)</b>')
    expect(withDates({ change: { attribute: 'delivered_in', old: '2026-10-02 17:20:00', new: '2026-10-02 17:50:00' } })).toContain('from <b>PARSED(2026-10-02 17:20:00)</b> to <b>PARSED(2026-10-02 17:50:00)</b>')
  })

  it('does not break when the caller gives no parseDate: the value stays as it came', () => {
    expect(buildComment({ change: { attribute: 'delivery_datetime', old: '2026-10-02 17:00:00', new: '2026-10-03 09:30:00' } })).toContain('from <b>2026-10-02 17:00:00</b> to <b>2026-10-03 09:30:00</b>')
  })

  it('keeps escaping what is not a date', () => {
    expect(withDates({ change: { attribute: 'delivery_datetime', old: 0, new: XSS } })).toContain(escapedXss)
  })
})
