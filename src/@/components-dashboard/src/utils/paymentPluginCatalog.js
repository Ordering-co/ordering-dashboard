export const PAYMENT_PLUGIN_CATALOG = [
  { key: 'paystack', gateway: 'paystack', name: 'Paystack', installUrl: 'https://paystack.plugins.orderingplus.com' },
  { key: 'globalpay', gateway: 'globalpay', name: 'GlobalPay', installUrl: 'https://globalpay.plugins.orderingplus.com' },
  { key: 'ecocash', gateway: 'ecocash', name: 'EcoCash', installUrl: 'https://ecocash.plugins.orderingplus.com' },
  { key: 'giftme', gateway: 'giftme', name: 'Giftme', installUrl: 'https://giftme.plugins.orderingplus.com' },
  { key: 'liqpay_integration', gateway: 'liqpay_integration', name: 'LiqPay', installUrl: 'https://liqpay.plugins.orderingplus.com' },
  { key: 'hyp', gateway: 'hyp', name: 'HYP', installUrl: 'https://hyp.plugins.orderingplus.com' },
  { key: 'hitpay', gateway: 'hitpay', name: 'HitPay', installUrl: 'https://hitpay.plugins.orderingplus.com' },
  { key: 'pagazul', gateway: 'pagazul', name: 'Pagazul', installUrl: 'https://pagazul.plugins.orderingplus.com' },
  { key: 'cybersource', gateway: 'cybersource', name: 'CyberSource', installUrl: 'https://cybersource.plugins.orderingplus.com' },
  { key: 'credibanco', gateway: 'credibanco', name: 'Credibanco', installUrl: 'https://credibanco.plugins.orderingplus.com' },
  { key: 'bpay', gateway: 'bpay', name: 'BPay', installUrl: 'https://bpay.plugins.orderingplus.com' },
  { key: 'freshpay', gateway: 'freshpay', name: 'FreshPay', installUrl: 'https://freshpay.plugins.orderingplus.com' },
  { key: 'redsys', gateway: 'redsys', name: 'Redsys', installUrl: 'https://redsys.plugins.orderingplus.com' },
  { key: 'yappy_paymethod', gateway: 'yappy_paymethod', name: 'Yappy', installUrl: 'https://yappy-paymethod.plugins.orderingplus.com' },
  { key: 'mercado_pago_checkout_pro', gateway: 'checkout_pro_mercadopago', name: 'Mercado Pago Checkout Pro', installUrl: 'https://mercado-pago-checkout-pro.plugins.orderingplus.com' },
  { key: 'square_redirect', gateway: 'square_redirect', name: 'Square Redirect', installUrl: 'https://square-redirect.plugins.orderingplus.com' },
  { key: 'izipay', gateway: 'izipay', name: 'Izipay', installUrl: 'https://integrations.ordering.co/izipay_paymethod' },
  { key: 'interswitch', gateway: 'interswitch', name: 'Interswitch', installUrl: 'https://integrations.ordering.co/interswitch_paymethod' },
  { key: 'computop', gateway: 'computop', name: 'Computop', installUrl: 'https://integrations.ordering.co/computop_paymethod' },
  { key: 'epayco', gateway: 'epayco', name: 'ePayco', installUrl: 'https://integrations.ordering.co/epayco_paymethod' }
]

export const isPaymentPluginInstalled = (plugins, pluginKey) => {
  if (!pluginKey || !Array.isArray(plugins)) return false
  return plugins.some(plugin => plugin?.key === pluginKey)
}

export const mergePaymethodsWithCatalog = ({
  paymethods = [],
  plugins = [],
  excludeGateways = [],
  includeCatalog = true
} = {}) => {
  const excluded = new Set(excludeGateways)
  const apiRows = (paymethods || [])
    .filter(paymethod => !excluded.has(paymethod?.gateway))
    .map(paymethod => ({
      ...paymethod,
      pluginKey: PAYMENT_PLUGIN_CATALOG.find(item => item.gateway === paymethod.gateway)?.key || null,
      installUrl: null,
      source: 'api',
      installState: 'ready'
    }))

  if (!includeCatalog) return apiRows

  const presentGateways = new Set(apiRows.map(row => row.gateway))
  const stubs = PAYMENT_PLUGIN_CATALOG
    .filter(item => (
      !excluded.has(item.gateway) &&
      !presentGateways.has(item.gateway) &&
      !isPaymentPluginInstalled(plugins, item.key)
    ))
    .map(item => ({
      id: null,
      name: item.name,
      gateway: item.gateway,
      pluginKey: item.key,
      installUrl: item.installUrl,
      source: 'catalog',
      installState: 'installable'
    }))

  return [...apiRows, ...stubs]
}

export const findPaymethodAfterInstall = (paymethods, pluginKey) => {
  const catalog = PAYMENT_PLUGIN_CATALOG.find(item => item.key === pluginKey)
  if (!catalog) return null
  const paymethod = (paymethods || []).find(item => item?.gateway === catalog.gateway)
  if (!paymethod?.id) return null
  return { id: paymethod.id, gateway: paymethod.gateway }
}

export const consumePendingInstallOpen = (pendingPluginKey, paymethods) => {
  if (!pendingPluginKey) return { pendingPluginKey: null, paymethod: null }
  const paymethod = findPaymethodAfterInstall(paymethods, pendingPluginKey)
  if (!paymethod) return { pendingPluginKey, paymethod: null }
  return { pendingPluginKey: null, paymethod }
}
