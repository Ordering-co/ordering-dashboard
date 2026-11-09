import { describe, expect, it } from 'vitest'
import {
  PAYMENT_PLUGIN_CATALOG,
  consumePendingInstallOpen,
  findPaymethodAfterInstall,
  isPaymentPluginInstalled,
  mergePaymethodsWithCatalog
} from '../paymentPluginCatalog'

describe('PAYMENT_PLUGIN_CATALOG', () => {
  it('has 16 unique keys, gateways, and install URLs', () => {
    expect(PAYMENT_PLUGIN_CATALOG).toHaveLength(16)
    const keys = PAYMENT_PLUGIN_CATALOG.map(item => item.key)
    const gateways = PAYMENT_PLUGIN_CATALOG.map(item => item.gateway)
    const urls = PAYMENT_PLUGIN_CATALOG.map(item => item.installUrl)
    expect(new Set(keys).size).toBe(16)
    expect(new Set(gateways).size).toBe(16)
    expect(new Set(urls).size).toBe(16)
    PAYMENT_PLUGIN_CATALOG.forEach(item => {
      expect(item.installUrl).toMatch(/^https:\/\//)
      expect(item.name).toBeTruthy()
    })
  })

  it('only offers plugins hosted on plugins.orderingplus.com, none of the legacy integrations server', () => {
    PAYMENT_PLUGIN_CATALOG.forEach(item => {
      expect(new URL(item.installUrl).hostname).toMatch(/\.plugins\.orderingplus\.com$/)
    })
    ;['izipay', 'interswitch', 'computop', 'epayco'].forEach(gateway => {
      expect(PAYMENT_PLUGIN_CATALOG.find(row => row.gateway === gateway)).toBeUndefined()
    })
  })

  it('keeps showing an installed payment method that is no longer in the catalog', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [{ id: 9, name: 'ePayco', gateway: 'epayco' }],
      plugins: []
    })
    const epayco = rows.find(row => row.gateway === 'epayco')
    expect(epayco).toMatchObject({ id: 9, source: 'api', installState: 'ready', pluginKey: null })
  })

  it('maps Mercado Pago Checkout Pro to its own gateway, not the legacy plugin one', () => {
    const item = PAYMENT_PLUGIN_CATALOG.find(row => row.key === 'mercado_pago_checkout_pro')
    expect(item.gateway).toBe('mercado_pago_checkout_pro')
  })
})

describe('isPaymentPluginInstalled', () => {
  it('matches plugin.key only', () => {
    expect(isPaymentPluginInstalled([{ key: 'paystack' }], 'paystack')).toBe(true)
    expect(isPaymentPluginInstalled([{ key: 'other' }], 'paystack')).toBe(false)
    expect(isPaymentPluginInstalled(null, 'paystack')).toBe(false)
  })
})

