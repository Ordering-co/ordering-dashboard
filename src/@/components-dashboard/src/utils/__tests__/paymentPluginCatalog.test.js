import { describe, expect, it } from 'vitest'
import {
  PAYMENT_PLUGIN_CATALOG,
  consumePendingInstallOpen,
  findPaymethodAfterInstall,
  isPaymentPluginInstalled,
  mergePaymethodsWithCatalog
} from '../paymentPluginCatalog'

describe('PAYMENT_PLUGIN_CATALOG', () => {
  it('has 20 unique keys, gateways, and install URLs', () => {
    expect(PAYMENT_PLUGIN_CATALOG).toHaveLength(20)
    const keys = PAYMENT_PLUGIN_CATALOG.map(item => item.key)
    const gateways = PAYMENT_PLUGIN_CATALOG.map(item => item.gateway)
    const urls = PAYMENT_PLUGIN_CATALOG.map(item => item.installUrl)
    expect(new Set(keys).size).toBe(20)
    expect(new Set(gateways).size).toBe(20)
    expect(new Set(urls).size).toBe(20)
    PAYMENT_PLUGIN_CATALOG.forEach(item => {
      expect(item.installUrl).toMatch(/^https:\/\//)
      expect(item.name).toBeTruthy()
    })
  })

  it('maps Mercado Pago Checkout Pro plugin key to the dashboard gateway', () => {
    const item = PAYMENT_PLUGIN_CATALOG.find(row => row.key === 'mercado_pago_checkout_pro')
    expect(item.gateway).toBe('checkout_pro_mercadopago')
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
      paymethods: [cash, { id: 9, name: 'Mercado Pago', gateway: 'checkout_pro_mercadopago' }],
      plugins: [],
      excludeGateways: ['checkout_pro_mercadopago'],
      includeCatalog: true
    })
    expect(rows.some(row => row.gateway === 'checkout_pro_mercadopago')).toBe(false)
    expect(rows.some(row => row.pluginKey === 'mercado_pago_checkout_pro')).toBe(false)
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
