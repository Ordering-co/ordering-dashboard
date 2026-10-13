import { describe, expect, it } from 'vitest'
import {
  buildStripeConnectSavePayload,
  mapStripeConnectOAuthResult
} from '../stripeConnectHelpers'

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

describe('buildStripeConnectSavePayload', () => {
  it('writes live credentials to data only and does not copy them into data_sandbox', () => {
    const payload = buildStripeConnectSavePayload(mapStripeConnectOAuthResult(liveOAuthResult))

    expect(payload.sandbox).toBe(false)
    expect(JSON.parse(payload.data)).toEqual({
      token: 'sk_live_abc',
      publishable: 'pk_live_abc',
      user: 'acct_live',
      refresh_token: 'rt_live'
    })
    expect(payload).not.toHaveProperty('data_sandbox')
  })

  it('writes sandbox credentials to data_sandbox only and does not copy them into data', () => {
    const payload = buildStripeConnectSavePayload(mapStripeConnectOAuthResult(sandboxOAuthResult))

    expect(payload.sandbox).toBe(true)
    expect(JSON.parse(payload.data_sandbox)).toEqual({
      token: 'sk_test_abc',
      publishable: 'pk_test_abc',
      user: 'acct_test',
      refresh_token: 'rt_test'
    })
    expect(payload).not.toHaveProperty('data')
  })

  it('keeps sites, devices, and allowed_order_types serialization', () => {
    const payload = buildStripeConnectSavePayload({
      ...mapStripeConnectOAuthResult(liveOAuthResult),
      sites: [1, 2],
      devices: [9],
      allowed_order_types: [1]
    })

    expect(payload.sites).toBe(JSON.stringify([1, 2]))
    expect(payload.devices).toBe(JSON.stringify([9]))
    expect(payload.allowed_order_types).toBe(JSON.stringify([1]))
  })

  it('returns null when there is nothing to save', () => {
    expect(buildStripeConnectSavePayload({})).toBe(null)
    expect(buildStripeConnectSavePayload(null)).toBe(null)
  })

  it('does not leak a leftover data_sandbox field into a live save', () => {
    const payload = buildStripeConnectSavePayload({
      ...mapStripeConnectOAuthResult(liveOAuthResult),
      data_sandbox: { token: 'sk_live_should_not_copy' }
    })

    expect(payload).not.toHaveProperty('data_sandbox')
    expect(JSON.parse(payload.data).token).toBe('sk_live_abc')
  })

  it('does not write credential buckets when OAuth data is missing', () => {
    const payload = buildStripeConnectSavePayload({
      sites: [1],
      sandbox: false
    })

    expect(payload).not.toHaveProperty('data')
    expect(payload).not.toHaveProperty('data_sandbox')
    expect(payload.sites).toBe(JSON.stringify([1]))
    expect(payload.sandbox).toBe(false)
  })
})
