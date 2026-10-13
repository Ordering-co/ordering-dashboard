import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MERCADO_PAGO_ADMIN_ONLY_FIELDS,
  MERCADO_PAGO_CONNECT_GATEWAY,
  MERCADO_PAGO_PLUGIN_URL,
  filterPaymethodFieldsByRole,
  getMercadoPagoSetupUrl,
  isMercadoPagoAdminOnlyField,
  isMercadoPagoConnectGateway,
  openMercadoPagoSetupPopup
} from '../mercadoPagoConnect'

describe('openMercadoPagoSetupPopup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the setup url in a sized popup window', () => {
    const popup = { focus: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)

    const result = openMercadoPagoSetupPopup('https://example.com/setup')

    expect(open).toHaveBeenCalledTimes(1)
    const [url, target, features] = open.mock.calls[0]
    expect(url).toBe('https://example.com/setup')
    expect(target).toBe('mercado_pago_setup')
    expect(features).toMatch(/width=\d+/)
    expect(features).toMatch(/height=\d+/)
    expect(features).toContain('scrollbars=yes')
    expect(popup.focus).toHaveBeenCalled()
    expect(result).toBe(popup)
  })

  it('does nothing without a url', () => {
    const open = vi.spyOn(window, 'open')
    expect(openMercadoPagoSetupPopup(null)).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('isMercadoPagoConnectGateway', () => {
  it('matches only the Checkout Pro plugin gateway', () => {
    expect(MERCADO_PAGO_CONNECT_GATEWAY).toBe('mercado_pago_checkout_pro')
    expect(isMercadoPagoConnectGateway('mercado_pago_checkout_pro')).toBe(true)
    expect(isMercadoPagoConnectGateway('checkout_pro_mercadopago')).toBe(false)
    expect(isMercadoPagoConnectGateway('stripe_connect')).toBe(false)
    expect(isMercadoPagoConnectGateway(undefined)).toBe(false)
  })
})

describe('getMercadoPagoSetupUrl', () => {
  it('builds the setup url with project code and business id', () => {
    expect(getMercadoPagoSetupUrl({ project: 'kosherkav', businessId: 42 })).toBe(
      `${MERCADO_PAGO_PLUGIN_URL}/kosherkav/views/setup?business_id=42`
    )
  })

  it('encodes the project code', () => {
    expect(getMercadoPagoSetupUrl({ project: 'my project', businessId: 1 })).toBe(
      `${MERCADO_PAGO_PLUGIN_URL}/my%20project/views/setup?business_id=1`
    )
  })

  it('returns null when project or business id is missing', () => {
    expect(getMercadoPagoSetupUrl({ project: 'demo', businessId: undefined })).toBeNull()
    expect(getMercadoPagoSetupUrl({ project: '', businessId: 5 })).toBeNull()
    expect(getMercadoPagoSetupUrl({})).toBeNull()
  })
})

describe('isMercadoPagoAdminOnlyField', () => {
  it('flags the marketplace fee only on the Checkout Pro plugin gateway', () => {
    expect(MERCADO_PAGO_ADMIN_ONLY_FIELDS).toContain('marketplace_fee_percent')
    expect(isMercadoPagoAdminOnlyField('mercado_pago_checkout_pro', 'marketplace_fee_percent')).toBe(true)
    expect(isMercadoPagoAdminOnlyField('mercado_pago_checkout_pro', 'access_token')).toBe(false)
    expect(isMercadoPagoAdminOnlyField('checkout_pro_mercadopago', 'marketplace_fee_percent')).toBe(false)
    expect(isMercadoPagoAdminOnlyField('stripe_connect', 'marketplace_fee_percent')).toBe(false)
    expect(isMercadoPagoAdminOnlyField(undefined, undefined)).toBe(false)
  })
})

describe('filterPaymethodFieldsByRole', () => {
  const fields = [
    { key: 'marketplace_fee_percent', name: 'Marketplace Fee %' },
    { key: 'other', name: 'Other' }
  ]

  it('keeps every field for admins', () => {
    expect(filterPaymethodFieldsByRole(fields, { gateway: 'mercado_pago_checkout_pro', userLevel: 0 })).toEqual(fields)
  })

  it('hides the marketplace fee from business owners on the Mercado Pago gateway', () => {
    expect(filterPaymethodFieldsByRole(fields, { gateway: 'mercado_pago_checkout_pro', userLevel: 2 })).toEqual([fields[1]])
  })

  it('hides the fee for any non-admin level, including an unknown user', () => {
    expect(filterPaymethodFieldsByRole(fields, { gateway: 'mercado_pago_checkout_pro', userLevel: undefined })).toEqual([fields[1]])
  })

  it('leaves other gateways untouched for business owners', () => {
    expect(filterPaymethodFieldsByRole(fields, { gateway: 'stripe_connect', userLevel: 2 })).toEqual(fields)
    expect(filterPaymethodFieldsByRole(fields, { gateway: 'checkout_pro_mercadopago', userLevel: 2 })).toEqual(fields)
  })

  it('returns an empty list for non-array input', () => {
    expect(filterPaymethodFieldsByRole(undefined, { gateway: 'mercado_pago_checkout_pro', userLevel: 2 })).toEqual([])
  })
})
