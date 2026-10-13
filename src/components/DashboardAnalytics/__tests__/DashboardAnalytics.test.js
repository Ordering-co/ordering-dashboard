import { describe, expect, it } from 'vitest'
import {
  getDashboardRouteFingerprint,
  isDashboardAnalyticsReady
} from '../analytics'

describe('DashboardAnalytics readiness', () => {
  it('waits for authenticated project context before capturing a route', () => {
    expect(isDashboardAnalyticsReady({ auth: true, projectLoading: false, projectId: 12 })).toBe(true)
    expect(isDashboardAnalyticsReady({ auth: 'stored-token', projectLoading: false, projectId: 12 })).toBe(true)
    expect(isDashboardAnalyticsReady({ auth: true, projectLoading: true, projectId: 12 })).toBe(false)
    expect(isDashboardAnalyticsReady({ auth: true, projectLoading: false, projectId: null })).toBe(false)
    expect(isDashboardAnalyticsReady({ auth: null, projectLoading: false, projectId: 12 })).toBe(false)
  })

  it('deduplicates route views by project and pathname only', () => {
    expect(getDashboardRouteFingerprint(12, '/orders')).toBe('12:/orders')
    expect(getDashboardRouteFingerprint(13, '/orders')).toBe('13:/orders')
  })
})