describe('mergePaymethodsWithCatalog', () => {
  const paystackPaymethod = { id: 11, name: 'Paystack', gateway: 'paystack' }
  const cash = { id: 1, name: 'Cash', gateway: 'cash' }

  it('keeps API paymethods as ready rows', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash, paystackPaymethod],
      plugins: [{ key: 'paystack' }],
      excludeGateways: [],
      includeCatalog: true
    })
    expect(rows.find(row => row.gateway === 'cash')).toMatchObject({
      source: 'api',
      installState: 'ready',
      id: 1
    })
    expect(rows.filter(row => row.gateway === 'paystack')).toHaveLength(1)
    expect(rows.find(row => row.gateway === 'paystack').installState).toBe('ready')
  })

  it('adds an installable stub when the plugin and paymethod are missing', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash],
      plugins: [],
      excludeGateways: [],
      includeCatalog: true
    })
    const paystack = rows.find(row => row.pluginKey === 'paystack')
    expect(paystack).toMatchObject({
      id: null,
      source: 'catalog',
      installState: 'installable',
      installUrl: 'https://paystack.plugins.orderingplus.com'
    })
  })

  it('hides catalog rows when the plugin is already installed', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash],
      plugins: [{ key: 'paystack' }],
      excludeGateways: [],
      includeCatalog: true
    })
    expect(rows.some(row => row.pluginKey === 'paystack' || row.gateway === 'paystack')).toBe(false)
  })

  it('does not add catalog rows when includeCatalog is false', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash],
      plugins: [],
      excludeGateways: [],
      includeCatalog: false
    })
    expect(rows).toEqual([
      expect.objectContaining({ gateway: 'cash', source: 'api' })
    ])
  })

  it('drops excluded gateways from API and catalog', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash, paystackPaymethod],
      plugins: [],
      excludeGateways: ['paystack'],
      includeCatalog: true
    })
    expect(rows.some(row => row.gateway === 'paystack' || row.pluginKey === 'paystack')).toBe(false)
  })

  it('offers Mercado Pago Checkout Pro when the legacy Mercado Pago gateway is hidden', () => {
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash],
      plugins: [],
      excludeGateways: ['checkout_pro_mercadopago'],
      includeCatalog: true
    })
    expect(rows.find(row => row.pluginKey === 'mercado_pago_checkout_pro')).toMatchObject({
      gateway: 'mercado_pago_checkout_pro',
      source: 'catalog',
      installState: 'installable'
    })
  })

  it('offers Mercado Pago Checkout Pro next to an installed legacy Mercado Pago', () => {
    const legacy = { id: 9, name: 'Checkout-pro Mercadopago', gateway: 'checkout_pro_mercadopago' }
    const rows = mergePaymethodsWithCatalog({
      paymethods: [cash, legacy],
      plugins: [{ key: 'mercadopago' }],
      excludeGateways: [],
      includeCatalog: true
    })
    expect(rows.find(row => row.gateway === 'checkout_pro_mercadopago')).toMatchObject({
      source: 'api',
      pluginKey: null
    })
    expect(rows.find(row => row.pluginKey === 'mercado_pago_checkout_pro')).toMatchObject({
      source: 'catalog',
      installState: 'installable'
    })
  })
})

describe('findPaymethodAfterInstall', () => {
  it('returns the API paymethod for a catalog plugin key', () => {
    expect(findPaymethodAfterInstall([
      { id: 1, gateway: 'cash' },
      { id: 11, gateway: 'paystack' }
    ], 'paystack')).toEqual({ id: 11, gateway: 'paystack' })
  })

  it('returns null when the paymethod is not in the list yet', () => {
    expect(findPaymethodAfterInstall([{ id: 1, gateway: 'cash' }], 'paystack')).toBeNull()
    expect(findPaymethodAfterInstall([{ id: 11, gateway: 'paystack' }], 'unknown')).toBeNull()
    expect(findPaymethodAfterInstall([{ gateway: 'paystack' }], 'paystack')).toBeNull()
  })

  it('opens the new Mercado Pago paymethod, not the legacy one', () => {
    expect(findPaymethodAfterInstall([
      { id: 9, gateway: 'checkout_pro_mercadopago' },
      { id: 12, gateway: 'mercado_pago_checkout_pro' }
    ], 'mercado_pago_checkout_pro')).toEqual({ id: 12, gateway: 'mercado_pago_checkout_pro' })
  })
})

describe('consumePendingInstallOpen', () => {
  const paymethods = [{ id: 11, gateway: 'paystack' }]

  it('keeps the pending key until the paymethod appears, then opens once', () => {
    expect(consumePendingInstallOpen(null, paymethods)).toEqual({
      pendingPluginKey: null,
      paymethod: null
    })
    expect(consumePendingInstallOpen('paystack', [])).toEqual({
      pendingPluginKey: 'paystack',
      paymethod: null
    })
    expect(consumePendingInstallOpen('paystack', paymethods)).toEqual({
      pendingPluginKey: null,
      paymethod: { id: 11, gateway: 'paystack' }
    })
  })
})
