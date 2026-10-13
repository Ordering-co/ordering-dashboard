import { describe, expect, it } from 'vitest'
import * as analytics from '../businessLoadAnalytics'

describe('business list load analytics', () => {
  it('maps API, transport and cancellation outcomes without exposing error payloads', () => {
    expect(analytics.getBusinessLoadOperation({ content: { error: false } })).toEqual({
      status: 'succeeded', module: 'stores', action: 'load_stores'
    })
    expect(analytics.getBusinessLoadOperation({ content: { error: true, result: ['private'] } })).toEqual({
      status: 'failed', module: 'stores', action: 'load_stores', failureType: 'api'
    })
    expect(analytics.getBusinessLoadOperation({ error: new Error('private') })).toEqual({
      status: 'failed', module: 'stores', action: 'load_stores', failureType: 'transport'
    })
    expect(analytics.getBusinessLoadOperation({ error: { constructor: { name: 'Cancel' } } })).toEqual({
      status: 'cancelled', module: 'stores', action: 'load_stores'
    })
    expect(analytics.getBusinessLoadOperation({ content: { error: false }, isInitialLoad: false })).toBeNull()
    expect(analytics.getBusinessLoadStartedOperation({ isInitialLoad: false })).toBeNull()
  })

  it('preserves the public caught-error contract', () => {
    expect(analytics.getCaughtBusinessListState({
      previousBusinesses: [{ id: 1 }],
      error: new Error('private')
    })).toEqual({ loading: false, businesses: [], error: null })
    expect(analytics.getCaughtBusinessListState({
      previousBusinesses: [{ id: 1 }],
      error: { constructor: { name: 'Cancel' } }
    })).toEqual({ loading: true, businesses: [{ id: 1 }], error: null })
  })
})
