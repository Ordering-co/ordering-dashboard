import { describe, expect, it } from 'vitest'

import { sanitizeRouterCacheKey } from '../../../worker/sanitizeRouterCacheKey.js'

const ROUTER_CACHE_KEY_BASE = 'https://ordering-dashboard-router.internal'
const requestOrigin = 'https://tenant-a.example.com'
const matchingKey = `${ROUTER_CACHE_KEY_BASE}/first-load?origin=${encodeURIComponent(requestOrigin)}`

describe('sanitizeRouterCacheKey', () => {
  it('accepts a router key whose origin matches the request', () => {
    expect(sanitizeRouterCacheKey(matchingKey, requestOrigin)).toBe(matchingKey)
  })

  it('rejects a router key for another tenant origin', () => {
    const victimKey = `${ROUTER_CACHE_KEY_BASE}/first-load?origin=${encodeURIComponent('https://victim.example.com')}`
    expect(sanitizeRouterCacheKey(victimKey, requestOrigin)).toBeNull()
  })

  it('rejects a key outside the dashboard router namespace', () => {
    const offNamespace = `https://evil.example/first-load?origin=${encodeURIComponent(requestOrigin)}`
    expect(sanitizeRouterCacheKey(offNamespace, requestOrigin)).toBeNull()
  })

  it('rejects a missing or oversized header', () => {
    expect(sanitizeRouterCacheKey(null, requestOrigin)).toBeNull()
    expect(sanitizeRouterCacheKey('https://ordering-dashboard-router.internal/' + 'a'.repeat(1024), requestOrigin)).toBeNull()
  })
})
