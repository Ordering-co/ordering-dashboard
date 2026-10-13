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
})
