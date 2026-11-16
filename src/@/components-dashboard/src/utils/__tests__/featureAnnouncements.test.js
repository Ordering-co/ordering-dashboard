import { describe, expect, it } from 'vitest'
import { FEATURE_ANNOUNCEMENTS, getActiveAnnouncements, getNewFeatureUrls } from '../featureAnnouncements'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const entry = (id, extra = {}) => ({ id, url: `/${id}`, until: '2026-12-31', when: () => true, ...extra })

describe('getActiveAnnouncements', () => {
  it('keeps the order of the list (newest first) and leaves out what is dismissed', () => {
    const list = [entry('b'), entry('a')]
    expect(getActiveAnnouncements({ now: NOW, list }).map(item => item.id)).toEqual(['b', 'a'])
    expect(getActiveAnnouncements({ now: NOW, list, dismissed: ['b'] }).map(item => item.id)).toEqual(['a'])
  })

  it('ends on its last day, and offers only what the project has and the person can open', () => {
    const list = [
      entry('past', { until: '2026-11-19' }),
      entry('last_day', { until: '2026-11-20' }),
      entry('not_offered', { when: () => false }),
      entry('closed')
    ]
    const ids = getActiveAnnouncements({ now: NOW, list, canOpen: url => url !== '/closed' }).map(item => item.id)
    expect(ids).toEqual(['last_day'])
  })
})

describe('getNewFeatureUrls', () => {
  it('tags the page of a running announcement, dismissed or not', () => {
    const list = [entry('a'), entry('b', { until: '2026-01-01' })]
    expect(getNewFeatureUrls({ now: NOW, list })).toEqual(['/a'])
  })
})

describe('Order with Google', () => {
  const google = FEATURE_ANNOUNCEMENTS.find(item => item.id === 'order_with_google')

  it('is announced only to a project that can activate it, and leads to its Connect page', () => {
    expect(google.url).toBe('/connect/order-with-google')
    expect(google.when({ googleActions: { can_activate: true } })).toBe(true)
    expect(google.when({ googleActions: { can_activate: false, counts: { sent: 3 } } })).toBe(false)
    expect(google.when({})).toBe(false)
  })
})
