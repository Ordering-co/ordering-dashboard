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

  // redesign bugs C: a request that failed said `error: null`, so the list read «no stores». It says there was an error
  // now, by a key the list translates, never with the raw message.
  it('a failed request is an error of the list (never its raw message); a cancelled one keeps the rows', () => {
    expect(analytics.getCaughtBusinessListState({
      previousBusinesses: [{ id: 1 }],
      error: new Error('private')
    })).toEqual({ loading: false, businesses: [], error: ['NETWORK_ERROR'] })
    expect(analytics.getCaughtBusinessListState({
      previousBusinesses: [{ id: 1 }],
      error: { constructor: { name: 'Cancel' } }
    })).toEqual({ loading: true, businesses: [{ id: 1 }], error: null })
  })
})
