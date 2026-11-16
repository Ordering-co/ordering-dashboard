import { describe, expect, it } from 'vitest'
import { mapStripeConnectOAuthResult } from '../stripeConnectHelpers'

const liveOAuthResult = {
  livemode: true,
  access_token: 'sk_live_abc',
  stripe_publishable_key: 'pk_live_abc',
  stripe_user_id: 'acct_live',
  refresh_token: 'rt_live'
}

const sandboxOAuthResult = {
  livemode: false,
  access_token: 'sk_test_abc',
  stripe_publishable_key: 'pk_test_abc',
  stripe_user_id: 'acct_test',
  refresh_token: 'rt_test'
}

describe('mapStripeConnectOAuthResult', () => {
  it('maps a live Stripe Connect account to sandbox: false', () => {
    expect(mapStripeConnectOAuthResult(liveOAuthResult)).toEqual({
      sandbox: false,
      data: {
        token: 'sk_live_abc',
        publishable: 'pk_live_abc',
        user: 'acct_live',
        refresh_token: 'rt_live'
      }
    })
  })

  it('maps a sandbox Stripe Connect account to sandbox: true', () => {
    expect(mapStripeConnectOAuthResult(sandboxOAuthResult)).toEqual({
      sandbox: true,
      data: {
        token: 'sk_test_abc',
        publishable: 'pk_test_abc',
        user: 'acct_test',
        refresh_token: 'rt_test'
      }
    })
  })

  it('returns null for missing or incomplete OAuth payloads', () => {
    expect(mapStripeConnectOAuthResult(null)).toBe(null)
    expect(mapStripeConnectOAuthResult({})).toBe(null)
    expect(mapStripeConnectOAuthResult({ livemode: true })).toBe(null)
  })
})
