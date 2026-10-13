import { describe, expect, it } from 'vitest'

import {
  PAYMENT_GATEWAY_SETTINGS,
  SETTINGS_MAPS_PATH,
  SETTINGS_SLA_PATH,
  getPaymentGatewayKeyStatus,
  getPaymentGatewaySettingsPath
} from '../settingsExternalEditors'

describe('settings paths', () => {
  it('points SLA and Maps at the Settings hub', () => {
    expect(SETTINGS_SLA_PATH).toBe('/settings?group=orders&category=enterprise_orders_slas')
    expect(SETTINGS_MAPS_PATH).toBe('/settings?group=locations&category=google_maps')
  })

  it('maps payment gateways to their Settings section', () => {
    expect(PAYMENT_GATEWAY_SETTINGS.stripe).toEqual({ group: 'payments', category: 'stripe' })
    expect(getPaymentGatewaySettingsPath('stripe')).toBe('/settings?group=payments&category=stripe')
    expect(getPaymentGatewaySettingsPath('computop')).toBe('/settings?group=developers&category=plugin_computop')
    expect(getPaymentGatewaySettingsPath('paypal')).toBe('/settings?group=payments&category=paypal')
  })
})

describe('getPaymentGatewayKeyStatus', () => {
  it('treats a filled credential as configured', () => {
    expect(getPaymentGatewayKeyStatus({
      gateway: 'stripe',
      configs: {
        stripe_publishable: { key: 'stripe_publishable', value: 'pk_test' },
        stripe_secret: { key: 'stripe_secret', value: '' }
      }
    }).configured).toBe(true)
  })

  it('reports missing keys when credentials are empty', () => {
    expect(getPaymentGatewayKeyStatus({
      gateway: 'stripe',
      configs: {
        stripe_publishable: { key: 'stripe_publishable', value: '  ' }
      }
    }).configured).toBe(false)
  })

  it('returns missing when there are no related configs', () => {
    expect(getPaymentGatewayKeyStatus({ gateway: 'stripe', configs: {} })).toEqual({
      configured: false,
      keys: []
    })
  })
})
