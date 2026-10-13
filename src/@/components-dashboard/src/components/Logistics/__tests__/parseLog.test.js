import { describe, expect, it } from 'vitest'

import { parseLog } from '../parseLog'

const XSS = '<img src=x onerror=alert(1)>'
const escapedXss = '&lt;img src=x onerror=alert(1)&gt;'

const t = (key, fallback) => fallback || key
const fallbackText = (key) => {
  if (key === 'LOG_LOGISTIC_DRIVER_FOUND') {
    return '<strong>Logistic:</strong> Driver _driver_ found at _distance_.'
  }
  if (key === 'LOG_LOGISTIC_DRIVER_COMPANY_FOUND') {
    return 'Driver company <b>_driver_company_</b> found.'
  }
  return key
}

const deps = {
  t,
  parseDistance: (value) => `${value} km`,
  getOrderState: (status) => `status-${status}`,
  capitalize: (value) => value.charAt(0).toUpperCase() + value.slice(1),
  fallbackText
}

describe('parseLog', () => {
  it('escapes a crafted driver name', () => {
    const html = parseLog({
      event: 'logistic_driver_found',
      driver: { name: XSS, lastname: 'Smith' },
      data: { distance: 1.2 }
    }, deps)

    expect(html).toContain(escapedXss)
    expect(html).toContain('<strong>Logistic:</strong>')
    expect(html).not.toContain('<img')
  })

  it('escapes a crafted company name', () => {
    const html = parseLog({
      event: 'logistic_driver_company_found',
      driver_company_id: 9,
      driver_company: { name: XSS }
    }, deps)

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })

  it('escapes JSON from an unknown event', () => {
    const html = parseLog({
      event: 'unknown_logistic_event',
      data: { note: XSS }
    }, deps)

    expect(html).toContain(escapedXss)
    expect(html).not.toContain('<img')
  })
})
